
import httpx
import os
import json
import hmac
import hashlib
import time


async def send_webhook(url: str, payload: dict):

    secret = os.getenv("WEBHOOK_SECRET")

    if not secret:
        raise RuntimeError("WEBHOOK_SECRET is not configured")

    # Convert payload into consistent JSON bytes
    body = json.dumps(
        payload,
        separators=(",", ":"),
        sort_keys=True
    ).encode("utf-8")

    # Generate current Unix timestamp
    timestamp = str(int(time.time()))

    # Sign timestamp + body together
    signed_content = timestamp.encode("utf-8") + b"." + body

    signature = hmac.new(
        secret.encode("utf-8"),
        signed_content,
        hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Timestamp": timestamp,
        "X-Webhook-Signature": signature
    }

    async with httpx.AsyncClient(timeout=10.0) as client:

        response = await client.post(
            url,
            content=body,
            headers=headers
        )

        response.raise_for_status()

        return response.json()
