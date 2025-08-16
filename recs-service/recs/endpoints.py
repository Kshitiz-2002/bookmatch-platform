from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from .trainer import Trainer
from .model_store import ModelStore
import uuid
import threading

router = APIRouter()
trainer = Trainer()
store = ModelStore()

# in-memory job registry (for simplicity). For production store in DB or Redis.
_JOB_REGISTRY = {}
_JOB_LOCK = threading.Lock()

class RecItem(BaseModel):
    bookId: str
    score: float
    reason: Optional[str] = None

class TrainRequest(BaseModel):
    full: Optional[bool] = False
    source_csv: Optional[str] = None  # path to CSV or S3 key (trainer will interpret)

class TrainResponse(BaseModel):
    jobId: str

@router.post("/train", response_model=TrainResponse)
async def train_endpoint(req: TrainRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    with _JOB_LOCK:
        _JOB_REGISTRY[job_id] = {"status": "queued", "progress": 0, "error": None, "model_path": None}

    # run training in background using FastAPI BackgroundTasks -> they run in same process worker thread
    def _run():
        try:
            with _JOB_LOCK:
                _JOB_REGISTRY[job_id]["status"] = "running"
                _JOB_REGISTRY[job_id]["progress"] = 5
            model_path, metrics = trainer.train(full=req.full, source_csv=req.source_csv, on_progress=lambda p: _update_progress(job_id, p))
            # persist model locally and optionally to storage
            artifact_uri = store.save_model(job_id, model_path, metadata=metrics)
            with _JOB_LOCK:
                _JOB_REGISTRY[job_id]["status"] = "completed"
                _JOB_REGISTRY[job_id]["progress"] = 100
                _JOB_REGISTRY[job_id]["model_path"] = artifact_uri
                _JOB_REGISTRY[job_id]["metrics"] = metrics
        except Exception as e:
            with _JOB_LOCK:
                _JOB_REGISTRY[job_id]["status"] = "failed"
                _JOB_REGISTRY[job_id]["error"] = str(e)

    background_tasks.add_task(_run)
    return {"jobId": job_id}

def _update_progress(job_id, p):
    with _JOB_LOCK:
        if job_id in _JOB_REGISTRY:
            _JOB_REGISTRY[job_id]["progress"] = p

@router.get("/status/{job_id}")
async def status(job_id: str):
    with _JOB_LOCK:
        if job_id not in _JOB_REGISTRY:
            raise HTTPException(status_code=404, detail="Job not found")
        return _JOB_REGISTRY[job_id]

@router.get("/user/{user_id}/top", response_model=List[RecItem])
async def user_top(user_id: str, n: int = 20):
    """
    Return top-N recommended book ids for a user.
    Implementation: load model (user factors & item factors) and compute top K.
    """
    try:
        items = trainer.recommend_for_user(user_id, k=n)
        return [{"bookId": bid, "score": float(score), "reason": "cf:als"} for bid, score in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/book/{book_id}/similar", response_model=List[RecItem])
async def book_similar(book_id: str, n: int = 10):
    try:
        items = trainer.similar_items(book_id, k=n)
        return [{"bookId": bid, "score": float(score), "reason": "item-sim"} for bid, score in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
