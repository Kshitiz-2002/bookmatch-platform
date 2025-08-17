from pydantic import BaseModel
from typing import List, Optional, Any

class TrainRequest(BaseModel):
    full: Optional[bool] = False

class TrainResponse(BaseModel):
    jobId: str

class RecItem(BaseModel):
    bookId: str
    score: float
    reason: Optional[str] = None

class RecsResponse(BaseModel):
    items: List[RecItem]

class JobStatus(BaseModel):
    id: str
    kind: str
    status: str
    metrics: Optional[Any] = None
