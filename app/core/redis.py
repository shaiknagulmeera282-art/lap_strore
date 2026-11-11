
# import redis.asyncio as redis

# # Redis connection URL
# REDIS_URL = "redis://localhost:6379/0"

# # Create Redis client
# redis_client = redis.from_url(
#     REDIS_URL,
#     decode_responses=True
# )

import os
import redis.asyncio as redis
from dotenv import load_dotenv

load_dotenv()

redis_client = redis.from_url(
    os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    decode_responses=True
)



# Test Redis connection
async def test_redis():
    try:
        response = await redis_client.ping()
        return response
    except Exception as e:
        print(f"Redis connection error: {e}")
        return False
