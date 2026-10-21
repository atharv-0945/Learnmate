import React, { useState, useEffect, useRef } from 'react';
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import StudyPlanView from './components/StudyPlanView';
import SubjectsView from './components/SubjectsView';
import QuizzesView from './components/QuizzesView';
import FlashcardsView from './components/FlashcardsView';
import DoubtSolverView from './components/DoubtSolverView';
import ModelLabView from './components/ModelLabView';
import ModelVisualiserView from './components/ModelVisualiserView';
import { Menu, X, User as UserIcon, ArrowLeft } from 'lucide-react';
import * as api from './api';

export default function App() {
  const [currentView, setCurrentView] = useState(() => {
    return window.location.hash === '#workspace' || window.location.hash === '#app' ? 'app' : 'landing';
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemStatus, setSystemStatus] = useState({
    ml_model_active: true,
    gemini_active: true,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // Refs for scroll-based sidebar collapse
  const mainContentRef = useRef(null);
  const lastScrollY = useRef(0);
  // When the user manually expands the rail mid-page, don't fight them
  // until they scroll back to the top or navigate to another module.
  const expandLockRef = useRef(false);

  useEffect(() => {
    loadStatus();
    loadUser();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.getStatus();
      setSystemStatus(res);
    } catch {
      // fallback
    }
  };

  const loadUser = async () => {
    try {
      const res = await api.getUser();
      setUserProfile(res);
    } catch {
      // fallback
    }
  };

  // Hash-change routing
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#workspace' || window.location.hash === '#app') {
        setCurrentView('app');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Collapse the sidebar as the user scrolls into the page and restore it
  // near the top. A requestAnimationFrame guard plus hysteresis thresholds
  // keeps this to one state change per boundary instead of per scroll pixel.
  useEffect(() => {
    if (currentView !== 'app') return undefined;
    const el = mainContentRef.current;
    if (!el) return undefined;

    const COLLAPSE_AT = 72;
    const EXPAND_AT = 16;
    let rafId = 0;
    lastScrollY.current = el.scrollTop;

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const y = el.scrollTop;
        const scrollingDown = y > lastScrollY.current;
        lastScrollY.current = y;

        if (y <= EXPAND_AT) {
          expandLockRef.current = false;
          setSidebarCollapsed(false);
        } else if (scrollingDown && y >= COLLAPSE_AT && !expandLockRef.current) {
          setSidebarCollapsed(true);
        }
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [currentView]);

  const handleSidebarCollapse = (next) => {
    // A manual expand wins until the user returns to the top.
    expandLockRef.current = next === false;
    setSidebarCollapsed(next);
  };

  const handleNavigate = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    expandLockRef.current = false;
    setSidebarCollapsed(false);
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (currentView === 'landing') {
    return (
      <LandingPage
        onLaunchApp={() => {
          setCurrentView('app');
          window.location.hash = '#workspace';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-main)',
    }}>

      {/* ── Top Banner ── */}
      <div className="workspace-return-banner" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#ccff00', borderRadius: '1px' }} />
          <span style={{ fontWeight: 700, color: '#ccff00' }}>LIVE WORKSPACE ACTIVE</span>
          <span style={{ opacity: 0.65 }}>// LearnMate Cognitive Engine [SYS_01]</span>
        </div>
        <button
          type="button"
          className="workspace-return-btn"
          onClick={() => {
            setCurrentView('landing');
            window.location.hash = '';
          }}
        >
          <ArrowLeft size={13} />
          <span>Back to Landing Page</span>
        </button>
      </div>

      {/* ── Body Row ── */}
      <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 38px)', overflow: 'hidden' }}>

        {/* Desktop Sidebar – stays fixed/static on the left */}
        <div className="desktop-sidebar" style={{ display: 'block', height: '100%', flexShrink: 0 }}>
          <Sidebar
            activeTab={activeTab}
            setActiveTab={handleNavigate}
            systemStatus={systemStatus}
            collapsed={sidebarCollapsed}
            setCollapsed={handleSidebarCollapse}
          />
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 50,
          }}>
            <div style={{ width: '280px', height: '100%' }}>
              <Sidebar
                activeTab={activeTab}
                setActiveTab={handleNavigate}
                systemStatus={systemStatus}
                collapsed={false}
              />
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: 'absolute', top: '1.25rem', right: '1.25rem',
                background: 'transparent', border: 'none', color: '#fff',
              }}
            >
              <X size={26} />
            </button>
          </div>
        )}

        {/* ── Scrollable Main Column ── */}
        <div
          ref={mainContentRef}
          className="main-scroll"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Top Header */}
          <header className="workspace-header" style={{
            height: '64px',
            borderBottom: '1.5px solid var(--border-strong)',
            backgroundColor: 'var(--bg-surface-low)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 2rem',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Mobile menu trigger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="btn-tech-outline mobile-menu-btn"
                style={{ padding: '0.4rem', display: 'none' }}
              >
                <Menu size={18} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="tag-mono workspace-breadcrumb-crumb" style={{ color: 'var(--text-main)', fontWeight: 700 }}>
                  // WORKSPACE
                </span>
                <span className="workspace-breadcrumb-slash" style={{ color: 'var(--border-strong)', opacity: 0.4 }}>/</span>
                <span className="workspace-title" style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.01em',
                }}>
                  {activeTab === 'dashboard' && 'Executive Dashboard'}
                  {activeTab === 'study-plan' && 'Dynamic Timetable & Planner'}
                  {activeTab === 'subjects' && 'Syllabus & Topic Registry'}
                  {activeTab === 'quizzes' && 'AI Active Recall Generator'}
                  {activeTab === 'flashcards' && 'Knowledge Base & Flashcards'}
                  {activeTab === 'doubt-solver' && 'AI Academic Doubt Solver (Groq LPU)'}
                  {activeTab === 'model-lab' && 'ML Model Lab & Predictor'}
                  {activeTab === 'model-visualiser' && 'Model Visualiser'}
                </span>
              </div>
            </div>

            {/* User Pill */}
            <div className="workspace-user" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="corner-frame" style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.35rem 0.75rem',
                border: '1.5px solid var(--border-strong)',
                backgroundColor: 'var(--bg-surface-lowest)',
              }}>
                <span className="corner-bracket top-left">┌</span>
                <span className="corner-bracket top-right">┐</span>
                <span className="corner-bracket bottom-left">└</span>
                <span className="corner-bracket bottom-right">┘</span>
                <div style={{
                  width: '22px', height: '22px',
                  backgroundColor: 'var(--border-strong)',
                  color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '1px',
                }}>
                  <UserIcon size={13} strokeWidth={2.4} />
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                  fontWeight: 700, color: 'var(--text-main)',
                }}>
                  {userProfile?.name || 'Alex'} [STUDENT_01]
                </span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="workspace-main" style={{
            padding: '2rem',
            maxWidth: '1400px',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}>
            {activeTab === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}
            {activeTab === 'study-plan' && <StudyPlanView />}
            {activeTab === 'subjects' && <SubjectsView />}
            {activeTab === 'quizzes' && <QuizzesView />}
            {activeTab === 'flashcards' && <FlashcardsView />}
            {activeTab === 'doubt-solver' && (
              <DoubtSolverView
                systemStatus={systemStatus}
                onStatusRefresh={loadStatus}
              />
            )}
            {activeTab === 'model-lab' && <ModelLabView />}
            {activeTab === 'model-visualiser' && <ModelVisualiserView />}
          </main>
        </div>
      </div>
    </div>
  );
}
