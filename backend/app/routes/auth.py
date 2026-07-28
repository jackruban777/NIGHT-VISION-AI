from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
import jwt
import datetime
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginSchema(BaseModel):
    email: str
    password: str

class RegisterSchema(BaseModel):
    name: str
    email: str
    password: str

@router.post("/login")
def login(payload: LoginSchema):
    token = jwt.encode(
        {
            "sub": payload.email,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": "usr_nv_9921",
            "name": payload.email.split("@")[0].upper(),
            "email": payload.email,
            "role": "driver",
            "vehicleModel": "Lumina EV GT-9",
            "licensePlate": "NV-882-AI",
        },
    }

@router.post("/register")
def register(payload: RegisterSchema):
    token = jwt.encode(
        {
            "sub": payload.email,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": f"usr_{int(datetime.datetime.utcnow().timestamp())}",
            "name": payload.name,
            "email": payload.email,
            "role": "driver",
            "vehicleModel": "Lumina EV GT-9",
            "licensePlate": "NV-882-AI",
        },
    }
