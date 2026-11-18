
import os
import hmac
import hashlib
import time

from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel

from app.webhooks.sender import send_webhook

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# Accept webhook timestamps within 5 minutes
MAX_TIMESTAMP_AGE = 300


class OrderWebhook(BaseModel):
    event: str
    order_id: int
    product_name: str
    quantity: int
    total_price: float


class ProductWebhook(BaseModel):
    event: str
    product_id: int
    product_name: str
    price: float
    quantity: int


async def verify_webhook_signature(
    request: Request,
    signature: str | None,
    timestamp: str | None
):
    secret = os.getenv("WEBHOOK_SECRET")

    if not secret:
        raise HTTPException(
            status_code=500,
            detail="WEBHOOK_SECRET is not configured"
        )

    if not signature or not timestamp:
        raise HTTPException(
            status_code=401,
            detail="Missing webhook security headers"
        )

    # Check timestamp format
    try:
        timestamp_value = int(timestamp)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid timestamp"
        )

    # Reject old or future timestamps
    current_time = int(time.time())

    if abs(current_time - timestamp_value) > MAX_TIMESTAMP_AGE:
        raise HTTPException(
            status_code=401,
            detail="Webhook timestamp expired"
        )

    # Read original request body
    raw_body = await request.body()

    # Recreate signed content
    signed_content = timestamp.encode("utf-8") + b"." + raw_body

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        signed_content,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(
            status_code=401,
            detail="Invalid webhook signature"
        )


@router.post("/orders")
async def receive_order_webhook(
    request: Request,
    x_webhook_signature: str | None = Header(default=None),
    x_webhook_timestamp: str | None = Header(default=None)
):
    await verify_webhook_signature(
        request,
        x_webhook_signature,
        x_webhook_timestamp
    )

    raw_body = await request.body()
    data = OrderWebhook.model_validate_json(raw_body)

    print("ORDER WEBHOOK RECEIVED!")
    print("Event:", data.event)
    print("Order ID:", data.order_id)
    print("Product:", data.product_name)
    print("Quantity:", data.quantity)
    print("Total Price:", data.total_price)

    return {
        "message": "Order webhook received successfully",
        "event": data.event,
        "order_id": data.order_id
    }


@router.post("/products")
async def receive_product_webhook(
    request: Request,
    x_webhook_signature: str | None = Header(default=None),
    x_webhook_timestamp: str | None = Header(default=None)
):
    await verify_webhook_signature(
        request,
        x_webhook_signature,
        x_webhook_timestamp
    )

    raw_body = await request.body()
    data = ProductWebhook.model_validate_json(raw_body)

    print("PRODUCT WEBHOOK RECEIVED!")
    print("Event:", data.event)
    print("Product ID:", data.product_id)
    print("Product Name:", data.product_name)
    print("Price:", data.price)
    print("Quantity:", data.quantity)

    return {
        "message": "Product webhook received successfully",
        "event": data.event,
        "product_id": data.product_id
    }


@router.post("/send-test")
async def send_test_webhook():
    webhook_url = "http://127.0.0.1:8002/webhooks/orders"

    payload = {
        "event": "order.created",
        "order_id": 102,
        "product_name": "HP Laptop",
        "quantity": 1,
        "total_price": 45000
    }

    try:
        result = await send_webhook(webhook_url, payload)

        return {
            "message": "Signed webhook sent successfully",
            "receiver_response": result
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Webhook delivery failed: {str(error)}"
        )
