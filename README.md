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
   - Topic-focused multiple choice questions generated dynamically via Google Gemini AI (primary), with automatic Groq fallback and offline templates if both providers are unavailable.
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

## 📋 Prerequisites

Install these before starting:

- **Git**
- **Python 3.10+** (3.11 or 3.12 recommended)
- **Node.js 20.19+ or 22.12+** with npm
- A free **Gemini** and/or **Groq** API key for AI features

---

## 🛠 Quick Start Guide for Collaborators

### 1. Clone the Repository

```bash
git clone https://github.com/atharv-0945/Learmate.git
cd Learnmate
```

> A fresh clone creates a folder named `Learnmate`. If you cloned into a different folder name, `cd` into that folder instead.

### 2. Configure Environment Secrets

**macOS / Linux / Git Bash:**

```bash
cp learnmate_web/.env.example learnmate_web/.env
```

**Windows PowerShell:**

```powershell
Copy-Item learnmate_web\.env.example learnmate_web\.env
```

**Windows CMD:**

```cmd
copy learnmate_web\.env.example learnmate_web\.env
```

Open `learnmate_web/.env` and paste your free keys:

- **GEMINI_API_KEY**: Get a free key at [aistudio.google.com](https://aistudio.google.com/). Used for quiz, flashcard, and topic extraction; also the fallback for doubt solving.
- **GROQ_API_KEY**: Get a free key at [console.groq.com/keys](https://console.groq.com/keys). Used for the sub-second doubt solver and as the fallback for content generation.
- **GEMINI_FALLBACK_MODELS**: Optional comma-separated model fallbacks (default: `gemini-3.5-flash,gemini-3.6-flash,gemini-flash-lite-latest`).

> **Note:** `.env` and local `*.db` files are ignored by git. Never commit real API keys.

### 3. Install Dependencies

**Backend (Python virtual environment):**

```bash
python -m venv .venv
```

Activate it for your platform:

**Windows PowerShell:**

```powershell
.venv\Scripts\Activate.ps1
```

**Windows CMD:**

```cmd
.venv\Scripts\activate
```

**macOS / Linux:**

```bash
source .venv/bin/activate
```

Then install the backend packages:

```bash
python -m pip install --upgrade pip
python -m pip install -r learnmate_web/requirements.txt
```

**Frontend (React + Vite):**

```bash
cd learnmate_web/frontend
npm install
cd ../..
```

### 4. Launch the Application

**Windows — launch both services with one command:**

```bash
python learnmate_web/launch.py
```

**macOS / Linux — run the backend and frontend in separate terminals:**

Terminal 1 (backend):

```bash
cd learnmate_web
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2 (frontend):

```bash
cd learnmate_web/frontend
npm run dev
```

Once running:

- **Frontend App**: `http://localhost:5173`
- **Backend Swagger Docs**: `http://127.0.0.1:8000/docs`

### 5. Seed Initial Subjects & Topics (Optional)

Start the app once first so the default user exists, then run this in a second terminal with the virtual environment activated:

```bash
python learnmate_web/seed_aiml_data.py
```

### 6. Run the Test Suite

```bash
python -m pytest learnmate_web/tests
```

> The web app uses the pre-trained models in `models/`. To retrain models or run the full ML analysis pipeline, install the root `requirements.txt` and run `python run_pipeline.py`.
