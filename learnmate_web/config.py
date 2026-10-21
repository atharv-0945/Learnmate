"""
config.py – the single source of truth for environment variables and file paths.

Rules enforced here:
- Only this module reads os.environ / .env.
- All absolute paths are derived from this file's location so the app
  works regardless of the launch directory.
- No other module imports os.environ directly.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Locate important directories
# ---------------------------------------------------------------------------
# learnmate_web/ is the parent of this file
WEBAPP_DIR = Path(__file__).resolve().parent

# The analysis project root is one level up
PROJECT_ROOT = WEBAPP_DIR.parent

# ---------------------------------------------------------------------------
# Load .env (only affects learnmate_web/.env; silently skips if absent)
# ---------------------------------------------------------------------------
load_dotenv(WEBAPP_DIR / ".env", override=True)

# ---------------------------------------------------------------------------
# Gemini / AI settings  (read ONCE, never leaked elsewhere)
# ---------------------------------------------------------------------------
GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
# If the preferred Gemini model is overloaded or retired, try these in order.
# The app also caches the last model that worked, so this list is only a fallback.
GEMINI_FALLBACK_MODELS: list[str] = [
    name.strip()
    for name in os.environ.get(
        "GEMINI_FALLBACK_MODELS",
        "gemini-3.5-flash,gemini-3.6-flash,gemini-flash-lite-latest",
    ).split(",")
    if name.strip()
]
GEMINI_ENABLED: bool = bool(GEMINI_API_KEY)

# ---------------------------------------------------------------------------
# Groq API settings (Ultra-fast LPU inference for Doubt Solver)
# ---------------------------------------------------------------------------
GROQ_API_KEY: str = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL: str = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
GROQ_ENABLED: bool = bool(GROQ_API_KEY)


def reload_env():
    """Reload environment variables from .env to pick up updated API keys."""
    global GEMINI_API_KEY, GEMINI_MODEL, GEMINI_FALLBACK_MODELS, GEMINI_ENABLED
    global GROQ_API_KEY, GROQ_MODEL, GROQ_ENABLED
    load_dotenv(WEBAPP_DIR / ".env", override=True)
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
    GEMINI_FALLBACK_MODELS = [
        name.strip()
        for name in os.environ.get(
            "GEMINI_FALLBACK_MODELS",
            "gemini-3.5-flash,gemini-3.6-flash,gemini-flash-lite-latest",
        ).split(",")
        if name.strip()
    ]
    GEMINI_ENABLED = bool(GEMINI_API_KEY)
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
    GROQ_MODEL = os.environ.get("GROQ_MODEL", "qwen/qwen3.8-27b")
    GROQ_ENABLED = bool(GROQ_API_KEY)

# ---------------------------------------------------------------------------
# Analysis artefact paths (read-only – never modified by the web app)
# ---------------------------------------------------------------------------
MODELS_DIR = PROJECT_ROOT / "models"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
REPORTS_DIR = PROJECT_ROOT / "reports"
DATA_DIR = PROJECT_ROOT / "data"

BEST_MODEL_PATH = MODELS_DIR / "best_model.joblib"
GD_MODEL_PATH = MODELS_DIR / "logistic_regression_gd.joblib"
MODEL_METADATA_PATH = MODELS_DIR / "model_metadata.json"
DATASET_PATH = DATA_DIR / "student_exam_data.csv"

# Output plots (shown in Model Lab)
PLOT_CONFUSION_MATRIX = OUTPUTS_DIR / "confusion_matrix.png"
PLOT_ROC_CURVE = OUTPUTS_DIR / "roc_curve.png"
PLOT_FEATURE_IMPORTANCE = OUTPUTS_DIR / "feature_importance.png"
PLOT_MODEL_F1_COMPARISON = OUTPUTS_DIR / "model_f1_comparison.png"
PLOT_GD_LOSS = OUTPUTS_DIR / "gradient_descent_loss.png"
PLOT_CLASS_DIST = OUTPUTS_DIR / "class_distribution.png"
PLOT_FEATURE_DIST = OUTPUTS_DIR / "feature_distributions.png"
PLOT_CORRELATION = OUTPUTS_DIR / "feature_correlation.png"
PLOT_SCATTER = OUTPUTS_DIR / "scatter_study_vs_score.png"

REPORT_MODEL_COMPARISON = REPORTS_DIR / "model_comparison.csv"
REPORT_CV_RESULTS = REPORTS_DIR / "cross_validation_results.csv"
REPORT_CLASSIFICATION = REPORTS_DIR / "classification_report.txt"

# ---------------------------------------------------------------------------
# Web-app paths
# ---------------------------------------------------------------------------
DB_PATH = WEBAPP_DIR / "learnmate.db"
DB_URL = f"sqlite:///{DB_PATH}"
ASSETS_DIR = WEBAPP_DIR / "assets"
CSS_PATH = ASSETS_DIR / "style.css"

# ---------------------------------------------------------------------------
# Planner constants (all configurable from here, never scattered literals)
# ---------------------------------------------------------------------------
PLANNER_WEIGHTS = {
    "urgency": 0.35,
    "weakness": 0.35,
    "difficulty": 0.20,
    "subject_priority": 0.10,
}
REVISION_RESERVE_FRACTION = 0.20   # 20 % of final period reserved for revision
LOW_QUIZ_SCORE_THRESHOLD = 0.60    # triggers replanning
MIN_QUESTIONS_FOR_LABEL = 3        # need at least 3 answers before weak/mastered labels
DEFAULT_SESSION_MINUTES = 45
DEFAULT_BREAK_MINUTES = 10
MAX_STORED_QUIZZES_PER_USER = 50

# Mastery SGD learning-rate cap
MASTERY_ETA = 0.3

# Difficulty bias values for IRT-style mastery
DIFFICULTY_BIAS = {"easy": -1.0, "medium": 0.0, "hard": 1.0}

# Predictor input validation ranges
STUDY_HOURS_MIN = 0.0
STUDY_HOURS_MAX = 24.0
EXAM_SCORE_MIN = 0.0
EXAM_SCORE_MAX = 100.0

# Model Visualiser (Gradient Descent logistic regression)
VISUALISER_CHART_HOURS_MIN = 0.0
VISUALISER_CHART_HOURS_MAX = 20.0
VISUALISER_GRID_RESOLUTION = 121
VISUALISER_CURVE_POINTS = 121
VISUALISER_DECISION_THRESHOLD = 0.50
VISUALISER_HIGH_CONFIDENCE_THRESHOLD = 0.80

# Dataset-driven timetable / pass-probability (change here, not in services)
BENCHMARK_SCORE_WINDOW = 10.0          # ± points around previous score
BENCHMARK_SCORE_WINDOW_WIDE = 20.0     # fallback window if the tight band is empty
PASS_TARGET_PERCENTAGE = 60.0          # dataset pass threshold on previous exam score
SKIP_WARNING_MIN_DROP = 2.0            # percentage-point drop that flags a skip warning
DATASET_PASS_VALUE = 1                 # Pass/Fail label for a pass in the raw CSV
# Priority 1 = high … 3 = low. Used as weights for overall readiness.
SUBJECT_PRIORITY_WEIGHTS = {1: 3.0, 2: 2.0, 3: 1.0}
COUNTABLE_SESSION_STATUSES = ("scheduled", "completed")

# ---------------------------------------------------------------------------
# Cached metadata helper
# ---------------------------------------------------------------------------
_metadata_cache: dict | None = None


def load_model_metadata() -> dict:
    """Return parsed model_metadata.json (cached after first read)."""
    global _metadata_cache
    if _metadata_cache is None:
        if not MODEL_METADATA_PATH.exists():
            return {}
        with open(MODEL_METADATA_PATH, encoding="utf-8") as f:
            _metadata_cache = json.load(f)
    return _metadata_cache


def feature_names() -> list[str]:
    """Return feature names in the order the model expects."""
    meta = load_model_metadata()
    return meta.get("features", ["Study Hours", "Previous Exam Score"])


def target_name() -> str:
    """Return the dataset target column the model was trained on."""
    meta = load_model_metadata()
    return meta.get("target", "Pass/Fail")
