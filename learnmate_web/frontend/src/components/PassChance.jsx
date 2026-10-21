import React from 'react';
import { X } from 'lucide-react';

function fmtHours(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function ProgressTrack({ pct }) {
  const width = Math.min(100, Math.max(0, pct ?? 0));
  return (
    <div style={{ marginTop: '0.85rem', width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-high)', borderRadius: '1px', overflow: 'hidden' }}>
      <div style={{ width: `${width}%`, height: '100%', backgroundColor: 'var(--primary)', borderRight: '1px solid var(--border-strong)', transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)' }} />
    </div>
  );
}

export function ReadinessBlock({ readiness }) {
  if (!readiness) return null;

  if (!readiness.model_available) {
    return (
      <div className="corner-frame" style={{ padding: '1.25rem 1.5rem' }}>
        <span className="corner-bracket top-left">┌</span>
        <span className="corner-bracket top-right">┐</span>
        <span className="corner-bracket bottom-left">└</span>
        <span className="corner-bracket bottom-right">┘</span>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', margin: 0 }}>
          {readiness.warning || 'Pass estimates unavailable — the trained model did not load.'}
        </p>
      </div>
    );
  }

  const overall = readiness.overall_pass_probability;
  const subjects = readiness.subjects || [];

  return (
    <div className="corner-frame" style={{ padding: '1.5rem' }}>
      <span className="corner-bracket top-left">┌</span>
      <span className="corner-bracket top-right">┐</span>
      <span className="corner-bracket bottom-left">└</span>
      <span className="corner-bracket bottom-right">┘</span>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span className="tag-mono">// OVERALL READINESS</span>
        <span className="tag-mono" style={{ fontSize: '0.62rem' }}>estimate only</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>
          {overall == null ? '—' : Math.round(overall)}
        </span>
        {overall != null && (
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-deep)' }}>%</span>
        )}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
        {readiness.note || 'Priority-weighted pass chance across your subjects'}
      </p>
      {overall != null && <ProgressTrack pct={overall} />}

      {subjects.length > 0 && (
        <div style={{ marginTop: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {subjects.map((row) => (
            <div
              key={row.subject_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                padding: '0.55rem 0.75rem',
                backgroundColor: 'var(--bg-surface-low)',
                border: '1px solid var(--border-strong)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.85rem' }}>
                {row.subject_name}
              </span>
              <span className="tag-mono" style={{ fontSize: '0.68rem', fontWeight: 700 }}>
                {row.pass_probability == null ? 'NO SCORE' : `${Math.round(row.pass_probability)}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SubjectPassCards({ readiness }) {
  if (!readiness?.model_available) return null;
  const subjects = readiness.subjects || [];
  if (subjects.length === 0) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '1.25rem',
    }}>
      {subjects.map((row) => {
        const scheduled = fmtHours(row.scheduled_hours);
        const bench = fmtHours(row.benchmark_hours);
        const pct = row.pass_probability;
        const deficit = scheduled != null && bench != null
          ? Math.max(0, Number(bench) - Number(scheduled))
          : null;
        const scoreLimited = pct != null && pct < 50 && deficit != null && deficit < 0.05;
        return (
          <div key={row.subject_id} className="corner-frame" style={{ padding: '1.5rem' }}>
            <span className="corner-bracket top-left">┌</span>
            <span className="corner-bracket top-right">┐</span>
            <span className="corner-bracket bottom-left">└</span>
            <span className="corner-bracket bottom-right">┘</span>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', gap: '0.5rem' }}>
              <span className="badge-tech lime" style={{ fontSize: '0.62rem' }}>{row.subject_name}</span>
              <span className="badge-tech" style={{ fontSize: '0.62rem' }}>PRIORITY {row.priority}</span>
            </div>

            {pct != null ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Estimated pass chance</span>
                  <span className="tag-mono" style={{ fontSize: '0.62rem' }}>estimate only</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginTop: '0.35rem' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 900, lineHeight: 1 }}>
                    {Math.round(pct)}
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-deep)' }}>%</span>
                </div>
                <ProgressTrack pct={pct} />
              </>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Add a previous score to estimate pass chance.
              </p>
            )}

            {bench != null && scheduled != null && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.85rem' }}>
                Scheduled {scheduled} hrs · Benchmark {bench} hrs
                {scoreLimited ? ' · score-limited' : deficit > 0 ? ` · add ${deficit} hrs` : ''}.
              </p>
            )}
            {bench == null && scheduled != null && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.85rem' }}>
                Scheduled {scheduled} hrs
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SkipImpactModal({ skipModal, onKeep, onConfirm }) {
  if (!skipModal) return null;
  const isDelete = skipModal.action === 'delete';
  const preview = skipModal.preview;
  const before = preview?.before;
  const after = preview?.after;

  return (
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
          marginBottom: '1.25rem',
          borderBottom: '1.5px solid var(--border-strong)',
        }}>
          <div>
            <span className="tag-mono">// PASS CHANCE IMPACT</span>
            <h2 style={{ fontSize: '1.35rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
              {isDelete ? 'Delete this session?' : 'Skip this session?'}
            </h2>
          </div>
          <button className="btn-tech-outline" onClick={onKeep} style={{ padding: '0.35rem 0.65rem' }}>
            <X size={16} />
          </button>
        </div>

        {skipModal.loading ? (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>Calculating pass chance…</p>
        ) : preview && !preview.model_available ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {preview.warning || 'Pass estimates unavailable — the trained model did not load.'}
          </p>
        ) : (
          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-surface-low)', border: '1.5px solid var(--border-strong)' }}>
            <div className="tag-mono" style={{ marginBottom: '0.5rem' }}>
              {preview?.subject_name || 'Subject'} · estimate only
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div className="tag-mono" style={{ fontSize: '0.62rem' }}>BEFORE</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.6rem' }}>
                  {before == null ? '—' : `${Math.round(before)}%`}
                </div>
              </div>
              <div>
                <div className="tag-mono" style={{ fontSize: '0.62rem' }}>AFTER</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.6rem' }}>
                  {after == null ? '—' : `${Math.round(after)}%`}
                </div>
              </div>
            </div>
            {preview?.drop_percentage_points != null && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.65rem' }}>
                Change: {preview.drop_percentage_points > 0 ? '−' : ''}{Math.abs(preview.drop_percentage_points)} pts
              </p>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-lime" onClick={onKeep}>Keep it</button>
          <button type="button" className="btn-tech-outline" onClick={onConfirm} style={{ color: '#991b1b' }}>
            {isDelete ? 'Delete anyway' : 'Skip anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}
