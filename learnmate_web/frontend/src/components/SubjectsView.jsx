import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
  Sliders,
  Check,
  Terminal,
  Layers
} from 'lucide-react';
import * as api from '../api';

export default function SubjectsView() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubj, setExpandedSubj] = useState(null);

  // Add Subject Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubjName, setNewSubjName] = useState('');
  const [newExamDate, setNewExamDate] = useState(
    new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10)
  );
  const [newPriority, setNewPriority] = useState(1);
  const [newPrevScore, setNewPrevScore] = useState('');
  const [newTopicsText, setNewTopicsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [acceptSuggested, setAcceptSuggested] = useState(null);

  // Inline Add Topic state
  const [addingTopicSubjId, setAddingTopicSubjId] = useState(null);
  const [topicNameInput, setTopicNameInput] = useState('');
  const [topicDiffInput, setTopicDiffInput] = useState('medium');
  const [topicConfInput, setTopicConfInput] = useState(50);
  const [topicEstInput, setTopicEstInput] = useState(60);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    const score = parseFloat(newPrevScore);
    if (!newExamDate || Number.isNaN(score) || score < 0 || score > 100) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await api.getSessionSuggestion(score);
        if (!cancelled) setSuggestion(res);
      } catch {
        if (!cancelled) setSuggestion(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [newPrevScore, newExamDate]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const res = await api.getSubjects();
      setSubjects(res || []);
      if (res && res.length > 0 && !expandedSubj) {
        setExpandedSubj(res[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;
    const topicLines = newTopicsText
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    if (topicLines.length === 0) {
      alert('Please provide at least one topic for this subject.');
      return;
    }

    try {
      setSubmitting(true);
      const prevScore = parseFloat(newPrevScore);
      if (Number.isNaN(prevScore) || prevScore < 0 || prevScore > 100) {
        alert('Previous score must be between 0 and 100.');
        return;
      }
      const res = await api.createSubject({
        name: newSubjName.trim(),
        exam_date: newExamDate,
        priority: newPriority,
        previous_score: prevScore,
        topics: topicLines,
        accept_suggested_sessions: acceptSuggested === true,
        suggested_session_count: suggestion?.suggested_session_count ?? null,
      });
      setShowAddModal(false);
      setNewSubjName('');
      setNewTopicsText('');
      setNewPrevScore('');
      setSuggestion(null);
      setAcceptSuggested(null);
      const extra = res.sessions_created ? ` · ${res.sessions_created} sessions scheduled.` : '';
      setMsg(`SUCCESS: Registered '${newSubjName}' with ${topicLines.length} topics.${extra}`);
      loadSubjects();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubject = async (id, name) => {
    if (!confirm(`Are you sure you want to delete '${name}' and its syllabus topics?`)) return;
    try {
      await api.deleteSubject(id);
      loadSubjects();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddInlineTopic = async (subjId) => {
    if (!topicNameInput.trim()) return;
    try {
      await api.addTopic(subjId, {
        name: topicNameInput.trim(),
        difficulty: topicDiffInput,
        confidence: topicConfInput / 100.0,
        estimated_minutes: parseInt(topicEstInput) || 60,
      });
      setTopicNameInput('');
      setAddingTopicSubjId(null);
      loadSubjects();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateConfidence = async (topicId, newConfidence) => {
    // newConfidence is 0-100 from slider; server stores confidence as 0-100
    const clampedVal = Math.min(100, Math.max(0, newConfidence));
    try {
      await api.updateTopic(topicId, {
        confidence: clampedVal,
      });
      // Optimistic update – keep confidence as 0-100 to match API response format
      setSubjects((prev) =>
        prev.map((s) => ({
          ...s,
          topics: s.topics.map((t) =>
            t.id === topicId ? { ...t, confidence: clampedVal } : t
          ),
        }))
      );
    } catch (err) {
      console.error(err);
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
              // CURRICULUM REGISTRY & IRT CALIBRATION
            </span>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', textTransform: 'uppercase', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
              SUBJECTS & SYLLABUS TOPICS
            </h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', fontSize: '0.92rem' }}>
              Define exam subjects, target dates, and granular topics. Adjust Item Response Theory (IRT) topic mastery sliders to recalibrate the study planner.
            </p>
          </div>

          <button
            className="btn-lime"
            onClick={() => setShowAddModal(true)}
            style={{ padding: '0.75rem 1.4rem' }}
          >
            <Plus size={18} strokeWidth={2.4} />
            <span>REGISTER NEW SUBJECT</span>
          </button>
        </div>

        {msg && (
          <div style={{
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-surface-lowest)',
            border: '1.5px solid var(--border-strong)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>{msg}</span>
            <button
              onClick={() => setMsg(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              [DISMISS]
            </button>
          </div>
        )}
      </div>

      {/* 2. Subjects List */}
      {loading ? (
        <div className="corner-frame" style={{ padding: '3rem', textAlign: 'center' }}>
          <span className="tag-mono">// QUERYING_CURRICULUM_DATABASE...</span>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, marginTop: '0.5rem' }}>
            LOADING ACTIVE SUBJECTS
          </div>
        </div>
      ) : subjects.length === 0 ? (
        <div className="corner-frame" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <BookOpen size={36} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <h3 style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            No Subjects Registered in Syllabus
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
            Add your exam subjects and chapters to activate the AI active recall quizzes and adaptive timetable engine.
          </p>
          <button className="btn-lime" onClick={() => setShowAddModal(true)}>
            + Register First Subject
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {subjects.map((subj) => {
            const isExpanded = expandedSubj === subj.id;
            const topicCount = subj.topics ? subj.topics.length : 0;
            // confidence from API is already 0-100; clamp to 100 max
            const avgConf = topicCount > 0
              ? Math.min(100, Math.round(subj.topics.reduce((acc, t) => acc + (t.confidence || 0), 0) / topicCount))
              : 50;

            return (
              <div key={subj.id} className="corner-frame">
                <span className="corner-bracket top-left">┌</span>
                <span className="corner-bracket top-right">┐</span>
                <span className="corner-bracket bottom-left">└</span>
                <span className="corner-bracket bottom-right">┘</span>

                {/* Subject Header Card */}
                <div style={{
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  backgroundColor: isExpanded ? 'var(--bg-surface-low)' : 'var(--bg-surface-lowest)',
                  cursor: 'pointer',
                  borderBottom: isExpanded ? '1.5px solid var(--border-strong)' : 'none',
                }}
                onClick={() => setExpandedSubj(isExpanded ? null : subj.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: 'var(--border-strong)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--radius-xs)',
                    }}>
                      <BookOpen size={18} strokeWidth={2.4} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: '1.25rem', textTransform: 'uppercase' }}>{subj.name}</h2>
                        <span className="badge-tech lime" style={{ fontSize: '0.62rem' }}>
                          PRIORITY {subj.priority || 1}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        EXAM DATE: {subj.exam_date || 'TBD'} · {topicCount} CHAPTERS · MASTERY {avgConf}%
                        {subj.previous_score != null ? ` · PREV SCORE ${subj.previous_score}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-tech-outline"
                      onClick={() => setAddingTopicSubjId(addingTopicSubjId === subj.id ? null : subj.id)}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      <Plus size={13} />
                      <span>Add Topic</span>
                    </button>
                    <button
                      className="btn-tech-danger"
                      onClick={() => handleDeleteSubject(subj.id, subj.name)}
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      className="btn-tech-outline"
                      onClick={() => setExpandedSubj(isExpanded ? null : subj.id)}
                      style={{ padding: '0.35rem 0.65rem' }}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Inline Add Topic Box */}
                {addingTopicSubjId === subj.id && (
                  <div style={{
                    padding: '1.25rem',
                    backgroundColor: 'var(--bg-surface-lowest)',
                    borderBottom: '1.5px solid var(--border-strong)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}>
                    <input
                      type="text"
                      placeholder="Topic name (e.g. Thermodynamics)"
                      value={topicNameInput}
                      onChange={(e) => setTopicNameInput(e.target.value)}
                      className="tech-input"
                      style={{ flex: 2, minWidth: '220px' }}
                    />
                    <select
                      value={topicDiffInput}
                      onChange={(e) => setTopicDiffInput(e.target.value)}
                      className="tech-select"
                      style={{ flex: 1, minWidth: '120px' }}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Min (60)"
                      value={topicEstInput}
                      onChange={(e) => setTopicEstInput(e.target.value)}
                      className="tech-input"
                      style={{ width: '90px' }}
                    />
                    <button
                      className="btn-lime"
                      onClick={() => handleAddInlineTopic(subj.id)}
                    >
                      Save Topic
                    </button>
                    <button
                      className="btn-tech-outline"
                      onClick={() => setAddingTopicSubjId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Expanded Topics Table */}
                {isExpanded && (
                  <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-surface-lowest)' }}>
                    <div className="tag-mono" style={{ marginBottom: '0.85rem' }}>
                      // GRANULAR TOPICS & ITEM RESPONSE THEORY MASTERY
                    </div>

                    {topicCount === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        No topics added to this subject yet. Click "+ Add Topic" above.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {subj.topics.map((topic) => {
                          // confidence from API is 0-100; clamp to 100 max
                          const confPct = Math.min(100, Math.round(topic.confidence ?? 50));
                          return (
                            <div
                              key={topic.id}
                              style={{
                                padding: '1rem',
                                border: '1px solid var(--border-strong)',
                                backgroundColor: 'var(--bg-surface-low)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '1rem',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: '220px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800 }}>{topic.name}</h4>
                                  <span className="badge-tech" style={{ fontSize: '0.6rem' }}>
                                    {topic.difficulty?.toUpperCase() || 'MEDIUM'}
                                  </span>
                                </div>
                                <span className="tag-mono" style={{ fontSize: '0.65rem' }}>
                                  EST. REVISION: {topic.estimated_minutes || 60} MIN
                                </span>
                              </div>

                              {/* Interactive IRT Slider */}
                              <div style={{ width: '220px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: '0.25rem' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Mastery Score:</span>
                                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{confPct}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={confPct}
                                  onChange={(e) => handleUpdateConfidence(topic.id, parseInt(e.target.value))}
                                  className="tech-range"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Register Subject Modal */}
      {showAddModal && (
        <div className="tech-modal-overlay">
          <div className="tech-modal-card subject-form-modal">
            <span className="crosshair-corner top-left">┼</span>
            <span className="crosshair-corner top-right">┼</span>
            <span className="crosshair-corner bottom-left">┼</span>
            <span className="crosshair-corner bottom-right">┼</span>

            <div className="subject-form-modal__header" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1.5px solid var(--border-strong)',
            }}>
              <div>
                <span className="tag-mono">// CURRICULUM_REGISTRY_ENTRY</span>
                <h2 style={{ fontSize: '1.35rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                  REGISTER NEW SUBJECT
                </h2>
              </div>
              <button
                className="btn-tech-outline"
                onClick={() => setShowAddModal(false)}
                style={{ padding: '0.35rem 0.65rem' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="subject-form-modal__form">
              <div className="subject-form-modal__body">
              <div>
                <label className="tag-mono" style={{ display: 'block', marginBottom: '0.4rem' }}>
                  SUBJECT NAME *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Organic Chemistry, Quantum Physics, Macroeconomics"
                  value={newSubjName}
                  onChange={(e) => setNewSubjName(e.target.value)}
                  className="tech-input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="tag-mono" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    EXAM DATE
                  </label>
                  <input
                    type="date"
                    value={newExamDate}
                    onChange={(e) => setNewExamDate(e.target.value)}
                    className="tech-input"
                    required
                  />
                </div>
                <div>
                  <label className="tag-mono" style={{ display: 'block', marginBottom: '0.4rem' }}>
                    PREVIOUS SCORE (0–100) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="e.g. 68"
                    value={newPrevScore}
                    onChange={(e) => {
                      setNewPrevScore(e.target.value);
                      setAcceptSuggested(null);
                    }}
                    className="tech-input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="tag-mono" style={{ display: 'block', marginBottom: '0.4rem' }}>
                  IMPORTANCE PRIORITY
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(parseInt(e.target.value))}
                  className="tech-select"
                >
                  <option value={1}>High Priority (1)</option>
                  <option value={2}>Medium Priority (2)</option>
                  <option value={3}>Low Priority (3)</option>
                </select>
              </div>

              {suggestion && suggestion.suggested_session_count != null && (
                <div className="corner-frame" style={{ padding: '1.15rem', backgroundColor: 'var(--bg-surface-low)' }}>
                  <span className="corner-bracket top-left">┌</span>
                  <span className="corner-bracket top-right">┐</span>
                  <span className="corner-bracket bottom-left">└</span>
                  <span className="corner-bracket bottom-right">┘</span>
                  <div className="tag-mono" style={{ marginBottom: '0.5rem' }}>// SESSION SUGGESTION</div>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.05rem', marginBottom: '0.35rem' }}>
                    {suggestion.suggested_session_count} sessions
                    {suggestion.pass_probability != null ? ` · ${Math.round(suggestion.pass_probability)}% estimated pass chance` : ''}
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                    Benchmark {suggestion.benchmark_hours} hrs for students like you
                    {suggestion.projected_hours != null ? ` · ${suggestion.projected_hours} hrs if you accept` : ''}.
                    <span className="tag-mono" style={{ marginLeft: '0.4rem', fontSize: '0.62rem' }}>estimate only</span>
                  </p>
                  {suggestion.warning && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{suggestion.warning}</p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
                    <button
                      type="button"
                      className={acceptSuggested === true ? 'btn-lime' : 'btn-tech-outline'}
                      onClick={() => setAcceptSuggested(true)}
                    >
                      Accept suggestion
                    </button>
                    <button
                      type="button"
                      className={acceptSuggested === false ? 'btn-lime' : 'btn-tech-outline'}
                      onClick={() => setAcceptSuggested(false)}
                    >
                      Adjust manually
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="tag-mono" style={{ display: 'block', marginBottom: '0.4rem' }}>
                  TOPICS & CHAPTERS (ONE PER LINE) *
                </label>
                <textarea
                  rows={5}
                  placeholder={`Electrophilic Addition\nResonance Structures\nAromatic Compounds\nReaction Kinetics`}
                  value={newTopicsText}
                  onChange={(e) => setNewTopicsText(e.target.value)}
                  className="tech-textarea"
                  required
                />
                <span className="tag-mono" style={{ fontSize: '0.65rem', display: 'block', marginTop: '0.25rem' }}>
                  Each line will register as a discrete chapter for active recall testing.
                </span>
              </div>

              </div>

              <div className="subject-form-modal__footer">
                <button
                  type="button"
                  className="btn-tech-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-lime"
                  disabled={submitting}
                >
                  {submitting ? 'Registering...' : 'Register Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
