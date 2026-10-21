import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Calendar,
  ArrowRight,
  Flame,
  Check,
  FastForward,
  Sliders
} from 'lucide-react';
import * as api from '../api';
import { ReadinessBlock, SkipImpactModal } from './PassChance';

const DEFAULT_SIM_HOURS = 8.0;
const DEFAULT_SIM_SCORE = 68.0;

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

export default function DashboardView({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Live ML Predictor Sandbox state
  const [simHours, setSimHours] = useState(DEFAULT_SIM_HOURS);
  const [simScore, setSimScore] = useState(DEFAULT_SIM_SCORE);
  const [simProb, setSimProb] = useState(null);
  const [simIsPass, setSimIsPass] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [simError, setSimError] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [optMessage, setOptMessage] = useState(null);
  const [skipModal, setSkipModal] = useState(null);
  const [busySessionId, setBusySessionId] = useState(null);

  const simInitialised = useRef(false);
  const predictSeq = useRef(0);
  const predictTimer = useRef(null);

  const requestPrediction = useCallback((hours, score, { immediate = false } = {}) => {
    if (predictTimer.current) {
      clearTimeout(predictTimer.current);
      predictTimer.current = null;
    }

    const run = async () => {
      const seq = predictSeq.current + 1;
      predictSeq.current = seq;
      setPredicting(true);
      setSimError('');
      try {
        const res = await api.predictModel(hours, score);
        if (seq !== predictSeq.current) return;
        const prob = typeof res.pass_probability === 'number' ? res.pass_probability : null;
        setSimProb(prob);
        setSimIsPass(typeof res.is_pass === 'boolean' ? res.is_pass : null);
      } catch (err) {
        if (seq !== predictSeq.current) return;
        setSimProb(null);
        setSimIsPass(null);
        setSimError(err.message || 'Prediction unavailable');
      } finally {
        if (seq === predictSeq.current) setPredicting(false);
      }
    };

    if (immediate) {
      run();
    } else {
      // Small debounce: smooth while dragging, but still feels instant.
      predictTimer.current = setTimeout(run, 140);
    }
  }, []);

  useEffect(() => () => {
    if (predictTimer.current) clearTimeout(predictTimer.current);
    predictSeq.current += 1;
  }, []);

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      const res = await api.getDashboard();
      setData(res);

      // Seed the simulator from the student's saved profile once, then let the
      // sliders own the values from then on (dashboard refreshes never reset them).
      if (!simInitialised.current && res.user) {
        simInitialised.current = true;
        const hours = clampNumber(Number(res.user.weekly_study_hours ?? DEFAULT_SIM_HOURS), 0, 24);
        const score = clampNumber(Number(res.user.prev_exam_score ?? DEFAULT_SIM_SCORE), 0, 100);
        setSimHours(hours);
        setSimScore(score);
        requestPrediction(hours, score, { immediate: true });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [requestPrediction]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSimHours = (event) => {
    const next = parseFloat(event.target.value);
    if (Number.isNaN(next)) return;
    setSimHours(next);
    requestPrediction(next, simScore);
  };

  const handleSimScore = (event) => {
    const next = parseFloat(event.target.value);
    if (Number.isNaN(next)) return;
    setSimScore(next);
    requestPrediction(simHours, next);
  };

  const handleSessionAction = async (id, status, shiftDays = 0) => {
    setBusySessionId(id);
    try {
      await api.updateSession(id, { status, shift_days: shiftDays });
      await loadDashboard({ silent: true });
    } catch (err) {
      console.error(err);
    } finally {
      setBusySessionId(null);
    }
  };

  const openSkipModal = async (id, action) => {
    setSkipModal({ id, action, preview: null, loading: true });
    try {
      const preview = await api.previewSessionSkip(id);
      setSkipModal({ id, action, preview, loading: false });
    } catch {
      setSkipModal({ id, action, preview: null, loading: false });
    }
  };

  const confirmSkipOrDelete = async () => {
    if (!skipModal) return;
    const { id, action } = skipModal;
    setSkipModal(null);
    try {
      if (action === 'delete') {
        await api.deleteSession(id);
      } else {
        await api.updateSession(id, { status: 'skipped' });
      }
      await loadDashboard({ silent: true });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMLOptimize = async () => {
    try {
      setOptimizing(true);
      setOptMessage(null);
      const res = await api.optimizePlanML([]);
      const before = res.readiness_before;
      const after = res.readiness_after;

      if (!res.created) {
        setOptMessage(res.warning || 'No sessions were scheduled — your timetable is already up to date.');
      } else {
        const delta = before != null && after != null ? after - before : null;
        const readinessLine = delta == null
          ? ''
          : Math.abs(delta) >= 0.5
            ? ` Readiness ${Math.round(before)}% → ${Math.round(after)}% (${delta >= 0 ? '+' : ''}${Math.round(delta)} pts).`
            : ` Readiness steady at ${Math.round(after)}%.`;
        setOptMessage(
          `SUCCESS: Scheduled ${res.created} study slots (${res.weak_sessions_scheduled} priority for weak areas).${readinessLine}`
          + (res.warning ? ` ${res.warning}` : '')
        );
      }
      await loadDashboard({ silent: true });
    } catch (err) {
      setOptMessage(`Optimization error: ${err.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: '1rem',
      }}>
        <div className="corner-frame" style={{ padding: '2rem 3rem', textAlign: 'center' }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>
          <div className="tag-mono" style={{ marginBottom: '0.5rem' }}>// TELEMETRY_INITIALIZING</div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.25rem' }}>
            SYNCHRONIZING ML METRICS...
          </div>
        </div>
      </div>
    );
  }

  const overallPct = data?.readiness?.overall_pass_probability ?? data?.pass_probability ?? null;
  const passProb = overallPct == null ? null : clampNumber(Math.round(overallPct), 0, 100);
  const rawMastery = data?.average_mastery ?? null;
  const avgMastery = rawMastery == null ? null : clampNumber(Math.round(rawMastery), 0, 100);
  const todaySessions = data?.today_sessions ?? [];
  const nextSession = data?.next_session ?? null;
  const weakTopics = data?.critical_topics ?? data?.weak_topics ?? [];
  const totalSubj = data?.total_subjects ?? 0;
  const totalTop = data?.total_topics ?? 0;
  const topicsInPlan = data?.topics_in_plan ?? 0;
  const syllabusProgress = clampNumber(Number(data?.syllabus_progress ?? 0), 0, 100);

  const passThreshold = data?.thresholds?.pass ?? 50;
  const onTrackThreshold = data?.thresholds?.on_track ?? 60;
  const passBadge = passProb == null
    ? { label: 'NO DATA', className: '' }
    : passProb >= onTrackThreshold
      ? { label: 'ON TRACK', className: 'lime' }
      : passProb >= passThreshold
        ? { label: 'AT RISK', className: 'warning' }
        : { label: 'OFF TRACK', className: 'danger' };

  const simDisplay = simProb == null ? null : clampNumber(Math.round(simProb), 0, 100);
  const simPass = simDisplay == null ? null : (simIsPass ?? simDisplay >= passThreshold);

  return (
    <div className="animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      opacity: refreshing ? 0.82 : 1,
      transition: 'opacity 0.22s ease',
    }} aria-busy={refreshing}>
      {/* 1. Technical Welcome Header Frame */}
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
            <div className="tag-mono" style={{ color: 'var(--primary-deep)', marginBottom: '0.35rem', fontWeight: 700 }}>
              // AI SYSTEM ACTIVE
            </div>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              YOUR STUDY DASHBOARD
            </h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', fontSize: '0.92rem' }}>
              Track your exam readiness, today's study sessions, and which topics need the most attention — all in one place.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              className="btn-lime"
              onClick={handleMLOptimize}
              disabled={optimizing}
              style={{ padding: '0.75rem 1.4rem' }}
            >
              <Flame size={18} strokeWidth={2.4} />
              <span>{optimizing ? 'Optimising...' : 'Optimize My Schedule'}</span>
            </button>
            <span className="tag-mono" style={{ fontSize: '0.65rem' }}>
              Powered by LearnMate AI
            </span>
          </div>
        </div>

        {optMessage && (
          <div className="animate-fade-in" style={{
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-surface-lowest)',
            border: '1.5px solid var(--border-strong)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>{optMessage}</span>
            <button
              onClick={() => setOptMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              [DISMISS]
            </button>
          </div>
        )}
      </div>

      <ReadinessBlock readiness={data?.readiness} />

      {/* 2. Four Key Telemetry Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
      }}>
        {/* Metric 1: Exam Pass Probability */}
        <div className="corner-frame" style={{ padding: '1.5rem' }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <span className="tag-mono">// PASS PROBABILITY</span>
            <span className={`badge-tech ${passBadge.className}`}>{passBadge.label}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '0.35rem' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2.6rem', fontWeight: 900, lineHeight: 1 }}>
              {passProb == null ? '—' : passProb}
            </span>
            {passProb != null && (
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-deep)' }}>%</span>
            )}
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {data?.readiness?.model_available === false
              ? (data.readiness.warning || 'Pass estimates unavailable — the trained model did not load.')
              : (data?.readiness?.note || 'Priority-weighted readiness across your planned timetable')}
          </p>
          {passProb != null && (
            <div style={{ marginTop: '0.85rem', width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-high)', borderRadius: '1px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, passProb)}%`,
                height: '100%',
                backgroundColor: 'var(--primary)',
                borderRight: '1px solid var(--border-strong)',
                transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
              }} />
            </div>
          )}
        </div>

        {/* Metric 2: Average Topic Mastery */}
        <div className="corner-frame" style={{ padding: '1.5rem' }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <span className="tag-mono">// TOPIC MASTERY</span>
            <span className="badge-tech">AVG SCORE</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '0.35rem' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2.6rem', fontWeight: 900, lineHeight: 1 }}>
              {avgMastery == null ? '—' : avgMastery}
            </span>
            {avgMastery != null && <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>%</span>}
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Average mastery across all your topics
          </p>
          <div style={{ marginTop: '0.85rem', width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-high)', borderRadius: '1px', overflow: 'hidden' }}>
            <div style={{
              width: `${avgMastery ?? 0}%`,
              height: '100%',
              backgroundColor: 'var(--border-strong)',
              transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
        </div>

        {/* Metric 3: Today's Scheduled Slots */}
        <div className="corner-frame" style={{ padding: '1.5rem' }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <span className="tag-mono">// TODAY_SESSIONS</span>
            <span className="badge-tech">AUTO-SYNC</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '0.35rem' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2.6rem', fontWeight: 900, lineHeight: 1 }}>
              {todaySessions.length}
            </span>
            <span style={{ fontSize: '0.95rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>SLOTS</span>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {todaySessions.filter((s) => s.status === 'completed').length} completed · {todaySessions.filter((s) => s.status === 'scheduled').length} pending
          </p>
          <div style={{ marginTop: '0.85rem', width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-high)', borderRadius: '1px', overflow: 'hidden' }}>
            <div style={{
              width: `${todaySessions.length > 0 ? (todaySessions.filter((s) => s.status === 'completed').length / todaySessions.length) * 100 : 0}%`,
              height: '100%',
              backgroundColor: 'var(--primary)',
              borderRight: '1px solid var(--border-strong)',
              transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
        </div>

        {/* Metric 4: Syllabus Registry */}
        <div className="corner-frame" style={{ padding: '1.5rem' }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <span className="tag-mono">// SYLLABUS_INDEX</span>
            <span className="badge-tech">ACTIVE</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '0.35rem' }}>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2.6rem', fontWeight: 900, lineHeight: 1 }}>
              {totalSubj}
            </span>
            <span style={{ fontSize: '0.95rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>SUBJECTS</span>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {topicsInPlan} of {totalTop} topics in your plan
          </p>
          <div style={{ marginTop: '0.85rem', width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-high)', borderRadius: '1px', overflow: 'hidden' }}>
            <div style={{
              width: `${syllabusProgress}%`,
              height: '100%',
              backgroundColor: 'var(--border-strong)',
              transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Grid: Left = Adaptive Timetable, Right = Weakness Radar & Simulator */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '1.5rem',
      }}>
        {/* Left Column: Today's Adaptive Timetable */}
        <div className="corner-frame" style={{ padding: '1.75rem' }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '0.85rem',
            marginBottom: '1.25rem',
            borderBottom: '1.5px solid var(--border-strong)',
          }}>
            <div>
              <span className="tag-mono">// SCHEDULE_DISPATCH</span>
              <h2 style={{ fontSize: '1.25rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                TODAY'S ADAPTIVE TIMETABLE
              </h2>
            </div>
            <button
              className="btn-tech-outline"
              onClick={() => onNavigate('study-plan')}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
            >
              <span>Full Schedule</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {todaySessions.length === 0 ? (
            <div style={{
              padding: '2.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface-low)',
              border: '1px dashed var(--border-strong)',
            }}>
              <Calendar size={28} style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
              {nextSession ? (
                <>
                  <div className="tag-mono" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                    NO SESSIONS LEFT TODAY
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                    Next up: {nextSession.date} at {nextSession.start_time} · {nextSession.subject_name}
                    {nextSession.topic_name ? ` — ${nextSession.topic_name}` : ''}
                  </p>
                  <button className="btn-lime" onClick={() => onNavigate?.('study-plan')}>
                    <span>View Study Plan</span>
                    <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <>
                  <div className="tag-mono" style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                    NO SESSIONS DISPATCHED TODAY
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                    Run the ML optimizer to generate an adaptive revision schedule.
                  </p>
                  <button className="btn-lime" onClick={handleMLOptimize} disabled={optimizing}>
                    {optimizing ? 'Optimising...' : 'Generate Timetable'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {todaySessions.map((session, i) => {
                const isDone = session.status === 'completed';
                const isSkipped = session.status === 'skipped';
                const isBusy = busySessionId === session.id;
                return (
                  <div
                    key={session.id || i}
                    style={{
                      padding: '1rem',
                      backgroundColor: isDone ? 'var(--bg-surface-low)' : 'var(--bg-surface-lowest)',
                      border: '1.5px solid var(--border-strong)',
                      borderLeft: `5px solid ${isDone ? '#15803d' : isSkipped ? '#b91c1c' : 'var(--primary)'}`,
                      opacity: isBusy ? 0.6 : isDone || isSkipped ? 0.75 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      transition: 'opacity 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span className="badge-tech lime" style={{ fontSize: '0.62rem' }}>
                            {session.subject_name || 'Subject'}
                          </span>
                          <span className="tag-mono" style={{ fontSize: '0.65rem' }}>
                            {session.start_time || session.time || '--:--'}
                            {session.end_time ? ` - ${session.end_time}` : ''}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1rem', textTransform: 'none', fontWeight: 800 }}>
                          {session.topic_name || 'Active Review'}
                        </h4>
                      </div>

                      <span className={`badge-tech ${isDone ? 'success' : isSkipped ? 'danger' : ''}`}>
                        {session.status.toUpperCase()}
                      </span>
                    </div>

                    {session.status === 'scheduled' && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        paddingTop: '0.5rem',
                        borderTop: '1px solid var(--border-subtle)',
                      }}>
                        <button
                          className="btn-lime"
                          onClick={() => handleSessionAction(session.id, 'completed')}
                          disabled={isBusy}
                          style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem' }}
                        >
                          <Check size={13} strokeWidth={3} />
                          <span>Complete</span>
                        </button>
                        <button
                          className="btn-tech-outline"
                          onClick={() => handleSessionAction(session.id, 'scheduled', 1)}
                          disabled={isBusy}
                          style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem' }}
                        >
                          <FastForward size={13} />
                          <span>Shift +1d</span>
                        </button>
                        <button
                          className="btn-tech-outline"
                          onClick={() => openSkipModal(session.id, 'skip')}
                          disabled={isBusy}
                          style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem', color: '#991b1b' }}
                        >
                          <span>Skip</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Weakness Radar & ML Simulator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Weakness Radar Card */}
          <div className="corner-frame" style={{ padding: '1.75rem' }}>
            <span className="corner-bracket top-left">┌</span>
            <span className="corner-bracket top-right">┐</span>
            <span className="corner-bracket bottom-left">└</span>
            <span className="corner-bracket bottom-right">┘</span>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '0.85rem',
              marginBottom: '1.25rem',
              borderBottom: '1.5px solid var(--border-strong)',
            }}>
              <div>
                <span className="tag-mono">// TOPICS NEEDING ATTENTION</span>
                <h3 style={{ fontSize: '1.15rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                  WEAK AREAS TO FOCUS ON
                </h3>
              </div>
              <span className="badge-tech warning">AI DETECTED</span>
            </div>

            {weakTopics.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--bg-surface-low)' }}>
                <CheckCircle2 size={24} color="#15803d" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700 }}>
                  NO SEVERE WEAKNESSES DETECTED
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  All topics currently maintain safe retention calibration.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {weakTopics.slice(0, 3).map((w, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.85rem 1rem',
                      backgroundColor: 'var(--bg-surface-low)',
                      border: '1px solid var(--border-strong)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div className="tag-mono" style={{ fontSize: '0.65rem' }}>
                        {w.subject_name || w.subject || 'Subject'} · LOW SCORE
                      </div>
                      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem' }}>
                        {w.name || w.topic}
                      </div>
                    </div>
                    <button
                      className="btn-lime"
                      onClick={() => onNavigate('quizzes')}
                      style={{ fontSize: '0.7rem', padding: '0.35rem 0.65rem' }}
                    >
                      <span>Fix Quiz</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive What-If Simulator Card */}
          <div className="corner-frame" style={{ padding: '1.75rem' }}>
            <span className="corner-bracket top-left">┌</span>
            <span className="corner-bracket top-right">┐</span>
            <span className="corner-bracket bottom-left">└</span>
            <span className="corner-bracket bottom-right">┘</span>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '0.85rem',
              marginBottom: '1.25rem',
              borderBottom: '1.5px solid var(--border-strong)',
            }}>
              <div>
                <span className="tag-mono">// ML_SIMULATOR</span>
                <h3 style={{ fontSize: '1.15rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                  WHAT-IF PASS CALCULATOR
                </h3>
              </div>
              <Sliders size={16} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Weekly Study Hours:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{simHours} hrs/wk</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="0.5"
                  value={simHours}
                  onChange={handleSimHours}
                  className="tech-range"
                  aria-label="Simulated weekly study hours"
                  aria-valuetext={`${simHours} hours per week`}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Previous Exam Score:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{simScore}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={simScore}
                  onChange={handleSimScore}
                  className="tech-range"
                  aria-label="Simulated previous exam score"
                  aria-valuetext={`${simScore} percent`}
                />
              </div>

              {/* Real-time Result Pill */}
              <div
                aria-live="polite"
                title={simError || undefined}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem 1.15rem',
                  backgroundColor: 'var(--bg-surface-low)',
                  border: '1.5px solid var(--border-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  transition: 'background-color 0.2s ease, border-color 0.2s ease',
                }}
              >
                <div>
                  <span className="tag-mono" style={{ display: 'block', fontSize: '0.65rem' }}>
                    PROJECTED OUTCOME{predicting ? ' · SYNCING' : ''}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'color 0.2s ease',
                  }}>
                    {simError
                      ? 'MODEL OFFLINE'
                      : simDisplay == null
                        ? (predicting ? 'CALCULATING…' : '—')
                        : `${simDisplay}% PASS CHANCE`}
                  </span>
                </div>
                <span className={`badge-tech ${simDisplay == null ? '' : simPass ? 'lime' : 'warning'}`}>
                  {simDisplay == null
                    ? (simError ? 'NO ESTIMATE' : predicting ? 'SYNCING' : 'NO ESTIMATE')
                    : simPass ? 'PASS VERDICT' : 'NEEDS REVISION'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SkipImpactModal
        skipModal={skipModal}
        onKeep={() => setSkipModal(null)}
        onConfirm={confirmSkipOrDelete}
      />
    </div>
  );
}
