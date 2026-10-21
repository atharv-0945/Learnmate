"""db/session.py – SQLAlchemy engine + session factory."""
from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import DB_URL
from db.models import Base

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    """Create all tables if they don't exist yet, then apply lightweight column adds."""
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(subjects)"))}
        if "previous_score" not in cols:
            conn.execute(text("ALTER TABLE subjects ADD COLUMN previous_score FLOAT"))


def get_db() -> Session:
    """Return a new database session (caller must close it)."""
    return SessionLocal()
