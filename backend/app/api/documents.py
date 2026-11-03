import hashlib
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy import select, func, delete
from sqlalchemy.exc import IntegrityError
from ..auth import current_user, db_session
from ..models import Document, Chunk, ResearchTask
from ..services.parsing import parse_document, ALLOWED
from ..services.classification import classify_document
from .common import own_project, own_document, serialize, system_settings

router = APIRouter(tags=["documents"])


def document_out(row):
    return {**serialize(row, ("sha256",)), **classify_document(row.name, row.summary)}


@router.get("/projects/{project_id}/documents")
def documents(project_id: str, user=Depends(current_user), db=Depends(db_session)):
    own_project(db, project_id, user)
    return [
        document_out(row)
        for row in db.scalars(
            select(Document)
            .where(Document.project_id == project_id)
            .order_by(Document.created_at.desc())
        )
    ]


@router.post("/projects/{project_id}/documents", status_code=201)
def upload(
    project_id: str,
    request: Request,
    files: list[UploadFile] = File(...),
    user=Depends(current_user),
    db=Depends(db_session),
):
    own_project(db, project_id, user)
    if len(files) > 20:
        raise HTTPException(400, "每批最多上传 20 个文件")
    limit = (
        system_settings(db, request.app.state.settings)["max_upload_mb"] * 1024 * 1024
    )
    prepared, total_size = [], 0
    for file in files:
        name = (file.filename or "untitled").replace("\\", "/").split("/")[-1][:255]
        if Path(name).suffix.lower() not in ALLOWED:
            raise HTTPException(400, f"{name}：仅支持 PDF、DOCX、Markdown 和 TXT")
        # A synchronous route runs in Starlette's thread pool. The parser, index
        # and its database session remain on this worker, never on the event loop.
        payload = file.file.read(limit + 1)
        file.file.close()
        total_size += len(payload)
        if len(payload) > limit or total_size > limit * 4:
            raise HTTPException(
                413, f"单文件上限 {limit // 1024 // 1024} MB，单批上限为其四倍"
            )
        if not payload:
            raise HTTPException(400, f"{name} 是空文件")
        prepared.append(
            (name, payload, file.content_type or "application/octet-stream")
        )
    result = []
    for name, payload, media_type in prepared:
        hashed = hashlib.sha256(payload).hexdigest()
        previous = db.scalar(
            select(Document).where(
                Document.project_id == project_id, Document.sha256 == hashed
            )
        )
        if previous:
            result.append(document_out(previous))
            continue
        row = Document(
            project_id=project_id,
            name=name,
            sha256=hashed,
            media_type=media_type,
            size=len(payload),
        )
        chunks = []
        try:
            parsed = parse_document(name, payload)
            count = db.scalar(
                select(func.count())
                .select_from(Chunk)
                .where(Chunk.project_id == project_id)
            )
            if count + len(parsed) > request.app.state.settings.max_project_chunks:
                raise ValueError("项目文本块已达容量上限，请删除不再需要的资料")
            db.add(row)
            db.flush()
            chunks = [
                Chunk(document_id=row.id, project_id=project_id, **part)
                for part in parsed
            ]
            db.add_all(chunks)
            db.flush()
            request.app.state.retriever.index(chunks)
            row.summary = " ".join(part["text"] for part in parsed)[:400]
            row.chunk_count, row.status = len(parsed), "ready"
        except IntegrityError:
            db.rollback()
            previous = db.scalar(
                select(Document).where(
                    Document.project_id == project_id, Document.sha256 == hashed
                )
            )
            if previous:
                result.append(document_out(previous))
                continue
            raise HTTPException(409, "资料写入冲突，请重试")
        except Exception as error:
            db.rollback()
            if row.id:
                request.app.state.retriever.remove_document(row.id)
            row = Document(
                project_id=project_id,
                name=name,
                sha256=hashed,
                media_type=media_type,
                size=len(payload),
                status="failed",
                error=str(error)[:300]
                if isinstance(error, ValueError)
                else "解析或索引失败，请检查文件是否损坏",
            )
            logging.getLogger(__name__).warning(
                "Document processing failed: %s", type(error).__name__
            )
            db.add(row)
        db.commit()
        result.append(document_out(row))
    return result


@router.get("/documents/{document_id}")
def detail(document_id: str, user=Depends(current_user), db=Depends(db_session)):
    row = own_document(db, document_id, user)
    chunks = db.scalars(select(Chunk).where(Chunk.document_id == row.id)).all()
    return {
        **document_out(row),
        "chunks": [serialize(chunk, ("project_id", "document_id")) for chunk in chunks],
    }


@router.delete("/documents/{document_id}")
def remove(
    document_id: str,
    request: Request,
    user=Depends(current_user),
    db=Depends(db_session),
):
    with request.app.state.task_lock:
        row = own_document(db, document_id, user)
        active = db.scalar(
            select(ResearchTask).where(
                ResearchTask.project_id == row.project_id,
                ResearchTask.status.in_(["queued", "running"]),
            )
        )
        if active:
            raise HTTPException(
                409, "项目有研究任务运行中，请先取消或等待完成后再删除资料"
            )
        request.app.state.retriever.remove_document(row.id)
        db.execute(delete(Chunk).where(Chunk.document_id == row.id))
        db.delete(row)
        db.commit()
    return {"ok": True}
