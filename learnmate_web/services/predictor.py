"""
services/predictor.py

Loads the trained Random-Forest pipeline and the raw exam dataset once.
All pass-probability and benchmark queries live here; the timetable only
displays results returned by these functions.
"""
from __future__ import annotations

import math
import warnings
from pathlib import Path
from typing import Any, Optional

import numpy as np
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config

# ──────────────────────────────────────────────────────────────
# Model + dataset loading (once at startup; never retrain)
# ──────────────────────────────────────────────────────────────

_cached_model = None
_model_load_attempted = False
_cached_dataset: Optional[pd.DataFrame] = None
_dataset_load_attempted = False

# Model Visualiser caches (Gradient Descent model, scatter, boundary grid).
# They are built during warmup() and then read-only for the process lifetime.
_cached_gd_model = None
_gd_load_attempted = False
_visualiser_scatter_cache: Optional[dict] = None
_visualiser_scatter_attempted = False
_visualiser_boundary_cache: Optional[dict] = None
_visualiser_boundary_attempted = False
_visualiser_curve_cache: dict[tuple[float, int], list[dict]] = {}


def load_model(reload: bool = False):
    """Load and return the trained pipeline.  Returns None on failure."""
    global _cached_model, _model_load_attempted
    if _cached_model is not None and not reload:
        return _cached_model
    if _model_load_attempted and not reload:
        return _cached_model
    _model_load_attempted = True
    if not config.BEST_MODEL_PATH.exists():
        _cached_model = None
        return None
    try:
        import joblib
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            _cached_model = joblib.load(config.BEST_MODEL_PATH)
            return _cached_model
    except Exception:
        _cached_model = None
        return None


def load_gd_model(reload: bool = False):
    """Load the custom Gradient Descent logistic-regression artifact once."""
    global _cached_gd_model, _gd_load_attempted
    if _cached_gd_model is not None and not reload:
        return _cached_gd_model
    if _gd_load_attempted and not reload:
        return _cached_gd_model
    _gd_load_attempted = True
    if not config.GD_MODEL_PATH.exists():
        _cached_gd_model = None
        return None
    try:
        import joblib
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            _cached_gd_model = joblib.load(config.GD_MODEL_PATH)
            return _cached_gd_model
    except Exception:
        _cached_gd_model = None
        return None


def load_dataset(reload: bool = False) -> Optional[pd.DataFrame]:
    """Read student_exam_data.csv once and cache the frame."""
    global _cached_dataset, _dataset_load_attempted
    if _cached_dataset is not None and not reload:
        return _cached_dataset
    if _dataset_load_attempted and not reload:
        return _cached_dataset
    _dataset_load_attempted = True
    if not config.DATASET_PATH.exists():
        _cached_dataset = None
        return None
    try:
        _cached_dataset = pd.read_csv(config.DATASET_PATH)
        return _cached_dataset
    except Exception:
        _cached_dataset = None
        return None


def warmup() -> None:
    """Load models/dataset and cache the visualiser's static artifacts."""
    load_model()
    load_dataset()
    load_gd_model()
    _build_visualiser_scatter()
    _build_visualiser_boundary()


def model_available() -> bool:
    return load_model() is not None


def gd_model_available() -> bool:
    return load_gd_model() is not None


# ──────────────────────────────────────────────────────────────
# Input validation
# ──────────────────────────────────────────────────────────────

def _validate(study_hours: float, exam_score: float) -> tuple[bool, str]:
    if math.isnan(study_hours) or math.isnan(exam_score) or not math.isfinite(study_hours) or not math.isfinite(exam_score):
        return False, "Inputs must be finite numbers."
    if not (config.STUDY_HOURS_MIN <= study_hours <= config.STUDY_HOURS_MAX):
        return False, f"Study hours must be between {config.STUDY_HOURS_MIN} and {config.STUDY_HOURS_MAX}."
    if not (config.EXAM_SCORE_MIN <= exam_score <= config.EXAM_SCORE_MAX):
        return False, f"Exam score must be between {config.EXAM_SCORE_MIN} and {config.EXAM_SCORE_MAX}."
    return True, ""


def _clip_hours(study_hours: float) -> float:
    return float(min(config.STUDY_HOURS_MAX, max(config.STUDY_HOURS_MIN, study_hours)))


# ──────────────────────────────────────────────────────────────
# Prediction
# ──────────────────────────────────────────────────────────────

def predict(
    model,
    study_hours: float,
    exam_score: float,
) -> dict:
    """
    Returns:
        {
          ok: bool,
          error: str | None,
          predicted_class: int | None,
          outcome_label: str | None,
          pass_probability: float | None,
        }
    """
    if model is None:
        return {"ok": False, "error": "Model not loaded.", "predicted_class": None,
                "outcome_label": None, "pass_probability": None}

    ok, err = _validate(study_hours, exam_score)
    if not ok:
        return {"ok": False, "error": err, "predicted_class": None,
                "outcome_label": None, "pass_probability": None}

    features = config.feature_names()
    X = pd.DataFrame([[study_hours, exam_score]], columns=features)
    pred_class = int(model.predict(X)[0])
    prob = float(model.predict_proba(X)[0][1]) if hasattr(model, "predict_proba") else float(pred_class)

    return {
        "ok": True,
        "error": None,
        "predicted_class": pred_class,
        "outcome_label": "Pass" if pred_class == 1 else "Fail",
        "pass_probability": prob,
    }


# ──────────────────────────────────────────────────────────────
# Model Visualiser – Gradient Descent logistic regression
# ──────────────────────────────────────────────────────────────

def _gd_probability_values(model, hours, previous_score):
    """Vectorised sigmoid probability for the custom GD model artifact."""
    if not isinstance(model, dict):
        return None
    weights = model.get("weights") or []
    mean = model.get("scaler_mean") or [0.0, 0.0]
    scale = model.get("scaler_scale") or [1.0, 1.0]
    if len(weights) < 2 or len(mean) < 2 or len(scale) < 2:
        return None
    if float(scale[0]) == 0.0 or float(scale[1]) == 0.0:
        return None

    h = np.asarray(hours, dtype=float)
    z = (
        float(weights[0]) * (h - float(mean[0])) / float(scale[0])
        + float(weights[1]) * (float(previous_score) - float(mean[1])) / float(scale[1])
        + float(model.get("bias", 0.0))
    )
    z = np.clip(z, -60.0, 60.0)
    return 1.0 / (1.0 + np.exp(-z))


def _algorithm_label(model) -> str:
    class_name = str(model.get("model_class", "")) if isinstance(model, dict) else ""
    if "logistic" in class_name.lower():
        return "Logistic Regression"
    return class_name or "Logistic Regression"


def _training_label(model) -> str:
    class_name = str(model.get("model_class", "")) if isinstance(model, dict) else ""
    if "gd" in class_name.lower() or "gradient" in class_name.lower():
        return "Gradient Descent"
    return "Gradient Descent"


def predict_gd(study_hours: float, previous_score: float) -> dict:
    """Run one prediction through the custom Gradient Descent model."""
    model = load_gd_model()
    if model is None:
        return {
            "ok": False,
            "error": "Gradient Descent model not loaded.",
            "pass_probability": None,
            "probability_pct": None,
            "is_pass": None,
        }

    ok, err = _validate(study_hours, previous_score)
    if not ok:
        return {
            "ok": False,
            "error": err,
            "pass_probability": None,
            "probability_pct": None,
            "is_pass": None,
        }

    probs = _gd_probability_values(model, [study_hours], previous_score)
    if probs is None:
        return {
            "ok": False,
            "error": "Gradient Descent model artifact is malformed.",
            "pass_probability": None,
            "probability_pct": None,
            "is_pass": None,
        }

    prob = float(np.asarray(probs).reshape(-1)[0])
    threshold = config.VISUALISER_DECISION_THRESHOLD
    return {
        "ok": True,
        "error": None,
        "study_hours": round(float(study_hours), 2),
        "previous_score": round(float(previous_score), 2),
        "pass_probability": prob,
        "probability_pct": round(prob * 100.0, 1),
        "is_pass": bool(prob >= threshold),
        "threshold": threshold,
    }


def _build_visualiser_scatter() -> dict:
    """Cache the raw dataset as render-ready pass/fail points."""
    global _visualiser_scatter_cache, _visualiser_scatter_attempted
    if _visualiser_scatter_cache is not None:
        return _visualiser_scatter_cache
    if _visualiser_scatter_attempted:
        return _visualiser_scatter_cache or {"points": [], "count": 0, "pass_count": 0, "fail_count": 0}
    _visualiser_scatter_attempted = True

    df = load_dataset()
    features = config.feature_names()
    target = config.target_name()
    if df is None or any(col not in df.columns for col in (features[0], features[1], target)):
        _visualiser_scatter_cache = {
            "points": [],
            "count": 0,
            "pass_count": 0,
            "fail_count": 0,
        }
        return _visualiser_scatter_cache

    points = []
    for hours, score, label in zip(df[features[0]], df[features[1]], df[target]):
        passed = bool(int(label) == config.DATASET_PASS_VALUE)
        points.append({
            "hours": round(float(hours), 3),
            "score": round(float(score), 3),
            "pass": passed,
        })

    pass_count = sum(1 for point in points if point["pass"])
    _visualiser_scatter_cache = {
        "points": points,
        "count": len(points),
        "pass_count": pass_count,
        "fail_count": len(points) - pass_count,
    }
    return _visualiser_scatter_cache


def _contour_hours(row_probs: np.ndarray, hours: np.ndarray, threshold: float) -> float:
    """Find the x-axis crossing of the probability contour in one grid row."""
    above = row_probs >= threshold
    if not bool(above.any()):
        return float(hours[-1])
    if bool(above.all()):
        return float(hours[0])

    idx = int(np.argmax(above))
    if idx == 0:
        return float(hours[0])
    p_low = float(row_probs[idx - 1])
    p_high = float(row_probs[idx])
    if p_high == p_low:
        return float(hours[idx])
    fraction = (threshold - p_low) / (p_high - p_low)
    return float(hours[idx - 1] + fraction * (hours[idx] - hours[idx - 1]))


def _build_visualiser_boundary() -> dict:
    """
    Build and cache a probability grid across the chart area.

    The grid is sampled once at startup; the 50% contour and the two shaded
    regions are derived from it, so the web page never runs model maths.
    """
    global _visualiser_boundary_cache, _visualiser_boundary_attempted
    if _visualiser_boundary_cache is not None:
        return _visualiser_boundary_cache
    if _visualiser_boundary_attempted:
        return _visualiser_boundary_cache or {"ok": False, "line": [], "pass_region": [], "fail_region": []}
    _visualiser_boundary_attempted = True

    model = load_gd_model()
    if model is None:
        _visualiser_boundary_cache = {
            "ok": False,
            "line": [],
            "pass_region": [],
            "fail_region": [],
            "grid_resolution": 0,
            "threshold": config.VISUALISER_DECISION_THRESHOLD,
        }
        return _visualiser_boundary_cache

    hours = np.linspace(
        config.VISUALISER_CHART_HOURS_MIN,
        config.VISUALISER_CHART_HOURS_MAX,
        config.VISUALISER_GRID_RESOLUTION,
    )
    scores = np.linspace(
        config.EXAM_SCORE_MIN,
        config.EXAM_SCORE_MAX,
        config.VISUALISER_GRID_RESOLUTION,
    )
    grid = np.asarray([
        _gd_probability_values(model, hours, float(score))
        for score in scores
    ])

    threshold = config.VISUALISER_DECISION_THRESHOLD
    line = [
        [round(_contour_hours(grid[i], hours, threshold), 3), round(float(scores[i]), 3)]
        for i in range(len(scores))
    ]

    x_min = float(hours[0])
    x_max = float(hours[-1])
    y_min = float(scores[0])
    y_max = float(scores[-1])

    right_region = (
        [[line[0][0], y_min]]
        + line
        + [[x_max, y_max], [x_max, y_min]]
    )
    left_region = (
        [[x_min, y_min]]
        + line
        + [[x_min, y_max]]
    )

    right_is_pass = bool(float(grid[len(scores) // 2, -1]) >= threshold)
    pass_region = right_region if right_is_pass else left_region
    fail_region = left_region if right_is_pass else right_region

    _visualiser_boundary_cache = {
        "ok": True,
        "threshold": threshold,
        "line": line,
        "pass_region": pass_region,
        "fail_region": fail_region,
        "grid_resolution": int(len(hours)),
        "x_range": [x_min, x_max],
        "y_range": [y_min, y_max],
    }
    return _visualiser_boundary_cache


def visualiser_overview() -> dict:
    """Metadata, dataset cloud, and cached boundary for the visualiser page."""
    model = load_gd_model()
    metadata = config.load_model_metadata()
    scatter = _build_visualiser_scatter()
    boundary = _build_visualiser_boundary()

    dataset_size = int(scatter.get("count") or metadata.get("dataset_rows") or 0)
    training_steps = None
    learning_rate = None
    if isinstance(model, dict):
        if model.get("epochs") is not None:
            training_steps = int(model["epochs"])
        if model.get("learning_rate") is not None:
            learning_rate = float(model["learning_rate"])
    if training_steps is None and metadata.get("training_steps") is not None:
        training_steps = int(metadata["training_steps"])

    return {
        "ok": model is not None,
        "error": None if model is not None else "Gradient Descent model not loaded.",
        "meta": {
            "algorithm": _algorithm_label(model),
            "trained_with": _training_label(model),
            "training_steps": training_steps,
            "learning_rate": learning_rate,
            "dataset_size": dataset_size,
            "features": (
                model.get("feature_names")
                if isinstance(model, dict) and model.get("feature_names")
                else config.feature_names()
            ),
        },
        "thresholds": {
            "decision": config.VISUALISER_DECISION_THRESHOLD,
            "high_confidence": config.VISUALISER_HIGH_CONFIDENCE_THRESHOLD,
        },
        "ranges": {
            "hours": [config.STUDY_HOURS_MIN, config.STUDY_HOURS_MAX],
            "chart_hours": [
                config.VISUALISER_CHART_HOURS_MIN,
                config.VISUALISER_CHART_HOURS_MAX,
            ],
            "score": [config.EXAM_SCORE_MIN, config.EXAM_SCORE_MAX],
        },
        "scatter": scatter,
        "boundary": boundary,
    }


def sigmoid_curve(previous_score: float) -> dict:
    """Sweep study hours at a fixed previous score through the GD model."""
    model = load_gd_model()
    if model is None:
        return {"ok": False, "error": "Gradient Descent model not loaded.", "points": []}

    ok, err = _validate(0.0, previous_score)
    if not ok:
        return {"ok": False, "error": err, "points": []}

    score = round(float(previous_score), 3)
    n_points = config.VISUALISER_CURVE_POINTS
    cache_key = (score, n_points)
    cached = _visualiser_curve_cache.get(cache_key)
    if cached is not None:
        return {"ok": True, "error": None, "points": cached, "cached": True}

    hours = np.linspace(
        config.VISUALISER_CHART_HOURS_MIN,
        config.VISUALISER_CHART_HOURS_MAX,
        n_points,
    )
    probs = _gd_probability_values(model, hours, score)
    if probs is None:
        return {"ok": False, "error": "Gradient Descent model artifact is malformed.", "points": []}

    points = [
        {"hours": round(float(h), 3), "probability": round(float(p), 5)}
        for h, p in zip(hours, probs)
    ]
    if len(_visualiser_curve_cache) >= 32:
        _visualiser_curve_cache.clear()
    _visualiser_curve_cache[cache_key] = points
    return {"ok": True, "error": None, "points": points, "cached": False}


def visualiser_state(study_hours: float, previous_score: float) -> dict:
    """One live prediction plus the sigmoid curve for the current score."""
    prediction = predict_gd(study_hours, previous_score)
    if not prediction.get("ok"):
        return {
            "ok": False,
            "error": prediction.get("error", "Prediction failed."),
            "prediction": None,
            "curve": [],
        }

    curve = sigmoid_curve(previous_score)
    if not curve.get("ok"):
        return {
            "ok": False,
            "error": curve.get("error", "Curve generation failed."),
            "prediction": prediction,
            "curve": [],
        }

    return {
        "ok": True,
        "error": None,
        "prediction": prediction,
        "curve": curve.get("points", []),
        "thresholds": {
            "decision": config.VISUALISER_DECISION_THRESHOLD,
            "high_confidence": config.VISUALISER_HIGH_CONFIDENCE_THRESHOLD,
        },
        "ranges": {
            "chart_hours": [
                config.VISUALISER_CHART_HOURS_MIN,
                config.VISUALISER_CHART_HOURS_MAX,
            ],
            "score": [config.EXAM_SCORE_MIN, config.EXAM_SCORE_MAX],
        },
    }


def whatif_curve(
    model,
    exam_score: float,
    hours_range: tuple[float, float] = (0.0, 12.0),
    n_points: int = 60,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Vary study hours from hours_range[0] to hours_range[1] while keeping
    exam_score fixed.  Returns (hours_array, probability_array).
    """
    if model is None:
        return np.array([]), np.array([])
    hours = np.linspace(hours_range[0], hours_range[1], n_points)
    features = config.feature_names()
    X = pd.DataFrame({"Study Hours": hours,
                       "Previous Exam Score": np.full(n_points, exam_score)})
    X = X[features]
    probs = model.predict_proba(X)[:, 1]
    return hours, probs


# ──────────────────────────────────────────────────────────────
# Dataset benchmark
# ──────────────────────────────────────────────────────────────

def benchmark_hours(previous_score: float) -> Optional[float]:
    """
    Median Study Hours among students who passed and whose Previous Exam
    Score is within BENCHMARK_SCORE_WINDOW of `previous_score`.
    Widens to BENCHMARK_SCORE_WINDOW_WIDE if the tight band is empty.
    """
    df = load_dataset()
    if df is None or previous_score is None:
        return None
    try:
        score = float(previous_score)
    except (TypeError, ValueError):
        return None
    if math.isnan(score):
        return None

    features = config.feature_names()
    hours_col, score_col = features[0], features[1]
    target_col = config.target_name()
    if hours_col not in df.columns or score_col not in df.columns or target_col not in df.columns:
        return None

    passed = df[df[target_col] == config.DATASET_PASS_VALUE]
    if passed.empty:
        return None

    def _median_in_window(window: float) -> Optional[float]:
        band = passed[
            (passed[score_col] >= score - window)
            & (passed[score_col] <= score + window)
        ]
        if band.empty:
            return None
        return float(band[hours_col].median())

    result = _median_in_window(config.BENCHMARK_SCORE_WINDOW)
    if result is None:
        result = _median_in_window(config.BENCHMARK_SCORE_WINDOW_WIDE)
    return result


# ──────────────────────────────────────────────────────────────
# Hours + subject / overall readiness
# ──────────────────────────────────────────────────────────────

def session_hours(duration_min: Optional[int], fallback_min: int) -> float:
    minutes = duration_min if duration_min and duration_min > 0 else fallback_min
    return max(0.0, float(minutes) / 60.0)


def projected_study_hours(
    sessions: list[Any],
    session_min: int,
    *,
    exclude_session_id: Optional[int] = None,
    extra_hours: float = 0.0,
) -> float:
    """Sum duration of scheduled + completed sessions, in hours."""
    total = 0.0
    countable = set(config.COUNTABLE_SESSION_STATUSES)
    for sess in sessions:
        if exclude_session_id is not None and getattr(sess, "id", None) == exclude_session_id:
            continue
        if getattr(sess, "status", None) not in countable:
            continue
        total += session_hours(getattr(sess, "duration_min", None), session_min)
    return total + extra_hours


def _probability_for_hours(study_hours: float, previous_score: float) -> Optional[float]:
    model = load_model()
    if model is None:
        return None
    clipped = _clip_hours(study_hours)
    res = predict(model, clipped, previous_score)
    if not res.get("ok"):
        return None
    return res.get("pass_probability")


def subject_pass_stats(
    subject: Any,
    sessions: list[Any],
    session_min: int,
    *,
    exclude_session_id: Optional[int] = None,
    extra_hours: float = 0.0,
    fallback_previous_score: Optional[float] = None,
) -> dict:
    """Pass probability, scheduled hours, and dataset benchmark for one subject.

    Subjects created before per-subject scores existed have ``previous_score``
    set to None.  When ``fallback_previous_score`` is supplied (the student's
    profile score) it is used instead so the subject still contributes to
    overall readiness instead of silently dropping out of the average.
    """
    prev = getattr(subject, "previous_score", None)
    score_source = "subject" if prev is not None else None
    if prev is None and fallback_previous_score is not None:
        prev = fallback_previous_score
        score_source = "profile"
    hours = projected_study_hours(
        sessions,
        session_min,
        exclude_session_id=exclude_session_id,
        extra_hours=extra_hours,
    )
    bench = benchmark_hours(prev) if prev is not None else None
    available = model_available()
    prob = None
    if available and prev is not None:
        prob = _probability_for_hours(hours, float(prev))

    return {
        "subject_id": getattr(subject, "id", None),
        "subject_name": getattr(subject, "name", ""),
        "priority": getattr(subject, "priority", 2) or 2,
        "previous_score": float(prev) if prev is not None else None,
        "previous_score_source": score_source,
        "scheduled_hours": round(hours, 2),
        "benchmark_hours": round(bench, 2) if bench is not None else None,
        "pass_probability": prob,
        "model_available": available,
    }


def overall_readiness(subject_rows: list[dict]) -> dict:
    """Priority-weighted average of per-subject pass probabilities."""
    available = model_available()
    weights = config.SUBJECT_PRIORITY_WEIGHTS
    numer = 0.0
    denom = 0.0
    breakdown = []
    for row in subject_rows:
        prob = row.get("pass_probability")
        if prob is None:
            breakdown.append({
                **row,
                "weight": weights.get(int(row.get("priority") or 2), 1.0),
            })
            continue
        w = weights.get(int(row.get("priority") or 2), 1.0)
        numer += float(prob) * w
        denom += w
        breakdown.append({**row, "weight": w})

    overall = (numer / denom) if denom > 0 else None
    return {
        "model_available": available,
        "overall_pass_probability": overall,
        "subjects": breakdown,
    }


def session_suggestion(previous_score: float, session_min: int) -> dict:
    """
    Benchmark hours ÷ session length, rounded up, plus projected pass
    probability if that many sessions are accepted.
    """
    available = model_available()
    bench = benchmark_hours(previous_score)
    length_h = session_hours(session_min, session_min) or (config.DEFAULT_SESSION_MINUTES / 60.0)
    suggested = None
    projected_hours = None
    prob = None
    if bench is not None and length_h > 0:
        suggested = int(math.ceil(bench / length_h))
        projected_hours = suggested * length_h
        if available:
            prob = _probability_for_hours(projected_hours, float(previous_score))
    return {
        "model_available": available,
        "benchmark_hours": round(bench, 2) if bench is not None else None,
        "session_hours": round(length_h, 4),
        "suggested_session_count": suggested,
        "projected_hours": round(projected_hours, 2) if projected_hours is not None else None,
        "pass_probability": prob,
    }


def skip_impact(
    subject: Any,
    sessions: list[Any],
    session: Any,
    session_min: int,
) -> dict:
    """Before/after pass probability if `session` is skipped or deleted."""
    available = model_available()
    before_row = subject_pass_stats(subject, sessions, session_min)
    after_row = subject_pass_stats(
        subject,
        sessions,
        session_min,
        exclude_session_id=getattr(session, "id", None),
    )
    before = before_row.get("pass_probability")
    after = after_row.get("pass_probability")
    drop_pct = None
    if before is not None and after is not None:
        drop_pct = round((before - after) * 100.0, 2)
    return {
        "model_available": available,
        "before": before,
        "after": after,
        "drop_percentage_points": drop_pct,
        "warn": bool(drop_pct is not None and drop_pct >= config.SKIP_WARNING_MIN_DROP),
        "scheduled_hours_before": before_row.get("scheduled_hours"),
        "scheduled_hours_after": after_row.get("scheduled_hours"),
        "subject_name": before_row.get("subject_name"),
    }


def build_user_readiness(
    subjects: list[Any],
    sessions_by_subject: dict[int, list],
    session_min: int,
    *,
    fallback_previous_score: Optional[float] = None,
) -> dict:
    rows = [
        subject_pass_stats(
            subj,
            sessions_by_subject.get(subj.id, []),
            session_min,
            fallback_previous_score=fallback_previous_score,
        )
        for subj in subjects
    ]
    return overall_readiness(rows)


def to_percent(prob: Optional[float]) -> Optional[float]:
    if prob is None:
        return None
    return round(float(prob) * 100.0, 1)
