"""
Trainer: reads rating data from Postgres, computes SVD-based collaborative filtering,
writes per-user Recommendation rows. Lightweight, depends on pandas + scikit-learn.

This runs synchronously inside a background thread (so FastAPI remains async).
"""
from typing import Dict, Any
import numpy as np
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.metrics import mean_squared_error
from math import sqrt
from ..models import db as dbmod
from ..api import crud
from ..utils.logger import logger
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
import json

def train_and_write(sync_engine: Engine, async_session_maker, job_id: str, n_components: int = 50, top_k: int = 20) -> Dict[str, Any]:
    """
    1) load ratings
    2) create user-item matrix
    3) run TruncatedSVD on matrix
    4) reconstruct approximate ratings
    5) for each user, pick top_k books not previously rated and write to Recommendation table
    6) return metrics (rmse)
    """
    logger.info("Trainer starting load_ratings_df")
    df = crud.load_ratings_df(sync_engine)  # columns: user_id, book_id, rating
    if df.empty:
        logger.warn("No ratings found; nothing to train")
        return {"rmse": None, "users": 0, "items": 0}

    # map ids to indices
    user_ids = df["user_id"].unique().tolist()
    book_ids = df["book_id"].unique().tolist()
    user_index = {u: i for i, u in enumerate(user_ids)}
    book_index = {b: i for i, b in enumerate(book_ids)}

    # build matrix
    rows = df["user_id"].map(user_index)
    cols = df["book_id"].map(book_index)
    data = df["rating"].astype(float)
    # create dense matrix (users x items)
    R = np.zeros((len(user_ids), len(book_ids)), dtype=float)
    R[rows, cols] = data

    # SVD
    k = min(n_components, min(R.shape)-1)
    if k <= 0:
        k = min(1, min(R.shape) - 1)
    logger.info("Running TruncatedSVD components=%s on matrix shape %s", k, R.shape)
    svd = TruncatedSVD(n_components=k, random_state=42)
    U = svd.fit_transform(R)        # users x k
    Sigma = svd.singular_values_    # length k
    VT = svd.components_            # k x items

    # Reconstruct approx ratings (U * Sigma * VT)
    approx = np.dot(U, np.diag(Sigma)).dot(VT)

    # Compute RMSE on observed entries
    mask = R > 0
    if mask.sum() > 0:
        mse = mean_squared_error(R[mask], approx[mask])
        rmse = sqrt(mse)
    else:
        rmse = None

    logger.info("Training done, rmse: %s", rmse)

    # For each user generate top_k recommendations (exclude already rated)
    # Convert approx to DataFrame to ease top-K
    approx_df = pd.DataFrame(approx, index=user_ids, columns=book_ids)

    # Already rated mask per user
    rated_df = df.set_index(["user_id", "book_id"])
    # Now write into DB (async sessions)
    import asyncio
    async def write_all():
        async with async_session_maker() as session:
            # For each user
            for u in user_ids:
                user_row = approx_df.loc[u]
                # mask rated items
                rated_books = df[df["user_id"] == u]["book_id"].tolist()
                candidates = [(bid, float(user_row[bid])) for bid in book_ids if bid not in rated_books]
                # sort by score
                candidates.sort(key=lambda x: x[1], reverse=True)
                top = [{"bookId": bid, "score": score, "reason": "svd"} for bid, score in candidates[:top_k]]
                # write to Recommendation table
                await crud.write_recommendations_for_user(session, u, top, ttl_days=1)
    # run the async writes from sync code
    logger.info("Writing recommendations for %s users", len(user_ids))
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        loop.run_until_complete(write_all())
    finally:
        loop.close()

    metrics = {"rmse": rmse, "users": len(user_ids), "items": len(book_ids)}
    logger.info("Trainer finished: %s", metrics)
    return metrics
