from fastapi import FastAPI
from .endpoints import router as recs_router

app = FastAPI(title="BookMatch Recs Service", version="0.1.0")

app.include_router(recs_router, prefix="/api/v1/recs")

@app.get("/health")
async def health():
    return {"status": "ok"}
