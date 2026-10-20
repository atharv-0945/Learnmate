"""
services/mastery.py – online Bayesian-style mastery tracking.

One parameter θ per topic.  Pass probability = σ(θ − b) where b is
question difficulty.  Updated via one SGD step on log-loss after each answer.
"""
from __future__ import annotations

import math
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import MASTERY_ETA, DIFFICULTY_BIAS, MIN_QUESTIONS_FOR_LABEL


# ──────────────────────────────────────────────────────────────
# Core maths
# ──────────────────────────────────────────────────────────────

def _sigmoid(z: float) -> float:
    z = max(-30.0, min(30.0, z))
    return 1.0 / (1.0 + math.exp(-z))


def _logit(p: float) -> float:
    p = max(0.05, min(0.95, p))
    return math.log(p / (1.0 - p))


def confidence_to_theta(confidence_pct: float) -> float:
    """Convert an initial confidence percentage (0-100) to logit θ₀."""
    return _logit(confidence_pct / 100.0)


def theta_to_confidence(theta: float) -> float:
    """Convert θ to a probability in [0, 1]."""
    return _sigmoid(theta)


def update_theta(theta: float, is_correct: bool, difficulty: str) -> float:
    """
    One SGD step on log-loss:
        θ ← θ + η * (y − p)
    where p = σ(θ − b) and b = DIFFICULTY_BIAS[difficulty].
    η is capped at MASTERY_ETA.
    """
    b = DIFFICULTY_BIAS.get(difficulty, 0.0)
    p = _sigmoid(theta - b)
    y = 1.0 if is_correct else 0.0
    delta = MASTERY_ETA * (y - p)
    return theta + delta


def mastery_label(theta: float, n_answered: int) -> str:
    """
    Returns 'mastered', 'weak', or 'learning'.
    Never returns weak/mastered until MIN_QUESTIONS_FOR_LABEL answers.
    """
    if n_answered < MIN_QUESTIONS_FOR_LABEL:
        return "learning"
    conf = theta_to_confidence(theta)
    if conf >= 0.75:
        return "mastered"
    if conf <= 0.40:
        return "weak"
    return "learning"


# ──────────────────────────────────────────────────────────────
# DB helpers
# ──────────────────────────────────────────────────────────────

def apply_quiz_result(db_session, topic_id: int, answers: list[int], questions: list[dict]) -> None:
    """
    Given a list of chosen answer indices and the question list,
    update θ for each question in the topic.
    """
    from db.models import Topic

    topic = db_session.get(Topic, topic_id)
    if topic is None:
        return

    for i, q in enumerate(questions):
        if i >= len(answers):
            break
        correct = answers[i] == q.get("correct_index", -1)
        topic.theta = update_theta(topic.theta, correct, q.get("difficulty", "medium"))
        topic.n_answered = (topic.n_answered or 0) + 1

    # Sync confidence for display
    topic.confidence = theta_to_confidence(topic.theta) * 100.0
    db_session.commit()


def get_weakest_topics(db_session, user_id: int, n: int = 3) -> list:
    """Return the n topics with lowest θ that have MIN_QUESTIONS_FOR_LABEL answers."""
    from db.models import Topic
    topics = (
        db_session.query(Topic)
        .filter(Topic.user_id == user_id, Topic.n_answered >= MIN_QUESTIONS_FOR_LABEL)
        .order_by(Topic.theta)
        .limit(n)
        .all()
    )
    return topics
