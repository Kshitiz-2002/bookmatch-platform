from fastapi import FastAPI
from .routes import router
from ..utils.logger import logger

app = FastAPI(title="BookMatch Recs Service")

app.include_router(router, prefix="/api/v1/recs")

@app.on_event("startup")
async def startup_event():
    logger.info("Recs service starting up")

@app.get("/")
async def root():
    return {"ok": True, "service": "recs"}
