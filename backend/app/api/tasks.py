from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from ..auth import current_user, db_session
from ..models import ResearchTask, TaskEvent
from ..schemas import TaskInput
from ..services.providers import OpenAICompatible, TavilySearch
from ..services.research import ResearchRunner
from .common import own_project, own_task, serialize, system_settings

router = APIRouter(tags=["research"])


def task_out(row):
    return serialize(row, ("evidence", "outline", "gaps", "memory"))


def submit(request, row, db):
    config = system_settings(db, request.app.state.settings)
    settings = request.app.state.settings
    llm = (
        OpenAICompatible(
            config["llm_base_url"],
            config["llm_model"],
            settings.llm_api_key,
            timeout_seconds=settings.llm_timeout_seconds,
            enable_thinking=settings.llm_enable_thinking,
        )
        if settings.llm_api_key
        else None
    )
    search = TavilySearch(settings.tavily_api_key) if settings.tavily_api_key else None
    runner = ResearchRunner(
        request.app.state.sessions,
        request.app.state.retriever,
        llm,
        search,
        row.id,
        config["search_max_results"],
        request.app.state.task_lock,
    )
    request.app.state.executor.submit(runner.run)


def available(request, db, web_enabled, exclude_id=None):
    if web_enabled and not request.app.state.settings.tavily_api_key:
        raise HTTPException(
            409,
            "联网搜索未配置，请管理员设置 TAVILY_API_KEY 并重启服务，或关闭联网搜索",
        )
    query = (
        select(func.count())
        .select_from(ResearchTask)
        .where(ResearchTask.status.in_(["queued", "running"]))
    )
    if exclude_id:
        query = query.where(ResearchTask.id != exclude_id)
    if db.scalar(query) >= 8:
        raise HTTPException(429, "任务队列已满，请稍后重试")


@router.get("/projects/{project_id}/tasks")
def tasks(project_id: str, user=Depends(current_user), db=Depends(db_session)):
    own_project(db, project_id, user)
    return [
        task_out(row)
        for row in db.scalars(
            select(ResearchTask)
            .where(ResearchTask.project_id == project_id)
            .order_by(ResearchTask.created_at.desc())
        )
    ]


@router.post("/projects/{project_id}/tasks", status_code=202)
def create_task(
    project_id: str,
    body: TaskInput,
    request: Request,
    user=Depends(current_user),
    db=Depends(db_session),
):
    own_project(db, project_id, user)
    with request.app.state.task_lock:
        available(request, db, body.web_enabled)
        row = ResearchTask(
            project_id=project_id,
            mode="llm" if request.app.state.settings.llm_api_key else "extractive",
            **body.model_dump(),
        )
        db.add(row)
        db.commit()
        result = task_out(row)
        submit(request, row, db)
    return result


@router.get("/tasks/{task_id}")
def detail(task_id: str, user=Depends(current_user), db=Depends(db_session)):
    row = own_task(db, task_id, user)
    events = db.scalars(
        select(TaskEvent)
        .where(TaskEvent.task_id == row.id)
        .order_by(TaskEvent.created_at, TaskEvent.id)
    ).all()
    return {
        **task_out(row),
        "events": [serialize(event, ("task_id",)) for event in events],
        "evidence": row.evidence,
        "gaps": row.gaps,
        "outline": row.outline,
    }


@router.post("/tasks/{task_id}/cancel")
def cancel(
    task_id: str, request: Request, user=Depends(current_user), db=Depends(db_session)
):
    with request.app.state.task_lock:
        row = own_task(db, task_id, user)
        if row.status not in ("queued", "running"):
            raise HTTPException(409, "只有等待中或运行中的任务可以取消")
        row.status, row.stage = "cancelled", "cancelled"
        db.add(
            TaskEvent(
                task_id=row.id,
                kind="cancelled",
                message="用户取消任务；正在进行的外部请求返回后退出",
            )
        )
        db.commit()
        return task_out(row)


@router.post("/tasks/{task_id}/retry", status_code=202)
def retry(
    task_id: str, request: Request, user=Depends(current_user), db=Depends(db_session)
):
    with request.app.state.task_lock:
        row = own_task(db, task_id, user)
        if row.status not in ("failed", "cancelled"):
            raise HTTPException(409, "只有失败或取消的任务可以重试")
        available(request, db, row.web_enabled, row.id)
        # Create a fresh run so an in-flight cancelled worker cannot mutate its replacement.
        replacement = ResearchTask(
            project_id=row.project_id,
            title=row.title,
            instructions=row.instructions,
            language=row.language,
            report_type=row.report_type,
            web_enabled=row.web_enabled,
            max_rounds=row.max_rounds,
            mode="llm" if request.app.state.settings.llm_api_key else "extractive",
        )
        db.add(replacement)
        db.commit()
        result = task_out(replacement)
        submit(request, replacement, db)
        return result
