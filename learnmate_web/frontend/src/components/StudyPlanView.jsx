import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Check,
  FastForward,
  RotateCcw,
  Sparkles,
  Flame,
  FileBarChart,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Brain,
  Sliders,
  Terminal,
  Activity
} from 'lucide-react';
import * as api from '../api';

export default function StudyPlanView() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [actionLoading, setActionLoading] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);

  // Diagnostic Report Modal state
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, [selectedDate, viewMode]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await api.getStudyPlan(viewMode === 'day' ? selectedDate : null);
      setSessions(res.sessions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStandardGenerate = async () => {
    try {
      setActionLoading(true);
      const res = await api.generateStandardPlan();
      setAlertMsg(`Done! Created ${res.created} study sessions across your active syllabus.`);
      loadSessions();
    } catch (err) {
      setAlertMsg(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMLOptimize = async () => {
    try {
      setActionLoading(true);
      const res = await api.optimizePlanML([]);
      setAlertMsg(`Plan optimized! Scheduled ${res.created} sessions (${res.weak_sessions_scheduled} extra slots added for your weaker topics).`);
      loadSessions();
    } catch (err) {
      setAlertMsg(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSessionAction = async (id, status, shiftDays = 0) => {
    try {
      await api.updateSession(id, { status, shift_days: shiftDays });
      loadSessions();
    } catch (err) {
      console.error(err);
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
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
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
            title="Previous Day"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="tech-input"
            style={{ width: '150px', padding: '0.35rem 0.5rem', textAlign: 'center' }}
          />
          <button
            className="btn-tech-outline"
            onClick={() => shiftDay(1)}
            style={{ padding: '0.35rem 0.65rem' }}
            title="Next Day"
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="btn-tech-outline"
            onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
          >
            Today
          </button>
        </div>

        <div className="tag-mono" style={{ fontWeight: 700 }}>
          {sessions.length} SESSION{sessions.length !== 1 ? 'S' : ''} {viewMode === 'day' ? 'ON THIS DAY' : 'TOTAL'}
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
            const todayStr = new Date().toISOString().slice(0, 10);

            return dayNames.map((dName, idx) => {
              const d = new Date(monday);
              d.setDate(monday.getDate() + idx);
              const dateStr = d.toISOString().slice(0, 10);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;

              // Count sessions on this day if in weekly mode
              const daySessionCount = sessions.filter(s => (s.date || s.scheduled_start?.slice(0, 10)) === dateStr).length;

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
        ) : sessions.length === 0 ? (
          <div className="corner-frame" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <span className="corner-bracket top-left">┌</span>
            <span className="corner-bracket top-right">┐</span>
            <span className="corner-bracket bottom-left">└</span>
            <span className="corner-bracket bottom-right">┘</span>

            <Calendar size={36} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
            <h3 style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              No Sessions Scheduled for {selectedDate}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
              Your syllabus has no study blocks for this day. Click Smart Optimize to generate or rebalance your calendar slots.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button className="btn-lime" onClick={handleMLOptimize}>
                Smart Optimize Plan
              </button>
              <button className="btn-tech-outline" onClick={handleStandardGenerate}>
                Regenerate Schedule
              </button>
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
              // Group sessions by date
              const groups = {};
              sessions.forEach(s => {
                const d = s.date || s.scheduled_start?.slice(0, 10) || 'Upcoming';
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
                      {daySessions.length} SESSIONS
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {daySessions.map(session => {
                      const isDone = session.status === 'completed';
                      const isSkipped = session.status === 'skipped';
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
                            <span>⏰ {session.time || session.scheduled_start?.slice(11, 16) || '09:00'} ({session.duration_min || 60}m)</span>
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
            {sessions.map((session) => {
              const isDone = session.status === 'completed';
              const isSkipped = session.status === 'skipped';
              const timeDisplay = session.time || session.scheduled_start?.slice(11, 16) || '09:00';
              return (
                <div
                  key={session.id}
                  className="corner-frame"
                  style={{
                    padding: '1.5rem',
                    backgroundColor: isDone ? 'var(--bg-surface-low)' : 'var(--bg-surface-lowest)',
                    borderLeft: `6px solid ${isDone ? '#15803d' : isSkipped ? '#b91c1c' : session.is_weak_priority ? '#b45309' : 'var(--primary)'}`,
                    opacity: isDone || isSkipped ? 0.75 : 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
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
                        {timeDisplay} ({session.duration_min || 60} mins)
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
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem' }}
                      >
                        <Check size={13} strokeWidth={3} />
                        <span>Done</span>
                      </button>
                      <button
                        className="btn-tech-outline"
                        onClick={() => handleSessionAction(session.id, 'scheduled', 1)}
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem' }}
                      >
                        <FastForward size={13} />
                        <span>Move to Tomorrow</span>
                      </button>
                      <button
                        className="btn-tech-outline"
                        onClick={() => handleSessionAction(session.id, 'skipped')}
                        style={{ fontSize: '0.72rem', padding: '0.35rem 0.75rem', color: '#991b1b' }}
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
                  <div>Topics needing more attention: <strong>{reportData.weak_topics?.length ?? 0}</strong></div>
                  <div style={{ marginTop: '0.35rem' }}>
                    Priority revision slots scheduled: <strong>{reportData.priority_slots ?? 4}</strong>
                  </div>
                  <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
                    The AI analyses your quiz scores and study hours to flag topics where more revision will make the biggest difference.
                  </div>
                </div>

                <div>
                  <div className="tag-mono" style={{ marginBottom: '0.5rem' }}>TOPICS TO FOCUS ON:</div>
                  {reportData.weak_topics && reportData.weak_topics.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {reportData.weak_topics.map((t, idx) => (
                        <div key={idx} style={{ padding: '0.65rem 0.85rem', border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-surface-lowest)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span><strong>{t.subject}</strong> — {t.topic}</span>
                          <span className="badge-tech warning" style={{ fontSize: '0.62rem' }}>NEEDS WORK</span>
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
    </div>
  );
}
