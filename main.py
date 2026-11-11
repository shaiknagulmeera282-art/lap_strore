from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from app.user_api import router as users_router

from app.database import SessionLocal
from app.models import Product
from app.schemas import ProductCreate, ProductResponse

from pathlib import Path

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

import os
from dotenv import load_dotenv

import json
# from app.core.redis import redis_client
# from app.core.redis import redis_client
import redis.asyncio as redis

import os
import jwt
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from jwt.exceptions import InvalidTokenError

# Load .env from the project root
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE, override=True)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError("Set the JWT_SECRET_KEY environment variable")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30


REDIS_URL = os.getenv(
    "REDIS_URL",
    "redis://localhost:6379/0"
)

redis_client = redis.from_url(
    REDIS_URL,
    decode_responses=True
)

async def test_redis():
    response = await redis_client.ping()
    return response

# @asynccontextmanager
async def lifespan(app: FastAPI):
    await redis_client.ping()
    yield

    # Close Redis connection
    await redis_client.aclose()
    print("Redis connection closed")


app = FastAPI(lifespan=lifespan)


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static"
)

@app.get("/", include_in_schema=False)
def home():
    return FileResponse(STATIC_DIR / "index.html")
    
app.include_router(users_router)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)

@app.get("/", include_in_schema=False)
def serve_frontend():
    return FileResponse(STATIC_DIR / "index.html")


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
async def get_products(db: Session = Depends(get_db)):

    cache_key = "products:all"

    # Step 1: Check Redis
    try:
        cached_products = await redis_client.get(cache_key)

        if cached_products:
            print("REDIS CACHE HIT: All products")

            return json.loads(cached_products)

    except Exception as e:
        print(f"Redis read error: {e}")

    # Step 2: Fetch from PostgreSQL
    print("REDIS CACHE MISS: Fetching from PostgreSQL")

    products = db.query(Product).all()

    # Step 3: Convert SQLAlchemy objects to JSON
    product_data = [
    ProductResponse.model_validate(product).model_dump(mode="json")
    for product in products
    ]

    # Step 4: Save in Redis for 300 seconds
    try:
        await redis_client.set(
            cache_key,
            json.dumps(product_data),
            ex=300
        )
    except Exception as e:
        print(f"Redis write error: {e}")

    return product_data


@app.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: Session = Depends(get_db)):

    # Redis cache key
    cache_key = f"products:{product_id}"

    # 1. Check Redis first
    cached_product = await redis_client.get(cache_key)

    if cached_product:
        print("REDIS CACHE HIT")
        return json.loads(cached_product)

    print("REDIS CACHE MISS")

    # 2. If cache is empty, fetch from PostgreSQL
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    # 3. Convert SQLAlchemy object to dictionary
    product_data = ProductResponse.model_validate(
        product
    ).model_dump(mode="json")

    # 4. Save product in Redis for 5 minutes
    await redis_client.set(
        cache_key,
        json.dumps(product_data),
        ex=300
    )

    print("PRODUCT SAVED IN REDIS")

    # 5. Return product
    return product_data



async def clear_product_cache(product_id=None):

    try:
        # Clear all products cache
        await redis_client.delete("products:all")

        # Clear individual product cache
        if product_id is not None:
            await redis_client.delete(
                f"products:{product_id}"
            )

        print("REDIS CACHE CLEARED")

    except Exception as e:
        print(f"Redis cache clearing error: {e}")





@app.post(
    "/products",
    response_model=ProductResponse,
    status_code=201
)
async def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db)
):
    product = Product(**product_data.model_dump())

    db.add(product)
    db.commit()
    db.refresh(product)

    # Clear old cache
    await clear_product_cache(product.id)

    return product




@app.put(
    "/products/{product_id}",
    response_model=ProductResponse
)
async def update_product(
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

    # Clear old cache
    await clear_product_cache(product_id)

    return product



@app.delete("/products/{product_id}")
async def delete_product(
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

    # Clear old cache
    await clear_product_cache(product_id)

    return {
        "message": "Product deleted successfully"
    }







from fastapi import HTTPException
async def clear_product_cache(product_id=None):

    try:
        await redis_client.delete("products:all")

        if product_id is not None:
            await redis_client.delete(
                f"products:{product_id}"
            )

        print("Product cache cleared")

    except Exception as e:
        print(f"Redis cache error: {e}")
