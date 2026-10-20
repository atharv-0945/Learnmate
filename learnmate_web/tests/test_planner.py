"""
tests/test_planner.py – Tests for heuristic timetable slot generation and priority calculation.
"""
from datetime import date, timedelta
import pytest

from services.planner import _compute_priority, _generate_slots


def test_priority_urgency_ordering():
    today = date(2026, 10, 20)
    # Exam in 2 days vs exam in 30 days
    p_urgent = _compute_priority("2026-10-22", theta=0.0, difficulty="medium", subject_priority=1, today=today, max_days=30)
    p_distant = _compute_priority("2026-11-19", theta=0.0, difficulty="medium", subject_priority=1, today=today, max_days=30)
    assert p_urgent > p_distant


def test_priority_weakness_ordering():
    today = date(2026, 10, 20)
    # Low theta (weak) vs high theta (strong)
    p_weak = _compute_priority("2026-11-01", theta=-2.0, difficulty="medium", subject_priority=1, today=today, max_days=30)
    p_strong = _compute_priority("2026-11-01", theta=2.0, difficulty="medium", subject_priority=1, today=today, max_days=30)
    assert p_weak > p_strong


def test_generate_slots_structure():
    start = date(2026, 10, 20)  # Tuesday
    end = date(2026, 10, 22)    # Thursday (3 days)
    study_days = ["Tue", "Wed", "Thu"]
    slots = _generate_slots(
        start_date=start,
        end_date=end,
        study_days=study_days,
        hours_per_day=1.5,
        session_min=45,
        break_min=10,
        start_hour=9
    )
    # 1.5 hours = 90 min. 1 session = 45 min. Break = 10 min. 90 - 45 = 45. Next session needs 10 break + 45 = 55 > 45, so 1 session per day.
    assert len(slots) == 3
    for s_start, s_end in slots:
        diff_mins = (s_end - s_start).total_seconds() / 60
        assert diff_mins == 45
