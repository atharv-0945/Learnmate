import React from 'react';
import './LandingPage.css';
import { 
  Calendar, 
  Sparkles, 
  Activity, 
  ArrowRight, 
  Bolt, 
  Terminal,
  Clock,
  Layers
} from 'lucide-react';

export default function LandingPage({ onLaunchApp }) {
  const exams = [
    'JEE',
    'NEET',
    'UPSC',
    'CAT',
    'GATE',
    'Board Exams',
    'University Finals'
  ];

  const features = [
    {
      label: '// 01 TIMETABLE',
      title: 'Smart Timetable',
      desc: 'Dynamically adapts your revision schedule around exam dates and daily energy levels.',
      metaLeft: 'MODULE: ENGINE_V4',
      metaRight: 'AUTO-SYNCED',
      icon: <Calendar size={20} strokeWidth={1.8} />
    },
    {
      label: '// 02 RETENTION',
      title: 'AI Quizzes',
      desc: 'Generates high-yield active recall questions from your syllabus and notes instantly.',
      metaLeft: 'FORMAT: LATEX + MCQ',
      metaRight: 'ZERO-LATENCY',
      icon: <Sparkles size={20} strokeWidth={1.8} />
    },
    {
      label: '// 03 ANALYTICS',
      title: 'Mastery Tracking',
      desc: 'Pinpoints high-yield weak areas with precision readiness scores before test day.',
      metaLeft: 'CALIBRATION: WEIBULL',
      metaRight: 'READINESS SCORE',
      icon: <Activity size={20} strokeWidth={1.8} />
    },
    {
      label: '// 04 DOUBT SOLVER',
      title: 'Groq LPU Solver',
      desc: 'Sub-second academic explanations, step-by-step derivations, and instant active recall checks.',
      metaLeft: 'MODEL: LLAMA-3.3-70B',
      metaRight: 'SUB-SECOND LPU',
      icon: <Bolt size={20} strokeWidth={1.8} />
    }
  ];

  const testimonials = [
    {
      quote: "“LearnMate's timetable adjusted automatically when I fell behind. Cleared JEE Advanced with AIR 412!”",
      name: 'Aarav Sharma',
      exam: 'JEE Advanced 2024'
    },
    {
      quote: "“The active recall quizzes saved me hundreds of hours of passive reading during NEET revision.”",
      name: 'Priya Nair',
      exam: 'NEET UG (Top 0.1%)'
    },
    {
      quote: "“Mastery tracking showed me the exact 3 polity chapters dragging my mock scores down. Essential for prelims.”",
      name: 'Rohan Varma',
      exam: 'UPSC CSE Aspirant'
    }
  ];

  return (
    <div className="ux-landing bg-drafting-grid">
      {/* Architectural vertical guide lines */}
      <div className="architectural-grid">
        <div className="grid-line" />
        <div className="grid-line hidden-mobile" />
        <div className="grid-line hidden-mobile" />
        <div className="grid-line" />
      </div>

      {/* 1. Minimal Top Navbar */}
      <header className="lp-header">
        <div className="lp-header-inner">
          {/* Logo Left */}
          <a href="#" className="lp-brand">
            <div className="lp-brand-icon">
              <Terminal size={16} strokeWidth={2.2} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span className="lp-brand-title">LearnMate</span>
              <span className="lp-brand-sys">[SYS_01]</span>
            </div>
          </a>

          {/* Single CTA Button on Right */}
          <div>
            <button 
              type="button" 
              className="btn-lime-cta" 
              onClick={onLaunchApp}
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Sections */}
      <main>
        {/* 2. Hero Section */}
        <section className="lp-hero">
          {/* Centered micro-tag */}
          <div className="lp-hero-tag">
            <span>/ TRUSTED BY 600,000+ STUDENTS \</span>
          </div>

          {/* Large Bold Hero Headline */}
          <h1 className="lp-hero-headline">
            STUDY SMARTER,<br />
            NOT HARDER
          </h1>

          {/* Subtitle */}
          <p className="lp-hero-subtitle">
            Your personal AI study companion that builds your timetable, quizzes you, and tracks your mastery.
          </p>

          {/* Hero CTA Button */}
          <div className="lp-hero-cta-wrap">
            <button 
              type="button" 
              className="btn-lime-cta hero-btn" 
              onClick={onLaunchApp}
            >
              <span>Start Studying — it's free</span>
              <ArrowRight size={18} strokeWidth={2.2} />
            </button>
            <span className="lp-hero-tagline">
              No account needed to explore
            </span>
          </div>
        </section>

        {/* 3. Social Proof Strip */}
        <section className="lp-ticker-strip">
          <div className="lp-ticker-inner">
            <div className="lp-ticker-label">
              <span className="pulse-dot" />
              <span>// TRUSTED BY STUDENTS PREPARING FOR</span>
            </div>
            <div className="lp-ticker-items">
              {exams.map((exam, idx) => (
                <React.Fragment key={exam}>
                  <span>{exam}</span>
                  {idx < exams.length - 1 && <span className="lp-ticker-dot">·</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Three Feature Highlight Cards */}
        <section className="lp-features-section">
          <div className="lp-features-grid">
            {features.map((feature, i) => (
              <div key={i} className="corner-frame lp-feature-card">
                {/* Corner Brackets */}
                <span className="corner-bracket top-left">┌</span>
                <span className="corner-bracket top-right">┐</span>
                <span className="corner-bracket bottom-left">└</span>
                <span className="corner-bracket bottom-right">┘</span>

                <div>
                  <div className="lp-feature-card-header">
                    <span className="tag-mono">{feature.label}</span>
                    <span className="lp-feature-icon">{feature.icon}</span>
                  </div>
                  <h3 className="lp-feature-title">{feature.title}</h3>
                  <p className="lp-feature-desc">{feature.desc}</p>
                </div>

                <div className="lp-feature-card-footer">
                  <span>{feature.metaLeft}</span>
                  <span>{feature.metaRight}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Testimonials Section */}
        <section className="lp-testimonials-section">
          <div className="lp-testimonials-header">
            <span className="tag-mono">// WHAT STUDENTS SAY</span>
            <h2 className="lp-testimonials-headline">
              Proven results across competitive exams
            </h2>
          </div>

          <div className="lp-testimonials-grid">
            {testimonials.map((item, index) => (
              <div key={index} className="corner-frame lp-quote-card">
                {/* Corner Brackets */}
                <span className="corner-bracket top-left">┌</span>
                <span className="corner-bracket top-right">┐</span>
                <span className="corner-bracket bottom-left">└</span>
                <span className="corner-bracket bottom-right">┘</span>

                <p className="lp-quote-text">{item.quote}</p>

                <div className="lp-quote-author-wrap">
                  <div className="lp-quote-author">{item.name}</div>
                  <div className="lp-quote-exam">{item.exam}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Final CTA Section with Framed Dashboard Mockup */}
        <section className="lp-final-cta-section" id="dashboard-mock">
          <div className="lp-cta-outer-frame">
            {/* Technical Drafting Crosshair Corners */}
            <span className="crosshair-corner top-left">┼</span>
            <span className="crosshair-corner top-right">┼</span>
            <span className="crosshair-corner bottom-left">┼</span>
            <span className="crosshair-corner bottom-right">┼</span>

            {/* Headline and Button */}
            <div className="lp-final-cta-content">
              <span className="tag-mono">// TELEMETRY ACTIVE : SYSTEM READY</span>
              <h2 className="lp-final-headline">
                Start Your Study Plan Today
              </h2>
              <p className="lp-final-desc">
                Join thousands of top scorers mastering their exams in less time.
              </p>
              <button 
                type="button" 
                className="btn-lime-cta hero-btn"
                onClick={onLaunchApp}
              >
                <span>Start Studying — it's free</span>
                <Bolt size={18} strokeWidth={2.2} />
              </button>
            </div>

            {/* Annotation Line identical to UX Pilot prompt styling */}
            <div className="mockup-annotation-line">
              <span>Made in LearnMate in &lt;1min ────┐</span>
              <span>┌──── AI Study Session &amp; Schedule Calibration</span>
            </div>

            {/* Framed Lavender/Technical Mockup Container */}
            <div className="mockup-viewport-frame">
              <div className="mockup-window">
                {/* Window Topbar */}
                <div className="mockup-window-topbar">
                  <div className="window-dots">
                    <span className="window-dot filled" />
                    <span className="window-dot outline" />
                    <span className="window-dot outline" />
                    <span className="window-title">WORKSPACE // COGNITIVE_ACCELERATOR</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="window-badge">SIMULATION LIVE</span>
                    <button 
                      type="button" 
                      onClick={onLaunchApp}
                      style={{
                        background: 'transparent',
                        border: '1px solid #181916',
                        padding: '0.15rem 0.5rem',
                        fontFamily: 'Space Mono, monospace',
                        fontSize: '0.65rem',
                        cursor: 'pointer',
                        borderRadius: '2px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                    >
                      <span>Interactive Mode</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Wireframe UI Grid */}
                <div className="mockup-grid">
                  {/* Left Column: Timetable Schedule */}
                  <div className="mockup-card">
                    <div className="mockup-card-header">
                      <span className="tag-mono" style={{ color: '#181916', fontWeight: 'bold' }}>
                        TODAY'S ADAPTIVE TIMETABLE
                      </span>
                      <span className="tag-mono" style={{ fontSize: '0.65rem' }}>
                        CALIBRATED: 08:30 AM
                      </span>
                    </div>

                    <div className="schedule-item active">
                      <div>
                        <div className="schedule-title">09:00 - 10:30 // Organic Chemistry</div>
                        <div className="schedule-sub">Reaction mechanisms: Electrophilic addition</div>
                      </div>
                      <span className="schedule-status">IN PROGRESS</span>
                    </div>

                    <div className="schedule-item" style={{ opacity: 0.85 }}>
                      <div>
                        <div className="schedule-title">11:00 - 12:15 // Integral Calculus</div>
                        <div className="schedule-sub">Integration by parts + High yield mock problems</div>
                      </div>
                      <span className="schedule-status" style={{ color: '#5a5b57' }}>SCHEDULED</span>
                    </div>

                    <div className="schedule-item" style={{ opacity: 0.65 }}>
                      <div>
                        <div className="schedule-title">14:00 - 15:00 // Classical Mechanics</div>
                        <div className="schedule-sub">Rotational dynamics review</div>
                      </div>
                      <span className="schedule-status" style={{ color: '#5a5b57' }}>SCHEDULED</span>
                    </div>
                  </div>

                  {/* Right Column: Readiness Dial & Diagnostic Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Dial Box */}
                    <div className="mockup-card">
                      <div className="readiness-box">
                        <div>
                          <span className="tag-mono" style={{ display: 'block', marginBottom: '0.25rem' }}>
                            EXAM READINESS SCORE
                          </span>
                          <div className="readiness-dial-value">
                            94<span style={{ fontSize: '1.4rem', color: '#475a00' }}>%</span>
                          </div>
                          <span className="tag-mono" style={{ fontSize: '0.65rem', display: 'block', marginTop: '0.2rem' }}>
                            +12.4% vs last diagnostic
                          </span>
                        </div>
                        <div className="readiness-badge-circle">
                          OPTIMAL
                        </div>
                      </div>
                    </div>

                    {/* Active Recall Quiz Card */}
                    <div className="mockup-card">
                      <div className="mockup-card-header" style={{ marginBottom: '0.35rem' }}>
                        <span className="tag-mono" style={{ color: '#181916', fontWeight: 'bold' }}>
                          // ACTIVE RECALL GENERATOR
                        </span>
                        <Sparkles size={14} color="#475a00" />
                      </div>

                      <div className="quiz-preview-snippet">
                        “Calculate the rate constant k at 300K given activation energy Ea = 45 kJ/mol...”
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Space Mono, monospace', fontSize: '0.68rem' }}>
                          <span style={{ color: '#5a5b57' }}>Topic: Kinetics & Thermodynamics</span>
                          <span style={{ fontWeight: 700, color: '#181916' }}>88% Mastery</span>
                        </div>
                        <div className="mastery-bar-track">
                          <div className="mastery-bar-fill" style={{ width: '88%' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 7. Minimal Footer */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          {/* Logo Left */}
          <div className="lp-footer-logo">
            <span className="lp-footer-logo-badge">L</span>
            <span>LearnMate</span>
          </div>

          {/* Copyright Notice */}
          <div className="lp-footer-copyright">
            © 2025 LearnMate AI. All rights reserved.
          </div>

          {/* Links: Strictly Privacy Policy and Terms of Service */}
          <div className="lp-footer-links">
            <a href="#privacy" className="lp-footer-link" onClick={(e) => { e.preventDefault(); alert("LearnMate AI – Privacy Policy: All student data is stored locally and processed securely."); }}>
              Privacy Policy
            </a>
            <a href="#terms" className="lp-footer-link" onClick={(e) => { e.preventDefault(); alert("LearnMate AI – Terms of Service: Free educational AI companion for student exam preparation."); }}>
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
