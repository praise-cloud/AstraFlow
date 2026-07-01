import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from backend.db.database import get_db, Base
from backend.models.user import User, BusinessType, FuelType
from backend.services.auth import hash_password, verify_password, create_access_token, decode_access_token
from fastapi import Header
import threading

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    business_type: str
    fuel_type: str = "petrol"


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    business_type: Optional[str] = None
    fuel_type: Optional[str] = None


def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    user_id = decode_access_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def _user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "business_type": user.business_type,
        "fuel_type": user.fuel_type,
        "avatar_url": user.avatar_url,
    }


def _warmup_ml():
    from backend.ml.forecast import get_forecaster
    get_forecaster()


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not req.full_name or not req.full_name.strip():
        raise HTTPException(status_code=400, detail="Full name is required")
    if req.business_type not in [e.value for e in BusinessType]:
        raise HTTPException(status_code=400, detail="Invalid business type")
    if req.fuel_type not in [e.value for e in FuelType]:
        raise HTTPException(status_code=400, detail="Invalid fuel type")

    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            full_name=req.full_name.strip(),
            business_type=req.business_type,
            fuel_type=req.fuel_type,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    token = create_access_token(str(user.id))

    threading.Thread(target=_warmup_ml, daemon=True).start()

    return {"token": token, "user": _user_dict(user)}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(user.id))

    threading.Thread(target=_warmup_ml, daemon=True).start()

    return {"token": token, "user": _user_dict(user)}


@router.get("/profile")
def get_profile(
    user: User = Depends(get_current_user),
):
    return _user_dict(user)


@router.put("/profile")
def update_profile(
    req: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.full_name is not None:
        user.full_name = req.full_name
    if req.business_type is not None:
        if req.business_type not in [e.value for e in BusinessType]:
            raise HTTPException(status_code=400, detail="Invalid business type")
        user.business_type = req.business_type
    if req.fuel_type is not None:
        if req.fuel_type not in [e.value for e in FuelType]:
            raise HTTPException(status_code=400, detail="Invalid fuel type")
        user.fuel_type = req.fuel_type

    db.commit()
    db.refresh(user)
    return _user_dict(user)


UPLOAD_DIR = "uploads/avatars"


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg"
    filename = f"{user.id}_{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    avatar_url = f"/static/avatars/{filename}"
    user.avatar_url = avatar_url
    db.commit()
    db.refresh(user)
    return {"avatar_url": avatar_url}


@router.delete("/avatar")
def delete_avatar(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.avatar_url:
        fname = user.avatar_url.split("/")[-1]
        fpath = os.path.join(UPLOAD_DIR, fname)
        if os.path.exists(fpath):
            os.remove(fpath)
    user.avatar_url = None
    db.commit()
    return {"avatar_url": None}
