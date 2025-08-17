from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
import asyncio

from ..models import db
from ..models.schemas import TrainRequest, TrainResponse, RecsResponse, RecItem, JobStatus
from ..utils.logger import logger
from . import crud
from ..trainer.trainer import train_and_write

router = APIRouter()

# dependency to get async session
async def get_async_session():
    async with db.AsyncSessionLocal() as session:
        yield session

class TrainIn(BaseModel):
    full: Optional[bool] = False

@router.post("/train", status_code=202)
async def trigger_train(payload: TrainIn, background_tasks: BackgroundTasks, session = Depends(get_async_session)):
    # create model job row
    job_id = await crud.create_model_job(session, kind="full" if payload.full else "incremental")
    # schedule background worker
    # run the heavy sync CPU trainer in a separate thread to avoid blocking event loop
    def run_training():
        try:
            logger.info("Background trainer started for job %s", job_id)
            # Update job to running (already pending)
            import asyncio as _asyncio
            _asyncio.run(crud.update_model_job(db.AsyncSessionLocal(), job_id, "running"))  # NOT awaited; we update in main thread below using proper session
        except Exception:
            pass
        # call sync trainer (it will create its own async session to write recs)
        metrics = train_and_write(db.sync_engine, db.AsyncSessionLocal, job_id, n_components=50, top_k=20)
        # Write metrics back to DB; we use a new async session for update
        import asyncio as _asyncio
        async def finalize():
            async with db.AsyncSessionLocal() as sess:
                await crud.update_model_job(sess, job_id, "done", metrics)
        _asyncio.run(finalize())

    # use FastAPI background tasks to spawn a thread
    background_tasks.add_task(run_training)
    return {"jobId": job_id}

@router.get("/status/{job_id}", response_model=JobStatus)
async def job_status(job_id: str, session = Depends(get_async_session)):
    job = await crud.get_model_job(session, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.get("/user/{user_id}/top")
async def user_top(user_id: str, n: Optional[int] = 20, session = Depends(get_async_session)):
    items = await crud.get_recommendations_for_user(session, user_id, n=n)
    return {"items": items}

@router.get("/book/{book_id}/similar")
async def book_similar(book_id: str, n: Optional[int] = 10, session = Depends(get_async_session)):
    items = await crud.get_similar_books(session, book_id, n=n)
    return {"items": items}
