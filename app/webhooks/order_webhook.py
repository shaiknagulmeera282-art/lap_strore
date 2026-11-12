
from fastapi import APIRouter
from pydantic import BaseModel
from fastapi import HTTPException
from app.webhooks.sender import send_webhook


router = APIRouter(
    prefix="/webhooks",
    tags=["Webhooks"]
)


# Webhook request data
class OrderWebhook(BaseModel):
    event: str
    order_id: int
    product_name: str
    quantity: int
    total_price: float


# Receive order webhook
@router.post("/orders")
def receive_order_webhook(data: OrderWebhook):

    print("Webhook received!")

    print("Event:", data.event)
    print("Order ID:", data.order_id)
    print("Product:", data.product_name)
    print("Quantity:", data.quantity)
    print("Total Price:", data.total_price)

    return {
        "message": "Webhook received successfully",
        "event": data.event,
        "order_id": data.order_id
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
        result = await send_webhook(
            webhook_url,
            payload
        )

        return {
            "message": "Webhook sent successfully",
            "receiver_response": result
        }

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Webhook delivery failed: {str(error)}"
        )


class ProductWebhook(BaseModel):
    event: str
    product_id: int
    product_name: str
    price: float
    quantity: int


@router.post("/products")
def receive_product_webhook(data: ProductWebhook):

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