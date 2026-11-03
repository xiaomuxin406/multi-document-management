import threading
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from .config import Settings
from .db import Base, database
from .models import ResearchTask, TaskEvent
from .auth import router as auth_router, hash_password
from .api import projects, documents, tasks, admin, reports
from .services.retrieval import HybridRetriever
from .services.providers import OpenAIEmbeddings


def create_app(database_url=None, data_dir=None, testing=False):
    settings = Settings()
    if testing:
        settings.llm_api_key = settings.tavily_api_key = settings.embedding_api_key = ""
        settings.embedding_model = ""
    if data_dir is not None:
        settings.data_dir = Path(data_dir)
    if database_url:
        settings.database_url = database_url
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    engine, sessions = database(settings.database_url)
    # Test databases are transient. Persistent databases are managed with Alembic.
    if testing:
        Base.metadata.create_all(engine)

    @asynccontextmanager
    async def lifespan(app):
        if not testing:
            from alembic.config import Config
            from alembic import command

            config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
            config.set_main_option(
                "sqlalchemy.url", settings.database_url.replace("%", "%%")
            )
            command.upgrade(config, "head")
        with app.state.task_lock, sessions() as db:
            for task in db.scalars(
                select(ResearchTask).where(
                    ResearchTask.status.in_(["queued", "running"])
                )
            ):
                task.status, task.stage, task.error = (
                    "failed",
                    "failed",
                    "服务重启中断了任务，请点击重试",
                )
                db.add(TaskEvent(task_id=task.id, kind="failed", message=task.error))
            db.commit()
        embedding = (
            OpenAIEmbeddings(
                settings.embedding_base_url,
                settings.embedding_model,
                settings.embedding_api_key or settings.llm_api_key,
            )
            if settings.embedding_model
            else None
        )
        app.state.retriever = HybridRetriever(
            sessions, settings.data_dir / "chroma", embedding
        )
        # Reconcile missing vector IDs after interrupted writes or embedding model changes.
        from .models import Chunk, Document

        with sessions() as db:
            chunks = db.scalars(
                select(Chunk).join(Document).where(Document.status == "ready")
            ).all()
            existing = set(app.state.retriever.collection.get(include=[])["ids"])
            app.state.retriever.index(
                [chunk for chunk in chunks if chunk.id not in existing]
            )
        app.state.executor = ThreadPoolExecutor(
            max_workers=2, thread_name_prefix="research"
        )
        yield
        # Cooperative cancellation before waiting for bounded provider calls.
        with app.state.task_lock, sessions() as db:
            for task in db.scalars(
                select(ResearchTask).where(
                    ResearchTask.status.in_(["queued", "running"])
                )
            ):
                task.status, task.stage, task.error = (
                    "failed",
                    "failed",
                    "服务已关闭，请重试",
                )
            db.commit()
        app.state.executor.shutdown(wait=True, cancel_futures=True)
        engine.dispose()

    app = FastAPI(title="研序 Research Workspace", version="0.1.0", lifespan=lifespan)
    app.state.settings, app.state.sessions = settings, sessions
    app.state.task_lock, app.state.admin_lock = threading.RLock(), threading.RLock()
    app.state.dummy_password = hash_password("dummy-password-never-valid")
    attempts, attempt_lock = defaultdict(deque), threading.Lock()

    @app.middleware("http")
    async def boundaries(request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            origin = request.headers.get("origin")
            allowed_origins = {
                item.strip() for item in settings.trusted_origins.split(",")
            }
            if (
                origin
                and urlparse(origin).netloc != request.headers.get("host")
                and origin not in allowed_origins
            ):
                return JSONResponse({"detail": "不允许跨站写入请求"}, status_code=403)
            if request.headers.get("sec-fetch-site") == "cross-site":
                return JSONResponse({"detail": "不允许跨站写入请求"}, status_code=403)
        if (
            request.url.path
            in ("/api/auth/login", "/api/auth/register", "/api/auth/setup")
            and request.method == "POST"
        ):
            key = request.client.host if request.client else "unknown"
            with attempt_lock:
                current = time.monotonic()
                history = attempts[key]
                while history and history[0] < current - 60:
                    history.popleft()
                if len(history) >= (1000 if testing else 20):
                    return JSONResponse(
                        {"detail": "请求过于频繁，请一分钟后重试"}, status_code=429
                    )
                history.append(current)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Cache-Control"] = "no-store"
        return response

    for router in (
        auth_router,
        projects.router,
        documents.router,
        tasks.router,
        admin.router,
        reports.router,
    ):
        app.include_router(router, prefix="/api")

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": "0.1.0"}

    @app.get("/api/capabilities")
    def capabilities():
        return {
            "llm_configured": bool(settings.llm_api_key),
            "search_configured": bool(settings.tavily_api_key),
            "mode": "llm" if settings.llm_api_key else "extractive",
            "embedding_mode": "semantic_api"
            if settings.embedding_model
            else "local_lexical",
        }

    return app


app = create_app()
