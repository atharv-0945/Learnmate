"""
tests/test_mastery.py – Tests for Bayesian / IRT mastery tracking and SGD updates.
"""
import pytest
from services.mastery import (
    _sigmoid, _logit,
    confidence_to_theta, theta_to_confidence,
    update_theta, mastery_label
)
from config import MIN_QUESTIONS_FOR_LABEL


def test_sigmoid_logit_roundtrip():
    for p in [0.1, 0.3, 0.5, 0.7, 0.9]:
        logit_val = _logit(p)
        recovered_p = _sigmoid(logit_val)
        assert pytest.approx(recovered_p, abs=1e-4) == p


def test_confidence_to_theta():
    theta_50 = confidence_to_theta(50.0)
    assert pytest.approx(theta_50, abs=1e-4) == 0.0

    theta_90 = confidence_to_theta(90.0)
    assert theta_90 > 0.0

    theta_10 = confidence_to_theta(10.0)
    assert theta_10 < 0.0


def test_update_theta_increases_on_correct():
    initial_theta = 0.0
    updated = update_theta(initial_theta, is_correct=True, difficulty="medium")
    assert updated > initial_theta


def test_update_theta_decreases_on_incorrect():
    initial_theta = 0.0
    updated = update_theta(initial_theta, is_correct=False, difficulty="medium")
    assert updated < initial_theta


def test_difficulty_bias_impact():
    # Solving a hard question should yield larger theta increase than solving an easy question
    theta = 0.0
    delta_hard = update_theta(theta, is_correct=True, difficulty="hard") - theta
    delta_easy = update_theta(theta, is_correct=True, difficulty="easy") - theta
    assert delta_hard > delta_easy


def test_mastery_label_learning_before_threshold():
    # Even if theta is very high, if n_answered < MIN_QUESTIONS_FOR_LABEL, label is 'learning'
    assert mastery_label(theta=5.0, n_answered=MIN_QUESTIONS_FOR_LABEL - 1) == "learning"
    assert mastery_label(theta=-5.0, n_answered=MIN_QUESTIONS_FOR_LABEL - 1) == "learning"


def test_mastery_label_after_threshold():
    # High theta -> mastered
    assert mastery_label(theta=2.5, n_answered=MIN_QUESTIONS_FOR_LABEL) == "mastered"
    # Low theta -> weak
    assert mastery_label(theta=-2.5, n_answered=MIN_QUESTIONS_FOR_LABEL) == "weak"
    # Medium theta -> learning
    assert mastery_label(theta=0.0, n_answered=MIN_QUESTIONS_FOR_LABEL) == "learning"
