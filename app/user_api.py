
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pwdlib import PasswordHash
from app.auth import create_access_token

from app.database import SessionLocal
from app.user_models import User
from app.user_schemas import UserCreate, UserResponse

from fastapi import Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth import verify_access_token

router = APIRouter(prefix="/users", tags=["Users"])

password_hash = PasswordHash.recommended()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/register", response_model=UserResponse, status_code=201)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        (User.username == user_data.username) |
        (User.email == user_data.email)
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Username or email already exists"
        )

    user = User(
        username=user_data.username,
        email=user_data.email,
        password=password_hash.hash(user_data.password)
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


from pydantic import BaseModel, EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str



@router.post("/login")
def login_user(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == login_data.email
    ).first()

    if user is None or not password_hash.verify(
        login_data.password, user.password
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


bearer_scheme = HTTPBearer()


@router.get("/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    db: Session = Depends(get_db)
):
    user_id = verify_access_token(credentials.credentials)

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email
    }
