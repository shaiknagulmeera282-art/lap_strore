
from pydantic import BaseModel, ConfigDict
from pydantic import BaseModel, ConfigDict, EmailStr


class ProductCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    quantity: int = 0


class ProductResponse(ProductCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


# Existing product schemas should remain above this code.


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr

    model_config = ConfigDict(from_attributes=True)


