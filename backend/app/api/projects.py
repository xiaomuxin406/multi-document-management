from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from ..auth import current_user, db_session
from ..models import Project, Document, ResearchTask
from ..schemas import ProjectInput
from .common import serialize

router = APIRouter(tags=["projects"])


def project_out(db, row):
    return {
        **serialize(row, ("owner_id",)),
        "document_count": db.scalar(
            select(func.count())
            .select_from(Document)
            .where(Document.project_id == row.id)
        ),
        "task_count": db.scalar(
            select(func.count())
            .select_from(ResearchTask)
            .where(ResearchTask.project_id == row.id)
        ),
    }


@router.get("/projects")
def projects(user=Depends(current_user), db=Depends(db_session)):
    return [
        project_out(db, row)
        for row in db.scalars(
            select(Project)
            .where(Project.owner_id == user.id)
            .order_by(Project.created_at.desc())
        )
    ]


@router.post("/projects", status_code=201)
def create_project(
    body: ProjectInput, user=Depends(current_user), db=Depends(db_session)
):
    row = Project(owner_id=user.id, **body.model_dump())
    db.add(row)
    db.commit()
    return project_out(db, row)
