import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Clock,
  Check,
  FastForward,
  RotateCcw,
  Flame,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2
} from 'lucide-react';
import * as api from '../api';
import { ReadinessBlock, SubjectPassCards, SkipImpactModal } from './PassChance';

const pad2 = (n) => String(n).padStart(2, '0');

const localDateStr = (date = new Date()) => (
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
);

const parseDay = (dateStr) => new Date(`${dateStr}T12:00:00`);

const sessionDate = (session) => (
  session?.date || session?.scheduled_start?.slice(0, 10) || ''
);

const getWeekRange = (dateStr) => {
  const base = parseDay(dateStr);
  const day = base.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: localDateStr(monday), end: localDateStr(sunday) };
};

const formatReadinessLine = (before, after) => {
  if (before == null || after == null) return '';
  const delta = after - before;
  if (Math.abs(delta) < 0.5) return ` Readiness steady at ${Math.round(after)}%.`;
  return ` Readiness ${Math.round(before)}% → ${Math.round(after)}% (${delta >= 0 ? '+' : ''}${Math.round(delta)} pts).`;
};

const isUpcomingSession = (session) => (
  session?.status === 'scheduled'
  && Boolean(session.scheduled_start)
  && new Date(session.scheduled_start).getTime() >= Date.now()
);

export default function StudyPlanView() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [selectedDate, setSelectedDate] = useState(() => localDateStr());
  const [actionLoading, setActionLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [skipModal, setSkipModal] = useState(null);
  const [busySessionId, setBusySessionId] = useState(null);
  const loadSeq = useRef(0);

  // Diagnostic Report Modal state
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadSessions = useCallback(async ({ silent = false } = {}) => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    try {
      if (silent) setRefreshing(true); else setLoading(true);
      const res = await api.getStudyPlan();
      if (seq !== loadSeq.current) return null;
      const allSessions = res.sessions || [];
      setSessions(allSessions);
      if (res.readiness) setReadiness(res.readiness);
      return { ...res, sessions: allSessions };
    } catch (err) {
      console.error(err);
      return null;
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const jumpToUpcoming = (allSessions) => {
    const upcoming = (allSessions || []).find(isUpcomingSession);
    if (!upcoming) return null;
    setSelectedDate(sessionDate(upcoming));
    setViewMode('day');
    return upcoming;
  };

  const handleStandardGenerate = async () => {
    try {
      setActionLoading(true);
      setAlertMsg(null);
      const before = readiness?.overall_pass_probability;
      const res = await api.generateStandardPlan();
      const reloaded = await loadSessions({ silent: true });
      const after = reloaded?.readiness?.overall_pass_probability
        ?? res.readiness?.overall_pass_probability;
      if (res.created) {
        jumpToUpcoming(reloaded?.sessions || []);
        setAlertMsg(
          `Plan regenerated: ${res.created} study sessions.`
          + formatReadinessLine(before, after)
          + (res.warning ? ` ${res.warning}` : '')
        );
      } else {
        setAlertMsg(res.warning || 'No new sessions were created — your plan is already up to date.');
      }
    } catch (err) {
      setAlertMsg(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMLOptimize = async () => {
    try {
      setActionLoading(true);
      setAlertMsg(null);
      const res = await api.optimizePlanML([]);
      const reloaded = await loadSessions({ silent: true });
      const after = reloaded?.readiness?.overall_pass_probability
        ?? res.readiness_after;
      if (res.created) {
        jumpToUpcoming(reloaded?.sessions || []);
        setAlertMsg(
          `Smart Optimize: scheduled ${res.created} study slots `
          + `(${res.weak_sessions_scheduled} priority for weak areas).`
          + formatReadinessLine(res.readiness_before, after)
          + (res.warning ? ` ${res.warning}` : '')
        );
      } else {
        setAlertMsg(res.warning || 'Nothing to optimize — your timetable is already up to date.');
      }
    } catch (err) {
      setAlertMsg(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSessionAction = async (id, status, shiftDays = 0) => {
    setBusySessionId(id);
    try {
      await api.updateSession(id, { status, shift_days: shiftDays });
      await loadSessions({ silent: true });
    } catch (err) {
      setAlertMsg(`Could not update the session: ${err.message}`);
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
    setBusySessionId(id);
    try {
      if (action === 'delete') {
        await api.deleteSession(id);
      } else {
        await api.updateSession(id, { status: 'skipped' });
      }
      await loadSessions({ silent: true });
    } catch (err) {
      setAlertMsg(`Could not change the session: ${err.message}`);
    } finally {
      setBusySessionId(null);
    }
  };

  const openDiagnosticReport = async () => {
    setShowReport(true);
    try {
      setReportLoading(true);
      const res = await api.getMLDiagnostic();
      setReportData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const shiftDay = (days) => {
    const d = parseDay(selectedDate);
    d.setDate(d.getDate() + (viewMode === 'week' ? days * 7 : days));
    setSelectedDate(localDateStr(d));
  };

  const todayStr = localDateStr();
  const weekRange = getWeekRange(selectedDate);
  const visibleSessions = sessions.filter((session) => {
    const day = sessionDate(session);
    if (viewMode === 'day') return day === selectedDate;
    return day >= weekRange.start && day <= weekRange.end;
  });
  const nextUpcoming = sessions.find(isUpcomingSession) || null;
  const reportWeakTopics = reportData?.weak_topics
    ?? reportData?.critical_topics
    ?? [];

  return (
    <div className="animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
      opacity: refreshing ? 0.85 : 1,
      transition: 'opacity 0.2s ease',
    }} aria-busy={refreshing}>
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
              // ADAPTIVE STUDY PLANNER
            </span>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', textTransform: 'uppercase', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
              DYNAMIC STUDY PLAN & TIMETABLE
            </h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', fontSize: '0.92rem' }}>
              Your personalised revision schedule, automatically adjusted based on exam dates and how well you're retaining each topic.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
              className="btn-tech-outline"
              onClick={openDiagnosticReport}
            >
              <FileBarChart size={15} />
              <span>Study Report</span>
            </button>
            <button
              className="btn-tech-outline"
              onClick={handleStandardGenerate}
              disabled={actionLoading}
            >
              <RotateCcw size={15} />
              <span>Regenerate Plan</span>
            </button>
            <button
              className="btn-lime"
              onClick={handleMLOptimize}
              disabled={actionLoading}
            >
              <Flame size={16} strokeWidth={2.4} />
              <span>Smart Optimize</span>
            </button>
          </div>
        </div>

        {alertMsg && (
          <div className="animate-fade-in" aria-live="polite" style={{
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
            <span>{alertMsg}</span>
            <button
              onClick={() => setAlertMsg(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              [CLOSE]
            </button>
          </div>
        )}
      </div>

      <ReadinessBlock readiness={readiness} />
      <SubjectPassCards readiness={readiness} />

      {/* 2. Controls & Date Navigation Bar */}
      <div className="corner-frame" style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <span className="corner-bracket top-left">┌</span>
        <span className="corner-bracket top-right">┐</span>
        <span className="corner-bracket bottom-left">└</span>
        <span className="corner-bracket bottom-right">┘</span>

        {/* View Mode Toggle: Day / Week */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="tag-mono" style={{ marginRight: '0.25rem' }}>VIEW:</span>
          <button
            className={viewMode === 'day' ? 'btn-lime' : 'btn-tech-outline'}
            onClick={() => setViewMode('day')}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}
          >
            DAY VIEW
          </button>
          <button
            className={viewMode === 'week' ? 'btn-lime' : 'btn-tech-outline'}
            onClick={() => setViewMode('week')}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}
          >
            WEEKLY OVERVIEW
          </button>
        </div>

        {/* Day Stepper & Quick Today */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn-tech-outline"
            onClick={() => shiftDay(-1)}
            style={{ padding: '0.35rem 0.65rem' }}
            title={viewMode === 'week' ? 'Previous Week' : 'Previous Day'}
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            className="tech-input"
            style={{ width: '150px', padding: '0.35rem 0.5rem', textAlign: 'center' }}
          />
          <button
            className="btn-tech-outline"
            onClick={() => shiftDay(1)}
            style={{ padding: '0.35rem 0.65rem' }}
            title={viewMode === 'week' ? 'Next Week' : 'Next Day'}
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="btn-tech-outline"
            onClick={() => setSelectedDate(localDateStr())}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
          >
            Today
          </button>
        </div>

        <div className="tag-mono" style={{ fontWeight: 700 }}>
          {visibleSessions.length} SESSION{visibleSessions.length !== 1 ? 'S' : ''} {viewMode === 'day' ? 'ON THIS DAY' : 'THIS WEEK'}
        </div>
      </div>

      {/* 2b. Interactive 7-Day Week Strip */}
      <div className="corner-frame" style={{
        padding: '1rem 1.25rem',
        backgroundColor: 'var(--bg-surface-lowest)',
        border: '1.5px solid var(--border-strong)',
      }}>
        <div className="tag-mono" style={{ marginBottom: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>// QUICK_CALENDAR_TIMETABLE_STRIP</span>
          <span style={{ color: 'var(--text-secondary)' }}>Click any day to jump directly</span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '0.5rem',
        }}>
          {(() => {
            const base = new Date(selectedDate + 'T12:00:00');
            const dayOfWeek = base.getDay();
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(base);
            monday.setDate(base.getDate() + diffToMon);

            const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

            return dayNames.map((dName, idx) => {
              const d = new Date(monday);
              d.setDate(monday.getDate() + idx);
              const dateStr = localDateStr(d);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;

              // Count sessions on this day across the full plan.
              const daySessionCount = sessions.filter(s => sessionDate(s) === dateStr).length;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setViewMode('day');
                  }}
                  style={{
                    padding: '0.65rem 0.25rem',
                    textAlign: 'center',
                    border: '1.5px solid var(--border-strong)',
                    backgroundColor: isSelected ? 'var(--primary)' : isToday ? 'var(--bg-surface-high)' : 'var(--bg-surface-low)',
                    boxShadow: isSelected ? 'var(--shadow-subtle)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.2rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, opacity: 0.8 }}>
                    {dName}
                  </span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 900, lineHeight: 1 }}>
                    {d.getDate()}
                  </span>
                  <span style={{
                    fontSize: '0.62rem',
                    fontFamily: 'var(--font-mono)',
                    color: isSelected ? 'var(--text-main)' : 'var(--text-secondary)',
                    fontWeight: 600,
                  }}>
                    {daySessionCount > 0 ? `${daySessionCount} slots` : '—'}
                  </span>
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* 3. Sessions List / Matrix */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <div className="corner-frame" style={{ padding: '3rem', textAlign: 'center' }}>
            <span className="tag-mono">// LOADING YOUR SCHEDULE...</span>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, marginTop: '0.5rem' }}>
              FETCHING REVISION SESSIONS
            </div>
          </div>
        ) : visibleSessions.length === 0 ? (
          <div className="corner-frame" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <span className="corner-bracket top-left">┌</span>
            <span className="corner-bracket top-right">┐</span>
            <span className="corner-bracket bottom-left">└</span>
            <span className="corner-bracket bottom-right">┘</span>

            <Calendar size={36} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
            <h3 style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              {viewMode === 'week' ? 'No Sessions This Week' : `No Sessions Scheduled for ${selectedDate}`}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
              {nextUpcoming
                ? `Next up: ${sessionDate(nextUpcoming)} at ${nextUpcoming.time || nextUpcoming.scheduled_start?.slice(11, 16)} · ${nextUpcoming.subject_name} — ${nextUpcoming.topic_name}.`
                : 'Your syllabus has no study blocks for this day. Click Smart Optimize to generate or rebalance your calendar slots.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {nextUpcoming && (
                <button
                  className="btn-lime"
                  onClick={() => jumpToUpcoming(sessions)}
                  disabled={actionLoading}
                >
                  Jump to Next Session
                </button>
              )}
              <button
                className={nextUpcoming ? 'btn-tech-outline' : 'btn-lime'}
                onClick={handleMLOptimize}
                disabled={actionLoading}
              >
                {actionLoading ? 'Optimising...' : 'Smart Optimize Plan'}
              </button>
              {!nextUpcoming && (
                <button
                  className="btn-tech-outline"
                  onClick={handleStandardGenerate}
                  disabled={actionLoading}
                >
                  Regenerate Schedule
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'week' ? (
          /* Weekly Matrix View */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}>
            {(() => {
              // Group this week's sessions by date
              const groups = {};
              visibleSessions.forEach(s => {
                const d = sessionDate(s) || 'Upcoming';
                if (!groups[d]) groups[d] = [];
                groups[d].push(s);
              });

              return Object.entries(groups).map(([dateStr, daySessions]) => (
                <div
                  key={dateStr}
                  className="corner-frame"
                  style={{
                    padding: '1.25rem',
                    backgroundColor: 'var(--bg-surface-low)',
                    border: '1.5px solid var(--border-strong)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: '0.5rem',
                    borderBottom: '1.5px solid var(--border-strong)',
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.85rem' }}>
                      📅 {dateStr}
                    </span>
                    <span className="badge-tech lime" style={{ fontSize: '0.62rem' }}>
                      {daySessions.length} SESSION{daySessions.length === 1 ? '' : 'S'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {daySessions.map(session => {
                      const isDone = session.status === 'completed';
                      const isSkipped = session.status === 'skipped';
                      const startTime = session.time || session.scheduled_start?.slice(11, 16) || '--:--';
                      const endTime = session.end_time || session.scheduled_end?.slice(11, 16);
                      return (
                        <div
                          key={session.id}
                          style={{
                            padding: '0.85rem',
                            backgroundColor: isDone ? '#ecfdf5' : isSkipped ? '#fef2f2' : 'var(--bg-surface-lowest)',
                            border: '1px solid var(--border-strong)',
                            borderLeft: `4px solid ${isDone ? '#15803d' : isSkipped ? '#b91c1c' : session.is_weak_priority ? '#b45309' : 'var(--primary)'}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <span className="tag-mono" style={{ fontSize: '0.65rem', fontWeight: 700 }}>
                              {session.subject_name}
                            </span>
                            <span className={`badge-tech ${isDone ? 'success' : isSkipped ? 'danger' : ''}`} style={{ fontSize: '0.6rem' }}>
                              {session.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.35rem' }}>
                            {session.topic_name}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>⏰ {startTime}{endTime ? `–${endTime}` : ''} ({session.duration_min || 60}m)</span>
                            {session.is_weak_priority && (
                              <span style={{ color: '#b45309', fontWeight: 700 }}>🎯 WEAK FOCUS</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : (
          /* Day View Grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {visibleSessions.map((session) => {
              const isDone = session.status === 'completed';
              const isSkipped = session.status === 'skipped';
              const isBusy = busySessionId === session.id;
              const timeDisplay = session.time || session.scheduled_start?.slice(11, 16) || '--:--';
              const endDisplay = session.end_time || session.scheduled_end?.slice(11, 16);
              return (
                <div
                  key={session.id}
                  className="corner-frame"
                  style={{
                    padding: '1.5rem',
                    backgroundColor: isDone ? 'var(--bg-surface-low)' : 'var(--bg-surface-lowest)',
                    borderLeft: `6px solid ${isDone ? '#15803d' : isSkipped ? '#b91c1c' : session.is_weak_priority ? '#b45309' : 'var(--primary)'}`,
                    opacity: isBusy ? 0.6 : isDone || isSkipped ? 0.75 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'opacity 0.2s ease, background-color 0.2s ease, border-color 0.2s ease',
                  }}
                >
                  <span className="corner-bracket top-left">┌</span>
                  <span className="corner-bracket top-right">┐</span>
                  <span className="corner-bracket bottom-left">└</span>
                  <span className="corner-bracket bottom-right">┘</span>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="badge-tech lime" style={{ fontSize: '0.65rem' }}>
                          {session.subject_name || 'Subject'}
                        </span>
                        {session.is_weak_priority && (
                          <span className="badge-tech warning" style={{ fontSize: '0.65rem' }}>
                            🎯 ML WEAK FOCUS
                          </span>
                        )}
                      </div>
                      <span className={`badge-tech ${isDone ? 'success' : isSkipped ? 'danger' : ''}`}>
                        {session.status.toUpperCase()}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', textTransform: 'none', fontWeight: 800, marginBottom: '0.5rem' }}>
                      {session.topic_name}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} />
                        {timeDisplay}{endDisplay ? `–${endDisplay}` : ''} ({session.duration_min || 60} mins)
                      </span>
                      <span>·</span>
                      <span>{session.date || selectedDate}</span>
                    </div>
                  </div>

                  {session.status === 'scheduled' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      paddingTop: '0.85rem',
                      borderTop: '1px solid var(--border-subtle)',
                      flexWrap: 'wrap',
                    }}>
                      <button
                        className="btn-lime"
                        onClick={() => handleSessionAction(session.id, 'completed')}
                        disabled={isBusy}
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem' }}
                      >
                        <Check size={13} strokeWidth={3} />
                        <span>Done</span>
                      </button>
                      <button
                        className="btn-tech-outline"
                        onClick={() => handleSessionAction(session.id, 'scheduled', 1)}
                        disabled={isBusy}
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem' }}
                      >
                        <FastForward size={13} />
                        <span>Move to Tomorrow</span>
                      </button>
                      <button
                        className="btn-tech-outline"
                        onClick={() => openSkipModal(session.id, 'skip')}
                        disabled={isBusy}
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem', color: '#991b1b' }}
                      >
                        <span>Skip</span>
                      </button>
                      <button
                        className="btn-tech-outline"
                        onClick={() => openSkipModal(session.id, 'delete')}
                        disabled={isBusy}
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem' }}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Study Report Modal */}
      {showReport && (
        <div className="tech-modal-overlay">
          <div className="tech-modal-card">
            <span className="crosshair-corner top-left">┼</span>
            <span className="crosshair-corner top-right">┼</span>
            <span className="crosshair-corner bottom-left">┼</span>
            <span className="crosshair-corner bottom-right">┼</span>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '1rem',
              marginBottom: '1.5rem',
              borderBottom: '1.5px solid var(--border-strong)',
            }}>
              <div>
                <span className="tag-mono">// STUDY HEALTH REPORT</span>
                <h2 style={{ fontSize: '1.35rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                  AI STUDY DIAGNOSTIC
                </h2>
              </div>
              <button
                className="btn-tech-outline"
                onClick={() => setShowReport(false)}
                style={{ padding: '0.35rem 0.65rem' }}
              >
                <X size={16} />
              </button>
            </div>

            {reportLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                Analysing your study performance...
              </div>
            ) : reportData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-low)', border: '1.5px solid var(--border-strong)' }}>
                  <div className="tag-mono" style={{ marginBottom: '0.5rem' }}>OVERVIEW</div>
                  <div>Topics needing more attention: <strong>{reportData.summary?.critical_count ?? reportWeakTopics.length}</strong></div>
                  <div style={{ marginTop: '0.35rem' }}>
                    Priority revision slots scheduled: <strong>{reportData.priority_slots ?? 0}</strong>
                  </div>
                  <div style={{ marginTop: '0.35rem' }}>
                    Topics analysed: <strong>{reportData.summary?.total_topics ?? reportData.topics_analyzed ?? 0}</strong>
                    {' · '}
                    Mastered: <strong>{reportData.summary?.mastered_count ?? reportData.mastered_topics?.length ?? 0}</strong>
                  </div>
                  {reportData.summary?.top_subject_at_risk && (
                    <div style={{ marginTop: '0.35rem' }}>
                      Highest risk subject: <strong>{reportData.summary.top_subject_at_risk}</strong>
                    </div>
                  )}
                  <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                    The AI analyses your quiz scores and study hours to flag topics where more revision will make the biggest difference.
                  </div>
                </div>

                <div>
                  <div className="tag-mono" style={{ marginBottom: '0.5rem' }}>TOPICS TO FOCUS ON:</div>
                  {reportWeakTopics.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {reportWeakTopics.map((t, idx) => (
                        <div key={idx} style={{ padding: '0.65rem 0.85rem', border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-surface-lowest)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span><strong>{t.subject ?? t.subject_name}</strong> — {t.topic ?? t.name}</span>
                          <span className="badge-tech warning" style={{ fontSize: '0.62rem' }}>
                            NEEDS WORK{t.weakness_score != null ? ` ${Math.round(t.weakness_score)}/100` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Great job! No topics flagged as critically weak right now. Keep up the pace.
                    </p>
                  )}
                </div>

                <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-lime" onClick={() => setShowReport(false)}>
                    Close Report
                  </button>
                </div>
              </div>
            ) : (
              <p>Unable to load diagnostic data. Please try again.</p>
            )}
          </div>
        </div>
      )}

      <SkipImpactModal
        skipModal={skipModal}
        onKeep={() => setSkipModal(null)}
        onConfirm={confirmSkipOrDelete}
      />
    </div>
  );
}
