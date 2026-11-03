from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func, delete
from ..auth import administrator, db_session, user_out
from ..models import User, SystemSetting, AuthSession
from ..schemas import UserUpdate, SettingsInput
from .common import system_settings

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
def users(admin=Depends(administrator), db=Depends(db_session)):
    return [user_out(row) for row in db.scalars(select(User).order_by(User.created_at))]


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    body: UserUpdate,
    request: Request,
    admin=Depends(administrator),
    db=Depends(db_session),
):
    with request.app.state.admin_lock:
        row = db.get(User, user_id)
        if not row:
            raise HTTPException(404, "用户不存在")
        active_admins = db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == "admin", User.is_active.is_(True))
        )
        if (
            row.role == "admin"
            and row.is_active
            and active_admins <= 1
            and (body.role == "member" or body.is_active is False)
        ):
            raise HTTPException(409, "不能降级或停用最后一位有效管理员")
        for key, value in body.model_dump(exclude_none=True).items():
            setattr(row, key, value)
        if body.is_active is False:
            db.execute(delete(AuthSession).where(AuthSession.user_id == row.id))
        db.commit()
        return user_out(row)


@router.get("/settings")
def settings(request: Request, admin=Depends(administrator), db=Depends(db_session)):
    return {
        **system_settings(db, request.app.state.settings),
        "llm_configured": bool(request.app.state.settings.llm_api_key),
        "search_configured": bool(request.app.state.settings.tavily_api_key),
    }


@router.put("/settings")
def update_settings(
    body: SettingsInput,
    request: Request,
    admin=Depends(administrator),
    db=Depends(db_session),
):
    if body.embedding_model != request.app.state.settings.embedding_model:
        raise HTTPException(
            409,
            "Embedding 模型请通过 .env 的 EMBEDDING_MODEL 修改并重启，以重建独立索引",
        )
    saved = db.get(SystemSetting, "providers")
    value = body.model_dump()
    value.pop("embedding_model", None)
    if saved:
        saved.value = value
    else:
        db.add(SystemSetting(key="providers", value=value))
    db.commit()
    return {
        **value,
        "embedding_model": request.app.state.settings.embedding_model,
        "llm_configured": bool(request.app.state.settings.llm_api_key),
        "search_configured": bool(request.app.state.settings.tavily_api_key),
    }
