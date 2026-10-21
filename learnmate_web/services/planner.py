"""
services/planner.py – rule-based timetable generator.

Priority formula (per PRD §5.4):
  P = 0.35·Urgency + 0.35·Weakness + 0.20·Difficulty + 0.10·SubjectPriority

All weights are imported from config.PLANNER_WEIGHTS so they can be
changed without touching this file.
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config
from config import PLANNER_WEIGHTS, REVISION_RESERVE_FRACTION, DEFAULT_SESSION_MINUTES

_DIFFICULTY_SCORE = {"easy": 0.2, "medium": 0.5, "hard": 1.0}


def _sigmoid(z: float) -> float:
    z = max(-30.0, min(30.0, z))
    return 1.0 / (1.0 + math.exp(-z))


# ──────────────────────────────────────────────────────────────
# Priority computation
# ──────────────────────────────────────────────────────────────

def _compute_priority(
    exam_date_str: str,
    theta: float,
    difficulty: str,
    subject_priority: int,
    today: date,
    max_days: int,
) -> float:
    # Urgency: 1 when exam is today, 0 when max_days away
    try:
        exam_date = date.fromisoformat(exam_date_str)
    except ValueError:
        exam_date = today + timedelta(days=30)
    days_left = max(0, (exam_date - today).days)
    urgency = 1.0 - min(days_left / max(max_days, 1), 1.0)

    weakness = 1.0 - _sigmoid(theta)   # higher θ → lower weakness
    diff_score = _DIFFICULTY_SCORE.get(difficulty, 0.5)
    subj_prio_score = {1: 1.0, 2: 0.5, 3: 0.2}.get(subject_priority, 0.5)

    w = PLANNER_WEIGHTS
    p = (
        w["urgency"]          * urgency
        + w["weakness"]       * weakness
        + w["difficulty"]     * diff_score
        + w["subject_priority"] * subj_prio_score
    )
    return round(p, 4)


# ──────────────────────────────────────────────────────────────
# Slot generator
# ──────────────────────────────────────────────────────────────

def _generate_slots(
    start_date: date,
    end_date: date,
    study_days: list[str],
    hours_per_day: float,
    session_min: int,
    break_min: int,
    start_hour: int = 9,
    not_before: Optional[datetime] = None,
) -> list[tuple[datetime, datetime]]:
    """
    Yield (session_start, session_end) pairs.
    Slots are placed greedily from start_hour each study day.
    A break of break_min is inserted between consecutive sessions on the same day.
    Slots that begin before `not_before` are skipped so re-optimising never
    creates sessions in the past.
    """
    DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    allowed_weekdays = {DAY_NAMES.index(d) for d in study_days if d in DAY_NAMES}
    slots: list[tuple[datetime, datetime]] = []

    current = start_date
    while current <= end_date:
        if current.weekday() in allowed_weekdays:
            minutes_left = int(hours_per_day * 60)
            slot_start = datetime(current.year, current.month, current.day,
                                  start_hour, 0, tzinfo=timezone.utc)
            first_slot = True
            while minutes_left >= session_min:
                if not first_slot:
                    slot_start = slot_start + timedelta(minutes=break_min)
                    minutes_left -= break_min
                    if minutes_left < session_min:
                        break
                slot_end = slot_start + timedelta(minutes=session_min)
                if not_before is None or slot_start >= not_before:
                    slots.append((slot_start, slot_end))
                slot_start = slot_end
                minutes_left -= session_min
                first_slot = False
        current += timedelta(days=1)
    return slots


# ──────────────────────────────────────────────────────────────
# Main planner entry point
# ──────────────────────────────────────────────────────────────

def build_plan(db_session, user_id: int) -> dict:
    """
    Build a timetable for the user.  Returns:
      {
        "created": int,      # sessions created
        "warning": str|None, # if not enough time
        "sessions": list,    # created Session objects
      }
    """
    from db.models import User, Subject, Topic, Session

    user = db_session.get(User, user_id)
    if user is None:
        return {"created": 0, "warning": "User not found.", "sessions": []}

    study_days = [d.strip() for d in user.study_days.split(",") if d.strip()]
    today = date.today()

    # Gather all pending/in-progress topics with their subjects
    subjects = db_session.query(Subject).filter(Subject.user_id == user_id).all()
    if not subjects:
        return {"created": 0, "warning": "No subjects configured.", "sessions": []}

    # Find the furthest exam date to compute max_days
    exam_dates = []
    for subj in subjects:
        try:
            exam_dates.append(date.fromisoformat(subj.exam_date))
        except ValueError:
            pass
    if not exam_dates:
        return {"created": 0, "warning": "No valid exam dates.", "sessions": []}
    last_exam = max(exam_dates)
    max_days = max(1, (last_exam - today).days)

    # Collect topics and compute priorities
    scored_topics: list[tuple[float, Topic]] = []
    for subj in subjects:
        try:
            exam_dt = date.fromisoformat(subj.exam_date)
        except ValueError:
            continue
        if exam_dt < today:
            continue   # past exam
        for topic in subj.topics:
            if topic.status == "done":
                continue
            score = _compute_priority(
                subj.exam_date, topic.theta, topic.difficulty,
                subj.priority, today, max_days,
            )
            scored_topics.append((score, topic))

    if not scored_topics:
        return {"created": 0, "warning": "All topics are done or no upcoming exams.", "sessions": []}

    scored_topics.sort(key=lambda x: x[0], reverse=True)

    # Generate slots up to (last_exam − revision_period)
    revision_days = max(1, int(max_days * REVISION_RESERVE_FRACTION))
    plan_end = last_exam - timedelta(days=revision_days)
    now_utc = datetime.now(timezone.utc)
    slots = _generate_slots(
        today, plan_end, study_days,
        user.hours_per_day, user.session_min, user.break_min,
        not_before=now_utc,
    )
    if not slots:
        return {
            "created": 0,
            "warning": "No study slots left before the revision period. "
                       "Try adding study days/hours or check your exam dates.",
            "sessions": [],
        }

    # Rebuild the pending plan. Completed/skipped history is preserved.
    old_scheduled = (
        db_session.query(Session)
        .filter(
            Session.user_id == user_id,
            Session.status == "scheduled",
        )
        .all()
    )
    for s in old_scheduled:
        db_session.delete(s)
    db_session.flush()

    # Greedily assign topics to slots
    topic_iter = (t for _, t in scored_topics)
    current_topic = next(topic_iter, None)
    minutes_remaining = current_topic.estimated_min if current_topic else 0

    created_sessions: list[Session] = []
    for (slot_start, slot_end) in slots:
        if current_topic is None:
            break
        dur = int((slot_end - slot_start).total_seconds() / 60)
        sess = Session(
            user_id=user_id,
            subject_id=current_topic.subject_id,
            topic_id=current_topic.id,
            scheduled_start=slot_start.isoformat(),
            scheduled_end=slot_end.isoformat(),
            duration_min=dur,
            status="scheduled",
        )
        db_session.add(sess)
        created_sessions.append(sess)
        minutes_remaining -= dur
        if minutes_remaining <= 0:
            current_topic = next(topic_iter, None)
            minutes_remaining = current_topic.estimated_min if current_topic else 0

    db_session.commit()

    warning = None
    if current_topic is not None:
        warning = (
            f"⚠️ Not enough study time: {sum(1 for _ in scored_topics)} topics "
            f"couldn't be fully scheduled before the revision period. "
            f"Consider adding more study hours or moving exam dates."
        )

    return {"created": len(created_sessions), "warning": warning, "sessions": created_sessions}


def schedule_count_for_subject(db_session, user_id: int, subject, count: int) -> int:
    """Place `count` sessions for one subject between today and its exam date."""
    from db.models import User, Topic, Session

    if count <= 0:
        return 0
    user = db_session.get(User, user_id)
    if user is None:
        return 0
    study_days = [d.strip() for d in user.study_days.split(",") if d.strip()]
    today = date.today()
    try:
        exam_dt = date.fromisoformat(subject.exam_date)
    except ValueError:
        exam_dt = today + timedelta(days=30)
    plan_end = max(today, exam_dt - timedelta(days=1))
    slots = _generate_slots(
        today, plan_end, study_days,
        user.hours_per_day, user.session_min, user.break_min,
    )
    topics = [t for t in (subject.topics or []) if t.status != "done"]
    if not topics:
        topics = list(subject.topics or [])
    created = 0
    for i, (slot_start, slot_end) in enumerate(slots[:count]):
        topic = topics[i % len(topics)] if topics else None
        dur = int((slot_end - slot_start).total_seconds() / 60)
        db_session.add(Session(
            user_id=user_id,
            subject_id=subject.id,
            topic_id=topic.id if topic is not None else None,
            scheduled_start=slot_start.isoformat(),
            scheduled_end=slot_end.isoformat(),
            duration_min=dur or user.session_min,
            status="scheduled",
        ))
        created += 1
    return created


# ──────────────────────────────────────────────────────────────
# Replanning trigger
# ──────────────────────────────────────────────────────────────

def should_replan(db_session, user_id: int) -> tuple[bool, str]:
    """Check if any replanning trigger is active."""
    from db.models import Session
    from datetime import timezone

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # Missed sessions
    missed = (
        db_session.query(Session)
        .filter(
            Session.user_id == user_id,
            Session.status == "scheduled",
            Session.scheduled_end < now_iso,
        )
        .count()
    )
    if missed:
        return True, f"{missed} session(s) were missed."
    return False, ""
