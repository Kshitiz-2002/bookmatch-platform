import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL must be provided in environment")

# async engine for fastapi CRUD interactions (asyncpg dialect)
ASYNC_DB_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://") if DATABASE_URL.startswith("postgresql://") else DATABASE_URL
async_engine: AsyncEngine = create_async_engine(ASYNC_DB_URL, echo=False, future=True)
AsyncSessionLocal = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

# sync engine for trainer (pandas.read_sql)
# Use a separate sync connection for heavy CPU-bound trainer (pandas + sklearn)
sync_engine = create_engine(DATABASE_URL, pool_pre_ping=True)
