"""
services/predictor.py

Loads the trained Random-Forest pipeline once (st.cache_resource) and
exposes predict() and whatif_curve().  All validation is here; no UI code.
"""
from __future__ import annotations

import warnings
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config

# ──────────────────────────────────────────────────────────────
# Model loading (called from app.py with st.cache_resource)
# ──────────────────────────────────────────────────────────────

_cached_model = None


def load_model(reload: bool = False):
    """Load and return the trained pipeline.  Returns None on failure."""
    global _cached_model
    if _cached_model is not None and not reload:
        return _cached_model
    if not config.BEST_MODEL_PATH.exists():
        return None
    try:
        import joblib
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            _cached_model = joblib.load(config.BEST_MODEL_PATH)
            return _cached_model
    except Exception:
        return None



# ──────────────────────────────────────────────────────────────
# Input validation
# ──────────────────────────────────────────────────────────────

def _validate(study_hours: float, exam_score: float) -> tuple[bool, str]:
    import math
    if math.isnan(study_hours) or math.isnan(exam_score) or not math.isfinite(study_hours) or not math.isfinite(exam_score):
        return False, "Inputs must be finite numbers."
    if not (config.STUDY_HOURS_MIN <= study_hours <= config.STUDY_HOURS_MAX):
        return False, f"Study hours must be between {config.STUDY_HOURS_MIN} and {config.STUDY_HOURS_MAX}."
    if not (config.EXAM_SCORE_MIN <= exam_score <= config.EXAM_SCORE_MAX):
        return False, f"Exam score must be between {config.EXAM_SCORE_MIN} and {config.EXAM_SCORE_MAX}."
    return True, ""


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
