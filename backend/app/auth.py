import hashlib
import hmac
import secrets
import time
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from .models import User, AuthSession, SystemSetting
from .schemas import Registration, Credentials

router = APIRouter(prefix="/auth", tags=["auth"])


def db_session(request: Request):
    with request.app.state.sessions() as session:
        yield session


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1
    ).hex()
    return salt + ":" + hashed


def check_password(password, stored):
    salt, expected = stored.split(":")
    actual = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1
    ).hex()
    return hmac.compare_digest(actual, expected)


def user_out(user):
    return {
        key: getattr(user, key)
        for key in ("id", "name", "email", "role", "is_active", "created_at")
    }


def current_user(request: Request, db=Depends(db_session)):
    token = request.cookies.get("rw_session", "")
    auth = db.get(AuthSession, digest(token)) if token else None
    user = (
        db.get(User, auth.user_id) if auth and auth.expires_at > time.time() else None
    )
    if not user or not user.is_active:
        raise HTTPException(401, "请先登录")
    return user


def administrator(user=Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "需要管理员权限")
    return user


def issue_session(request, response, db, user):
    token = secrets.token_urlsafe(32)
    days = request.app.state.settings.session_days
    db.add(
        AuthSession(
            token_hash=digest(token),
            user_id=user.id,
            expires_at=time.time() + days * 86400,
        )
    )
    db.commit()
    response.set_cookie(
        "rw_session",
        token,
        max_age=days * 86400,
        httponly=True,
        secure=request.app.state.settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return user_out(user)


@router.get("/status")
def status(db=Depends(db_session)):
    return {
        "setup_required": not bool(db.scalar(select(func.count()).select_from(User)))
    }


def register_user(body, request, response, db, setup):
    count = db.scalar(select(func.count()).select_from(User))
    if setup and count:
        raise HTTPException(409, "管理员已初始化，请登录或注册普通账号")
    if not setup and not count:
        raise HTTPException(409, "请先初始化管理员")
    if db.scalar(select(User).where(User.email == body.email)):
        raise HTTPException(409, "该邮箱已注册")
    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role="admin" if setup else "member",
    )
    try:
        if setup:
            # A unique marker makes concurrent first-admin requests mutually exclusive.
            db.add(SystemSetting(key="initialized", value={"done": True}))
        db.add(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "账号或管理员已存在")
    return issue_session(request, response, db, user)


@router.post("/setup", status_code=201)
def setup(
    body: Registration, request: Request, response: Response, db=Depends(db_session)
):
    return register_user(body, request, response, db, True)


@router.post("/register", status_code=201)
def register(
    body: Registration, request: Request, response: Response, db=Depends(db_session)
):
    return register_user(body, request, response, db, False)


@router.post("/login")
def login(
    body: Credentials, request: Request, response: Response, db=Depends(db_session)
):
    user = db.scalar(select(User).where(User.email == body.email))
    # Perform password work even on unknown users to reduce timing differences.
    valid = (
        check_password(body.password, user.password_hash)
        if user
        else check_password(body.password, request.app.state.dummy_password)
    )
    if not user or not valid or not user.is_active:
        raise HTTPException(401, "邮箱或密码错误，或账号已停用")
    return issue_session(request, response, db, user)


@router.get("/me")
def me(user=Depends(current_user)):
    return user_out(user)


@router.post("/logout")
def logout(request: Request, response: Response, db=Depends(db_session)):
    token = request.cookies.get("rw_session", "")
    auth = db.get(AuthSession, digest(token))
    if auth:
        db.delete(auth)
        db.commit()
    response.delete_cookie("rw_session", path="/")
    return {"ok": True}
