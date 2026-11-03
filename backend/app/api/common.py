from fastapi import HTTPException
from sqlalchemy import select
from ..models import Project, Document, ResearchTask, Report, SystemSetting
from ..config import public_defaults


def serialize(row, exclude=()):
    return {
        column.name: getattr(row, column.name)
        for column in row.__table__.columns
        if column.name not in exclude
    }


def own_project(db, project_id, user):
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id)
    )
    if not project:
        raise HTTPException(404, "项目不存在")
    return project


def own_document(db, document_id, user):
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(404, "资料不存在")
    own_project(db, document.project_id, user)
    return document


def own_task(db, task_id, user):
    task = db.get(ResearchTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    own_project(db, task.project_id, user)
    return task


def own_report(db, report_id, user):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(404, "报告不存在")
    own_task(db, report.task_id, user)
    return report


def system_settings(db, settings):
    result = public_defaults(settings)
    saved = db.get(SystemSetting, "providers")
    if saved:
        result.update(saved.value)
    result["embedding_model"] = settings.embedding_model
    return result
