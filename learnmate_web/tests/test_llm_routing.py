"""
tests/test_llm_routing.py – Provider routing tests for Gemini/Groq.
"""
from unittest.mock import patch

import services.llm as llm
from services.doubt_solver import solve_doubt


def test_call_ai_prefers_gemini_for_content_generation():
    with patch("services.llm._call_gemini_with_timeout", return_value='[{"ok": true}]') as gemini, \
         patch("services.llm._call_groq_with_timeout", return_value='[{"ok": true}]') as groq:
        raw, provider = llm._call_ai("generate a quiz")

    assert raw == '[{"ok": true}]'
    assert provider == "gemini"
    gemini.assert_called_once()
    groq.assert_not_called()


def test_call_ai_falls_back_to_groq_when_gemini_fails():
    with patch("services.llm._call_gemini_with_timeout", return_value=None), \
         patch("services.llm._call_groq_with_timeout", return_value='[{"ok": true}]'):
        raw, provider = llm._call_ai("generate a quiz")

    assert raw == '[{"ok": true}]'
    assert provider == "groq"


def test_call_ai_can_prefer_groq_for_low_latency_tasks():
    with patch("services.llm._call_gemini_with_timeout", return_value='{"ok": true}') as gemini, \
         patch("services.llm._call_groq_with_timeout", return_value='{"ok": true}') as groq:
        raw, provider = llm._call_ai("solve this doubt", preferred="groq")

    assert raw == '{"ok": true}'
    assert provider == "groq"
    groq.assert_called_once()
    gemini.assert_not_called()


def test_gemini_model_candidates_are_deduplicated():
    with patch.object(llm.config, "GEMINI_MODEL", "gemini-3.8-flash"), \
         patch.object(llm.config, "GEMINI_FALLBACK_MODELS", ["gemini-3.6-flash", "gemini-3.8-flash"]), \
         patch.object(llm, "_gemini_active_model", "gemini-3.6-flash"):
        candidates = llm._gemini_model_candidates()

    assert candidates == ["gemini-3.6-flash", "gemini-3.8-flash"]


@patch("services.doubt_solver.call_groq_api", side_effect=RuntimeError("groq unavailable"))
@patch("services.llm._call_gemini_with_timeout", return_value=(
    "### Gemini fallback answer\n\n"
    "```json:metadata\n"
    '{"key_takeaways": ["Fallback works"]}\n'
    "```"
))
@patch("services.llm.gemini_status", return_value={"active_model": "gemini-3.6-flash"})
def test_solve_doubt_uses_gemini_when_groq_fails(mock_status, mock_gemini, mock_groq):
    with patch("config.GEMINI_ENABLED", True):
        res = solve_doubt(
            question="What is a derivative?",
            api_key_override="gsk_invalid_test_key",
        )

    assert res["ok"] is True
    assert res["provider"] == "gemini_fallback"
    assert res["model_used"] == "gemini-3.6-flash"
    assert "Fallback works" in res["key_takeaways"]
    mock_groq.assert_called_once()
    mock_gemini.assert_called_once()
