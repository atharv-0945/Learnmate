"""
tests/test_visualiser.py – Tests for the Gradient Descent model visualiser service.
"""
import config
from services.predictor import (
    load_gd_model,
    predict_gd,
    sigmoid_curve,
    visualiser_overview,
    visualiser_state,
)


def test_gd_artifact_is_the_custom_logistic_regression():
    model = load_gd_model()
    assert isinstance(model, dict)
    assert "LogisticRegression" in model.get("model_class", "")
    assert len(model.get("weights", [])) == 2
    assert model.get("epochs", 0) > 0


def test_gd_prediction_moves_with_study_hours():
    low = predict_gd(2.0, 68.0)
    high = predict_gd(12.0, 68.0)
    assert low["ok"] is True
    assert high["ok"] is True
    assert high["pass_probability"] > low["pass_probability"]
    assert low["is_pass"] is False
    assert high["is_pass"] is True


def test_gd_prediction_validates_inputs():
    res = predict_gd(25.0, 68.0)
    assert res["ok"] is False
    assert "Study hours must be between" in res["error"]


def test_sigmoid_curve_is_swept_and_cached():
    low = sigmoid_curve(50.0)
    high = sigmoid_curve(95.0)
    assert low["ok"] is True
    assert high["ok"] is True
    assert len(low["points"]) == config.VISUALISER_CURVE_POINTS
    assert low["points"][0]["hours"] == config.VISUALISER_CHART_HOURS_MIN
    assert low["points"][-1]["hours"] == config.VISUALISER_CHART_HOURS_MAX

    midpoint = len(low["points"]) // 2
    assert high["points"][midpoint]["probability"] > low["points"][midpoint]["probability"]

    again = sigmoid_curve(50.0)
    assert again["cached"] is True


def test_visualiser_overview_has_runtime_metadata_and_cached_artifacts():
    overview = visualiser_overview()
    assert overview["ok"] is True
    assert overview["meta"]["algorithm"] == "Logistic Regression"
    assert overview["meta"]["trained_with"] == "Gradient Descent"
    assert overview["meta"]["training_steps"] == load_gd_model()["epochs"]
    assert overview["meta"]["dataset_size"] == overview["scatter"]["count"]
    assert overview["scatter"]["count"] == (
        overview["scatter"]["pass_count"] + overview["scatter"]["fail_count"]
    )

    boundary = overview["boundary"]
    assert boundary["ok"] is True
    assert boundary["grid_resolution"] == config.VISUALISER_GRID_RESOLUTION
    assert len(boundary["line"]) == config.VISUALISER_GRID_RESOLUTION
    assert boundary["pass_region"]
    assert boundary["fail_region"]
    assert boundary["line"][0][1] == config.EXAM_SCORE_MIN
    assert boundary["line"][-1][1] == config.EXAM_SCORE_MAX


def test_visualiser_state_returns_prediction_and_curve():
    state = visualiser_state(8.0, 68.0)
    assert state["ok"] is True
    assert state["prediction"]["study_hours"] == 8.0
    assert 0.0 <= state["prediction"]["pass_probability"] <= 1.0
    assert len(state["curve"]) == config.VISUALISER_CURVE_POINTS
    assert state["thresholds"]["decision"] == config.VISUALISER_DECISION_THRESHOLD
    assert state["thresholds"]["high_confidence"] == config.VISUALISER_HIGH_CONFIDENCE_THRESHOLD
