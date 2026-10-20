"""
test_doc_synthesis.py – Tests for PPT/document quiz and flashcard synthesis.
"""
import pytest
from services.llm import (
    _extract_document_concepts,
    generate_flashcards,
    generate_quiz_from_text,
    generate_quiz,
)

SAMPLE_PPT = """--- Slide 1: Deep Learning Fundamentals ---
Convolutional Neural Networks are designed for spatial data.
Activation Functions introduce non-linear mapping capabilities.
Pooling Layer downsamples spatial feature maps.
--- Slide 2: Optimization ---
Adam Optimizer computes adaptive learning rates dynamically.
Dropout randomly deactivates neurons to prevent co-adaptation.
Learning Rate controls step magnitude along the loss gradient.
"""

def test_extract_document_concepts():
    concepts = _extract_document_concepts(SAMPLE_PPT)
    assert len(concepts) >= 4
    terms = [c["term"].lower() for c in concepts]
    assert any("convolutional" in t or "activation" in t or "pooling" in t for t in terms)

def test_generate_flashcards():
    res = generate_flashcards(SAMPLE_PPT, n_cards=5)
    assert res["ok"] is True
    assert len(res["cards"]) == 5
    for c in res["cards"]:
        assert "front" in c and "back" in c
        assert len(c["front"]) > 3
        assert len(c["back"]) > 5

def test_generate_quiz_from_text():
    res = generate_quiz_from_text(SAMPLE_PPT, n_questions=4, difficulty="medium")
    assert res["ok"] is True
    assert len(res["questions"]) == 4
    for q in res["questions"]:
        assert "question" in q
        assert len(q["options"]) == 4
        assert 0 <= q["correct_index"] <= 3
        assert "explanation" in q

def test_generate_curriculum_quiz_fallback():
    res = generate_quiz("Machine Learning", "Neural Networks", "medium", 5)
    assert res["ok"] is True
    assert len(res["questions"]) == 5
