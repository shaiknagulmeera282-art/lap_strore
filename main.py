
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from app.user_api import router as users_router

from app.database import SessionLocal
from app.models import Product
from app.schemas import ProductCreate, ProductResponse

app = FastAPI()
app.include_router(users_router)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# @app.get("/")
# def home():
#     return {"message": "Welcome to Laptop Store API....."}


@app.get("/products", response_model=list[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()


@app.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()

    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    return product


@app.post("/products", response_model=ProductResponse, status_code=201)
def create_product(product_data: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**product_data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product

@app.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_data: ProductCreate,
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    for key, value in product_data.model_dump().items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)

    return product


@app.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    db.delete(product)
    db.commit()

    return {"message": "Product deleted successfully"}
