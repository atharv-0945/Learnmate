"""
tests/test_predictor.py – Tests for ML prediction and what-if curve generation.
"""
import math
import numpy as np
import pytest

from services.predictor import _validate, predict, whatif_curve, load_model


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
