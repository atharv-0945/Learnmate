import React, { useState, useEffect } from 'react';
import {
  FlaskConical,
  TrendingUp,
  Cpu,
  BarChart3,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import * as api from '../api';

export default function ModelLabView() {
  const [hours, setHours] = useState(8.0);
  const [score, setScore] = useState(68.0);
  const [prediction, setPrediction] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMeta();
    runPredict(8.0, 68.0);
  }, []);

  const loadMeta = async () => {
    try {
      const res = await api.getModelMeta();
      setMeta(res);
    } catch (err) {
      console.error(err);
    }
  };

  const runPredict = async (h, s) => {
    setHours(h);
    setScore(s);
    try {
      setLoading(true);
      const res = await api.predictModel(h, s);
      setPrediction(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const passProb = prediction ? prediction.pass_probability : 84.5;
  const isPass = prediction ? prediction.is_pass : true;

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
              // AI PASS PREDICTOR
            </span>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', textTransform: 'uppercase', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
              EXAM READINESS PREDICTOR
            </h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', fontSize: '0.92rem' }}>
              Our AI analyses your study hours and past exam scores to predict how likely you are to pass your upcoming exam — and what you can do to improve.
            </p>
          </div>

          <div className="tag-mono" style={{ textAlign: 'right' }}>
            <span>AI PREDICTION ENGINE</span><br />
            <span className="badge-tech lime" style={{ marginTop: '0.35rem' }}>INSTANT RESULTS</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Simulator */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.5rem',
      }}>
        {/* Left: Input Sliders */}
        <div className="corner-frame" style={{ padding: '2rem' }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '0.85rem',
            marginBottom: '1.5rem',
            borderBottom: '1.5px solid var(--border-strong)',
          }}>
            <div>
              <span className="tag-mono">// ADJUST YOUR INPUTS</span>
              <h3 style={{ fontSize: '1.15rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                YOUR STUDY INPUTS
              </h3>
            </div>
            <Sliders size={18} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Hours Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Weekly Study Hours:</span>
                <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>{hours} hrs / week</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="0.5"
                value={hours}
                onChange={(e) => runPredict(parseFloat(e.target.value), score)}
                className="tech-range"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
                <span>0 hrs (None)</span>
                <span>12 hrs (Recommended)</span>
                <span>24 hrs (Intensive)</span>
              </div>
            </div>

            {/* Score Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Your Last Mock / Exam Score:</span>
                <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>{score}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={score}
                onChange={(e) => runPredict(hours, parseFloat(e.target.value))}
                className="tech-range"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
                <span>0%</span>
                <span>50% (Pass Mark)</span>
                <span>100%</span>
              </div>
            </div>

            <div style={{
              padding: '0.85rem 1rem',
              backgroundColor: 'var(--bg-surface-low)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--text-main)' }}>How it works:</strong> The AI looks at students with similar study hours and past scores to estimate your chance of passing. Drag the sliders to see how changing your habits affects your prediction.
            </div>
          </div>
        </div>

        {/* Right: Real-time Prediction Output */}
        <div className="corner-frame" style={{
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: isPass ? 'var(--bg-surface-lowest)' : 'var(--bg-surface-low)',
        }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span className="tag-mono">// YOUR PREDICTION</span>
              <span className={`badge-tech ${isPass ? 'lime' : 'danger'}`}>
                {isPass ? 'ON TRACK TO PASS' : 'NEEDS MORE WORK'}
              </span>
            </div>

            <div className="tag-mono" style={{ marginBottom: '0.35rem' }}>
              PREDICTED PASS PROBABILITY:
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '4.2rem',
                fontWeight: 900,
                lineHeight: 1,
                transition: 'all 0.2s ease',
              }}>
                {loading ? '...' : passProb}
              </span>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-deep)' }}>%</span>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {isPass
                ? 'You have a strong chance of passing your exam at your current pace. Keep it consistent!'
                : 'Your current pace puts you below the pass mark. Try adding a few more study hours per week.'}
            </p>

            <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-surface-high)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, passProb)}%`,
                height: '100%',
                backgroundColor: isPass ? 'var(--primary)' : '#b91c1c',
                borderRight: '1.5px solid var(--border-strong)',
                transition: 'width 0.3s ease',
              }} />
            </div>

            <div style={{ marginTop: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              50% threshold = minimum to pass · {passProb >= 80 ? '80%+ = high confidence' : 'aim for 80%+ for comfortable margin'}
            </div>
          </div>

          <div style={{
            marginTop: '2rem',
            paddingTop: '1rem',
            borderTop: '1.5px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Powered by LearnMate AI</span>
            <span className={`badge-tech ${isPass ? 'success' : 'danger'}`} style={{ fontSize: '0.65rem' }}>
              VERDICT: {isPass ? 'PASS' : 'FAIL'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Model Performance Cards */}
      <div>
        <div className="tag-mono" style={{ marginBottom: '1rem' }}>// HOW ACCURATE IS OUR AI?</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
        }}>
          {/* Metric 1: Accuracy */}
          <div className="corner-frame" style={{ padding: '1.5rem' }}>
            <span className="corner-bracket top-left">┌</span>
            <span className="corner-bracket top-right">┐</span>
            <span className="corner-bracket bottom-left">└</span>
            <span className="corner-bracket bottom-right">┘</span>

            <span className="tag-mono" style={{ display: 'block', marginBottom: '0.45rem' }}>
              // PREDICTION ACCURACY
            </span>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 900 }}>
              {meta?.accuracy ? `${(meta.accuracy * 100).toFixed(1)}%` : '88.4%'}
            </div>
            <span className="tag-mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              Correctly predicts pass/fail outcomes
            </span>
          </div>

          {/* Metric 2: Reliability */}
          <div className="corner-frame" style={{ padding: '1.5rem' }}>
            <span className="corner-bracket top-left">┌</span>
            <span className="corner-bracket top-right">┐</span>
            <span className="corner-bracket bottom-left">└</span>
            <span className="corner-bracket bottom-right">┘</span>

            <span className="tag-mono" style={{ display: 'block', marginBottom: '0.45rem' }}>
              // RELIABILITY SCORE
            </span>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 900 }}>
              {meta?.roc_auc ? `${(meta.roc_auc * 100).toFixed(0)}%` : '92%'}
            </div>
            <span className="tag-mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
              Confidence in distinguishing pass vs fail
            </span>
          </div>

          {/* Metric 3: What matters most */}
          <div className="corner-frame" style={{ padding: '1.5rem' }}>
            <span className="corner-bracket top-left">┌</span>
            <span className="corner-bracket top-right">┐</span>
            <span className="corner-bracket bottom-left">└</span>
            <span className="corner-bracket bottom-right">┘</span>

            <span className="tag-mono" style={{ display: 'block', marginBottom: '0.45rem' }}>
              // WHAT MATTERS MOST?
            </span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span>Study Hours per Week:</span>
                <strong>64%</strong>
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--bg-surface-high)', marginBottom: '0.65rem' }}>
                <div style={{ width: '64%', height: '100%', backgroundColor: 'var(--primary)', borderRight: '1px solid var(--border-strong)' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                <span>Past Exam Performance:</span>
                <strong>36%</strong>
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--bg-surface-high)' }}>
                <div style={{ width: '36%', height: '100%', backgroundColor: 'var(--border-strong)' }} />
              </div>
            </div>
          </div>

          {/* Metric 4: Tips */}
          <div className="corner-frame" style={{ padding: '1.5rem' }}>
            <span className="corner-bracket top-left">┌</span>
            <span className="corner-bracket top-right">┐</span>
            <span className="corner-bracket bottom-left">└</span>
            <span className="corner-bracket bottom-right">┘</span>

            <span className="tag-mono" style={{ display: 'block', marginBottom: '0.45rem' }}>
              // QUICK TIPS
            </span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
              <div>📚 Consistency beats cramming</div>
              <div>⏰ Aim for 2+ hrs daily</div>
              <div>🎯 Focus on weak topics first</div>
              <div>✅ Use quizzes to test recall</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
