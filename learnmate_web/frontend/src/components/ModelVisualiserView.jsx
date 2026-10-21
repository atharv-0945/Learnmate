import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, RotateCcw, Sliders } from 'lucide-react';
import * as api from '../api';

const DEFAULT_HOURS = 8;
const DEFAULT_SCORE = 68;

const CHART_W = 640;
const CHART_H = 360;
const PAD = { top: 24, right: 24, bottom: 48, left: 56 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

const X_TICKS = [0, 4, 8, 12, 16, 20];
const Y_TICKS = [0, 25, 50, 75, 100];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function scaleX(value, min, max) {
  const t = (clamp(value, min, max) - min) / (max - min || 1);
  return PAD.left + t * PLOT_W;
}

function scaleY(value, min, max) {
  const t = (clamp(value, min, max) - min) / (max - min || 1);
  return PAD.top + (1 - t) * PLOT_H;
}

function pathFromCurve(points, xFor, yFor) {
  if (!points || !points.length) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.hours).toFixed(2)} ${yFor(point.probability).toFixed(2)}`)
    .join(' ');
}

function pathFromPairs(pairs, xFor, yFor, close = false) {
  if (!pairs || !pairs.length) return '';
  const d = pairs
    .map((pair, index) => `${index === 0 ? 'M' : 'L'} ${xFor(pair[0]).toFixed(2)} ${yFor(pair[1]).toFixed(2)}`)
    .join(' ');
  return close ? `${d} Z` : d;
}

function StatTile({ label, value }) {
  return (
    <div className="mv-stat-tile" style={{
      backgroundColor: 'var(--bg-surface-low)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xs)',
      minWidth: 0,
      transition: 'border-color 0.15s ease, background-color 0.15s ease',
    }}>
      <span className="tag-mono" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.6rem' }}>
        {label}
      </span>
      <span className="mv-stat-value" style={{
        display: 'block',
        fontFamily: 'var(--font-heading)',
        fontWeight: 900,
        lineHeight: 1.15,
        textTransform: 'uppercase',
        overflowWrap: 'anywhere',
      }}>
        {value}
      </span>
    </div>
  );
}

function LiveVerdict({ prediction, thresholds }) {
  const probability = prediction ? prediction.pass_probability * 100 : null;
  const isPass = prediction ? prediction.is_pass : null;
  const decision = thresholds?.decision ?? 0.5;
  const highConfidence = thresholds?.high_confidence ?? 0.8;
  const highConfidencePct = highConfidence * 100;

  const status = probability === null
    ? 'WAITING FOR MODEL'
    : isPass
      ? (probability >= highConfidencePct ? 'HIGH CONFIDENCE' : 'ABOVE THRESHOLD')
      : 'BELOW THRESHOLD';
  const background = probability === null
    ? 'var(--bg-surface-low)'
    : isPass
      ? 'var(--primary)'
      : 'var(--status-danger-bg)';
  const accent = probability === null
    ? 'var(--text-dim)'
    : isPass
      ? 'var(--border-strong)'
      : 'var(--status-danger)';
  const muted = probability === null
    ? 'var(--text-secondary)'
    : isPass
      ? 'rgba(24, 25, 22, 0.68)'
      : 'var(--status-danger)';

  return (
    <div
      className="mv-verdict"
      aria-live="polite"
      style={{ backgroundColor: background, borderColor: 'var(--border-strong)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span className="tag-mono" style={{ fontSize: '0.58rem' }}>// LIVE VERDICT</span>
        <span className="tag-mono" style={{ fontSize: '0.58rem', fontWeight: 700, color: accent }}>
          {probability === null ? 'SYNC' : isPass ? 'PASS' : 'FAIL'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginTop: '0.2rem' }}>
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.65rem',
          fontWeight: 900,
          lineHeight: 1,
          color: accent,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.03em',
        }}>
          {probability === null ? '—' : probability.toFixed(1)}
          <span style={{ fontSize: '0.85rem' }}>%</span>
        </span>
      </div>
      <div className="tag-mono" style={{ fontSize: '0.52rem', color: muted, marginTop: '0.15rem', lineHeight: 1.2 }}>
        {status}
      </div>

      <div className="mv-verdict-meter" style={{ backgroundColor: isPass === false ? 'rgba(185, 28, 28, 0.18)' : 'rgba(24, 25, 22, 0.16)' }}>
        <span
          className="mv-verdict-fill"
          style={{ width: `${probability ?? 0}%`, backgroundColor: accent }}
        />
        <span className="mv-verdict-tick" style={{ left: `${decision * 100}%` }} />
        <span className="mv-verdict-tick" style={{ left: `${highConfidencePct}%` }} />
      </div>
    </div>
  );
}

function ChartCard({ tag, title, subtitle, right, children }) {
  return (
    <div className="corner-frame mv-chart-card" style={{
      padding: '1.15rem',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }}>
      <span className="corner-bracket top-left">┌</span>
      <span className="corner-bracket top-right">┐</span>
      <span className="corner-bracket bottom-left">└</span>
      <span className="corner-bracket bottom-right">┘</span>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem',
        paddingBottom: '0.55rem',
        marginBottom: '0.55rem',
        borderBottom: '1.5px solid var(--border-strong)',
      }}>
        <div style={{ minWidth: 0 }}>
          <span className="tag-mono" style={{ display: 'block' }}>{tag}</span>
          <h3 style={{
            fontSize: '0.95rem',
            lineHeight: 1.1,
            textTransform: 'uppercase',
            marginTop: '0.12rem',
            minHeight: '1.4rem',
          }}>
            {title}
          </h3>
        </div>
        {right}
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.4 }}>
        {subtitle}
      </p>

      <div style={{ flex: 1, marginTop: '0.55rem', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

function SigmoidChart({ curve, prediction, currentHours, meta, thresholds, chartHoursMax }) {
  const rawId = useId();
  const clipId = `mv-sigmoid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const xMin = 0;
  const xMax = chartHoursMax || 20;
  const xFor = (hours) => scaleX(hours, xMin, xMax);
  const yFor = (prob) => scaleY(prob, 0, 1);

  const points = curve || [];
  const currentHour = clamp(currentHours, xMin, xMax);
  const probability = prediction ? prediction.pass_probability : null;
  const dotX = xFor(currentHour);
  const dotY = probability === null || probability === undefined
    ? null
    : clamp(yFor(probability), PAD.top + 7, PAD.top + PLOT_H - 7);

  const visible = points.filter((point) => point.hours <= currentHour + 1e-6);
  const baseline = yFor(0);
  const areaPath = visible.length
    ? `M ${xFor(visible[0].hours).toFixed(2)} ${baseline.toFixed(2)} `
      + visible.map((point) => `L ${xFor(point.hours).toFixed(2)} ${yFor(point.probability).toFixed(2)}`).join(' ')
      + ` L ${xFor(currentHour).toFixed(2)} ${baseline.toFixed(2)} Z`
    : '';
  const curvePath = pathFromCurve(points, xFor, yFor);

  const decision = thresholds?.decision ?? 0.5;
  const highConfidence = thresholds?.high_confidence ?? 0.8;
  const referenceLines = [
    { value: decision, label: `Decision Threshold · ${(decision * 100).toFixed(0)}%` },
    { value: highConfidence, label: `High Confidence · ${(highConfidence * 100).toFixed(0)}%` },
  ];

  const probPct = probability === null || probability === undefined ? null : probability * 100;
  let labelBoxX = dotX + 12;
  if (labelBoxX + 72 > CHART_W - PAD.right) labelBoxX = dotX - 84;
  if (labelBoxX < PAD.left) labelBoxX = dotX + 12;
  let labelBoxY = (dotY ?? PAD.top) - 32;
  if (labelBoxY < PAD.top + 2) labelBoxY = (dotY ?? PAD.top) + 12;

  const datasetSize = meta?.dataset_size ? Number(meta.dataset_size).toLocaleString() : '—';

  return (
    <ChartCard
      tag="// SIGMOID CURVE"
      title="Study Hours vs Pass Probability"
      subtitle="The S-curve Gradient Descent learned — not hand-drawn."
    >
      <svg className="mv-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Study hours versus predicted pass probability">
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
          </clipPath>
        </defs>

        {/* Plot frame + grid */}
        <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} fill="var(--bg-surface-lowest)" stroke="var(--border-strong)" strokeWidth="1" />
        {Y_TICKS.map((tick) => {
          const y = yFor(tick / 100);
          return (
            <g key={`y-${tick}`}>
              <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray={tick === 0 ? '0' : '2 5'} />
              <text className="mv-axis" x={PAD.left - 9} y={y + 3} textAnchor="end">{tick}%</text>
            </g>
          );
        })}
        {X_TICKS.map((tick) => {
          if (tick > xMax) return null;
          const x = xFor(tick);
          return (
            <g key={`x-${tick}`}>
              <line x1={x} x2={x} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="2 5" />
              <text className="mv-axis" x={x} y={PAD.top + PLOT_H + 16} textAnchor="middle">{tick}h</text>
            </g>
          );
        })}

        {/* Threshold references */}
        {referenceLines.map((reference) => {
          const y = yFor(reference.value);
          return (
            <g key={reference.label}>
              <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={y} y2={y} stroke="var(--outline-variant)" strokeWidth="1" strokeDasharray="4 4" />
              <text className="mv-ref-label" x={PAD.left + PLOT_W - 4} y={y - 5} textAnchor="end">{reference.label}</text>
            </g>
          );
        })}

        <g clipPath={`url(#${clipId})`}>
          {areaPath && <path d={areaPath} fill="var(--primary)" opacity="0.16" />}
          {curvePath && <path d={curvePath} fill="none" stroke="var(--primary-deep)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        </g>

        {/* Current position */}
        <line x1={dotX} x2={dotX} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--primary-deep)" strokeWidth="1.25" strokeDasharray="4 4" opacity="0.7" />
        {dotY !== null && (
          <>
            <circle cx={dotX} cy={dotY} r="7" fill="var(--primary)" stroke="var(--border-strong)" strokeWidth="2" className="mv-point" />
            <g>
              <rect x={labelBoxX} y={labelBoxY} width="72" height="22" rx="1.5" fill="var(--bg-surface-lowest)" stroke="var(--border-strong)" strokeWidth="1" />
              <text className="mv-dot-label" x={labelBoxX + 36} y={labelBoxY + 15} textAnchor="middle" fill="var(--text-main)">
                {probPct !== null ? `${probPct.toFixed(1)}%` : '—'}
              </text>
            </g>
          </>
        )}

        {/* Axis titles */}
        <text className="mv-axis-title" x={PAD.left} y={PAD.top - 10}>P(PASS)</text>
        <text className="mv-axis-title" x={PAD.left + PLOT_W / 2} y={CHART_H - 9} textAnchor="middle">STUDY HOURS / WEEK</text>
      </svg>

      <div style={{ marginTop: '0.85rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ fontSize: '0.88rem', fontWeight: 800, lineHeight: 1.5 }}>
          {prediction
            ? `You are here · ${prediction.study_hours} hrs/week · ${(prediction.pass_probability * 100).toFixed(1)}% predicted pass probability.`
            : 'You are here · — hrs/week · —% predicted pass probability.'}
        </p>
        <p style={{ marginTop: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.55, fontStyle: 'italic' }}>
          Gradient Descent found this curve by studying {datasetSize} students. Slide left or right to see what it learned.
        </p>
      </div>
    </ChartCard>
  );
}

function BoundaryChart({ overview, currentHours, currentScore, isPass }) {
  const rawId = useId();
  const clipId = `mv-boundary-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const chartHoursMax = overview?.ranges?.chart_hours?.[1] ?? 20;
  const boundary = overview?.boundary;
  const points = overview?.scatter?.points || [];

  const xFor = (hours) => scaleX(hours, 0, chartHoursMax);
  const yFor = (score) => scaleY(score, 0, 100);
  const passPath = pathFromPairs(boundary?.pass_region, xFor, yFor, true);
  const failPath = pathFromPairs(boundary?.fail_region, xFor, yFor, true);
  const linePath = pathFromPairs(boundary?.line, xFor, yFor, false);

  const dotX = clamp(xFor(currentHours), PAD.left + 12, PAD.left + PLOT_W - 12);
  const dotY = clamp(yFor(currentScore), PAD.top + 12, PAD.top + PLOT_H - 12);
  const hasPrediction = isPass !== null && isPass !== undefined;
  const color = hasPrediction ? (isPass ? 'var(--status-success)' : 'var(--status-danger)') : 'var(--text-dim)';
  const halo = hasPrediction ? (isPass ? '#dcfce7' : '#fee2e2') : 'var(--bg-surface-high)';
  const labelAnchor = dotX > CHART_W - PAD.right - 24 ? 'end' : (dotX < PAD.left + 24 ? 'start' : 'middle');
  const labelX = dotX;
  const labelY = dotY < PAD.top + 36 ? dotY + 24 : dotY - 16;

  return (
    <ChartCard
      tag="// DECISION BOUNDARY"
      title="Where You Stand"
      subtitle="The decision line Gradient Descent learned from the data."
      right={(
        <div className="tag-mono" style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: '0.62rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--status-success)', display: 'inline-block' }} />
            PASS
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--status-danger)', display: 'inline-block' }} />
            FAIL
          </span>
        </div>
      )}
    >
      <svg className="mv-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Decision boundary with pass and fail students">
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
          </clipPath>
        </defs>

        <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} fill="var(--bg-surface-lowest)" stroke="var(--border-strong)" strokeWidth="1" />
        {Y_TICKS.map((tick) => {
          const y = yFor(tick);
          return (
            <g key={`y-${tick}`}>
              <line x1={PAD.left} x2={PAD.left + PLOT_W} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray={tick === 0 ? '0' : '2 5'} />
              <text className="mv-axis" x={PAD.left - 9} y={y + 3} textAnchor="end">{tick}</text>
            </g>
          );
        })}
        {X_TICKS.map((tick) => {
          if (tick > chartHoursMax) return null;
          const x = xFor(tick);
          return (
            <g key={`x-${tick}`}>
              <line x1={x} x2={x} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="2 5" />
              <text className="mv-axis" x={x} y={PAD.top + PLOT_H + 16} textAnchor="middle">{tick}h</text>
            </g>
          );
        })}

        <g clipPath={`url(#${clipId})`}>
          {failPath && <path d={failPath} fill="var(--status-danger)" opacity="0.075" />}
          {passPath && <path d={passPath} fill="var(--status-success)" opacity="0.085" />}

          {points.map((point, index) => (
            <circle
              key={`${point.hours}-${point.score}-${index}`}
              cx={xFor(point.hours)}
              cy={yFor(point.score)}
              r="2.1"
              fill={point.pass ? 'var(--status-success)' : 'var(--status-danger)'}
              opacity="0.5"
            />
          ))}

          {linePath && <path d={linePath} fill="none" stroke="var(--primary-deep)" strokeWidth="2.2" strokeLinecap="round" />}
        </g>

        <text className="mv-zone-label" x={PAD.left + 10} y={PAD.top + PLOT_H - 12} textAnchor="start" opacity="0.75">FAIL ZONE</text>
        <text className="mv-zone-label" x={PAD.left + PLOT_W - 10} y={PAD.top + PLOT_H - 12} textAnchor="end" opacity="0.75">PASS ZONE</text>

        <g className="mv-point">
          <circle cx={dotX} cy={dotY} r="11" fill={halo} stroke={color} strokeWidth="2.5" />
          <circle cx={dotX} cy={dotY} r="4.5" fill={color} />
          <text
            className="mv-you-label"
            x={labelX}
            y={labelY}
            textAnchor={labelAnchor}
            fill="var(--text-main)"
          >
            YOU
          </text>
        </g>

        <text className="mv-axis-title" x={PAD.left} y={PAD.top - 10}>PREVIOUS SCORE</text>
        <text className="mv-axis-title" x={PAD.left + PLOT_W / 2} y={CHART_H - 9} textAnchor="middle">STUDY HOURS / WEEK</text>
      </svg>

      <div style={{ marginTop: '0.85rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border-subtle)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.55, fontStyle: 'italic' }}>
          When YOU crosses the line, the prediction flips. Study hours move you more than previous score — Gradient Descent learned that from the data.
        </p>
      </div>
    </ChartCard>
  );
}

export default function ModelVisualiserView() {
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [score, setScore] = useState(DEFAULT_SCORE);
  const [overview, setOverview] = useState(null);
  const [state, setState] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSeq = useRef(0);
  const chartsRef = useRef(null);

  const runState = async (nextHours, nextScore) => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    try {
      const res = await api.getVisualiserState(nextHours, nextScore);
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        setError(res.error || 'The Gradient Descent model could not produce a prediction.');
        return;
      }
      setState(res);
      setError('');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err.message || 'Could not reach the prediction service.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getVisualiserOverview();
        if (cancelled) return;
        setOverview(res);
        if (!res.ok) {
          setError(res.error || 'The Gradient Descent model is unavailable.');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load model telemetry.');
      } finally {
        if (!cancelled) setOverviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      requestSeq.current += 1;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getVisualiserState(DEFAULT_HOURS, DEFAULT_SCORE);
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error || 'The Gradient Descent model could not produce a prediction.');
          return;
        }
        setState(res);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not reach the prediction service.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const changeHours = (event) => {
    const next = parseFloat(event.target.value);
    setHours(next);
    runState(next, score);
  };

  const changeScore = (event) => {
    const next = parseFloat(event.target.value);
    setScore(next);
    runState(hours, next);
  };

  const resetInputs = () => {
    setHours(DEFAULT_HOURS);
    setScore(DEFAULT_SCORE);
    runState(DEFAULT_HOURS, DEFAULT_SCORE);
  };

  const scrollToCharts = () => {
    chartsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const meta = overview?.meta;
  const thresholds = overview?.thresholds;
  const chartHoursMax = overview?.ranges?.chart_hours?.[1] ?? 20;
  const prediction = state?.prediction || null;
  const isPass = prediction ? prediction.is_pass : null;
  const datasetSize = meta?.dataset_size ? Number(meta.dataset_size).toLocaleString() : '—';
  const trainingSteps = meta?.training_steps !== null && meta?.training_steps !== undefined
    ? Number(meta.training_steps).toLocaleString()
    : '—';

  const chips = [
    {
      label: 'LOGISTIC REGRESSION',
      text: 'Learns a line to separate pass from fail.',
    },
    {
      label: 'GRADIENT DESCENT',
      text: `Trained the model in ${trainingSteps} steps by reducing error each time.`,
    },
    {
      label: 'SIGMOID FUNCTION',
      text: "Converts the model's output into a probability between 0% and 100%.",
    },
    {
      label: 'DECISION BOUNDARY',
      text: 'The 50% line where the prediction switches from fail to pass.',
    },
  ];

  return (
    <div className="animate-fade-in mv-page" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page header */}
      <div className="corner-frame" style={{
        padding: '1.1rem 1.35rem',
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
          gap: '1rem',
        }}>
          <div>
            <span className="tag-mono" style={{ color: 'var(--primary-deep)', fontWeight: 700 }}>
              // MODEL VISUALISER
            </span>
            <h1 style={{ fontSize: 'clamp(1.35rem, 2.1vw, 1.75rem)', textTransform: 'uppercase', marginTop: '0.1rem', marginBottom: '0.2rem' }}>
              MODEL VISUALISER
            </h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '650px', fontSize: '0.82rem' }}>
              See how your prediction works — move the sliders and watch the model respond.
            </p>
          </div>

          <div className="badge-tech lime" style={{ fontSize: '0.62rem', padding: '0.3rem 0.55rem', gap: '0.4rem' }}>
            <span className="pulse-live" style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--border-strong)',
              display: 'inline-block',
            }} />
            // LIVE · GRADIENT DESCENT MODEL
          </div>
        </div>
      </div>

      {error && (
        <div className="corner-frame" style={{
          padding: '0.85rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: 'var(--status-danger-bg)',
          borderColor: 'var(--status-danger)',
          color: 'var(--status-danger)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
        }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Inputs – sticky live control deck */}
      <div className="corner-frame mv-control-deck">
        <span className="corner-bracket top-left">┌</span>
        <span className="corner-bracket top-right">┐</span>
        <span className="corner-bracket bottom-left">└</span>
        <span className="corner-bracket bottom-right">┘</span>

        <div className="mv-deck-head">
          <div className="mv-deck-copy">
            <span className="tag-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sliders size={13} />
              // YOUR INPUTS
            </span>
            <span className="mv-deck-hint">
              Two inputs. One prediction. Move them and see what changes.
            </span>
          </div>

          <div className="mv-deck-actions">
            <button
              type="button"
              className="btn-tech-outline mv-deck-action"
              onClick={scrollToCharts}
              title="Jump to the live charts"
            >
              <ArrowDown size={12} />
              CHARTS
            </button>
            <button
              type="button"
              className="btn-tech-outline mv-deck-action"
              onClick={resetInputs}
              title="Reset both inputs"
            >
              <RotateCcw size={12} />
              RESET
            </button>
          </div>
        </div>

        <div className="mv-control-grid">
          <div className="mv-slider-block">
            <div className="mv-slider-label-row">
              <label htmlFor="mv-hours-slider">Weekly Study Hours</label>
              <span className="mv-slider-value">
                {hours.toFixed(1)} <small>hrs / week</small>
              </span>
            </div>
            <input
              id="mv-hours-slider"
              type="range"
              min="0"
              max="24"
              step="0.5"
              value={hours}
              onChange={changeHours}
              className="tech-range"
              aria-label="Weekly study hours"
              aria-valuetext={`${hours} hours per week`}
            />
            <div className="mv-slider-scale">
              <span>0h</span>
              <span>12h (rec.)</span>
              <span>24h</span>
            </div>
          </div>

          <div className="mv-slider-block">
            <div className="mv-slider-label-row">
              <label htmlFor="mv-score-slider">Previous Exam Score</label>
              <span className="mv-slider-value">
                {score} <small>%</small>
              </span>
            </div>
            <input
              id="mv-score-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={score}
              onChange={changeScore}
              className="tech-range"
              aria-label="Previous exam score"
              aria-valuetext={`${score} percent`}
            />
            <div className="mv-slider-scale">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <LiveVerdict prediction={prediction} thresholds={thresholds} />
        </div>
      </div>

      {/* Charts */}
      <div
        ref={chartsRef}
        className="mv-chart-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 430px), 1fr))',
          gap: '1.25rem',
        }}
      >
        <SigmoidChart
          curve={state?.curve || []}
          prediction={prediction}
          currentHours={hours}
          meta={meta}
          thresholds={thresholds}
          chartHoursMax={chartHoursMax}
        />
        <BoundaryChart
          overview={overview}
          currentHours={hours}
          currentScore={score}
          isPass={isPass}
        />
      </div>

      {/* Runtime spec sheet */}
      <div className="corner-frame mv-runtime-banner" style={{ padding: '1rem 1.25rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '0.65rem',
        }}>
          <span className="tag-mono">// RUNTIME TELEMETRY</span>
          <span className="tag-mono" style={{ fontSize: '0.6rem' }}>
            {overviewLoading ? 'SYNCING MODEL…' : 'CACHED AT STARTUP'}
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.6rem',
        }}>
          <StatTile label="ALGORITHM" value={meta?.algorithm || '—'} />
          <StatTile label="TRAINED WITH" value={meta?.trained_with || '—'} />
          <StatTile label="TRAINING STEPS" value={trainingSteps} />
          <StatTile label="DATASET SIZE" value={datasetSize} />
        </div>

        <p style={{ marginTop: '0.65rem', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.5 }}>
          {meta?.algorithm || 'Logistic Regression'} trained with {meta?.trained_with || 'Gradient Descent'} — finds the line that best separates pass from fail across {datasetSize} students.
        </p>
      </div>

      {/* Concept strip */}
      <div className="corner-frame" style={{ padding: '0.95rem 1.1rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '0.65rem',
        }}>
          <span className="tag-mono">// MODEL CONCEPTS</span>
          <span className="tag-mono" style={{ fontSize: '0.58rem', color: 'var(--text-dim)' }}>
            THE FOUR PIECES BEHIND THE PREDICTION
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '0.6rem',
        }}>
          {chips.map((chip) => (
            <div key={chip.label} className="mv-concept-chip" style={{
              padding: '0.7rem 0.8rem',
              backgroundColor: 'var(--bg-surface-low)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
            }}>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-heading)',
                fontSize: '0.76rem',
                fontWeight: 800,
                letterSpacing: '-0.01em',
              }}>
                {chip.label}
              </span>
              <p style={{
                marginTop: '0.2rem',
                color: 'var(--text-secondary)',
                fontSize: '0.72rem',
                lineHeight: 1.42,
              }}>
                {chip.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
