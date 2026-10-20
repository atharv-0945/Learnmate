"""
seed_aiml_data.py – Seed the LearnMate DB with AIML subjects + topics.

Run once:  python seed_aiml_data.py
"""
from __future__ import annotations

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db.session import init_db, get_db
from db.models import User, Subject, Topic
from services.mastery import confidence_to_theta

AIML_SUBJECTS = [
    {
        "name": "Machine Learning",
        "exam_date": "2027-01-15",
        "priority": 1,
        "topics": [
            ("Supervised Learning",           "medium", 50, 90),
            ("Unsupervised Learning",          "medium", 45, 80),
            ("Linear Regression",              "easy",   60, 60),
            ("Logistic Regression",            "medium", 55, 75),
            ("Decision Trees & Random Forests","medium", 50, 90),
            ("Support Vector Machines",        "hard",   35, 100),
            ("Neural Networks & Deep Learning","hard",   30, 120),
            ("Gradient Descent & Optimization","hard",   40, 90),
            ("Overfitting, Bias-Variance",     "medium", 55, 75),
            ("Model Evaluation & Cross-Validation", "medium", 60, 60),
        ],
    },
    {
        "name": "Artificial Intelligence",
        "exam_date": "2027-02-20",
        "priority": 2,
        "topics": [
            ("Search Algorithms (BFS, DFS, A*)", "medium", 50, 80),
            ("Knowledge Representation",          "medium", 45, 90),
            ("Bayesian Networks & Probability",   "hard",   35, 100),
            ("Natural Language Processing (NLP)", "hard",   30, 120),
            ("Reinforcement Learning",             "hard",   25, 120),
            ("Computer Vision & CNNs",             "hard",   30, 120),
            ("Transformer Architecture & LLMs",    "hard",   25, 120),
            ("Ethics & Fairness in AI",            "easy",   70, 60),
            ("Data Preprocessing & Feature Eng.",  "medium", 60, 75),
            ("Dimensionality Reduction (PCA/t-SNE)","medium",45, 90),
        ],
    },
]


def seed() -> None:
    init_db()
    db = get_db()
    try:
        user = db.query(User).first()
        if not user:
            print("No user found. Run the app first to create the default user, then re-run this script.")
            return

        user_id = user.id
        print(f"Seeding for user: {user.name} (id={user_id})")

        for subj_data in AIML_SUBJECTS:
            # Skip if subject already exists
            existing = (
                db.query(Subject)
                .filter(Subject.user_id == user_id, Subject.name == subj_data["name"])
                .first()
            )
            if existing:
                print(f"  Subject '{subj_data['name']}' already exists -- skipping.")
                continue

            subj = Subject(
                user_id=user_id,
                name=subj_data["name"],
                exam_date=subj_data["exam_date"],
                priority=subj_data["priority"],
            )
            db.add(subj)
            db.flush()

            for name, diff, conf, est_min in subj_data["topics"]:
                t = Topic(
                    user_id=user_id,
                    subject_id=subj.id,
                    name=name,
                    difficulty=diff,
                    confidence=float(conf),
                    theta=confidence_to_theta(float(conf)),
                    estimated_min=est_min,
                )
                db.add(t)

            print(f"  Created subject '{subj_data['name']}' with {len(subj_data['topics'])} topics.")

        db.commit()
        print("\nDone! Open the app -> Subjects & Topics or AI Quizzes to use the new data.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
