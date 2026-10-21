"""db/models.py – SQLAlchemy ORM models (single-user mode, user_id on every table)."""
# Flashcard and DocumentUpload models added for AI document-to-study-material feature.
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True)
    name          = Column(String(120), nullable=False)
    timezone      = Column(String(64), default="UTC")
    study_days    = Column(String(64), default="Mon,Tue,Wed,Thu,Fri")  # CSV
    hours_per_day = Column(Float, default=2.0)
    session_min   = Column(Integer, default=45)
    break_min     = Column(Integer, default=10)
    # Optional predictor inputs
    prev_exam_score   = Column(Float, nullable=True)
    weekly_study_hours = Column(Float, nullable=True)
    created_at    = Column(DateTime(timezone=True), default=_utcnow)

    subjects      = relationship("Subject", back_populates="user", cascade="all, delete-orphan")
    quizzes       = relationship("Quiz",    back_populates="user", cascade="all, delete-orphan")
    doubts        = relationship("Doubt",   back_populates="user", cascade="all, delete-orphan")


# ──────────────────────────────────────────────────────────────
class Subject(Base):
    __tablename__ = "subjects"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    name            = Column(String(120), nullable=False)
    exam_date       = Column(String(16), nullable=False)   # ISO date string YYYY-MM-DD
    priority        = Column(Integer, default=1)           # 1 = high … 3 = low
    previous_score  = Column(Float, nullable=True)         # last exam score 0–100

    user        = relationship("User",    back_populates="subjects")
    topics      = relationship("Topic",   back_populates="subject", cascade="all, delete-orphan")
    sessions    = relationship("Session", back_populates="subject", cascade="all, delete-orphan")


# ──────────────────────────────────────────────────────────────
class Topic(Base):
    __tablename__ = "topics"

    id             = Column(Integer, primary_key=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id     = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    name           = Column(String(200), nullable=False)
    difficulty     = Column(String(16), default="medium")   # easy | medium | hard
    confidence     = Column(Float, default=50.0)            # user-supplied 0-100
    theta          = Column(Float, default=0.0)             # mastery parameter
    n_answered     = Column(Integer, default=0)
    last_studied   = Column(DateTime(timezone=True), nullable=True)
    estimated_min  = Column(Integer, default=60)
    status         = Column(String(32), default="pending")  # pending | in_progress | done

    subject        = relationship("Subject", back_populates="topics")


# ──────────────────────────────────────────────────────────────
class Session(Base):
    __tablename__ = "sessions"

    id             = Column(Integer, primary_key=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id     = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    topic_id       = Column(Integer, ForeignKey("topics.id"), nullable=True)
    scheduled_start = Column(String(32), nullable=False)   # ISO datetime
    scheduled_end   = Column(String(32), nullable=False)
    actual_start    = Column(String(32), nullable=True)
    actual_end      = Column(String(32), nullable=True)
    duration_min    = Column(Integer, default=45)
    status          = Column(String(16), default="scheduled")  # scheduled|completed|skipped|missed
    notes           = Column(Text, default="")

    subject         = relationship("Subject", back_populates="sessions")
    topic           = relationship("Topic")


# ──────────────────────────────────────────────────────────────
class Quiz(Base):
    __tablename__ = "quizzes"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id  = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    topic_id    = Column(Integer, ForeignKey("topics.id"), nullable=True)
    difficulty  = Column(String(16), default="medium")
    n_questions = Column(Integer, default=5)
    questions   = Column(Text, nullable=False)   # JSON list
    cache_key   = Column(String(128), unique=True, nullable=True)
    created_at  = Column(DateTime(timezone=True), default=_utcnow)

    user        = relationship("User",    back_populates="quizzes")
    attempts    = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")


# ──────────────────────────────────────────────────────────────
class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    quiz_id     = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    answers     = Column(Text, nullable=False)   # JSON list of int indices
    score       = Column(Float, nullable=False)  # 0.0 – 1.0
    submitted_at = Column(DateTime(timezone=True), default=_utcnow)

    quiz        = relationship("Quiz", back_populates="attempts")


# ──────────────────────────────────────────────────────────────
class FlashcardSet(Base):
    """A named set of flashcards generated from an uploaded document."""
    __tablename__ = "flashcard_sets"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    title       = Column(String(200), nullable=False)        # e.g. filename or topic
    source_type = Column(String(32), default="document")     # document | manual
    created_at  = Column(DateTime(timezone=True), default=_utcnow)

    cards       = relationship("Flashcard", back_populates="set", cascade="all, delete-orphan")


# ──────────────────────────────────────────────────────────────
class Flashcard(Base):
    """Individual flashcard (front = question/term, back = answer/definition)."""
    __tablename__ = "flashcards"

    id          = Column(Integer, primary_key=True)
    set_id      = Column(Integer, ForeignKey("flashcard_sets.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    front       = Column(Text, nullable=False)   # Term / Question
    back        = Column(Text, nullable=False)   # Definition / Answer
    difficulty  = Column(String(16), default="medium")
    known       = Column(Boolean, default=False) # user self-assessed
    set         = relationship("FlashcardSet", back_populates="cards")


# ──────────────────────────────────────────────────────────────
class Doubt(Base):
    """Academic doubt resolution session powered by Groq LPU inference."""
    __tablename__ = "doubts"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id  = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    topic_id    = Column(Integer, ForeignKey("topics.id"), nullable=True)
    question    = Column(Text, nullable=False)
    answer      = Column(Text, nullable=False)
    key_takeaways = Column(Text, nullable=True)   # JSON array or markdown list
    practice_question = Column(Text, nullable=True)
    depth       = Column(String(32), default="standard")  # quick, standard, deep, exam
    model_used  = Column(String(64), default="llama-3.3-70b-versatile")
    created_at  = Column(DateTime(timezone=True), default=_utcnow)

    user        = relationship("User", back_populates="doubts")
    subject     = relationship("Subject")
    topic       = relationship("Topic")
