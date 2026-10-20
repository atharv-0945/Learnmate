"""
tests/test_doubt_solver.py – Unit and integration tests for Groq LPU Academic Doubt Solver.
"""
import json
import pytest
from unittest.mock import patch, MagicMock

from services.doubt_solver import (
    _build_system_prompt,
    _parse_groq_response,
    solve_doubt,
    save_groq_api_key_to_env,
)


def test_build_system_prompt_depths():
    prompt_quick = _build_system_prompt(depth="quick", subject="Physics", topic="Thermodynamics")
    assert "Physics" in prompt_quick
    assert "Thermodynamics" in prompt_quick
    assert "concise" in prompt_quick.lower()

    prompt_deep = _build_system_prompt(depth="deep")
    assert "mathematical" in prompt_deep.lower() or "masterclass" in prompt_deep.lower()

    prompt_exam = _build_system_prompt(depth="exam")
    assert "marking criteria" in prompt_exam.lower() or "exam" in prompt_exam.lower()


def test_parse_groq_response_with_metadata_json():
    raw_mock = (
        "### Gradient Descent Intuition\n\n"
        "Gradient descent steps in the direction of steepest descent.\n\n"
        "```json:metadata\n"
        "{\n"
        '  "key_takeaways": ["Step size depends on learning rate", "Can oscillate if alpha is too high"],\n'
        '  "practice_question": {\n'
        '    "question": "What happens if learning rate is too high?",\n'
        '    "options": ["A) Divergence", "B) Instant convergence"],\n'
        '    "correct_index": 0,\n'
        '    "explanation": "It overshoots the minimum."\n'
        "  }\n"
        "}\n"
        "```"
    )
    parsed = _parse_groq_response(raw_mock)
    assert "Gradient descent steps" in parsed["answer"]
    assert "```json" not in parsed["answer"]
    assert len(parsed["key_takeaways"]) == 2
    assert parsed["key_takeaways"][0] == "Step size depends on learning rate"
    assert parsed["practice_question"] is not None
    assert parsed["practice_question"]["correct_index"] == 0


def test_parse_groq_response_fallback_bullets():
    raw_mock = (
        "Here is the explanation:\n"
        "- First rule of calculus is continuity.\n"
        "- Differentiability implies continuity.\n"
        "- Limits must match from both directions."
    )
    parsed = _parse_groq_response(raw_mock)
    assert len(parsed["key_takeaways"]) >= 3
    assert "continuity" in parsed["key_takeaways"][0].lower()


def test_solve_doubt_empty_query():
    res = solve_doubt(question="")
    assert res["ok"] is False
    assert "empty" in res["error"].lower()


@patch("services.doubt_solver.call_groq_api")
def test_solve_doubt_groq_success(mock_call):
    mock_call.return_value = (
        "### Solution\n\nHere is how you solve it.\n\n"
        "```json:metadata\n"
        '{"key_takeaways": ["Point 1", "Point 2"]}\n'
        "```",
        "qwen/qwen3.8-27b"
    )

    res = solve_doubt(
        question="What is Bayes theorem?",
        subject_name="Statistics",
        topic_name="Probability",
        depth="standard",
        api_key_override="gsk_mock_test_key_12345"
    )

    assert res["ok"] is True
    assert res["provider"] == "groq"
    assert "Point 1" in res["key_takeaways"]
    assert mock_call.called


def test_solve_doubt_offline_guide_when_no_keys():
    with patch("config.GROQ_API_KEY", ""), patch("config.GEMINI_ENABLED", False):
        res = solve_doubt(
            question="Explain Big O notation",
            subject_name="Computer Science",
            topic_name="Algorithms",
        )
        assert res["ok"] is True
        assert res.get("is_setup_required") is True
        assert "console.groq.com" in res["answer"]


def test_api_endpoints():
    from fastapi.testclient import TestClient
    from server import app

    client = TestClient(app)

    # Status check includes groq
    resp = client.get("/api/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "groq_active" in data
    assert "groq_model" in data

    # Solve doubt endpoint test
    with patch("services.doubt_solver.call_groq_api") as mock_groq:
        mock_groq.return_value = (
            "### Fast Fourier Transform\n\nRuns in O(N log N) time.\n\n"
            "```json:metadata\n"
            '{"key_takeaways": ["Divide and conquer", "O(N log N) speedup"]}\n'
            "```",
            "qwen/qwen3.8-27b"
        )
        solve_resp = client.post(
            "/api/doubts/solve",
            json={
                "question": "Explain FFT algorithm",
                "depth": "quick",
                "api_key_override": "gsk_test_key"
            }
        )
        assert solve_resp.status_code == 200
        sol_data = solve_resp.json()
        assert sol_data["ok"] is True
        assert "Fast Fourier" in sol_data["answer"]
        doubt_id = sol_data.get("id")

        # History check
        hist_resp = client.get("/api/doubts")
        assert hist_resp.status_code == 200
        hist_list = hist_resp.json()
        assert any(d["question"] == "Explain FFT algorithm" for d in hist_list)

        # Delete doubt check
        if doubt_id:
            del_resp = client.delete(f"/api/doubts/{doubt_id}")
            assert del_resp.status_code == 200
