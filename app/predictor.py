"""
LearnMate AI - Student Exam Performance Predictor Module
=========================================================
This module loads the trained machine learning model artifacts and provides
robust, validated prediction functions for student exam pass/fail outcomes.

Boundary Note:
--------------
Predictions and estimated probabilities produced by this module are statistical
approximations derived from historical/synthetic training patterns. They do NOT
constitute a guarantee of student success or replace teacher guidance, syllabus
coverage, or real-time assessment data.
"""

import os
import math
import numbers
import joblib
import numpy as np
import pandas as pd


# Default paths relative to workspace root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEST_MODEL_PATH = os.path.join(BASE_DIR, "models", "best_model.joblib")
GD_MODEL_PATH = os.path.join(BASE_DIR, "models", "logistic_regression_gd.joblib")


def validate_student_inputs(study_hours: float, previous_exam_score: float) -> tuple[float, float]:
    """
    Validates that inputs are numeric, finite, non-null, and within valid domain ranges.
    
    Parameters
    ----------
    study_hours : float or int
        Daily or total weekly study hours dedicated by the student (must be >= 0 and <= 24).
    previous_exam_score : float or int
        Previous exam score or baseline academic percentage (must be in [0, 100]).
        
    Returns
    -------
    tuple of (float, float)
        Validated float values for study_hours and previous_exam_score.
        
    Raises
    ------
    TypeError
        If inputs are None, strings, or non-numeric types.
    ValueError
        If inputs are NaN, infinite, or out of realistic domain bounds.
    """
    # 1. Type validation
    if study_hours is None or previous_exam_score is None:
        raise TypeError("Both 'study_hours' and 'previous_exam_score' must be provided (cannot be None).")
    
    if not isinstance(study_hours, numbers.Real) or isinstance(study_hours, bool):
        raise TypeError(f"Invalid type for study_hours: {type(study_hours).__name__}. Must be a real number.")
    
    if not isinstance(previous_exam_score, numbers.Real) or isinstance(previous_exam_score, bool):
        raise TypeError(f"Invalid type for previous_exam_score: {type(previous_exam_score).__name__}. Must be a real number.")
        
    # 2. Finite / NaN checks
    study_hours = float(study_hours)
    previous_exam_score = float(previous_exam_score)
    
    if math.isnan(study_hours) or math.isinf(study_hours):
        raise ValueError("study_hours must be a finite real number (not NaN or Infinite).")
        
    if math.isnan(previous_exam_score) or math.isinf(previous_exam_score):
        raise ValueError("previous_exam_score must be a finite real number (not NaN or Infinite).")
        
    # 3. Domain boundaries
    if study_hours < 0.0:
        raise ValueError(f"study_hours cannot be negative. Received: {study_hours}")
    if study_hours > 24.0:
        raise ValueError(f"study_hours exceeds maximum daily bound of 24 hours. Received: {study_hours}")
        
    if previous_exam_score < 0.0 or previous_exam_score > 100.0:
        raise ValueError(f"previous_exam_score must be between 0.0 and 100.0. Received: {previous_exam_score}")
        
    return study_hours, previous_exam_score


class StudentPerformancePredictor:
    """
    Production-ready wrapper around trained classification artifacts.
    """
    def __init__(self, model_path: str = BEST_MODEL_PATH):
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at: {model_path}. Train the pipeline first.")
        self.model_path = model_path
        self.model = joblib.load(model_path)
        self.is_gd_bundle = isinstance(self.model, dict) and self.model.get('model_class') == 'LogisticRegressionGD'

    def predict(self, study_hours: float, previous_exam_score: float) -> dict:
        """
        Predict student pass/fail outcome and probability.
        
        Returns
        -------
        dict with keys:
            - study_hours (float)
            - previous_exam_score (float)
            - predicted_class (int): 0 for Fail, 1 for Pass
            - outcome_label (str): 'Pass' or 'Fail'
            - pass_probability (float): Estimated likelihood of passing [0.0 - 1.0]
            - confidence_percentage (float): Probability expressed as a percentage
            - interpretation (str): Pedagogical takeaway for LearnMate planner
            - disclaimer (str): Educational ethics statement
        """
        hours, score = validate_student_inputs(study_hours, previous_exam_score)
        
        if self.is_gd_bundle:
            # Predict using custom Gradient Descent weights and scaler
            mean = np.array(self.model['scaler_mean'])
            scale = np.array(self.model['scaler_scale'])
            weights = np.array(self.model['weights'])
            bias = self.model['bias']
            
            raw = np.array([[hours, score]])
            scaled = (raw - mean) / scale
            z = np.dot(scaled, weights) + bias
            z = np.clip(z, -500, 500)
            p_pass = float(1.0 / (1.0 + np.exp(-z))) if z >= 0 else float(np.exp(z) / (1.0 + np.exp(z)))
            pred_class = int(p_pass >= 0.5)
        else:
            # Predict using scikit-learn Pipeline
            features_df = pd.DataFrame([{
                'Study Hours': hours,
                'Previous Exam Score': score
            }])
            pred_class = int(self.model.predict(features_df)[0])
            if hasattr(self.model, "predict_proba"):
                probs = self.model.predict_proba(features_df)[0]
                p_pass = float(probs[1])
            else:
                p_pass = 1.0 if pred_class == 1 else 0.0

        label = "Pass" if pred_class == 1 else "Fail"
        confidence_pct = round(p_pass * 100, 2)
        
        # Educational interpretation
        if pred_class == 1:
            if p_pass >= 0.85:
                interpretation = (
                    f"Strong likelihood of Passing ({confidence_pct}%). "
                    "The student maintains a consistent study routine and strong foundational score. "
                    "LearnMate recommendation: Focus on high-yield revision and challenging mock tests."
                )
            else:
                interpretation = (
                    f"Moderate likelihood of Passing ({confidence_pct}%). "
                    "The student meets baseline criteria but is near the decision threshold. "
                    "LearnMate recommendation: Reinforce weak topics and add 1-2 hours of targeted practice."
                )
        else:
            if p_pass <= 0.20:
                interpretation = (
                    f"High Risk of Academic Failure ({confidence_pct}% pass probability). "
                    "Significant deficit in study hours or previous exam performance. "
                    "LearnMate recommendation: Immediate intervention required. Schedule foundational doubt-solving sessions."
                )
            else:
                interpretation = (
                    f"Borderline / Academic Risk ({confidence_pct}% pass probability). "
                    "Student has potential to transition to a pass by increasing daily study dedication. "
                    "LearnMate recommendation: Structure a structured 2-week catch-up study schedule."
                )

        return {
            "study_hours": hours,
            "previous_exam_score": score,
            "predicted_class": pred_class,
            "outcome_label": label,
            "pass_probability": round(p_pass, 4),
            "confidence_percentage": confidence_pct,
            "interpretation": interpretation,
            "disclaimer": (
                "Notice: Statistical estimate derived from student_exam_data.csv patterns. "
                "Not an absolute guarantee. Combine with continuous teacher evaluations."
            )
        }


# Quick function wrapper for external imports
def predict_student_outcome(study_hours: float, previous_exam_score: float, model_path: str = BEST_MODEL_PATH) -> dict:
    predictor = StudentPerformancePredictor(model_path=model_path)
    return predictor.predict(study_hours, previous_exam_score)


if __name__ == "__main__":
    print("="*70)
    print("LearnMate Model Predictor - Verification Test Suite")
    print("="*70)
    
    predictor = StudentPerformancePredictor()
    
    test_cases = [
        {"hours": 7.5, "score": 85.0, "description": "High Study Hours + High Score (Expected: Pass)"},
        {"hours": 2.5, "score": 45.0, "description": "Low Study Hours + Low Score (Expected: Fail)"},
        {"hours": 8.0, "score": 55.0, "description": "High Study Hours + Sub-60 Score (Expected: Fail due to score threshold)"},
        {"hours": 3.0, "score": 90.0, "description": "Low Study Hours + High Score (Expected: Fail due to hours threshold)"},
        {"hours": 5.5, "score": 65.0, "description": "Boundary Case: Just above both thresholds (Expected: Pass)"}
    ]
    
    for idx, tc in enumerate(test_cases, 1):
        res = predictor.predict(tc["hours"], tc["score"])
        print(f"\n[Test Case {idx}] {tc['description']}")
        print(f"  Inputs: Study Hours = {res['study_hours']}, Previous Score = {res['previous_exam_score']}")
        print(f"  Prediction: {res['outcome_label']} (Class {res['predicted_class']}) | Probability: {res['confidence_percentage']}%")
        print(f"  Analysis: {res['interpretation']}")
        
    print("\n[Input Validation Tests]")
    invalid_cases = [
        (-1.5, 80.0, "Negative study hours"),
        (5.0, 105.0, "Score > 100"),
        ("five", 80.0, "String input"),
        (None, 80.0, "None input"),
        (float('nan'), 80.0, "NaN input")
    ]
    for h, s, label in invalid_cases:
        try:
            validate_student_inputs(h, s)
            print(f"  FAILED to catch error for: {label}")
        except (ValueError, TypeError) as e:
            print(f"  PASSED: Caught expected error for {label} -> {type(e).__name__}: {e}")
            
    print("\nAll verification tests completed successfully.")
