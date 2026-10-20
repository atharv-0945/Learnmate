import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Flame,
  Clock,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Check,
  Award,
  Upload,
  FileText,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as api from '../api';

export default function QuizzesView() {
  const [sourceMode, setSourceMode] = useState('curriculum'); // 'curriculum' | 'document'
  const [docFile, setDocFile] = useState(null);
  const [docExtracted, setDocExtracted] = useState(null);
  const [docUploading, setDocUploading] = useState(false);

  const [subjects, setSubjects] = useState([]);
  const [selectedSubjId, setSelectedSubjId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [nQuestions, setNQuestions] = useState(5);

  const [activeQuiz, setActiveQuiz] = useState(null);
  const [userAnswers, setUserAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState(null);
  const [replanMsg, setReplanMsg] = useState(null);

  useEffect(() => {
    loadSubjects();
    loadHistory();
  }, []);

  const loadSubjects = async () => {
    try {
      const res = await api.getSubjects();
      setSubjects(res || []);
      if (res && res.length > 0) {
        setSelectedSubjId(res[0].id);
        if (res[0].topics && res[0].topics.length > 0) {
          setSelectedTopicId(res[0].topics[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.getQuizHistory();
      setHistory(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const currentSubj = subjects.find((s) => s.id === parseInt(selectedSubjId));
  const currentTopics = currentSubj ? currentSubj.topics : [];

  const handleSubjChange = (e) => {
    const sId = parseInt(e.target.value);
    setSelectedSubjId(sId);
    const sub = subjects.find((s) => s.id === sId);
    if (sub && sub.topics.length > 0) {
      setSelectedTopicId(sub.topics[0].id);
    } else {
      setSelectedTopicId('');
    }
  };

  const handleGenerate = async () => {
    if (!currentSubj) return;
    const top = currentTopics.find((t) => t.id === parseInt(selectedTopicId));
    const topicName = top ? top.name : 'General';

    try {
      setGenerating(true);
      setMsg(null);
      setReplanMsg(null);
      const res = await api.generateQuiz({
        subject: currentSubj.name,
        topic: topicName,
        difficulty,
        n_questions: nQuestions,
      });

      setActiveQuiz({
        quiz_id: res.quiz_id,
        topic_id: top ? top.id : null,
        questions: res.questions,
      });
      setUserAnswers(new Array(res.questions.length).fill(null));
      setSubmitted(false);
      setSubmitResult(null);
    } catch (err) {
      setMsg(`Generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDocUpload = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setDocFile(selected);
    try {
      setDocUploading(true);
      setMsg(null);
      const res = await api.uploadDocumentFile(selected);
      setDocExtracted(res);
    } catch (err) {
      setMsg(`Upload failed: ${err.message}`);
    } finally {
      setDocUploading(false);
    }
  };

  const handleGenerateFromDoc = async () => {
    if (!docExtracted) return;
    try {
      setGenerating(true);
      setMsg(null);
      setReplanMsg(null);
      const res = await api.generateDocQuiz({
        document_text: docExtracted.extracted_text,
        n_questions: nQuestions,
        difficulty,
        title: docExtracted.filename.replace(/\.[^/.]+$/, '') + ' Quiz',
      });

      setActiveQuiz({
        quiz_id: res.quiz_id,
        topic_id: null,
        title: res.title,
        questions: res.questions,
      });
      setUserAnswers(new Array(res.questions.length).fill(null));
      setSubmitted(false);
      setSubmitResult(null);

      try {
        confetti({ particleCount: 50, spread: 60 });
      } catch {
        // ignore
      }
    } catch (err) {
      setMsg(`Document quiz generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectAnswer = (qIdx, optIdx) => {
    if (submitted) return;
    const next = [...userAnswers];
    next[qIdx] = optIdx;
    setUserAnswers(next);
  };

  const handleSubmitQuiz = async () => {
    if (userAnswers.includes(null)) {
      if (!confirm('You have unanswered questions. Submit anyway?')) return;
    }

    try {
      const res = await api.submitQuiz({
        quiz_id: activeQuiz.quiz_id,
        topic_id: activeQuiz.topic_id,
        questions: activeQuiz.questions,
        answers: userAnswers,
      });

      setSubmitted(true);
      setSubmitResult(res);
      loadHistory();

      if (res.score_percentage >= 70) {
        try {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        } catch {
          // ignore
        }
      }

      if (res.replan_triggered && res.weak_topics?.length > 0) {
        setReplanMsg(`⚡ ML REPLAN ACTIVE: Weak concepts identified (${res.weak_topics.join(', ')}). Your adaptive timetable has been automatically recalibrated.`);
      }
    } catch (err) {
      alert(`Submission error: ${err.message}`);
    }
  };

  const handleRecalibratePlan = async (weakTopics) => {
    try {
      const res = await api.optimizePlanML(weakTopics || []);
      setReplanMsg(`✅ Timetable Recalibrated! Added ${res.weak_sessions_scheduled || 1} targeted study session(s) for your weak concepts.`);
    } catch (err) {
      alert(`Optimization error: ${err.message}`);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 1. Header Frame */}
      <div className="corner-frame" style={{
        padding: '2rem',
        backgroundColor: 'var(--bg-surface-low)',
        border: '1.5px solid var(--border-strong)',
      }}>
        <span className="crosshair-corner top-left">┼</span>
        <span className="crosshair-corner top-right">┼</span>
        <span className="crosshair-corner bottom-left">┼</span>
        <span className="crosshair-corner bottom-right">┼</span>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}>
          <div>
            <span className="tag-mono" style={{ color: 'var(--primary-deep)', fontWeight: 700 }}>
              // COGNITIVE ACTIVE RECALL PIPELINE
            </span>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', textTransform: 'uppercase', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
              AI ACTIVE RECALL QUIZZES
            </h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', fontSize: '0.92rem' }}>
              Generates high-yield diagnostic questions using Gemini 1.5 AI. Automatically recalculates Item Response Theory (IRT) theta scores and updates your timetable if weak concepts are identified.
            </p>
          </div>

          <div className="tag-mono" style={{ textAlign: 'right' }}>
            <span>LATEX + MCQ FORMAT</span><br />
            <span className="badge-tech lime" style={{ marginTop: '0.35rem' }}>ZERO LATENCY</span>
          </div>
        </div>

        {msg && (
          <div style={{
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-surface-lowest)',
            border: '1.5px solid var(--border-strong)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: '#991b1b',
          }}>
            {msg}
          </div>
        )}

        {replanMsg && (
          <div style={{
            marginTop: '1.25rem',
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--primary)',
            border: '1.5px solid var(--border-strong)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            fontWeight: 700,
          }}>
            {replanMsg}
          </div>
        )}
      </div>

      {/* 2. Generation Mode Selector & Parameters Deck */}
      <div className="corner-frame" style={{ padding: '1.75rem' }}>
        <span className="corner-bracket top-left">┌</span>
        <span className="corner-bracket top-right">┐</span>
        <span className="corner-bracket bottom-left">└</span>
        <span className="corner-bracket bottom-right">┘</span>

        {/* Source Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '0.65rem',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1.5px solid var(--border-subtle)',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            className={sourceMode === 'curriculum' ? 'btn-lime' : 'btn-tech-outline'}
            onClick={() => setSourceMode('curriculum')}
          >
            <BrainCircuit size={15} />
            <span>Syllabus Curriculum Quiz</span>
          </button>
          <button
            type="button"
            className={sourceMode === 'document' ? 'btn-lime' : 'btn-tech-outline'}
            onClick={() => setSourceMode('document')}
          >
            <Upload size={15} />
            <span>Upload Lecture PPT / Slide Deck</span>
          </button>
        </div>

        {sourceMode === 'curriculum' ? (
          /* Curriculum Subject / Topic Generator */
          <div>
            <div className="tag-mono" style={{ marginBottom: '1rem' }}>
              // CURRICULUM_GENERATION_PARAMETERS
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              alignItems: 'flex-end',
            }}>
              <div>
                <label className="tag-mono" style={{ display: 'block', marginBottom: '0.4rem' }}>
                  SUBJECT
                </label>
                <select
                  value={selectedSubjId}
                  onChange={handleSubjChange}
                  className="tech-select"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="tag-mono" style={{ display: 'block', marginBottom: '0.4rem' }}>
                  CHAPTER / TOPIC
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="tech-select"
                >
                  {currentTopics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="tag-mono" style={{ display: 'block', marginBottom: '0.4rem' }}>
                  DIFFICULTY
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="tech-select"
                >
                  <option value="easy">Easy (Foundations)</option>
                  <option value="medium">Medium (Standard Exam)</option>
                  <option value="hard">Hard (Advanced Problem Solving)</option>
                </select>
              </div>

              <div>
                <label className="tag-mono" style={{ display: 'block', marginBottom: '0.4rem' }}>
                  QUESTIONS: {nQuestions}
                </label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  value={nQuestions}
                  onChange={(e) => setNQuestions(parseInt(e.target.value))}
                  className="tech-range"
                />
              </div>

              <div>
                <button
                  className="btn-lime"
                  onClick={handleGenerate}
                  disabled={generating || subjects.length === 0}
                  style={{ width: '100%', padding: '0.65rem 1rem' }}
                >
                  <Sparkles size={16} strokeWidth={2.4} />
                  <span>{generating ? 'SYNTHESIZING...' : 'GENERATE AI QUIZ'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Document / PPT Upload Generator */
          <div>
            <div className="tag-mono" style={{ marginBottom: '1rem' }}>
              // LECTURE_SLIDES_DOCUMENT_SOURCE
            </div>

            <div style={{
              border: '2px dashed var(--border-strong)',
              padding: '1.75rem 1.25rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-low)',
              marginBottom: '1.25rem'
            }}>
              <Upload size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.7 }} />
              <h4 style={{ textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                {docUploading ? 'Ingesting & Analyzing Slides...' : docFile ? `Selected: ${docFile.name}` : 'Drop Lecture PPT (PPTX, PPT, PDF) for Instant Quiz'}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', maxWidth: '420px', margin: '0 auto 1rem' }}>
                Upload your slides. We'll extract each slide concept and formulate a custom diagnostic quiz.
              </p>
              <label className="btn-lime" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                <span>Select Lecture File</span>
                <input
                  type="file"
                  accept=".pptx,.ppt,.pdf,.docx,.txt"
                  onChange={handleDocUpload}
                  style={{ display: 'none' }}
                  disabled={docUploading}
                />
              </label>
            </div>

            {docExtracted && (
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'var(--bg-surface-lowest)',
                border: '1.5px solid var(--border-strong)',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={18} color="var(--primary-deep)" />
                    <strong style={{ fontSize: '1rem' }}>{docExtracted.filename}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {docExtracted.slide_count && (
                      <span className="badge-tech lime">{docExtracted.slide_count} SLIDES</span>
                    )}
                    <span className="badge-tech gray">{docExtracted.char_count} CHARACTERS</span>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                  alignItems: 'flex-end',
                }}>
                  <div>
                    <label className="tag-mono" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.72rem' }}>
                      DIFFICULTY
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      className="tech-select"
                      style={{ width: '100%' }}
                    >
                      <option value="easy">Easy (Foundations)</option>
                      <option value="medium">Medium (Standard Exam)</option>
                      <option value="hard">Hard (Advanced Problem Solving)</option>
                    </select>
                  </div>

                  <div>
                    <label className="tag-mono" style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.72rem' }}>
                      QUESTIONS: {nQuestions}
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="10"
                      value={nQuestions}
                      onChange={(e) => setNQuestions(parseInt(e.target.value))}
                      className="tech-range"
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <button
                      className="btn-lime"
                      onClick={handleGenerateFromDoc}
                      disabled={generating}
                      style={{ width: '100%', padding: '0.65rem 1rem' }}
                    >
                      <Sparkles size={16} strokeWidth={2.4} />
                      <span>{generating ? 'GENERATING FROM PPT...' : 'GENERATE PPT QUIZ'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Active Quiz Question Viewport */}
      {activeQuiz && (
        <div className="corner-frame" style={{ padding: '2rem' }}>
          <span className="crosshair-corner top-left">┼</span>
          <span className="crosshair-corner top-right">┼</span>
          <span className="crosshair-corner bottom-left">┼</span>
          <span className="crosshair-corner bottom-right">┼</span>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '1rem',
            marginBottom: '1.75rem',
            borderBottom: '1.5px solid var(--border-strong)',
          }}>
            <div>
              <span className="tag-mono">// ACTIVE_DIAGNOSTIC_SESSION</span>
              <h2 style={{ fontSize: '1.35rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                ACTIVE RECALL TEST : {activeQuiz?.title || currentSubj?.name || (sourceMode === 'document' ? 'DOCUMENT' : 'QUIZ')}
              </h2>
            </div>

            {submitted && submitResult && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <span className="tag-mono" style={{ fontSize: '0.65rem' }}>FINAL SCORE</span>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 900 }}>
                    {submitResult.score_percentage}%
                  </div>
                </div>
                <span className={`badge-tech ${submitResult.score_percentage >= 70 ? 'lime' : 'warning'}`}>
                  {submitResult.score_percentage >= 70 ? 'MASTERY VERIFIED' : 'RECALIBRATION NEEDED'}
                </span>
              </div>
            )}
          </div>

          {/* Diagnostic Summary & Weak Concepts Analysis (When Submitted) */}
          {submitted && submitResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
              {/* Weak Topics Identification Card */}
              {submitResult.weak_topics && submitResult.weak_topics.length > 0 ? (
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#fffbeb',
                  border: '1.5px solid var(--border-strong)',
                  boxShadow: 'var(--shadow-subtle)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertTriangle size={18} color="#b45309" />
                      <span className="tag-mono" style={{ color: '#b45309', fontWeight: 800 }}>
                        // WEAK TOPICS IDENTIFIED ({submitResult.weak_topics.length})
                      </span>
                    </div>
                    <button
                      className="btn-lime"
                      onClick={() => handleRecalibratePlan(submitResult.weak_topics)}
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
                    >
                      <Sparkles size={14} />
                      <span>Recalibrate Timetable for These Topics</span>
                    </button>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '1rem', lineHeight: 1.5 }}>
                    Our cognitive engine detected weak conceptual grasp in the following topics based on your quiz responses:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {submitResult.weak_topics.map((wt, i) => (
                      <span key={i} className="badge-tech danger" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>
                        ⚠️ {wt}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '1.25rem 1.5rem',
                  backgroundColor: '#ecfdf5',
                  border: '1.5px solid var(--border-strong)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={18} color="#15803d" />
                    <span className="tag-mono" style={{ color: '#15803d', fontWeight: 800 }}>
                      // ALL TESTED CONCEPTS MASTERED — NO WEAK TOPICS DETECTED!
                    </span>
                  </div>
                </div>
              )}

              {/* Wrong Questions Breakdown */}
              {submitResult.wrong_questions && submitResult.wrong_questions.length > 0 && (
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--bg-surface-lowest)',
                  border: '1.5px solid var(--border-strong)',
                }}>
                  <div className="tag-mono" style={{ color: '#b91c1c', fontWeight: 800, marginBottom: '0.75rem' }}>
                    // INCORRECT ANSWERS REVIEW ({submitResult.wrong_questions.length} MISSED)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {submitResult.wrong_questions.map((wq, idx) => (
                      <div key={idx} style={{
                        padding: '1rem',
                        backgroundColor: 'var(--bg-surface-low)',
                        border: '1px solid var(--border-subtle)',
                        borderLeft: '4px solid #b91c1c',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.82rem',
                      }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                          Q{wq.question_index}: {wq.question}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.4rem', fontSize: '0.78rem' }}>
                          <span style={{ color: '#b91c1c' }}>
                            ✖ Your Answer: <strong>{wq.user_answer}</strong>
                          </span>
                          <span style={{ color: '#15803d' }}>
                            ✔ Correct Answer: <strong>{wq.correct_answer}</strong>
                          </span>
                        </div>
                        {wq.explanation && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.4rem', marginTop: '0.3rem' }}>
                            <strong>Why:</strong> {wq.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {activeQuiz.questions.map((q, qIdx) => {
              const selectedOpt = userAnswers[qIdx];
              return (
                <div
                  key={q.id || qIdx}
                  style={{
                    padding: '1.5rem',
                    backgroundColor: 'var(--bg-surface-low)',
                    border: '1.5px solid var(--border-strong)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span className="tag-mono" style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      QUESTION 0{qIdx + 1} // 0{activeQuiz.questions.length}
                    </span>
                    {submitted && (
                      <span className={`badge-tech ${selectedOpt === q.correct_index ? 'success' : 'danger'}`}>
                        {selectedOpt === q.correct_index ? 'CORRECT' : 'INCORRECT'}
                      </span>
                    )}
                  </div>

                  <p style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    marginBottom: '1.25rem',
                    lineHeight: 1.5,
                  }}>
                    {q.question}
                  </p>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selectedOpt === optIdx;
                      const isCorrect = submitted && optIdx === q.correct_index;
                      const isWrongChoice = submitted && isSelected && optIdx !== q.correct_index;

                      let optBg = 'var(--bg-surface-lowest)';
                      if (isCorrect) optBg = '#dcfce7';
                      else if (isWrongChoice) optBg = '#fee2e2';
                      else if (isSelected) optBg = 'var(--primary)';

                      return (
                        <div
                          key={optIdx}
                          onClick={() => handleSelectAnswer(qIdx, optIdx)}
                          style={{
                            padding: '0.85rem 1rem',
                            backgroundColor: optBg,
                            border: '1.5px solid var(--border-strong)',
                            cursor: submitted ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.85rem',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.88rem',
                            fontWeight: isSelected || isCorrect ? 700 : 500,
                            boxShadow: isSelected ? 'var(--shadow-subtle)' : 'none',
                            transition: 'all 0.1s ease',
                          }}
                        >
                          <span style={{
                            width: '24px',
                            height: '24px',
                            border: '1.5px solid var(--border-strong)',
                            backgroundColor: isSelected ? 'var(--border-strong)' : 'transparent',
                            color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}>
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation reveal */}
                  {submitted && q.explanation && (
                    <div style={{
                      marginTop: '1.25rem',
                      padding: '1rem',
                      backgroundColor: 'var(--bg-surface-lowest)',
                      borderLeft: '4px solid var(--border-strong)',
                      border: '1px solid var(--border-subtle)',
                      borderLeftWidth: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.82rem',
                    }}>
                      <div className="tag-mono" style={{ marginBottom: '0.25rem', fontWeight: 700 }}>
                        // RATIONALE & EXPLANATION
                      </div>
                      <p style={{ color: 'var(--text-secondary)' }}>{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Submit Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '1.5rem',
            marginTop: '2rem',
            borderTop: '1.5px solid var(--border-strong)',
          }}>
            <button
              className="btn-tech-outline"
              onClick={() => setActiveQuiz(null)}
            >
              Exit Quiz
            </button>

            {!submitted ? (
              <button
                className="btn-lime"
                onClick={handleSubmitQuiz}
                style={{ padding: '0.75rem 2rem' }}
              >
                <span>Submit Answers</span>
                <Check size={16} strokeWidth={3} />
              </button>
            ) : (
              <button
                className="btn-lime"
                onClick={handleGenerate}
              >
                <span>Generate New Quiz</span>
                <Sparkles size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. Past Quiz Attempt History */}
      <div className="corner-frame" style={{ padding: '1.75rem' }}>
        <span className="corner-bracket top-left">┌</span>
        <span className="corner-bracket top-right">┐</span>
        <span className="corner-bracket bottom-left">└</span>
        <span className="corner-bracket bottom-right">┘</span>

        <div className="tag-mono" style={{ marginBottom: '1rem' }}>
          // ACTIVE_RECALL_AUDIT_LOG
        </div>

        <h3 style={{ textTransform: 'uppercase', marginBottom: '1.25rem' }}>
          Diagnostic History & Retention Calibrations
        </h3>

        {history.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            No past quiz attempts recorded. Generate a quiz above to start tracking performance.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
            }}>
              <thead>
                <tr style={{
                  borderBottom: '1.5px solid var(--border-strong)',
                  backgroundColor: 'var(--bg-surface-low)',
                  textAlign: 'left',
                }}>
                  <th style={{ padding: '0.75rem' }}>ID</th>
                  <th style={{ padding: '0.75rem' }}>SUBJECT</th>
                  <th style={{ padding: '0.75rem' }}>TOPIC</th>
                  <th style={{ padding: '0.75rem' }}>SCORE</th>
                  <th style={{ padding: '0.75rem' }}>DATE</th>
                  <th style={{ padding: '0.75rem' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr
                    key={h.id || i}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: i % 2 === 0 ? 'var(--bg-surface-lowest)' : 'var(--bg-surface-low)',
                    }}
                  >
                    <td style={{ padding: '0.75rem' }}>#{h.id || i + 1}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{h.subject || 'Subject'}</td>
                    <td style={{ padding: '0.75rem' }}>{h.topic || 'General'}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{h.score_percentage || 0}%</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{h.created_at?.slice(0, 10) || 'Today'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge-tech ${(h.score_percentage || 0) >= 70 ? 'lime' : 'warning'}`}>
                        {(h.score_percentage || 0) >= 70 ? 'PASS' : 'RECALIBRATED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
