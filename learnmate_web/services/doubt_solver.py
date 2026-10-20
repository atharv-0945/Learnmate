"""
services/doubt_solver.py – Academic Doubt Resolution Engine powered by Groq LPU inference.

Features:
- Ultra-fast responses powered by Groq Cloud (Llama 3.3 70B / Llama 3.1 8B).
- Step-by-step conceptual breakdowns, LaTeX formulas, and code block formatting.
- Automatic extraction of Key Takeaways and Active Recall practice questions.
- Resilient fallback to Gemini AI or pedagogical offline templates if API key is absent.
- Safe dynamic API key update helper for the local .env file.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Optional, Dict, Any

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config

# Recommended default Groq model for deep academic reasoning
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


def _build_system_prompt(depth: str = "standard", subject: Optional[str] = None, topic: Optional[str] = None) -> str:
    ctx = []
    if subject:
        ctx.append(f"Subject: {subject}")
    if topic:
        ctx.append(f"Topic: {topic}")
    context_str = f"Context: {', '.join(ctx)}." if ctx else ""

    depth_instructions = {
        "quick": (
            "Provide a concise, direct, high-impact explanation in under 3 paragraphs. "
            "Focus on immediate clarity, intuition, and removing the student's confusion fast."
        ),
        "standard": (
            "Provide a comprehensive, pedagogical explanation with clear section headers: "
            "1. Core Intuition / Big Picture\n"
            "2. Step-by-Step Breakdown\n"
            "3. Worked Example or Code/Math Proof (if applicable)\n"
            "4. Common Pitfalls & Traps to Avoid"
        ),
        "deep": (
            "Provide an in-depth, rigorous masterclass breakdown. "
            "Delve into underlying mathematical foundations, edge cases, real-world analogies, and advanced nuances."
        ),
        "exam": (
            "Provide an exam-oriented solution. Highlight exact marking criteria, common student pitfalls, "
            "standard formulas, and a short memory mnemonic to remember this for tests."
        )
    }.get(depth, "standard")

    return f"""You are LearnMate's Elite Academic AI Doubt Solver and Master Tutor.
{context_str}

Your goal is to eliminate student confusion with maximum clarity, intellectual rigor, and encouragement.

Guidelines:
- Explain complex ideas using simple, vivid analogies before diving into technicalities.
- Format mathematical equations using standard LaTeX ($inline$ or $$block$$).
- Format code blocks using appropriate syntax highlighting (e.g. ```python ... ```).
- Follow this resolution style: {depth_instructions}
- At the very end of your response, output a strict JSON block labeled ```json:metadata containing:
  "key_takeaways": [3 to 4 concise bullet points summarizing the core insight],
  "practice_question": {{
      "question": "A short active recall conceptual check question",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_index": 0,
      "explanation": "Brief explanation why"
  }}
"""


def _parse_groq_response(raw_text: str) -> Dict[str, Any]:
    """Extract markdown text, key takeaways, and practice question from response."""
    key_takeaways = []
    practice_question = None
    clean_text = raw_text

    # Search for ```json:metadata or ```json block at end
    meta_match = re.search(r"```(?:json:metadata|json)\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if meta_match:
        try:
            data = json.loads(meta_match.group(1))
            if isinstance(data.get("key_takeaways"), list):
                key_takeaways = [str(k) for k in data["key_takeaways"]]
            if isinstance(data.get("practice_question"), dict):
                practice_question = data["practice_question"]
            # Clean markdown of the metadata block for display
            clean_text = raw_text[:meta_match.start()].strip()
        except Exception:
            pass

    # Fallback extraction if no JSON block was matched
    if not key_takeaways:
        bullets = re.findall(r"(?:^|\n)[-*•]\s+(.+)", clean_text)
        if bullets:
            key_takeaways = bullets[:4]
        else:
            key_takeaways = [
                "Understand the fundamental definition and underlying principles.",
                "Trace through each step methodically to verify consistency.",
                "Review edge cases and common exam pitfalls."
            ]

    return {
        "answer": clean_text,
        "key_takeaways": key_takeaways,
        "practice_question": practice_question,
    }


DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b"
CANDIDATE_GROQ_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "allam-2-7b",
]


def call_groq_api(
    prompt: str,
    system_prompt: str,
    api_key: str,
    model: str = DEFAULT_GROQ_MODEL,
    temperature: float = 0.3,
    max_tokens: int = 2500,
) -> tuple[str, str]:
    """
    Call Groq API using the official groq SDK with automatic multi-model fallback.
    Returns (response_text, model_used).
    """
    from groq import Groq
    client = Groq(api_key=api_key)

    # Put desired model first, followed by other fallback candidates
    models_to_try = [model] + [m for m in CANDIDATE_GROQ_MODELS if m != model]
    last_err = None

    for m in models_to_try:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                model=m,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            content = chat_completion.choices[0].message.content or ""
            if content.strip():
                return content, m
        except Exception as e:
            last_err = e
            err_msg = str(e).lower()
            # If model not found or access denied, continue to next candidate
            if "not found" in err_msg or "model_not_found" in err_msg or "does not exist" in err_msg:
                continue
            # For other errors, continue to try other candidates as well
            continue

    if last_err:
        raise last_err
    raise RuntimeError("No Groq models could generate a response.")


def solve_doubt(
    question: str,
    subject_name: Optional[str] = None,
    topic_name: Optional[str] = None,
    depth: str = "standard",
    api_key_override: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Solve an academic doubt with high clarity using Groq LPU inference.
    Falls back gracefully to Gemini or offline structured template if Groq key is unset.
    """
    t0 = time.perf_counter()
    api_key = (api_key_override or config.GROQ_API_KEY).strip()
    preferred_model = (config.GROQ_MODEL or DEFAULT_GROQ_MODEL).strip()
    system_prompt = _build_system_prompt(depth, subject_name, topic_name)

    user_query = question.strip()
    if not user_query:
        return {
            "ok": False,
            "error": "Question cannot be empty.",
            "answer": "",
            "key_takeaways": [],
            "practice_question": None,
            "model_used": preferred_model,
            "provider": "none",
            "latency_ms": 0,
        }

    # 1. Attempt Groq Cloud LPU
    if api_key:
        try:
            raw_response, model_used = call_groq_api(
                prompt=user_query,
                system_prompt=system_prompt,
                api_key=api_key,
                model=preferred_model,
            )
            parsed = _parse_groq_response(raw_response)
            latency_ms = int((time.perf_counter() - t0) * 1000)
            return {
                "ok": True,
                "answer": parsed["answer"],
                "key_takeaways": parsed["key_takeaways"],
                "practice_question": parsed["practice_question"],
                "model_used": model_used,
                "provider": "groq",
                "latency_ms": latency_ms,
            }
        except Exception as groq_err:
            error_str = str(groq_err)
            print(f"[DoubtSolver] Groq call failed: {error_str}. Attempting Gemini fallback...")

    # 2. Fallback to Gemini if configured
    if config.GEMINI_ENABLED:
        try:
            from google import genai
            client = genai.Client(api_key=config.GEMINI_API_KEY)
            gemini_prompt = f"{system_prompt}\n\nStudent Question:\n{user_query}"
            resp = client.models.generate_content(
                model=config.GEMINI_MODEL,
                contents=gemini_prompt,
            )
            raw_text = resp.text or ""
            parsed = _parse_groq_response(raw_text)
            latency_ms = int((time.perf_counter() - t0) * 1000)
            return {
                "ok": True,
                "answer": parsed["answer"],
                "key_takeaways": parsed["key_takeaways"],
                "practice_question": parsed["practice_question"],
                "model_used": config.GEMINI_MODEL,
                "provider": "gemini_fallback",
                "latency_ms": latency_ms,
            }
        except Exception as gem_err:
            print(f"[DoubtSolver] Gemini fallback also failed: {gem_err}")

    # 3. Offline Pedagogical Template / Setup Guide
    latency_ms = int((time.perf_counter() - t0) * 1000)
    topic_str = f" in **{topic_name}**" if topic_name else ""
    subj_str = f" ({subject_name})" if subject_name else ""

    offline_solution = f"""### ⚡ Doubt Solver Setup Required

You asked:
> **"{user_query}"**{topic_str}{subj_str}

To get instant, ultra-fast LPU answers powered by **Groq (`llama-3.3-70b-versatile`)**:

1. **Get a free Groq API key**:
   - Go to [https://console.groq.com/keys](https://console.groq.com/keys)
   - Click **Create API Key** (it's 100% free with massive rate limits).
2. **Add your key**:
   - Paste it in the **Groq API Key configuration box** on this screen or in your `.env` file (`GROQ_API_KEY=gsk_...`).
   - Your key is strictly kept local and hidden from Git via `.gitignore`.

---

### 📖 Preliminary Conceptual Roadmap
While your Groq API key is being configured:
- **Core Principle**: Check the fundamental definitions of the variables and concepts involved in your question.
- **Decomposition**: Break the problem down into given inputs, target unknowns, and governing laws.
- **Verification**: Test edge values (e.g. $0, 1, \\infty$) to check consistency.
"""

    return {
        "ok": True,
        "is_setup_required": True,
        "answer": offline_solution,
        "key_takeaways": [
            "Configure your free GROQ_API_KEY from console.groq.com/keys.",
            "Groq provides sub-second reasoning speeds with Llama 3.3 70B.",
            "Once saved, full step-by-step math, code, and active recall tests activate instantly."
        ],
        "practice_question": None,
        "model_used": "offline_guide",
        "provider": "offline",
        "latency_ms": latency_ms,
    }


def save_groq_api_key_to_env(new_key: str, model_name: str = DEFAULT_GROQ_MODEL) -> Dict[str, Any]:
    """
    Persist GROQ_API_KEY safely to learnmate_web/.env without modifying other secrets.
    Reloads config immediately so changes take effect without server restart.
    """
    clean_key = new_key.strip()
    clean_model = (model_name or DEFAULT_GROQ_MODEL).strip()
    env_path = config.WEBAPP_DIR / ".env"

    try:
        lines = []
        if env_path.exists():
            lines = env_path.read_text(encoding="utf-8").splitlines()

        groq_key_found = False
        groq_model_found = False
        new_lines = []

        for line in lines:
            if line.startswith("GROQ_API_KEY="):
                new_lines.append(f"GROQ_API_KEY={clean_key}")
                groq_key_found = True
            elif line.startswith("GROQ_MODEL="):
                new_lines.append(f"GROQ_MODEL={clean_model}")
                groq_model_found = True
            else:
                new_lines.append(line)

        if not groq_key_found:
            new_lines.append(f"GROQ_API_KEY={clean_key}")
        if not groq_model_found:
            new_lines.append(f"GROQ_MODEL={clean_model}")

        env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")

        # Reload environment
        config.reload_env()

        return {
            "ok": True,
            "message": "Groq API key saved and activated successfully.",
            "groq_enabled": config.GROQ_ENABLED,
            "groq_model": config.GROQ_MODEL,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": f"Failed to save .env: {str(e)}",
        }
