"""
tests/test_predictor.py – Tests for ML prediction and what-if curve generation.
"""
import math
import numpy as np
import pytest

from types import SimpleNamespace

import config
from services.predictor import (
    _validate,
    predict,
    whatif_curve,
    load_model,
    load_dataset,
    benchmark_hours,
    session_suggestion,
    subject_pass_stats,
    overall_readiness,
    skip_impact,
    projected_study_hours,
)


def test_validate_valid_inputs():
    ok, err = _validate(5.0, 75.0)
    assert ok is True
    assert err == ""


def test_validate_boundary_inputs():
    ok, err = _validate(0.0, 0.0)
    assert ok is True
    ok, err = _validate(24.0, 100.0)
    assert ok is True


def test_validate_out_of_range():
    ok, err = _validate(-1.0, 50.0)
    assert ok is False
    assert "Study hours must be between" in err

    ok, err = _validate(25.0, 50.0)
    assert ok is False

    ok, err = _validate(5.0, -5.0)
    assert ok is False
    assert "Exam score must be between" in err

    ok, err = _validate(5.0, 105.0)
    assert ok is False


def test_validate_nan():
    ok, err = _validate(float("nan"), 50.0)
    assert ok is False
    assert "finite" in err


def test_model_loading_and_prediction():
    model = load_model()
    if model is None:
        pytest.skip("Model artifact not found at configured path.")

    # Test high hours, high previous score -> should predict pass
    res_high = predict(model, 10.0, 85.0)
    assert res_high["ok"] is True
    assert res_high["error"] is None
    assert res_high["predicted_class"] in [0, 1]
    assert res_high["outcome_label"] in ["Pass", "Fail"]
    assert 0.0 <= res_high["pass_probability"] <= 1.0

    # Test what-if curve
    hours, probs = whatif_curve(model, 70.0, hours_range=(0.0, 10.0), n_points=25)
    assert len(hours) == 25
    assert len(probs) == 25
    assert np.all((probs >= 0.0) & (probs <= 1.0))


def test_model_feature_order_matches_metadata():
    assert config.feature_names() == ["Study Hours", "Previous Exam Score"]
    assert config.target_name() == "Pass/Fail"


def test_dataset_cache_and_benchmark():
    df = load_dataset()
    if df is None:
        pytest.skip("Dataset CSV not found at configured path.")
    assert "Study Hours" in df.columns
    assert "Previous Exam Score" in df.columns
    assert "Pass/Fail" in df.columns

    hours = benchmark_hours(75.0)
    assert hours is not None
    assert hours > 0
    # Second call must use the cached frame
    assert load_dataset() is df


def test_session_suggestion_rounds_up():
    df = load_dataset()
    if df is None:
        pytest.skip("Dataset CSV not found at configured path.")
    sug = session_suggestion(80.0, session_min=45)
    assert sug["suggested_session_count"] is not None
    assert sug["suggested_session_count"] >= 1
    assert sug["benchmark_hours"] is not None
    expected = math.ceil(sug["benchmark_hours"] / sug["session_hours"])
    assert sug["suggested_session_count"] == expected


def test_projected_hours_ignore_skipped():
    sessions = [
        SimpleNamespace(id=1, status="scheduled", duration_min=60),
        SimpleNamespace(id=2, status="completed", duration_min=45),
        SimpleNamespace(id=3, status="skipped", duration_min=60),
    ]
    hours = projected_study_hours(sessions, session_min=45)
    assert abs(hours - 1.75) < 1e-9
    hours_excl = projected_study_hours(sessions, session_min=45, exclude_session_id=1)
    assert abs(hours_excl - 0.75) < 1e-9


def test_overall_readiness_priority_weights():
    rows = [
        {"subject_id": 1, "subject_name": "A", "priority": 1, "pass_probability": 0.80,
         "scheduled_hours": 6, "benchmark_hours": 8, "previous_score": 70, "model_available": True},
        {"subject_id": 2, "subject_name": "B", "priority": 3, "pass_probability": 0.20,
         "scheduled_hours": 2, "benchmark_hours": 8, "previous_score": 70, "model_available": True},
    ]
    result = overall_readiness(rows)
    # weights 3 and 1 → (0.8*3 + 0.2*1) / 4 = 0.65
    assert result["overall_pass_probability"] == pytest.approx(0.65)


def test_skip_impact_uses_model_when_available():
    model = load_model()
    if model is None or load_dataset() is None:
        pytest.skip("Model or dataset not available.")
    subject = SimpleNamespace(id=1, name="ML", priority=1, previous_score=75.0)
    sessions = [
        SimpleNamespace(id=1, status="scheduled", duration_min=180),
        SimpleNamespace(id=2, status="scheduled", duration_min=180),
    ]
    impact = skip_impact(subject, sessions, sessions[0], session_min=45)
    assert impact["model_available"] is True
    assert impact["before"] is not None
    assert impact["after"] is not None
    assert impact["scheduled_hours_after"] < impact["scheduled_hours_before"]


def test_subject_stats_hide_probability_without_previous_score():
    subject = SimpleNamespace(id=1, name="ML", priority=1, previous_score=None)
    sessions = [SimpleNamespace(id=1, status="scheduled", duration_min=60)]
    row = subject_pass_stats(subject, sessions, session_min=45)
    assert row["pass_probability"] is None
    assert row["previous_score"] is None


def test_subject_stats_uses_profile_fallback_score():
    model = load_model()
    if model is None:
        pytest.skip("Model not available.")
    subject = SimpleNamespace(id=1, name="ML", priority=1, previous_score=None)
    sessions = [SimpleNamespace(id=1, status="scheduled", duration_min=360)]
    row = subject_pass_stats(
        subject, sessions, session_min=45, fallback_previous_score=68.0
    )
    assert row["previous_score"] == 68.0
    assert row["previous_score_source"] == "profile"
    assert row["pass_probability"] is not None
    assert 0.0 <= row["pass_probability"] <= 1.0
