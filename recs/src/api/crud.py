import json
from typing import List, Dict, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.engine import Engine
import pandas as pd
from datetime import datetime, timedelta
import uuid

from ..models import db
from ..utils.logger import logger

# NOTE: table names must match your DB. If your Prisma created different names,
# update these constants. Prisma uses model names as table names by default (case sensitive),
# but many setups have lowercase tables. If your tables are lowercase, change them.
TABLE_RATINGS = "Rating"          # Prisma model Rating
TABLE_RECS = "Recommendation"     # Prisma model Recommendation
TABLE_MODEL_JOB = "ModelJob"      # Prisma model ModelJob

# --- sync: get ratings as pandas DataFrame (trainer uses sync engine) ---
def load_ratings_df(sync_engine: Engine) -> pd.DataFrame:
    """
    Expects columns: userId, bookId, rating, createdAt
    Adjust SQL if your columns are named differently.
    """
    sql = f'SELECT "userId" as user_id, "bookId" as book_id, "rating" as rating FROM "{TABLE_RATINGS}"'
    df = pd.read_sql(sql, con=sync_engine)
    logger.info("Loaded ratings rows: %s", len(df))
    return df

# --- async CRUD ---
async def create_model_job(session: AsyncSession, kind: str = "full") -> str:
    job_id = str(uuid.uuid4())
    now = datetime.utcnow()
    expires = now + timedelta(days=7)
    sql = text(f'INSERT INTO "{TABLE_MODEL_JOB}" (id, kind, status, "createdAt", "updatedAt") VALUES (:id, :kind, :status, :createdAt, :updatedAt)')
    await session.execute(sql, {"id": job_id, "kind": kind, "status": "pending", "createdAt": now, "updatedAt": now})
    await session.commit()
    logger.info("Created model job %s", job_id)
    return job_id

async def update_model_job(session: AsyncSession, job_id: str, status: str, metrics: Dict = None):
    now = datetime.utcnow()
    if metrics is not None:
        sql = text(f'UPDATE "{TABLE_MODEL_JOB}" SET status = :status, metrics = :metrics, "updatedAt" = :updatedAt WHERE id = :id')
        await session.execute(sql, {"status": status, "metrics": json.dumps(metrics), "updatedAt": now, "id": job_id})
    else:
        sql = text(f'UPDATE "{TABLE_MODEL_JOB}" SET status = :status, "updatedAt" = :updatedAt WHERE id = :id')
        await session.execute(sql, {"status": status, "updatedAt": now, "id": job_id})
    await session.commit()
    logger.info("Updated model job %s -> %s", job_id, status)

async def write_recommendations_for_user(session: AsyncSession, user_id: str, items: List[Dict[str, Any]], ttl_days: int = 1):
    """
    Write or upsert a Recommendation row for userId.
    items: list of { bookId, score, reason? }
    """
    now = datetime.utcnow()
    ttl = now + timedelta(days=ttl_days)
    # Upsert pattern: delete existing then insert (simple)
    del_sql = text(f'DELETE FROM "{TABLE_RECS}" WHERE "userId" = :userId')
    await session.execute(del_sql, {"userId": user_id})
    insert_sql = text(f'INSERT INTO "{TABLE_RECS}" (id, "userId", items, "createdAt", "updatedAt", ttl) VALUES (:id, :userId, :items, :createdAt, :updatedAt, :ttl)')
    await session.execute(insert_sql, {"id": str(uuid.uuid4()), "userId": user_id, "items": json.dumps(items), "createdAt": now, "updatedAt": now, "ttl": ttl})
    await session.commit()

async def get_recommendations_for_user(session: AsyncSession, user_id: str, n: int = 20):
    sql = text(f'SELECT items FROM "{TABLE_RECS}" WHERE "userId" = :userId ORDER BY "updatedAt" DESC LIMIT 1')
    res = await session.execute(sql, {"userId": user_id})
    row = res.first()
    if not row:
        return []
    items = row[0]
    if isinstance(items, str):
        import json
        items = json.loads(items)
    return items[:n]

async def get_similar_books(session: AsyncSession, book_id: str, n: int = 10):
    # This is a placeholder: if you created an item-item similarity table, read from it.
    # For now we attempt to read Recommendation table for users who liked this book, then aggregate similar items.
    sql = text(f'''
      SELECT items FROM "{TABLE_RECS}" WHERE items::text LIKE :like LIMIT 100
    ''')
    like = f'%{book_id}%'
    res = await session.execute(sql, {"like": like})
    rows = res.fetchall()
    # naive aggregation
    counts = {}
    import json
    for r in rows:
      try:
        arr = r[0] if isinstance(r[0], list) else json.loads(r[0])
        for it in arr:
          bid = it.get("bookId")
          if bid == book_id: 
            continue
          counts[bid] = counts.get(bid, 0) + 1
      except Exception:
        continue
    sorted_items = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:n]
    return [{"bookId": bid, "score": float(score)} for bid, score in sorted_items]

async def get_model_job(session: AsyncSession, job_id: str):
    sql = text(f'SELECT id, kind, status, metrics FROM "{TABLE_MODEL_JOB}" WHERE id = :id')
    res = await session.execute(sql, {"id": job_id})
    row = res.first()
    if not row: 
        return None
    import json
    metrics = row[3]
    if isinstance(metrics, str):
      try:
        metrics = json.loads(metrics)
      except Exception:
        metrics = metrics
    return {"id": row[0], "kind": row[1], "status": row[2], "metrics": metrics}
