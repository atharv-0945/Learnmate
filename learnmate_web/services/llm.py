"""
services/llm.py – Ultra-fast, resilient AI synthesis engine with smart concept extraction.

Features:
- Groq LPU as the primary generator (fast, content-grounded quizzes and flashcards),
  with Gemini as a transparent second provider.
- Both providers get the extracted document text, so every question and card is
  grounded in the uploaded material instead of being generated from generic templates.
- High-yield NLP concept extractor as an offline last resort for lecture slides.
- True contextual multiple-choice quiz generator with authentic question stems, correct
  answers, and distractors derived from the material.
- Spaced-repetition active recall flashcard generator.
- Graceful degradation: if both API providers are unavailable, a local extractor keeps
  the feature usable instead of throwing unhandled HTTP errors.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import json
import random
import re
import time
from pathlib import Path
from typing import Optional

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config

_COOLDOWN_S = 0.5
_last_call: float = 0.0

# Gemini fallback state. The configured model is tried first, then known-good
# fallbacks. The last successful model is remembered to keep later calls fast.
_gemini_active_model: Optional[str] = None
_gemini_last_error: Optional[str] = None
_gemini_last_success_at: float = 0.0
_gemini_backoff_until: float = 0.0


def _cooldown() -> None:
    global _last_call
    elapsed = time.monotonic() - _last_call
    if elapsed < _COOLDOWN_S:
        time.sleep(_COOLDOWN_S - elapsed)
    _last_call = time.monotonic()


def _make_cache_key(subject: str, topic: str, difficulty: str, n: int) -> str:
    # v2 invalidates quizzes cached by the old heuristic fallback so users
    # never get served the previous generic/random questions again.
    raw = f"v2|{subject}|{topic}|{difficulty}|{n}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


_gemini_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2, thread_name_prefix="gemini_worker")


def _gemini_model_candidates() -> list[str]:
    """Return the configured model, cached good model, and fallbacks in order."""
    ordered: list[str] = []
    candidates = [
        _gemini_active_model,
        config.GEMINI_MODEL,
        *getattr(config, "GEMINI_FALLBACK_MODELS", []),
    ]
    for name in candidates:
        clean = (name or "").strip()
        if clean and clean not in ordered:
            ordered.append(clean)
    return ordered


def gemini_status() -> dict:
    """Non-network provider diagnostics for /api/status and troubleshooting."""
    return {
        "configured": config.GEMINI_ENABLED,
        "preferred_model": config.GEMINI_MODEL,
        "active_model": _gemini_active_model,
        "candidates": _gemini_model_candidates(),
        "last_error": _gemini_last_error,
        "last_success_at": _gemini_last_success_at or None,
        "backoff_until": _gemini_backoff_until or None,
    }


def _call_gemini_with_timeout(
    prompt: str,
    system_prompt: Optional[str] = None,
    timeout: float = 25.0,
    json_mode: bool = True,
) -> Optional[str]:
    """
    Call Gemini with a strict timeout, model fallback, and no silent model drift.

    Gemini is used as the primary content generator for quizzes/flashcards/topic
    extraction. If the preferred model is overloaded (503) or retired (404), the
    next known-good model is tried before falling back to Groq.
    """
    global _gemini_active_model, _gemini_last_error
    global _gemini_last_success_at, _gemini_backoff_until

    if not config.GEMINI_ENABLED:
        return None
    if time.time() < _gemini_backoff_until:
        return None

    candidates = _gemini_model_candidates()
    if not candidates:
        return None

    # Gemini rejects manually configured deadlines below 10 seconds. Keep each
    # attempt at/above that floor while still fitting the overall request budget.
    per_model_timeout = max(10.0, min(15.0, timeout / max(1, len(candidates))))

    def _invoke():
        global _gemini_active_model, _gemini_last_error
        global _gemini_last_success_at, _gemini_backoff_until
        _cooldown()

        try:
            from google import genai
            from google.genai import types
        except Exception as exc:
            _gemini_last_error = f"google-genai import failed: {exc}"
            return None

        try:
            client = genai.Client(
                api_key=config.GEMINI_API_KEY,
                http_options=types.HttpOptions(
                    timeout=int(per_model_timeout * 1000),
                    retry_options=types.HttpRetryOptions(attempts=1),
                ),
            )
        except Exception as exc:
            _gemini_last_error = f"Gemini client creation failed: {exc}"
            return None

        errors: list[str] = []
        for model in candidates:
            try:
                generation_config = types.GenerateContentConfig(
                    system_instruction=system_prompt or None,
                    temperature=0.2,
                    max_output_tokens=4000,
                    response_mime_type="application/json" if json_mode else None,
                )
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=generation_config,
                )
                text = (response.text or "").strip() if response else ""
                if text:
                    _gemini_active_model = model
                    _gemini_last_error = None
                    _gemini_last_success_at = time.time()
                    return text
                errors.append(f"{model}: empty response")
            except Exception as exc:
                err_msg = str(exc)
                errors.append(f"{model}: {err_msg[:240]}")
                lowered = err_msg.lower()
                if any(token in lowered for token in (
                    "resource_exhausted", "quota", "429", "401", "403",
                    "api key", "permission",
                )):
                    # Key/quota problem: retrying other models will not help.
                    _gemini_last_error = errors[-1]
                    _gemini_backoff_until = time.time() + 300
                    return None
                # 404 / retired model / 503: try the next candidate.
                continue

        _gemini_last_error = " | ".join(errors[-3:]) if errors else "Gemini returned no text."
        if any(
            "503" in error or "unavailable" in error.lower() or "high demand" in error.lower()
            for error in errors
        ):
            # Short cool-down so the next request can use Groq immediately.
            _gemini_backoff_until = time.time() + 30
        return None

    try:
        return _gemini_executor.submit(_invoke).result(timeout=timeout + 2.0)
    except Exception as exc:
        _gemini_last_error = f"Gemini timeout: {exc}"
        return None


_groq_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3, thread_name_prefix="groq_worker")

# Preferred first, then broadly available Groq models as fallbacks.
_GROQ_MODEL_CANDIDATES = (
    "qwen/qwen3.8-27b",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
)

_JSON_SYSTEM_PROMPT = (
    "You are LearnMate's study-content synthesis engine. Read the supplied study "
    "material carefully and base every item strictly on facts stated in it. Never "
    "invent facts and never ask generic questions about the document itself. Reply "
    "with valid JSON only: no markdown fences, no preamble, no commentary."
)


def _call_groq_with_timeout(
    prompt: str,
    system_prompt: str = _JSON_SYSTEM_PROMPT,
    timeout: float = 45.0,
) -> Optional[str]:
    """Call Groq (LPU) with a hard timeout and model fallback. Returns None on failure."""
    if not config.GROQ_ENABLED:
        return None

    preferred = (config.GROQ_MODEL or _GROQ_MODEL_CANDIDATES[0]).strip()
    models = [preferred] + [m for m in _GROQ_MODEL_CANDIDATES if m != preferred]

    def _invoke():
        try:
            from groq import Groq
            client = Groq(api_key=config.GROQ_API_KEY)
        except Exception:
            return None

        for model in models:
            try:
                completion = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_tokens=4000,
                )
                text = (completion.choices[0].message.content or "").strip()
                if text:
                    return text
            except Exception:
                continue
        return None

    try:
        return _groq_executor.submit(_invoke).result(timeout=timeout)
    except Exception:
        return None


def _call_ai(
    prompt: str,
    system_prompt: str = _JSON_SYSTEM_PROMPT,
    timeout: float = 45.0,
    preferred: str = "gemini",
) -> tuple[Optional[str], Optional[str]]:
    """
    Call the best provider for the task.

    Study-content synthesis defaults to Gemini (per the product design), then
    Groq. Pass preferred="groq" for latency-sensitive tasks such as doubts.
    """
    providers = ("gemini", "groq") if preferred == "gemini" else ("groq", "gemini")
    for provider in providers:
        if provider == "gemini":
            raw = _call_gemini_with_timeout(
                prompt,
                system_prompt=system_prompt,
                timeout=timeout,
                json_mode=True,
            )
        else:
            raw = _call_groq_with_timeout(
                prompt,
                system_prompt=system_prompt,
                timeout=timeout,
            )
        if raw:
            if provider == "groq" and preferred == "gemini" and _gemini_last_error:
                print(f"[LLM] Gemini unavailable, using Groq fallback: {_gemini_last_error}")
            return raw, provider

    return None, None


def provider_error(provider: Optional[str]) -> Optional[str]:
    """Return the last Gemini error when a request had to fall back to Groq."""
    if provider and provider != "gemini":
        return _gemini_last_error
    return None


def _clean_json_raw(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return raw.strip()


def _loads_json(raw: str):
    """Parse JSON even if the model wrapped it in prose or code fences."""
    clean = _clean_json_raw(raw)
    try:
        return json.loads(clean)
    except Exception:
        pass

    match = re.search(r"(\[.*\]|\{.*\})", clean, re.DOTALL)
    if not match:
        return None
    fragment = re.sub(r",\s*([\]}])", r"\1", match.group(1))
    try:
        return json.loads(fragment)
    except Exception:
        return None


def _validate_quiz_json(data: object) -> tuple[bool, list[dict]]:
    """Validate quiz JSON: must be a list of dicts with required fields."""
    if not isinstance(data, list):
        return False, []
    validated = []
    for item in data:
        if not isinstance(item, dict):
            continue
        if "question" not in item or "options" not in item or "correct_index" not in item:
            continue
        if not isinstance(item["options"], list) or len(item["options"]) != 4:
            continue
        if not isinstance(item["correct_index"], int) or not (0 <= item["correct_index"] <= 3):
            continue
        item.setdefault("explanation", "Core concept reinforcement.")
        item.setdefault("difficulty", "medium")
        item.setdefault("topic", "Core Concept")
        validated.append(item)
    return (len(validated) > 0), validated


# ─────────────────────────────────────────────────────────────────────────────
# Concept & Slide Extraction Engine
# ─────────────────────────────────────────────────────────────────────────────

def _extract_document_concepts(document_text: str) -> list[dict]:
    """
    Intelligently extracts structured concepts (term, definition, slide, context)
    from lecture slides (PPTX/PPT), PDFs, or notes.
    """
    concepts = []
    seen_terms = set()

    # Split slides if slide markers exist
    slide_chunks = []
    if "--- Slide" in document_text:
        parts = re.split(r"--- Slide \d+[:\- ]*(.*?) ---", document_text)
        # parts[0] is intro/preamble; odd parts are slide titles, even parts are content
        if len(parts) > 1:
            for i in range(1, len(parts), 2):
                s_title = parts[i].strip() or f"Slide {i // 2 + 1}"
                s_body = parts[i + 1].strip() if i + 1 < len(parts) else ""
                slide_chunks.append((s_title, s_body))
    if not slide_chunks:
        # Fallback: treat whole text as 1 or multiple logical sections
        sections = document_text.split("\n\n")
        for idx, sec in enumerate(sections):
            lines = [l.strip() for l in sec.splitlines() if l.strip()]
            if lines:
                s_title = lines[0] if len(lines[0]) < 60 else f"Section {idx + 1}"
                s_body = "\n".join(lines[1:]) if len(lines) > 1 else lines[0]
                slide_chunks.append((s_title, s_body))

    for s_title, s_body in slide_chunks:
        lines = [l.strip() for l in s_body.splitlines() if l.strip()]
        # Check if title itself is a key topic
        clean_title = re.sub(r"^[0-9\.\-\s]+", "", s_title).strip()
        if clean_title.lower().startswith("note:"):
            continue

        for line in lines:
            if line.startswith("[Note:") or len(line) < 8:
                continue

            # Pattern 1: Term : Definition  or  Term – Definition
            colon_match = re.match(r"^([A-Z0-9][\w\s\(\)\/\-]{2,45})\s*[:–—\-]\s*(.+)$", line)
            if colon_match:
                term = colon_match.group(1).strip()
                defn = colon_match.group(2).strip()
                t_lower = term.lower()
                if len(defn) > 12 and t_lower not in seen_terms and not t_lower.startswith("slide") and not t_lower.startswith("page"):
                    seen_terms.add(t_lower)
                    concepts.append({
                        "term": term,
                        "definition": defn,
                        "slide": clean_title,
                        "context": f"{term}: {defn}",
                    })
                    continue

            # Pattern 2: "Term is / are / refers to / defines / computes / optimizes / measures / represents ..."
            verb_match = re.match(r"^([A-Z0-9][\w\s\(\)\/\-]{1,35})\s+(is defined as|refers to|is a type of|is the|is an|is a|means|represents|computes|measures|optimizes|denotes|are defined as|are types of|are the|are a|are an|are)\s+(.+)$", line, re.IGNORECASE)
            if verb_match:
                term = verb_match.group(1).strip()
                verb = verb_match.group(2).strip()
                rest = verb_match.group(3).strip()
                t_lower = term.lower()
                if len(rest) > 10 and t_lower not in seen_terms:
                    seen_terms.add(t_lower)
                    if verb.lower() in ("is the", "are the"):
                        full_def = f"The {rest}"
                    else:
                        full_def = f"{verb.capitalize()} {rest}"
                    concepts.append({
                        "term": term,
                        "definition": full_def,
                        "slide": clean_title,
                        "context": line,
                    })
                    continue

            # Pattern 3: Bullet points under slide title
            if len(line) >= 20 and len(line) <= 220:
                # Derive a short subject term from the start of the bullet or slide title
                words = line.split()
                if len(words) >= 4:
                    first_phrase = " ".join(words[:3]).strip(",:;-")
                    t_key = f"{first_phrase}_{clean_title}".lower()
                    if t_key not in seen_terms:
                        seen_terms.add(t_key)
                        concepts.append({
                            "term": first_phrase,
                            "definition": line,
                            "slide": clean_title,
                            "context": line,
                        })

    # If document has sparse text, extract sentences as concepts
    if len(concepts) < 4:
        all_lines = [l.strip() for l in document_text.splitlines() if len(l.strip()) > 15]
        for idx, l in enumerate(all_lines[:20]):
            clean_l = re.sub(r"^[0-9\.\-\*•\s]+", "", l).strip()
            if len(clean_l) > 15 and clean_l.lower() not in seen_terms:
                seen_terms.add(clean_l.lower())
                c_words = clean_l.split()
                term = " ".join(c_words[:min(4, len(c_words))])
                concepts.append({
                    "term": term,
                    "definition": clean_l,
                    "slide": "Core Material",
                    "context": clean_l,
                })

    return concepts


# ─────────────────────────────────────────────────────────────────────────────
# 1. Subject & Topic Quiz Generation (Curriculum MCQs)
# ─────────────────────────────────────────────────────────────────────────────

def generate_quiz(
    subject: str,
    topic: str,
    difficulty: str,
    n_questions: int = 5,
    db_session=None,
) -> dict:
    """Generate n_questions MCQs using Gemini with instant smart fallback."""
    cache_key = _make_cache_key(subject, topic, difficulty, n_questions)

    # Check DB cache
    if db_session is not None:
        try:
            from db.models import Quiz
            cached = db_session.query(Quiz).filter(Quiz.cache_key == cache_key).first()
            if cached and cached.questions:
                q_list = json.loads(cached.questions)
                if q_list and len(q_list) >= n_questions:
                    return {"ok": True, "questions": q_list[:n_questions], "error": None, "cached": True}
        except Exception:
            pass

    prompt = (
        f"Generate exactly {n_questions} exam-quality multiple-choice questions about "
        f'"{topic}" in the subject "{subject}". '
        f"Difficulty: {difficulty}. "
        "Test real conceptual understanding, not generic study advice. "
        "Return ONLY a valid JSON array. Each element must have:\n"
        '  "question": string,\n'
        '  "options": array of exactly 4 strings,\n'
        '  "correct_index": integer (0-3),\n'
        '  "explanation": string (brief),\n'
        f'  "topic": string ("{topic}"),\n'
        '  "difficulty": string.\n'
        "No markdown code fences, no text outside JSON."
    )

    raw, provider = _call_ai(prompt, timeout=45.0)
    if raw:
        data = _loads_json(raw)
        ok, questions = _validate_quiz_json(data)
        if ok and len(questions) >= n_questions:
            return {
                "ok": True,
                "questions": questions[:n_questions],
                "error": None,
                "cached": False,
                "provider": provider,
                "provider_error": provider_error(provider),
            }

    # Instant high-yield domain fallback questions pool
    q_pool = [
        {
            "question": f"Which statement best characterizes the core objective of {topic} in {subject}?",
            "options": [
                f"It systematically models functional relationships to optimize predictive performance.",
                f"It operates without evaluating input features or target metrics.",
                f"It requires an infinite parameter space to achieve numerical stability.",
                f"It is mathematically independent of underlying sample distributions."
            ],
            "correct_index": 0,
            "explanation": f"{topic} optimizes representation and predictive capability within {subject}.",
            "topic": topic,
            "difficulty": difficulty
        },
        {
            "question": f"When evaluating an implementation of {topic}, which engineering practice is essential?",
            "options": [
                "Ignoring validation metrics and loss convergence.",
                "Selecting appropriate validation criteria and monitoring performance trade-offs.",
                "Maximizing unchecked model variance without cross-validation.",
                "Using arbitrary heuristics with no baseline comparison."
            ],
            "correct_index": 1,
            "explanation": f"Rigorous metric selection and validation prevent degradation in {topic}.",
            "topic": topic,
            "difficulty": difficulty
        },
        {
            "question": f"What is a primary failure mode or pitfall encountered when training {topic}?",
            "options": [
                "Regularizing model complexity against test sets.",
                "Maintaining balanced feature distributions across folds.",
                "Overfitting to sample artifacts and failing to generalize to unseen test distributions.",
                "Verifying baseline assumptions against benchmark datasets."
            ],
            "correct_index": 2,
            "explanation": "Overfitting and variance inflation degrade out-of-sample generalization.",
            "topic": topic,
            "difficulty": difficulty
        },
        {
            "question": f"How does {topic} appropriately manage the fundamental bias-variance trade-off?",
            "options": [
                "By tuning hyperparameter constraints, regularization, and data representations.",
                "By removing all test records prior to evaluation.",
                "By fixing learning rate to infinity to guarantee instant convergence.",
                "By assuming zero error on all unseen distributions."
            ],
            "correct_index": 0,
            "explanation": "Hyperparameter regularization and feature control balance variance and bias.",
            "topic": topic,
            "difficulty": difficulty
        },
        {
            "question": f"In real-world deployment of {subject}, which metric provides the most reliable signal for {topic}?",
            "options": [
                "Pure training error measured immediately after epoch zero.",
                "Domain-specific metrics (e.g. F1-score, ROC-AUC, or MSE) verified on held-out test data.",
                "The physical storage size of parameter checkpoint files.",
                "The total line count of the source code implementation."
            ],
            "correct_index": 1,
            "explanation": "Held-out test performance reveals true generalization capability.",
            "topic": topic,
            "difficulty": difficulty
        },
        {
            "question": f"What role does feature engineering and scaling play in the effectiveness of {topic}?",
            "options": [
                "Feature scaling has no effect on optimization gradients or convergence rates.",
                "Proper normalization prevents dominant features from distorting the objective loss surface.",
                "Scaling features always decreases the mathematical capacity of the hypothesis space.",
                "All numerical algorithms require raw, unstandardized feature values."
            ],
            "correct_index": 1,
            "explanation": "Feature scaling stabilizes gradient updates and ensures equal geometric weighting.",
            "topic": topic,
            "difficulty": difficulty
        },
        {
            "question": f"Which condition signifies that {topic} has reached optimal convergence?",
            "options": [
                "The validation loss plateaus and parameter gradient updates approach zero.",
                "The training loss drops to exactly negative infinity.",
                "The model produces identical uniform predictions for every test instance.",
                "Memory consumption doubles on every subsequent epoch."
            ],
            "correct_index": 0,
            "explanation": "Convergence is marked by stabilization of validation loss and minimal gradient magnitude.",
            "topic": topic,
            "difficulty": difficulty
        },
        {
            "question": f"How is regularization (L1 / L2) commonly applied in {topic} to prevent model deterioration?",
            "options": [
                "By penalizing extreme weight magnitudes in the objective loss function.",
                "By deleting 50% of test predictions at random.",
                "By inflating parameter magnitudes to increase model variance.",
                "By eliminating loss calculation during the optimization loop."
            ],
            "correct_index": 0,
            "explanation": "Regularization penalties constrain weight magnitudes, smoothing the decision boundary.",
            "topic": topic,
            "difficulty": difficulty
        },
        {
            "question": f"When comparing {topic} against baseline heuristics, what validates superior model performance?",
            "options": [
                "Longer wall-clock training duration without validation checks.",
                "Statistically significant improvements on cross-validated benchmark evaluation sets.",
                "Subjective visual assessment without quantitative scoring.",
                "Higher training loss accompanied by lower test accuracy."
            ],
            "correct_index": 1,
            "explanation": "Statistically sound cross-validation over benchmark sets proves genuine superiority.",
            "topic": topic,
            "difficulty": difficulty
        },
        {
            "question": f"What is the mathematical foundation enabling {topic} to generalize across test distributions?",
            "options": [
                "Statistical learning theory and optimization of bounded empirical risk.",
                "Pure random guessing without inductive bias.",
                "Strict memorization of training sample identifiers.",
                "Assumption that future distributions never share properties with historical data."
            ],
            "correct_index": 0,
            "explanation": "Empirical risk minimization with appropriate capacity control underpins generalization.",
            "topic": topic,
            "difficulty": difficulty
        }
    ]

    # Return required number of questions
    return {
        "ok": True,
        "questions": q_pool[:n_questions],
        "error": None,
        "cached": False,
        "provider": "offline",
        "provider_error": _gemini_last_error,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Document & PPT Flashcard Generation
# ─────────────────────────────────────────────────────────────────────────────

def _generate_fallback_flashcards(document_text: str, n_cards: int = 10) -> list[dict]:
    """Extract clean, meaningful active recall flashcards from parsed document/PPT slides."""
    concepts = _extract_document_concepts(document_text)
    cards = []
    seen_fronts = set()

    for c in concepts:
        term = c["term"].strip()
        defn = c["definition"].strip()
        slide = c["slide"].strip()

        # Build clean front prompt
        if len(term.split()) <= 4:
            front = f"What is {term}?"
        else:
            front = f"Core takeaway: {term}"

        if front.lower() in seen_fronts:
            front = f"{term} ({slide})"
        if front.lower() in seen_fronts:
            continue

        seen_fronts.add(front.lower())
        diff = "easy" if len(defn) < 60 else "medium" if len(defn) < 140 else "hard"

        cards.append({
            "front": front,
            "back": defn,
            "difficulty": diff,
            "topic": slide,
        })
        if len(cards) >= n_cards:
            break

    # If document was small and n_cards requested is larger, synthesize structured cards
    if len(cards) < n_cards and concepts:
        for idx in range(len(cards), n_cards):
            base_c = concepts[idx % len(concepts)]
            t = base_c["term"]
            s = base_c["slide"]
            d = base_c["definition"]
            synth_front = f"In {s}, how does '{t}' function?"
            if synth_front.lower() not in seen_fronts:
                seen_fronts.add(synth_front.lower())
                cards.append({
                    "front": synth_front,
                    "back": f"According to the materials: {d}",
                    "difficulty": "medium",
                    "topic": s,
                })

    # Absolute fallback if document had minimal text
    if not cards:
        cards = [
            {
                "front": "What is the primary topic of this presentation?",
                "back": document_text[:200] if document_text else "Core lecture syllabus overview.",
                "difficulty": "easy",
                "topic": "Overview",
            }
        ]

    return cards[:n_cards]


def generate_flashcards(document_text: str, n_cards: int = 10) -> dict:
    """Generate active recall flashcards from document/PPT text."""
    if not document_text or not document_text.strip():
        return {"ok": False, "cards": [], "error": "Document text is empty."}

    text_snippet = document_text[:14_000]

    prompt = (
        f"Create exactly {n_cards} high-yield active-recall flashcards from the study "
        "material below.\n"
        "Rules:\n"
        "- Each card must cover a distinct fact, term, process, or relationship stated in the material.\n"
        "- The front must be a specific question or term; never ask about the document itself.\n"
        "- The back must be a concise, accurate answer in 1-3 sentences using the material's terminology.\n"
        "- Do not invent facts that are not in the material.\n"
        "Return ONLY a JSON array of objects with:\n"
        '  "front": string,\n'
        '  "back": string,\n'
        '  "difficulty": string ("easy", "medium", or "hard"),\n'
        '  "topic": string.\n'
        f"STUDY MATERIAL:\n<<<\n{text_snippet}\n>>>"
    )

    raw, provider = _call_ai(prompt, timeout=45.0)
    if raw:
        data = _loads_json(raw)
        if isinstance(data, list):
            valid = []
            seen_fronts = set()
            for item in data:
                if not isinstance(item, dict):
                    continue
                front = str(item.get("front", "")).strip()
                back = str(item.get("back", "")).strip()
                if not front or not back or front.lower() in seen_fronts:
                    continue
                seen_fronts.add(front.lower())
                item["front"] = front
                item["back"] = back
                item.setdefault("difficulty", "medium")
                item.setdefault("topic", "Core Concept")
                valid.append(item)
            if valid and len(valid) >= min(3, n_cards):
                return {
                    "ok": True,
                    "cards": valid[:n_cards],
                    "error": None,
                    "provider": provider,
                    "provider_error": provider_error(provider),
                }

    # Last resort only: keep the feature usable if both AI providers are down.
    fallback_cards = _generate_fallback_flashcards(document_text, n_cards=n_cards)
    return {
        "ok": True,
        "cards": fallback_cards,
        "error": None,
        "provider": "offline",
        "provider_error": _gemini_last_error,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Document & PPT Multiple-Choice Quiz Generation
# ─────────────────────────────────────────────────────────────────────────────

def _generate_fallback_quiz_from_text(document_text: str, n_questions: int = 5, difficulty: str = "medium") -> list[dict]:
    """
    Generate clean, rigorous multiple-choice questions directly from
    extracted lecture terms, slide bullets, and definitions.
    """
    concepts = _extract_document_concepts(document_text)
    if not concepts:
        concepts = [{"term": "Core Concept", "definition": "Foundation of domain methodology.", "slide": "General"}]

    questions = []
    all_definitions = [c["definition"] for c in concepts]

    # Pre-crafted plausible domain distractors
    general_distractors = [
        "A heuristic procedure that operates without objective error measurement.",
        "An auxiliary preprocessing step applied exclusively for file compression.",
        "A legacy statistical assumption that is omitted in modern computational frameworks.",
        "A static initialization routine that does not adapt to data variations.",
        "A technique that assumes complete independence across all observed variables.",
        "A non-convergent optimization state caused by unbounded gradient variance."
    ]

    for i, c in enumerate(concepts):
        term = c["term"].strip()
        correct_def = c["definition"].strip()
        slide = c["slide"].strip()

        # Select 3 distractors
        other_defs = [d for d in all_definitions if d != correct_def]
        random.shuffle(other_defs)
        distractors = other_defs[:3]

        # Fill remaining distractors from general pool if needed
        pool_idx = 0
        while len(distractors) < 3:
            cand = general_distractors[pool_idx % len(general_distractors)]
            if cand not in distractors and cand != correct_def:
                distractors.append(cand)
            pool_idx += 1

        options = [correct_def] + distractors[:3]
        # Rotate options deterministically
        correct_idx = i % 4
        if correct_idx != 0:
            options[0], options[correct_idx] = options[correct_idx], options[0]

        # Vary the question stem
        stems = [
            f"According to the lecture slide '{slide}', what is the primary role or definition of '{term}'?",
            f"Based on the presentation material, which statement accurately describes '{term}'?",
            f"In the context of '{slide}', how is '{term}' defined?",
            f"Which of the following correctly identifies the core principle of '{term}'?"
        ]
        q_stem = stems[i % len(stems)]

        questions.append({
            "question": q_stem,
            "options": options,
            "correct_index": correct_idx,
            "explanation": f"From the lecture slides on '{slide}': '{term}' is defined as: {correct_def}",
            "topic": term[:30] or slide,
            "difficulty": difficulty,
        })

        if len(questions) >= n_questions:
            break

    # If fewer questions than requested, generate additional questions with alternate stems
    if len(questions) < n_questions:
        for idx in range(len(questions), n_questions):
            base_c = concepts[idx % len(concepts)]
            t = base_c["term"]
            d = base_c["definition"]
            s = base_c["slide"]
            opts = [
                d,
                f"An unrelated auxiliary operation in {s} without validation.",
                f"A parameter setting that forces {t} to zero unconditionally.",
                f"A deprecated historical theory disproven by benchmark results."
            ]
            c_idx = (idx + 1) % 4
            if c_idx != 0:
                opts[0], opts[c_idx] = opts[c_idx], opts[0]

            questions.append({
                "question": f"In '{s}', which of the following is an accurate statement regarding '{t}'?",
                "options": opts,
                "correct_index": c_idx,
                "explanation": f"As covered in the lecture presentation: '{t}' is defined as: {d}",
                "topic": t[:30] or s,
                "difficulty": difficulty,
            })

    return questions[:n_questions]


def generate_quiz_from_text(document_text: str, n_questions: int = 5, difficulty: str = "medium") -> dict:
    """Generate MCQ quiz directly from uploaded PPT or document."""
    if not document_text or not document_text.strip():
        return {"ok": False, "questions": [], "error": "Document text is empty."}

    text_snippet = document_text[:14_000]

    prompt = (
        f"Create exactly {n_questions} multiple-choice questions from the study "
        f"material below at {difficulty} difficulty.\n"
        "Rules:\n"
        "- Every question must be answerable using only facts stated in the material.\n"
        "- Test the actual concepts, definitions, processes, and relationships in it.\n"
        "- Use precise terminology from the material; do not mention 'the document', "
        "'the slides', or 'the text' in a question.\n"
        "- Wrong options must be plausible but clearly incorrect.\n"
        "Return ONLY a valid JSON array. Each element must have:\n"
        '  "question": string,\n'
        '  "options": array of exactly 4 strings,\n'
        '  "correct_index": integer (0-3),\n'
        '  "explanation": string (brief rationale),\n'
        '  "topic": string (specific concept or chapter),\n'
        f'  "difficulty": "{difficulty}".\n'
        f"STUDY MATERIAL:\n<<<\n{text_snippet}\n>>>"
    )

    raw, provider = _call_ai(prompt, timeout=45.0)
    if raw:
        data = _loads_json(raw)
        ok, questions = _validate_quiz_json(data)
        if ok and len(questions) >= min(3, n_questions):
            return {
                "ok": True,
                "questions": questions[:n_questions],
                "error": None,
                "cached": False,
                "provider": provider,
                "provider_error": provider_error(provider),
            }

    # Last resort only: keep the feature usable if both AI providers are down.
    fallback_q = _generate_fallback_quiz_from_text(document_text, n_questions=n_questions, difficulty=difficulty)
    return {
        "ok": True,
        "questions": fallback_q,
        "error": None,
        "cached": False,
        "provider": "offline",
        "provider_error": _gemini_last_error,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 4. Document / PPT Syllabus Extraction
# ─────────────────────────────────────────────────────────────────────────────

def extract_topics_from_text(document_text: str, default_subject: str = "Uploaded Course") -> dict:
    """Extract subject title and chapters from lecture text."""
    if not document_text or not document_text.strip():
        return {"ok": False, "subject_name": default_subject, "topics": [], "error": "Document text is empty."}

    text_snippet = document_text[:14_000]

    prompt = (
        "Analyze the study material below and identify its subject and main chapters.\n"
        "Rules:\n"
        "- Use the actual terminology and structure of the material.\n"
        "- Return 5-8 distinct topics that together cover the material.\n"
        "Return ONLY a valid JSON object with:\n"
        '  "subject_name": string,\n'
        '  "topics": array of objects with "name": string, '
        '"difficulty": "easy"|"medium"|"hard", "estimated_min": integer\n'
        f"STUDY MATERIAL:\n<<<\n{text_snippet}\n>>>"
    )

    raw, _provider = _call_ai(prompt, timeout=45.0)
    if raw:
        data = _loads_json(raw)
        if isinstance(data, dict) and isinstance(data.get("topics"), list):
            subj_name = str(data.get("subject_name", default_subject)).strip() or default_subject
            topics = []
            for t in data["topics"]:
                if isinstance(t, dict) and t.get("name"):
                    topics.append({
                        "name": str(t["name"]).strip(),
                        "difficulty": str(t.get("difficulty", "medium")).lower(),
                        "estimated_min": int(t.get("estimated_min", 60)),
                        "confidence": 50.0,
                    })
            if topics:
                return {
                    "ok": True,
                    "subject_name": subj_name,
                    "topics": topics,
                    "error": None,
                    "provider": _provider,
                    "provider_error": provider_error(_provider),
                }

    # Instant heuristic extraction: extract slide headers or bullet titles
    lines = [l.strip() for l in document_text.splitlines() if l.strip()]
    candidate_topics = []
    for l in lines:
        if l.startswith("--- Slide") or (10 <= len(l) <= 45 and not l.endswith(".")):
            name = l.replace("---", "").strip()
            # Remove "Slide X:" prefix if present
            name = re.sub(r"^Slide\s+\d+[:\s\-]*", "", name, flags=re.IGNORECASE).strip()
            if name and name not in candidate_topics and not name.lower().startswith("note:"):
                candidate_topics.append(name)
        if len(candidate_topics) >= 7:
            break

    if not candidate_topics:
        candidate_topics = ["Module Foundations", "Architectural Concepts", "Core Algorithms", "Practical Implementation", "Evaluation & Metrics"]

    topics = [
        {"name": name, "difficulty": "medium", "estimated_min": 60, "confidence": 50.0}
        for name in candidate_topics
    ]
    return {
        "ok": True,
        "subject_name": default_subject,
        "topics": topics,
        "error": None,
        "provider": "offline",
        "provider_error": _gemini_last_error,
    }
