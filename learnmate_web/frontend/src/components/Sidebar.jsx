import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  BrainCircuit,
  Layers,
  FlaskConical,
  Terminal,
  Cpu,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, systemStatus, collapsed, setCollapsed }) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed;
  const toggleCollapse = () => {
    if (setCollapsed) {
      setCollapsed(!isCollapsed);
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const navItems = [
    { id: 'dashboard', code: '// 01', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'study-plan', code: '// 02', label: 'Study Plan & Timetable', icon: CalendarDays },
    { id: 'subjects', code: '// 03', label: 'Subjects & Topics', icon: BookOpen },
    { id: 'quizzes', code: '// 04', label: 'AI Active Recall', icon: BrainCircuit },
    { id: 'flashcards', code: '// 05', label: 'Flashcards & Documents', icon: Layers },
    { id: 'doubt-solver', code: '// 06', label: 'AI Doubt Solver', icon: Zap },
    { id: 'model-lab', code: '// 07', label: 'ML Model Lab', icon: FlaskConical },
  ];

  return (
    <aside style={{
      width: isCollapsed ? '76px' : '280px',
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1.5px solid var(--border-strong)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: isCollapsed ? '1.5rem 0.65rem' : '1.5rem 1.15rem',
      height: '100%',
      position: 'relative',
      zIndex: 40,
      flexShrink: 0,
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s ease',
      overflowX: 'hidden',
      overflowY: 'hidden',
    }}>
      {/* Brand & Collapse Header */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          paddingBottom: '1.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              backgroundColor: 'var(--border-strong)',
              color: 'var(--primary)',
              border: '1.5px solid var(--border-strong)',
              borderRadius: 'var(--radius-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-subtle)',
              flexShrink: 0,
            }}>
              <Terminal size={20} strokeWidth={2.4} />
            </div>

            {!isCollapsed && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                  <span style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.35rem',
                    fontWeight: 900,
                    color: 'var(--text-main)',
                    letterSpacing: '-0.02em',
                  }}>
                    LearnMate
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                  }}>
                    [SYS_01]
                  </span>
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  COGNITIVE COMPANION
                </div>
              </div>
            )}
          </div>

          {/* Collapse/Expand Toggle Button */}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-xs)',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-main)',
              padding: 0,
              boxShadow: '1px 1px 0px var(--border-strong)',
              flexShrink: 0,
              marginLeft: isCollapsed ? 0 : '0.5rem',
            }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Section Navigation Header */}
        {!isCollapsed && (
          <div className="tag-mono" style={{ marginBottom: '0.75rem', paddingLeft: '0.25rem' }}>
            NAVIGATION MODULES
          </div>
        )}

        {/* Nav Items List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  padding: isCollapsed ? '0.75rem 0' : '0.7rem 0.85rem',
                  borderRadius: 'var(--radius-xs)',
                  border: isActive ? '1.5px solid var(--border-strong)' : '1px solid transparent',
                  backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.88rem',
                  fontWeight: isActive ? 700 : 500,
                  textAlign: 'left',
                  width: '100%',
                  boxShadow: isActive ? 'var(--shadow-subtle)' : 'none',
                  transform: isActive ? 'translate(-1px, -1px)' : 'none',
                  transition: 'all 0.12s ease',
                  overflow: 'hidden',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                  <Icon size={18} strokeWidth={isActive ? 2.4 : 1.8} />
                  {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
                </div>
                {!isCollapsed && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    opacity: isActive ? 0.9 : 0.5,
                    fontWeight: 700,
                  }}>
                    {item.code}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Technical Diagnostics Box with Corner Brackets */}
      {isCollapsed ? (
        <div style={{
          textAlign: 'center',
          padding: '0.5rem 0',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <div
            title={`System: ${systemStatus?.ml_model_active ? 'ML Online' : 'ML Offline'}`}
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: systemStatus?.ml_model_active ? 'var(--primary)' : '#b91c1c',
              border: '1.5px solid var(--border-strong)',
              margin: '0 auto',
            }}
          />
        </div>
      ) : (
        <div className="corner-frame" style={{
          padding: '1rem',
          backgroundColor: 'var(--bg-surface-lowest)',
          border: '1.5px solid var(--border-strong)',
        }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.65rem',
            paddingBottom: '0.45rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span className="tag-mono" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Cpu size={12} />
              // TELEMETRY
            </span>
            <span className="badge-tech lime" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
              ACTIVE
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ML Engine:</span>
              <span style={{
                fontWeight: 700,
                color: systemStatus?.ml_model_active ? '#15803d' : '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                {systemStatus?.ml_model_active ? <Check size={12} strokeWidth={3} /> : <AlertCircle size={12} />}
                {systemStatus?.ml_model_active ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gemini AI:</span>
              <span style={{
                fontWeight: 700,
                color: systemStatus?.gemini_active ? '#15803d' : '#b45309',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                {systemStatus?.gemini_active ? <Check size={12} strokeWidth={3} /> : <AlertCircle size={12} />}
                {systemStatus?.gemini_active ? 'CONNECTED' : 'STANDBY'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Groq LPU:</span>
              <span style={{
                fontWeight: 700,
                color: systemStatus?.groq_active ? '#15803d' : '#b45309',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                {systemStatus?.groq_active ? <Check size={12} strokeWidth={3} /> : <AlertCircle size={12} />}
                {systemStatus?.groq_active ? 'ONLINE' : 'STANDBY'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Database:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                SQLITE_V2
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
