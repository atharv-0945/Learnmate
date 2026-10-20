# LearnMate Web Application 🎓

**LearnMate** is an AI-powered student learning companion, personalized timetable planner, intelligent quiz tester, and machine learning exam pass probability predictor.

---

## 🚀 Features

1. **📊 Intelligent Dashboard**
   - Live exam countdowns, topic mastery overview, and today's scheduled study sessions.
   - Quick one-click session tracking (**Done** / **Skip**).
   - Dynamic replanning alerts if study sessions are missed or quiz scores drop.
   - Interactive weekly planned vs. completed study bar chart.

2. **📅 Automated Study Planner & Timetable**
   - Heuristic priority-based scheduling:
     $$\text{Priority} = 0.35 \cdot \text{Urgency} + 0.35 \cdot \text{Weakness} + 0.20 \cdot \text{Difficulty} + 0.10 \cdot \text{SubjectPriority}$$
   - Day & Week calendar tabs with session reschedule capabilities.
   - Automatic 20% revision buffer allocation prior to final exam deadlines.

3. **📚 Subject & Topic Management**
   - Add/manage subjects, target exam dates, and priority levels.
   - Add topics with initial confidence and difficulty estimations.
   - Real-time progress mastery bars showing current mastery status.

4. **🧠 AI-Powered Quizzes & Online Mastery (IRT)**
   - Topic-focused multiple choice questions generated dynamically via Google Gemini AI (`gemini-1.5-flash-latest`).
   - Question response caching to conserve quota and minimize latency.
   - Bayesian / Item Response Theory (IRT) online mastery updates via single-step SGD:
     $$\theta \leftarrow \theta + \eta \cdot (y - \sigma(\theta - b))$$
   - Deterministic server-side grading and mastery classification (*Learning*, *Weak*, *Mastered*).

5. **⚡ Groq LPU Academic Doubt Solver**
   - Instant academic doubt resolution powered by Groq Cloud LPU inference (`qwen/qwen3.8-27b`).
   - Multiple reasoning archetypes: *Quick Clarification*, *Standard Breakdown*, *Deep Masterclass*, and *Exam Strategy*.
   - Dynamic subject linking with quick syllabus cards and topic anchors.
   - LaTeX mathematical proof formatting, syntax-highlighted code blocks, and markdown tables.
   - Active recall interactive quiz checks with real-time feedback and explanation.

6. **🔬 Machine Learning Model Lab & Predictor**
   - Real-time exam pass/fail prediction powered by the pre-trained **Random Forest Classifier** (`models/best_model.joblib`).
   - Interactive What-If sensitivity curves using Plotly: see how increasing study hours changes your pass probability.
   - Comprehensive model benchmark reports, 5-Fold cross-validation metrics, confusion matrix, ROC curves, feature importance, and custom gradient descent convergence loss plots.

---

## 🛠 Quick Start Guide for Collaborators

### 1. Clone the Repository
```bash
git clone <YOUR_REPO_URL>
cd aiml_proj_cie3
```

### 2. Configure Environment Secrets
Copy the environment template:
```bash
cp learnmate_web/.env.example learnmate_web/.env
```
Open `learnmate_web/.env` and paste your free keys:
- **GROQ_API_KEY**: Get a free key at [console.groq.com/keys](https://console.groq.com/keys) (Used for sub-second doubt solver).
- **GEMINI_API_KEY**: (Optional) Get a free key at [aistudio.google.com](https://aistudio.google.com/).

> **Note:** `.env` and `learnmate.db` are automatically ignored by git. Never commit real keys.

### 3. Install Dependencies
**Backend (Python virtual environment):**
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

pip install -r learnmate_web/requirements.txt
```

**Frontend (React Vite):**
```bash
cd learnmate_web/frontend
npm install
cd ../..
```

### 4. Seed Initial Subjects & Topics (Optional)
To populate subjects and topics into the database:
```bash
python learnmate_web/seed_aiml_data.py
```

### 5. Launch Application
Launch both backend and frontend with one command:
```bash
python learnmate_web/launch.py
```
- **Frontend App**: `http://localhost:5173`
- **Backend Swagger Docs**: `http://127.0.0.1:8000/docs`

### 6. Run Test Suite
```bash
pytest learnmate_web/tests
```

```
