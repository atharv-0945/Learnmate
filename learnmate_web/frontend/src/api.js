/**
 * src/api.js – Unified API client for FastAPI backend.
 */

const API_BASE = '/api';

export async function fetchJson(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`;
    try {
      const errData = await response.json();
      if (errData && errData.detail) {
        errorMsg = errData.detail;
      }
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

// ── Status & User ──
export const getStatus = () => fetchJson('/status');
export const getUser = () => fetchJson('/user');
export const updateUser = (data) => fetchJson('/user', { method: 'PUT', body: JSON.stringify(data) });
export const getDashboard = () => fetchJson('/dashboard');

// ── Subjects & Topics ──
export const getSubjects = () => fetchJson('/subjects');
export const createSubject = (data) => fetchJson('/subjects', { method: 'POST', body: JSON.stringify(data) });
export const updateSubject = (id, data) => fetchJson(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteSubject = (id) => fetchJson(`/subjects/${id}`, { method: 'DELETE' });
export const addTopic = (subjId, data) => fetchJson(`/subjects/${subjId}/topics`, { method: 'POST', body: JSON.stringify(data) });
export const updateTopic = (id, data) => fetchJson(`/topics/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTopic = (id) => fetchJson(`/topics/${id}`, { method: 'DELETE' });

// ── Study Plan ──
export const getStudyPlan = (dateStr) => fetchJson(`/study-plan${dateStr ? `?date_str=${dateStr}` : ''}`);
export const generateStandardPlan = () => fetchJson('/study-plan/generate', { method: 'POST' });
export const optimizePlanML = (customWeakTopics) => fetchJson('/study-plan/ml-optimize', {
  method: 'POST',
  body: JSON.stringify({ custom_weak_topics: customWeakTopics || [] }),
});
export const updateSession = (id, data) => fetchJson(`/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const previewSessionSkip = (id) => fetchJson(`/sessions/${id}/skip-preview`);
export const deleteSession = (id) => fetchJson(`/sessions/${id}`, { method: 'DELETE' });
export const getSessionSuggestion = (previousScore) => fetchJson(`/predictor/suggest?previous_score=${encodeURIComponent(previousScore)}`);
export const getReadiness = () => fetchJson('/predictor/readiness');
export const getMLDiagnostic = () => fetchJson('/ml-diagnostic');

// ── Quizzes ──
export const generateQuiz = (data) => fetchJson('/quizzes/generate', { method: 'POST', body: JSON.stringify(data) });
export const submitQuiz = (data) => fetchJson('/quizzes/submit', { method: 'POST', body: JSON.stringify(data) });
export const getQuizHistory = () => fetchJson('/quizzes/history');

// ── Document & Flashcards ──
export async function uploadDocumentFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Upload failed');
  }
  return response.json();
}

export const generateDocFlashcards = (data) => fetchJson('/documents/flashcards', { method: 'POST', body: JSON.stringify(data) });
export const generateDocQuiz = (data) => fetchJson('/documents/quiz', { method: 'POST', body: JSON.stringify(data) });
export const registerDocSubject = (data) => fetchJson('/documents/register-subject', { method: 'POST', body: JSON.stringify(data) });
export const getFlashcardSets = () => fetchJson('/flashcard-sets');
export const deleteFlashcardSet = (id) => fetchJson(`/flashcard-sets/${id}`, { method: 'DELETE' });

// ── Model Lab ──
export const predictModel = (studyHours, prevScore) => fetchJson('/model/predict', {
  method: 'POST',
  body: JSON.stringify({ study_hours: studyHours, prev_exam_score: prevScore }),
});
export const getModelMeta = () => fetchJson('/model/meta');
export const getVisualiserOverview = () => fetchJson('/model-visualiser/overview');
export const getVisualiserState = (studyHours, previousScore) => fetchJson('/model-visualiser/state', {
  method: 'POST',
  body: JSON.stringify({ study_hours: studyHours, previous_score: previousScore }),
});

// ── AI Doubt Solver (Groq LPU) ──
export const solveDoubt = (data) => fetchJson('/doubts/solve', { method: 'POST', body: JSON.stringify(data) });
export const getDoubts = () => fetchJson('/doubts');
export const deleteDoubt = (id) => fetchJson(`/doubts/${id}`, { method: 'DELETE' });
export const saveGroqConfig = (data) => fetchJson('/doubts/config', { method: 'POST', body: JSON.stringify(data) });
