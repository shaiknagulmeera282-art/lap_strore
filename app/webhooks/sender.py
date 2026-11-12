
import httpx


async def send_webhook(url: str, payload: dict):

    async with httpx.AsyncClient(timeout=10.0) as client:

        response = await client.post(
            url,
            json=payload
        )

        response.raise_for_status()

        return response.json()
