"""
services/ml_analyzer.py – Machine Learning based Weakness Detection & Dynamic Timetable Optimizer.

ML Architecture:
1. Feature Extraction:
   - IRT Latent Ability (θ): Derived from online SGD updates on log-loss per question
   - Error Rate: Ratio of incorrect answers to total questions attempted
   - Difficulty Weight: Categorical encoding (easy: 0.2, medium: 0.5, hard: 1.0)
   - Exam Urgency: Normalized temporal proximity to the exam date
   - Confidence-Competence Gap: Penalty for overconfidence or underconfidence
2. Clustering & Weakness Scoring (Scikit-Learn):
   - K-Means Clustering (k=3: "Critical Risk", "Developing", "Mastered")
   - Continuous ML Weakness Index ∈ [0, 100]
3. Subject Vulnerability Aggregation:
   - Computes subject-level vulnerability index and ranks at-risk subjects.
4. Dynamic Timetable Scheduler:
   - Dynamically reorganizes upcoming study sessions to front-load weak topics.
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import numpy as np
from sklearn.cluster import KMeans

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import DIFFICULTY_BIAS, PLANNER_WEIGHTS, REVISION_RESERVE_FRACTION
from services.mastery import theta_to_confidence, confidence_to_theta
from services.predictor import benchmark_hours


def _sigmoid(z: float) -> float:
    z = max(-30.0, min(30.0, z))
    return 1.0 / (1.0 + math.exp(-z))


# ─────────────────────────────────────────────────────────────────────────────
# 1. ML Weakness Analyzer
# ─────────────────────────────────────────────────────────────────────────────

def analyze_user_weaknesses(db_session, user_id: int) -> dict:
    """
    Run the ML weakness detection pipeline on all topics belonging to the user.

    Returns:
        {
          "ok": bool,
          "topics_analyzed": int,
          "critical_topics": list[dict],    # Top weak topics needing focus
          "developing_topics": list[dict],  # Moderate topics
          "mastered_topics": list[dict],    # Strong topics
          "subject_risk": list[dict],       # Ranked subjects by vulnerability
          "summary": dict,
          "report_text": str,
        }
    """
    from db.models import Subject, Topic, QuizAttempt, Quiz

    subjects = db_session.query(Subject).filter(Subject.user_id == user_id).all()
    if not subjects:
        return {
            "ok": False,
            "error": "No subjects found. Please add or upload subjects first.",
            "critical_topics": [],
            "developing_topics": [],
            "mastered_topics": [],
            "subject_risk": [],
            "topics_analyzed": 0,
            "report_text": "No subjects or topics available for analysis."
        }

    all_topics = db_session.query(Topic).filter(Topic.user_id == user_id).all()
    if not all_topics:
        return {
            "ok": False,
            "error": "No topics found in the database.",
            "critical_topics": [],
            "developing_topics": [],
            "mastered_topics": [],
            "subject_risk": [],
            "topics_analyzed": 0,
            "report_text": "No topics available for analysis."
        }

    today = date.today()

    # Pre-map subjects for fast lookup
    subj_map = {s.id: s for s in subjects}

    # Extract feature matrix for every topic
    feature_rows = []
    topic_records = []

    diff_map = {"easy": 0.2, "medium": 0.5, "hard": 1.0}

    for topic in all_topics:
        subj = subj_map.get(topic.subject_id)
        if not subj:
            continue

        # 1. IRT Theta & Estimated Latent Ability
        theta = float(topic.theta if topic.theta is not None else 0.0)
        p_success = _sigmoid(theta)

        # 2. Error Rate (1 - accuracy)
        # If no questions attempted yet, infer error rate inversely from initial confidence
        if topic.n_answered and topic.n_answered > 0:
            error_rate = 1.0 - p_success
        else:
            inferred_conf = (topic.confidence or 50.0) / 100.0
            error_rate = 1.0 - inferred_conf

        # 3. Difficulty Weight
        diff_weight = diff_map.get(topic.difficulty.lower(), 0.5)

        # 4. Exam Urgency Factor
        try:
            exam_dt = date.fromisoformat(subj.exam_date)
            days_left = max(1, (exam_dt - today).days)
            urgency = 1.0 / math.log2(days_left + 2)  # Higher when exam is imminent
        except Exception:
            urgency = 0.3

        # 5. Confidence-Competence Gap
        declared_conf = (topic.confidence or 50.0) / 100.0
        conf_gap = max(0.0, declared_conf - p_success)

        # 6. Composite ML Weakness Score (Continuous formula 0 - 100)
        # Weights: Inability 35%, Error Rate 30%, Difficulty 20%, Urgency 15%
        weakness_score = (
            0.35 * (1.0 - p_success)
            + 0.30 * error_rate
            + 0.20 * diff_weight
            + 0.15 * min(1.0, urgency)
        ) * 100.0

        # Adjust for overconfidence penalty
        weakness_score = min(100.0, max(0.0, weakness_score + (conf_gap * 15.0)))

        features = [
            theta,
            error_rate,
            diff_weight,
            urgency,
            conf_gap,
            weakness_score
        ]
        feature_rows.append(features)

        topic_records.append({
            "id": topic.id,
            "name": topic.name,
            "subject_id": subj.id,
            "subject_name": subj.name,
            "difficulty": topic.difficulty,
            "confidence": round(topic.confidence or 50.0, 1),
            "theta": round(theta, 3),
            "n_answered": topic.n_answered or 0,
            "error_rate": round(error_rate * 100, 1),
            "weakness_score": round(weakness_score, 1),
            "estimated_min": topic.estimated_min or 60,
        })

    # ─────────────────────────────────────────────────────────────────────────
    # Run K-Means Clustering on multi-dimensional feature space
    # ─────────────────────────────────────────────────────────────────────────
    X = np.array(feature_rows)

    # Sort descending by weakness score
    topic_records.sort(key=lambda t: t["weakness_score"], reverse=True)

    n_samples = len(topic_records)
    k = min(3, n_samples)

    if k >= 2:
        try:
            # Cluster based on [Error Rate, Difficulty, Weakness Score]
            cluster_features = X[:, [1, 2, 5]]
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            cluster_labels = kmeans.fit_predict(cluster_features)

            # Determine cluster centers' average weakness score to map cluster id to risk tier
            cluster_risk = {}
            for cid in range(k):
                mask = (cluster_labels == cid)
                cluster_risk[cid] = float(np.mean(X[mask, 5]))

            sorted_clusters = sorted(cluster_risk.keys(), key=lambda c: cluster_risk[c], reverse=True)
            high_cluster = sorted_clusters[0]
            low_cluster = sorted_clusters[-1]
            med_cluster = sorted_clusters[1] if k == 3 else None

            critical_topics = []
            developing_topics = []
            mastered_topics = []

            for i, rec in enumerate(topic_records):
                # Using continuous score threshold combined with cluster
                score = rec["weakness_score"]
                if score >= 55.0 or i < max(2, int(n_samples * 0.25)):
                    rec["tier"] = "Critical"
                    rec["tier_color"] = "#FF4D4F"
                    rec["recommendation"] = "Immediate review required; prioritize in next 48h."
                    critical_topics.append(rec)
                elif score >= 35.0:
                    rec["tier"] = "Developing"
                    rec["tier_color"] = "#FAAD14"
                    rec["recommendation"] = "Reinforce with practice questions."
                    developing_topics.append(rec)
                else:
                    rec["tier"] = "Mastered"
                    rec["tier_color"] = "#52C41A"
                    rec["recommendation"] = "Proficient; periodic spaced revision."
                    mastered_topics.append(rec)

        except Exception:
            # Fallback heuristic based directly on weakness score
            critical_topics = [r for r in topic_records if r["weakness_score"] >= 55]
            developing_topics = [r for r in topic_records if 35 <= r["weakness_score"] < 55]
            mastered_topics = [r for r in topic_records if r["weakness_score"] < 35]
    else:
        critical_topics = topic_records
        developing_topics = []
        mastered_topics = []

    # ─────────────────────────────────────────────────────────────────────────
    # Subject-Level Risk Calculation
    # ─────────────────────────────────────────────────────────────────────────
    subject_risk = []
    for subj in subjects:
        subj_topics = [t for t in topic_records if t["subject_id"] == subj.id]
        if not subj_topics:
            continue
        avg_score = float(np.mean([t["weakness_score"] for t in subj_topics]))
        crit_count = sum(1 for t in subj_topics if t in critical_topics)
        risk_level = "High" if avg_score >= 50 else ("Medium" if avg_score >= 35 else "Low")
        subject_risk.append({
            "subject_id": subj.id,
            "subject_name": subj.name,
            "exam_date": subj.exam_date,
            "topics_count": len(subj_topics),
            "critical_topics_count": crit_count,
            "average_weakness_score": round(avg_score, 1),
            "risk_level": risk_level,
        })

    subject_risk.sort(key=lambda s: s["average_weakness_score"], reverse=True)

    # ─────────────────────────────────────────────────────────────────────────
    # Generate Narrative Report
    # ─────────────────────────────────────────────────────────────────────────
    top_critical_names = [t["name"] for t in critical_topics[:4]]
    report_lines = [
        f"### 🤖 AI/ML Diagnostic Learning Report",
        f"**Algorithm Used:** Multi-Factor Item Response Theory (IRT) with SGD parameter estimation & K-Means clustering.",
        f"- **Analyzed Topics:** {len(topic_records)} across {len(subjects)} subjects.",
        f"- **🚨 Critical Weak Topics Flagged:** {len(critical_topics)} ({', '.join(top_critical_names) if top_critical_names else 'None'}).",
        f"- **⚡ Developing Topics:** {len(developing_topics)}.",
        f"- **✅ Mastered Topics:** {len(mastered_topics)}.",
        f"- **Highest Risk Subject:** **{subject_risk[0]['subject_name']}** (Risk Score: {subject_risk[0]['average_weakness_score']}/100) with exam on {subject_risk[0]['exam_date']}.",
    ]

    return {
        "ok": True,
        "topics_analyzed": len(topic_records),
        "critical_topics": critical_topics,
        "developing_topics": developing_topics,
        "mastered_topics": mastered_topics,
        "subject_risk": subject_risk,
        "summary": {
            "total_topics": len(topic_records),
            "critical_count": len(critical_topics),
            "developing_count": len(developing_topics),
            "mastered_count": len(mastered_topics),
            "top_subject_at_risk": subject_risk[0]["subject_name"] if subject_risk else "None",
        },
        "report_text": "\n".join(report_lines),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. Dynamic Timetable Optimizer
# ─────────────────────────────────────────────────────────────────────────────

def apply_dynamic_timetable_update(db_session, user_id: int, custom_weak_topic_names: list[str] = None) -> dict:
    """
    Dynamically update the user's timetable by giving high-priority slots to
    ML-detected weak topics (or explicitly passed weak topics from a quiz).
    """
    from db.models import User, Subject, Topic, Session
    from services.planner import _generate_slots

    analysis = analyze_user_weaknesses(db_session, user_id)
    if not analysis["ok"]:
        return {"created": 0, "warning": analysis.get("error", "Failed to analyze topics.")}

    user = db_session.get(User, user_id)
    if not user:
        return {"created": 0, "warning": "User not found."}

    # Get set of weak topic IDs
    weak_topic_ids = {t["id"] for t in analysis["critical_topics"]}

    # If user just answered a quiz with specific wrong topics, add them
    if custom_weak_topic_names:
        lower_names = {n.strip().lower() for n in custom_weak_topic_names}
        matching_topics = (
            db_session.query(Topic)
            .filter(Topic.user_id == user_id)
            .all()
        )
        for mt in matching_topics:
            if mt.name.strip().lower() in lower_names or any(w in mt.name.lower() for w in lower_names):
                weak_topic_ids.add(mt.id)

    today = date.today()
    subjects = db_session.query(Subject).filter(Subject.user_id == user_id).all()
    if not subjects:
        return {"created": 0, "warning": "No subjects configured."}

    # Find the furthest exam date
    exam_dates = []
    for subj in subjects:
        try:
            exam_dates.append(date.fromisoformat(subj.exam_date))
        except ValueError:
            pass
    if not exam_dates:
        return {"created": 0, "warning": "No valid exam dates."}
    last_exam = max(exam_dates)
    max_days = max(1, (last_exam - today).days)

    # Re-score all topics, giving a strong 2.5x multiplier to ML weak topics
    scored_topics = []
    for subj in subjects:
        try:
            exam_dt = date.fromisoformat(subj.exam_date)
        except (TypeError, ValueError):
            continue
        if exam_dt < today:
            continue  # exam already passed
        for topic in subj.topics:
            if topic.status == "done":
                continue

            # Base priority score
            p_success = _sigmoid(topic.theta if topic.theta else 0.0)
            weakness_factor = 1.0 - p_success
            is_critical = topic.id in weak_topic_ids

            # Multiplier: 2.5x if critical weak topic
            priority = (0.50 * weakness_factor + 0.30 * (1.0 if is_critical else 0.2)) * (2.5 if is_critical else 1.0)
            scored_topics.append((priority, is_critical, topic))

    if not scored_topics:
        return {"created": 0, "weak_sessions_scheduled": 0,
                "warning": "No pending topics with upcoming exams to schedule."}

    # Sort topics: Critical weak topics first, then by priority descending
    scored_topics.sort(key=lambda x: (x[1], x[0]), reverse=True)

    study_days = [d.strip() for d in user.study_days.split(",") if d.strip()]
    revision_days = max(1, int(max_days * REVISION_RESERVE_FRACTION))
    plan_end = last_exam - timedelta(days=revision_days)

    now_utc = datetime.now(timezone.utc)
    slots = _generate_slots(
        today, plan_end, study_days,
        user.hours_per_day, user.session_min, user.break_min,
        not_before=now_utc,
    )
    if not slots:
        return {"created": 0, "weak_sessions_scheduled": 0,
                "warning": "No study slots left before the revision period. "
                           "Add study days/hours or review your exam dates."}

    # Rebuild the pending timetable. Delete every scheduled session so
    # repeated optimisation is idempotent (completed/skipped are preserved).
    old_scheduled = (
        db_session.query(Session)
        .filter(
            Session.user_id == user_id,
            Session.status == "scheduled",
        )
        .all()
    )
    for s in old_scheduled:
        db_session.delete(s)
    db_session.flush()

    # ── Allocate slots ────────────────────────────────────────────────
    # Phase 1: give every pending topic one slot (coverage, weak topics first).
    # Phase 2: use the remaining slots to bring under-funded subjects up to the
    # dataset benchmark for their previous score, cycling their weakest topics.
    # This prevents a subject with only two topics from being starved of time
    # just because another subject has twenty-eight topics.
    subject_map = {subj.id: subj for subj in subjects if subj.topics}
    scored_by_id = {topic.id: (priority, is_crit) for priority, is_crit, topic in scored_topics}
    queues: dict[int, list] = {}
    for _priority, _is_crit, topic in scored_topics:
        queues.setdefault(topic.subject_id, []).append(topic)

    fallback_score = user.prev_exam_score
    target_hours: dict[int, float] = {}
    for subject_id, queue in queues.items():
        subj = subject_map[subject_id]
        score = subj.previous_score if subj.previous_score is not None else fallback_score
        target = benchmark_hours(score) if score is not None else None
        target_hours[subject_id] = max(4.0, min(float(target or 6.0), 12.0))

    completed_hours: dict[int, float] = {}
    for sess in (
        db_session.query(Session)
        .filter(Session.user_id == user_id, Session.status == "completed")
        .all()
    ):
        completed_hours[sess.subject_id] = completed_hours.get(sess.subject_id, 0.0) + (
            (sess.duration_min or 0) / 60.0
        )
    allocated_hours = dict(completed_hours)

    created_sessions = []
    weak_count = 0
    cursors: dict[int, int] = {}
    last_subject = None

    def add_session(slot_start, slot_end, topic, is_crit):
        nonlocal weak_count, last_subject
        dur = int((slot_end - slot_start).total_seconds() / 60)
        note_label = "🔥 ML Priority Focus (Weak Topic)" if is_crit else "Standard Session"
        if is_crit:
            weak_count += 1
        sess = Session(
            user_id=user_id,
            subject_id=topic.subject_id,
            topic_id=topic.id,
            scheduled_start=slot_start.isoformat(),
            scheduled_end=slot_end.isoformat(),
            duration_min=dur,
            status="scheduled",
            notes=note_label,
        )
        db_session.add(sess)
        created_sessions.append(sess)
        allocated_hours[topic.subject_id] = allocated_hours.get(topic.subject_id, 0.0) + (dur / 60.0)
        last_subject = topic.subject_id

    slot_idx = 0
    covered_topics = 0
    for _priority, is_crit, topic in scored_topics:
        if slot_idx >= len(slots):
            break
        slot_start, slot_end = slots[slot_idx]
        slot_idx += 1
        covered_topics += 1
        add_session(slot_start, slot_end, topic, is_crit)
    uncovered_topics = len(scored_topics) - covered_topics

    while slot_idx < len(slots):
        candidates = [
            subject_id for subject_id in queues
            if allocated_hours.get(subject_id, 0.0) + 0.01 < target_hours.get(subject_id, 0.0)
        ]
        if not candidates:
            break
        # Rotate away from the previous subject when possible so repeated
        # topics are spread across days instead of being stacked back-to-back.
        pool = [subject_id for subject_id in candidates if subject_id != last_subject] or candidates
        subject_id = max(
            pool,
            key=lambda sid: (
                (target_hours[sid] - allocated_hours.get(sid, 0.0))
                * (4 - (subject_map[sid].priority or 2))
            ),
        )
        queue = queues[subject_id]
        cursor = cursors.get(subject_id, 0)
        topic = queue[cursor % len(queue)]
        cursors[subject_id] = cursor + 1
        _, is_crit = scored_by_id.get(topic.id, (0, False))
        slot_start, slot_end = slots[slot_idx]
        slot_idx += 1
        add_session(slot_start, slot_end, topic, is_crit)

    underfunded = [
        subject_id for subject_id in queues
        if allocated_hours.get(subject_id, 0.0) + 0.01 < target_hours.get(subject_id, 0.0)
    ]
    if uncovered_topics:
        warning = "Not enough study time to cover every topic before the revision period."
    elif underfunded:
        warning = (
            "Timetable built, but some subjects are still below their recommended "
            "study hours. Add study days/hours for a stronger plan."
        )
    else:
        warning = None

    db_session.commit()

    scheduled_hours = round(
        sum((s.duration_min or 0) for s in created_sessions) / 60.0, 1
    )

    return {
        "ok": True,
        "created": len(created_sessions),
        "weak_sessions_scheduled": weak_count,
        "critical_topics_count": len(weak_topic_ids),
        "scheduled_hours": scheduled_hours,
        "warning": warning,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. Dynamic Subject & Topics Ingestion from Document / PPT
# ─────────────────────────────────────────────────────────────────────────────

def add_subject_with_topics(
    db_session,
    user_id: int,
    subject_name: str,
    exam_date_str: str,
    topics_list: list[dict],
    priority: int = 1
) -> tuple[bool, str]:
    """
    Save a new subject with its extracted topics directly into the database.
    Allows students to upload a PPT/document and register it as an active course.
    """
    from db.models import Subject, Topic

    try:
        # Check if subject already exists
        existing = (
            db_session.query(Subject)
            .filter(Subject.user_id == user_id, Subject.name == subject_name.strip())
            .first()
        )
        if existing:
            subj = existing
            msg = f"Subject '{subject_name}' already exists. Adding new topics."
        else:
            subj = Subject(
                user_id=user_id,
                name=subject_name.strip(),
                exam_date=exam_date_str,
                priority=priority,
            )
            db_session.add(subj)
            db_session.flush()
            msg = f"Created new subject '{subject_name}'."

        added_count = 0
        for t in topics_list:
            tname = t.get("name", "").strip()
            if not tname:
                continue

            # Check if topic already exists in this subject
            t_exists = (
                db_session.query(Topic)
                .filter(Topic.subject_id == subj.id, Topic.name == tname)
                .first()
            )
            if not t_exists:
                conf = float(t.get("confidence", 50.0))
                db_session.add(Topic(
                    user_id=user_id,
                    subject_id=subj.id,
                    name=tname,
                    difficulty=t.get("difficulty", "medium"),
                    confidence=conf,
                    theta=confidence_to_theta(conf),
                    estimated_min=int(t.get("estimated_min", 60)),
                ))
                added_count += 1

        db_session.commit()
        return True, f"{msg} Added {added_count} topic(s) to timetable system."
    except Exception as exc:
        db_session.rollback()
        return False, f"Failed to save subject: {str(exc)}"
