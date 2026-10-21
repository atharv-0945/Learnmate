import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  BookOpen,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Bot,
  PlusCircle,
  GraduationCap,
  X,
  FlaskConical,
  Brain,
  Settings,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  HelpCircle,
  Award,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as api from '../api';

// ── Inline Markdown & Math Helper ──
function renderInlineText(text) {
  if (!text) return null;
  // Splits by **bold**, `code`, and $inline math$
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\$.*?\$)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: 'var(--text-main)', fontWeight: 800 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          style={{
            backgroundColor: 'rgba(204, 255, 0, 0.15)',
            border: '1px solid rgba(24, 25, 22, 0.3)',
            padding: '0.12rem 0.38rem',
            borderRadius: '2px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.86em',
            color: 'var(--text-main)',
            fontWeight: 700,
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      return (
        <span
          key={i}
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--primary-deep)',
            backgroundColor: 'rgba(204, 255, 0, 0.2)',
            border: '1px solid var(--border-strong)',
            padding: '0.08rem 0.35rem',
            borderRadius: '2px',
            fontWeight: 700,
            fontSize: '0.88em',
            margin: '0 0.15rem',
          }}
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}

// ── Code Snippet Block Component ──
function CodeSnippetBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="doubt-code-container">
      <div className="doubt-code-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ display: 'inline-block', width: '7px', height: '7px', backgroundColor: '#ccff00', borderRadius: '1px' }} />
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            {language || 'SYNTAX'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: '1px solid #3e4238',
            color: copied ? '#ccff00' : '#e5e7eb',
            padding: '0.2rem 0.55rem',
            borderRadius: '2px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.68rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} />}
          <span>{copied ? 'COPIED' : 'COPY'}</span>
        </button>
      </div>
      <pre className="doubt-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── Markdown Content Parser with Table & Math Support ──
function MarkdownContent({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeBuffer = [];
  let inMathBlock = false;
  let mathBuffer = [];
  let listBuffer = [];
  let listType = null; // 'ul' | 'ol'
  let tableBuffer = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      if (listType === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} style={{ paddingLeft: '1.4rem', margin: '0.75rem 0' }}>
            {listBuffer.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem', lineHeight: 1.6 }}>
                {renderInlineText(item)}
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} style={{ paddingLeft: '1.4rem', margin: '0.75rem 0' }}>
            {listBuffer.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.4rem', lineHeight: 1.6 }}>
                {renderInlineText(item)}
              </li>
            ))}
          </ul>
        );
      }
      listBuffer = [];
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      // First row is header, second is divider, rest are rows
      const parseRow = (line) => {
        return line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());
      };

      const headerCells = parseRow(tableBuffer[0]);
      const dataRows = tableBuffer.slice(2).map(parseRow);

      elements.push(
        <div key={`table-${elements.length}`} style={{ overflowX: 'auto', margin: '1.25rem 0' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1.5px solid var(--border-strong)',
              backgroundColor: 'var(--bg-surface-lowest)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.84rem',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface-high)', borderBottom: '1.5px solid var(--border-strong)' }}>
                {headerCells.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    style={{
                      padding: '0.65rem 0.95rem',
                      textAlign: 'left',
                      fontWeight: 800,
                      borderRight: '1px solid var(--border-subtle)',
                      letterSpacing: '0.02em',
                      color: 'var(--text-main)',
                    }}
                  >
                    {renderInlineText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: rIdx % 2 === 1 ? 'var(--bg-surface-low)' : 'var(--bg-surface-lowest)',
                  }}
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        padding: '0.55rem 0.95rem',
                        borderRight: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)',
                      }}
                    >
                      {renderInlineText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // ── Code Block detection ──
    if (trimmed.startsWith('```')) {
      flushList();
      flushTable();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = trimmed.slice(3).trim() || 'code';
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        const codeText = codeBuffer.join('\n');
        elements.push(
          <CodeSnippetBlock
            key={`code-${elements.length}`}
            language={codeLanguage}
            code={codeText}
          />
        );
        codeBuffer = [];
        codeLanguage = '';
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // ── Math Block detection ($$ ... $$) ──
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2) {
      flushList();
      flushTable();
      const mathFormula = trimmed.slice(2, -2).trim();
      elements.push(
        <div key={`math-${elements.length}`} className="doubt-math-block">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span className="tag-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
              // FORMULA NOTATION
            </span>
            <span className="badge-tech" style={{ fontSize: '0.62rem' }}>LaTeX / Math</span>
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em', fontFamily: 'var(--font-mono)' }}>
            {mathFormula}
          </div>
        </div>
      );
      continue;
    }

    if (trimmed === '$$') {
      flushList();
      flushTable();
      if (!inMathBlock) {
        inMathBlock = true;
        mathBuffer = [];
      } else {
        inMathBlock = false;
        elements.push(
          <div key={`math-${elements.length}`} className="doubt-math-block">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span className="tag-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                // MATHEMATICAL PROOF / DERIVATION
              </span>
              <span className="badge-tech" style={{ fontSize: '0.62rem' }}>LaTeX / Math</span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
              {mathBuffer.join('\n')}
            </div>
          </div>
        );
        mathBuffer = [];
      }
      continue;
    }

    if (inMathBlock) {
      mathBuffer.push(rawLine);
      continue;
    }

    // ── Table detection (starts with | or contains multiple |) ──
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 3) {
      flushList();
      tableBuffer.push(trimmed);
      continue;
    } else {
      if (tableBuffer.length > 0) {
        flushTable();
      }
    }

    // ── Headers ──
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${elements.length}`}>
          {renderInlineText(trimmed.slice(4))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${elements.length}`}>
          {renderInlineText(trimmed.slice(3))}
        </h2>
      );
      continue;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${elements.length}`}>
          {renderInlineText(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // ── Ordered & Unordered Lists ──
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listBuffer.push(olMatch[2]);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listBuffer.push(ulMatch[1]);
      continue;
    }

    // ── Blockquotes ──
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={`quote-${elements.length}`}>
          {renderInlineText(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // ── Horizontal Rule ──
    if (trimmed === '---' || trimmed === '***') {
      flushList();
      elements.push(
        <hr
          key={`hr-${elements.length}`}
          style={{
            border: 'none',
            borderTop: '1.5px solid var(--border-subtle)',
            margin: '1.5rem 0',
          }}
        />
      );
      continue;
    }

    // ── Empty Lines ──
    if (!trimmed) {
      flushList();
      continue;
    }

    // ── Regular Paragraph ──
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} style={{ marginBottom: '0.9rem' }}>
        {renderInlineText(trimmed)}
      </p>
    );
  }

  flushList();
  flushTable();
  return <div className="doubt-solution-body">{elements}</div>;
}

// ── Preset Queries for One-Click Concept Demonstrations ──
const PRESET_QUERIES = [
  {
    tag: 'ML',
    label: 'Gradient Descent & Learning Rate',
    query: 'Explain Gradient Descent step-by-step with intuition, mathematical formulas, and the effect of learning rate (alpha).',
    depth: 'standard',
  },
  {
    tag: 'MATH',
    label: 'Bayes Theorem Derivation',
    query: 'Derive Bayes Theorem with a concrete real-world medical diagnostic test example and formula explanation.',
    depth: 'deep',
  },
  {
    tag: 'DSA',
    label: 'Quicksort O(n log n) vs O(n²)',
    query: 'Why does Quicksort have O(n log n) average time complexity but O(n²) worst-case? How does randomized pivot selection fix this?',
    depth: 'exam',
  },
  {
    tag: 'DB',
    label: 'ACID Properties in Transactions',
    query: 'Explain ACID properties in database management systems with a concrete bank fund transfer example.',
    depth: 'quick',
  },
];

export default function DoubtSolverView({ systemStatus, onStatusRefresh }) {
  // Main form states
  const [question, setQuestion] = useState('');
  const [depth, setDepth] = useState('standard');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [subjects, setSubjects] = useState([]);

  // Active solution & history
  const [activeSolution, setActiveSolution] = useState(null);
  const [history, setHistory] = useState([]);

  // Interactive active recall quiz state
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Loading & status states
  const [solving, setSolving] = useState(false);
  const [solvingStep, setSolvingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Engine config modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqModel, setGroqModel] = useState('qwen/qwen3.8-27b');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState(null);

  // Refs
  const solutionRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    loadSubjects();
    loadHistory();
  }, []);

  // Animated solving steps ticker
  useEffect(() => {
    let interval;
    if (solving) {
      setSolvingStep(1);
      interval = setInterval(() => {
        setSolvingStep((prev) => (prev < 3 ? prev + 1 : 1));
      }, 1400);
    } else {
      setSolvingStep(0);
    }
    return () => clearInterval(interval);
  }, [solving]);

  const loadSubjects = async () => {
    try {
      const res = await api.getSubjects();
      setSubjects(res || []);
    } catch {
      // fallback
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.getDoubts();
      setHistory(res || []);
      if (!activeSolution && res && res.length > 0) {
        setActiveSolution(res[0]);
      }
    } catch {
      // fallback
    }
  };

  const handleSolve = async (overrideQuery = null, overrideDepth = null) => {
    const q = (overrideQuery || question).trim();
    if (!q) {
      setErrorMsg('Please write or paste your academic question or doubt.');
      if (textareaRef.current) textareaRef.current.focus();
      return;
    }

    try {
      setSolving(true);
      setErrorMsg(null);
      setSelectedOptionIdx(null);
      setQuizSubmitted(false);

      const targetDepth = overrideDepth || depth;
      const payload = {
        question: q,
        depth: targetDepth,
        subject_id: selectedSubjectId ? parseInt(selectedSubjectId, 10) : undefined,
        topic_id: selectedTopicId ? parseInt(selectedTopicId, 10) : undefined,
      };

      const res = await api.solveDoubt(payload);

      if (res && res.ok) {
        const solutionData = {
          id: res.id,
          question: q,
          answer: res.answer,
          key_takeaways: res.key_takeaways || [],
          practice_question: res.practice_question || null,
          depth: targetDepth,
          model_used: res.model_used || 'qwen/qwen3.8-27b',
          provider: res.provider || 'groq',
          latency_ms: res.latency_ms || 0,
          created_at: new Date().toISOString(),
          subject_name: subjects.find((s) => s.id === parseInt(selectedSubjectId, 10))?.name || null,
          topic_name: null,
        };
        setActiveSolution(solutionData);
        loadHistory();

        setTimeout(() => {
          if (solutionRef.current) {
            solutionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      } else {
        setErrorMsg(res?.error || 'Unable to solve doubt. Please check your Groq and Gemini API configuration.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error occurred while contacting Groq inference engine.');
    } finally {
      setSolving(false);
    }
  };

  const handleCopySolution = () => {
    if (!activeSolution) return;
    const textToCopy = `QUESTION: ${activeSolution.question}\n\nSOLUTION:\n${activeSolution.answer}`;
    navigator.clipboard.writeText(textToCopy);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2200);
  };

  const handleQuizOptionClick = (idx, correctIdx) => {
    if (quizSubmitted) return;
    setSelectedOptionIdx(idx);
    setQuizSubmitted(true);

    if (idx === correctIdx) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.75 },
        });
      } catch {
        // confetti fallback
      }
    }
  };

  const handleSaveGroqConfig = async (e) => {
    e.preventDefault();
    if (!groqApiKey.trim()) {
      setConfigFeedback({ type: 'error', text: 'Groq API key cannot be blank.' });
      return;
    }

    try {
      setSavingConfig(true);
      setConfigFeedback(null);
      const res = await api.saveGroqConfig({
        api_key: groqApiKey.trim(),
        model: groqModel,
      });
      if (res && res.ok) {
        setConfigFeedback({ type: 'success', text: 'Groq configuration saved successfully to .env!' });
        if (onStatusRefresh) onStatusRefresh();
        setTimeout(() => {
          setShowConfigModal(false);
          setConfigFeedback(null);
        }, 1500);
      } else {
        setConfigFeedback({ type: 'error', text: res?.error || 'Failed to update configuration.' });
      }
    } catch (err) {
      setConfigFeedback({ type: 'error', text: err.message || 'Network error saving config.' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Filter topics for the currently selected subject
  const currentSubjectObj = subjects.find((s) => s.id === parseInt(selectedSubjectId, 10));
  const availableTopics = currentSubjectObj ? currentSubjectObj.topics || [] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '4rem' }}>

      {/* ── 1. Top Resolution Mode & Engine Telemetry Bar ── */}
      <div
        className="corner-frame"
        style={{
          padding: '0.85rem 1.4rem',
          backgroundColor: 'var(--bg-surface-lowest)',
          border: '1.5px solid var(--border-strong)',
          boxShadow: 'var(--shadow-hard)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <span className="corner-bracket top-left">┌</span>
        <span className="corner-bracket top-right">┐</span>
        <span className="corner-bracket bottom-left">└</span>
        <span className="corner-bracket bottom-right">┘</span>

        {/* Resolution Mode Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <span className="tag-mono" style={{ fontWeight: 800, color: 'var(--text-secondary)', marginRight: '0.2rem' }}>
            RESOLUTION MODE:
          </span>
          {[
            { id: 'quick', label: 'QUICK CLARIFICATION' },
            { id: 'standard', label: 'STANDARD BREAKDOWN' },
            { id: 'deep', label: 'DEEP MASTERCLASS' },
            { id: 'exam', label: 'EXAM SCHEME' },
          ].map((mode) => {
            const isSelected = depth === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setDepth(mode.id)}
                className={isSelected ? 'btn-lime' : 'btn-tech-outline'}
                style={{
                  fontSize: '0.74rem',
                  padding: '0.35rem 0.85rem',
                  fontWeight: isSelected ? 800 : 700,
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        {/* Engine Status & Config */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="tag-mono" style={{ color: 'var(--primary-deep)', fontWeight: 800, fontSize: '0.74rem' }}>
            ENGINE: {activeSolution?.model_used ? activeSolution.model_used.toUpperCase() : 'QWEN-3.8-27B'}{' '}
            [{activeSolution?.provider === 'gemini_fallback' ? 'GEMINI' : activeSolution?.provider === 'offline' ? 'OFFLINE' : 'LPU'}]
          </span>

          {history.length > 0 && (
            <span className="badge-tech success" style={{ fontSize: '0.68rem' }}>
              {history.length} DOUBTS RESOLVED
            </span>
          )}

          <button
            type="button"
            className="btn-tech-outline"
            onClick={() => setShowConfigModal(true)}
            style={{ padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}
          >
            <Settings size={13} />
            <span>CONFIG</span>
          </button>
        </div>
      </div>

      {/* ── 2. Quick Subject Strip (Seed Subjects from LearnMate) ── */}
      <div
        className="corner-frame"
        style={{
          padding: '1.15rem 1.4rem',
          backgroundColor: 'var(--bg-surface-lowest)',
          border: '1.5px solid var(--border-strong)',
          boxShadow: 'var(--shadow-hard)',
        }}
      >
        <span className="corner-bracket top-left">┌</span>
        <span className="corner-bracket top-right">┐</span>
        <span className="corner-bracket bottom-left">└</span>
        <span className="corner-bracket bottom-right">┘</span>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span className="tag-mono" style={{ fontWeight: 800, color: 'var(--primary-deep)' }}>
            // QUICK_SUBJECT_STRIP
          </span>
          <span className="tag-mono" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
            CLICK ANY SYLLABUS SUBJECT TO ANCHOR DOUBT CONTEXT
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {/* Universal General Option */}
          <button
            type="button"
            onClick={() => {
              setSelectedSubjectId('');
              setSelectedTopicId('');
            }}
            style={{
              textAlign: 'center',
              padding: '0.85rem 0.75rem',
              border: !selectedSubjectId ? '2px solid var(--border-strong)' : '1.5px solid var(--border-subtle)',
              backgroundColor: !selectedSubjectId ? 'var(--primary)' : 'var(--bg-surface-lowest)',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              boxShadow: !selectedSubjectId ? 'var(--shadow-subtle)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div className="tag-mono" style={{ fontSize: '0.62rem', fontWeight: 800, color: !selectedSubjectId ? 'var(--border-strong)' : 'var(--text-secondary)', marginBottom: '0.2rem' }}>
              ALL SUBJECTS
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '0.98rem', letterSpacing: '-0.01em', color: 'var(--border-strong)' }}>
              GENERAL
            </div>
            <div className="tag-mono" style={{ fontSize: '0.62rem', marginTop: '0.2rem', color: !selectedSubjectId ? 'rgba(24,25,22,0.8)' : 'var(--text-dim)' }}>
              UNIVERSAL
            </div>
          </button>

          {/* Seeded & User Subjects from Database */}
          {subjects.map((subj) => {
            const isSelected = selectedSubjectId === String(subj.id);
            const topicCount = subj.topics ? subj.topics.length : 0;
            return (
              <button
                key={subj.id}
                type="button"
                onClick={() => {
                  setSelectedSubjectId(String(subj.id));
                  setSelectedTopicId('');
                }}
                style={{
                  textAlign: 'center',
                  padding: '0.85rem 0.75rem',
                  border: isSelected ? '2px solid var(--border-strong)' : '1.5px solid var(--border-subtle)',
                  backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-surface-lowest)',
                  borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer',
                  boxShadow: isSelected ? 'var(--shadow-subtle)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div className="tag-mono" style={{ fontSize: '0.62rem', fontWeight: 800, color: isSelected ? 'var(--border-strong)' : 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  SYLLABUS
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    letterSpacing: '-0.01em',
                    color: 'var(--border-strong)',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {subj.name.toUpperCase()}
                </div>
                <div className="tag-mono" style={{ fontSize: '0.62rem', marginTop: '0.2rem', color: isSelected ? 'rgba(24,25,22,0.8)' : 'var(--text-dim)' }}>
                  {topicCount} TOPICS
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. Question Formulation & Prompt Studio ── */}
      <div
        className="corner-frame"
        style={{
          padding: '1.5rem',
          backgroundColor: 'var(--bg-surface-lowest)',
          border: '1.5px solid var(--border-strong)',
          boxShadow: 'var(--shadow-hard)',
        }}
      >
        <span className="corner-bracket top-left">┌</span>
        <span className="corner-bracket top-right">┐</span>
        <span className="corner-bracket bottom-left">└</span>
        <span className="corner-bracket bottom-right">┘</span>

        {/* Header with Topic Context Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Brain size={18} strokeWidth={2.4} />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
              ACADEMIC QUERY COMPILER
            </span>
            <span className="badge-tech lime" style={{ fontSize: '0.65rem' }}>
              MODE: {depth.toUpperCase()}
            </span>
          </div>

          {/* Topic Dropdown if Subject is Selected */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="tag-mono" style={{ fontSize: '0.7rem' }}>TOPIC / CHAPTER:</span>
            <select
              className="tech-select"
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              disabled={!selectedSubjectId || availableTopics.length === 0}
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem', minWidth: '190px' }}
            >
              <option value="">All Topics in Subject</option>
              {availableTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Concept Presets */}
        <div style={{ marginBottom: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
            <Sparkles size={13} color="var(--primary-deep)" />
            <span className="tag-mono" style={{ fontSize: '0.7rem', fontWeight: 700 }}>
              // ONE-CLICK CONCEPT DEMONSTRATIONS:
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {PRESET_QUERIES.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuestion(item.query);
                  setDepth(item.depth);
                  handleSolve(item.query, item.depth);
                }}
                className="corner-frame-subtle"
                style={{
                  backgroundColor: 'var(--bg-surface-low)',
                  padding: '0.4rem 0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.76rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                }}
              >
                <span
                  style={{
                    backgroundColor: 'var(--border-strong)',
                    color: 'var(--primary)',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '0.06rem 0.3rem',
                    borderRadius: '2px',
                  }}
                >
                  {item.tag}
                </span>
                <span>{item.label}</span>
                <ArrowRight size={11} strokeWidth={2.4} opacity={0.6} />
              </button>
            ))}
          </div>
        </div>

        {/* Question Textarea */}
        <div style={{ marginBottom: '1.15rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              YOUR ACADEMIC QUESTION / DOUBT:
            </label>
            <span className="tag-mono" style={{ fontSize: '0.68rem' }}>
              PRESS <kbd style={{ background: '#e5e7eb', padding: '0.1rem 0.35rem', borderRadius: '2px', fontWeight: 700 }}>Ctrl+Enter</kbd> TO SOLVE
            </span>
          </div>
          <textarea
            ref={textareaRef}
            className="tech-textarea"
            rows={4}
            placeholder="Paste or write your academic question here... E.g. 'How does Backpropagation calculate weight gradients in deep neural networks?' or 'Derive the maximum height and time of flight for a projectile launched at angle theta.'"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSolve();
              }
            }}
            style={{
              resize: 'vertical',
              minHeight: '110px',
              fontSize: '0.92rem',
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Error message */}
        {errorMsg && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              border: '1.5px solid #dc2626',
              color: '#991b1b',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-xs)',
              marginBottom: '1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
            }}
          >
            <XCircle size={16} strokeWidth={2.4} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Actions Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="tag-mono" style={{ fontSize: '0.7rem' }}>
              {question.length} CHARS
            </span>
            {selectedSubjectId && (
              <span className="badge-tech lime" style={{ fontSize: '0.68rem' }}>
                ANCHORED: {subjects.find((s) => s.id === parseInt(selectedSubjectId, 10))?.name}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {question.trim() && (
              <button
                type="button"
                className="btn-tech-outline"
                onClick={() => setQuestion('')}
                style={{ padding: '0.55rem 0.95rem', fontSize: '0.82rem' }}
              >
                CLEAR
              </button>
            )}

            <button
              type="button"
              className="btn-lime"
              onClick={() => handleSolve()}
              disabled={solving || !question.trim()}
              style={{
                padding: '0.65rem 1.6rem',
                fontSize: '0.9rem',
                minWidth: '220px',
              }}
            >
              {solving ? (
                <>
                  <Zap size={16} className="pulse-live" strokeWidth={2.5} />
                  <span>
                    {solvingStep === 1 && 'SENDING TO GROQ LPU...'}
                    {solvingStep === 2 && 'INFERENCE REASONING...'}
                    {solvingStep === 3 && 'SYNTHESIZING PROOFS...'}
                    {solvingStep === 0 && 'COMPILING...'}
                  </span>
                </>
              ) : (
                <>
                  <Zap size={17} strokeWidth={2.5} />
                  <span>SOLVE WITH GROQ LPU</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. Active Solved Solution Display ── */}
      {activeSolution ? (
        <div
          ref={solutionRef}
          className="corner-frame animate-fade-in"
          style={{
            padding: '2rem',
            backgroundColor: 'var(--bg-surface-lowest)',
            border: '2px solid var(--border-strong)',
            boxShadow: 'var(--shadow-hard)',
            scrollMarginTop: '80px',
          }}
        >
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          {/* Solution Header & Telemetry */}
          <div
            style={{
              borderBottom: '1.5px solid var(--border-strong)',
              paddingBottom: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '260px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge-tech lime" style={{ fontWeight: 800 }}>
                  {activeSolution.provider === 'gemini_fallback'
                    ? '✨ RESOLVED BY GEMINI'
                    : activeSolution.provider === 'offline'
                      ? 'OFFLINE STUDY GUIDE'
                      : '⚡ RESOLVED BY GROQ LPU'}
                </span>
                <span className="badge-tech" style={{ textTransform: 'uppercase' }}>
                  DEPTH: {activeSolution.depth || 'STANDARD'}
                </span>
                {activeSolution.subject_name && (
                  <span className="badge-tech" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                    SUBJECT: {activeSolution.subject_name}
                  </span>
                )}
                {activeSolution.latency_ms > 0 && (
                  <span className="badge-tech success">
                    {activeSolution.latency_ms}ms
                  </span>
                )}
              </div>
              <h2
                style={{
                  margin: '0.35rem 0 0',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  fontFamily: 'var(--font-heading)',
                  lineHeight: 1.4,
                }}
              >
                {activeSolution.question}
              </h2>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <button
                type="button"
                className="btn-tech-outline"
                onClick={handleCopySolution}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
              >
                {copyFeedback ? (
                  <>
                    <Check size={14} color="#166534" strokeWidth={2.5} />
                    <span style={{ color: '#166534' }}>COPIED!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>COPY ANSWER</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn-tech-outline"
                onClick={() => {
                  setQuestion(`Regarding "${activeSolution.question.slice(0, 80)}...": Can you elaborate further on...`);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.78rem' }}
              >
                <MessageSquare size={14} />
                <span>FOLLOW UP</span>
              </button>
            </div>
          </div>

          {/* Rendered Pedagogical Body */}
          <div style={{ minHeight: '120px' }}>
            <MarkdownContent content={activeSolution.answer} />
          </div>

          {/* Key Takeaways */}
          {activeSolution.key_takeaways && activeSolution.key_takeaways.length > 0 && (
            <div
              className="corner-frame-subtle"
              style={{
                backgroundColor: 'var(--bg-surface-low)',
                border: '1.5px solid var(--border-strong)',
                padding: '1.25rem 1.4rem',
                margin: '2rem 0 1.5rem',
                borderRadius: 'var(--radius-xs)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.75rem' }}>
                <ShieldCheck size={18} strokeWidth={2.4} color="var(--primary-deep)" />
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  EXECUTIVE KEY TAKEAWAYS
                </span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {activeSolution.key_takeaways.map((point, pIdx) => (
                  <li
                    key={pIdx}
                    style={{
                      marginBottom: '0.4rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.84rem',
                      color: 'var(--text-main)',
                      lineHeight: 1.5,
                    }}
                  >
                    {renderInlineText(point)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Active Recall Practice Question Interactive Card */}
          {activeSolution.practice_question && (
            <div
              className="corner-frame"
              style={{
                backgroundColor: 'var(--bg-surface-lowest)',
                border: '2px solid var(--border-strong)',
                padding: '1.5rem',
                marginTop: '2rem',
                boxShadow: 'var(--shadow-hard)',
              }}
            >
              <span className="corner-bracket top-left">┌</span>
              <span className="corner-bracket top-right">┐</span>
              <span className="corner-bracket bottom-left">└</span>
              <span className="corner-bracket bottom-right">┘</span>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                  <Brain size={18} strokeWidth={2.4} />
                  <span
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                    }}
                  >
                    ACTIVE RECALL CHECK
                  </span>
                </div>
                <span className="badge-tech lime" style={{ fontSize: '0.65rem' }}>
                  TEST YOUR UNDERSTANDING
                </span>
              </div>

              <p
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  marginBottom: '1rem',
                  color: 'var(--text-main)',
                  lineHeight: 1.5,
                }}
              >
                {activeSolution.practice_question.question}
              </p>

              {/* Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.25rem' }}>
                {activeSolution.practice_question.options?.map((opt, optIdx) => {
                  const isCorrect = optIdx === activeSolution.practice_question.correct_index;
                  const isSelected = selectedOptionIdx === optIdx;

                  let btnStyle = {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    border: '1.5px solid var(--border-strong)',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--bg-surface-lowest)',
                    cursor: quizSubmitted ? 'default' : 'pointer',
                    textAlign: 'left',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    transition: 'all 0.15s ease',
                  };

                  if (quizSubmitted) {
                    if (isCorrect) {
                      btnStyle.backgroundColor = '#dcfce7';
                      btnStyle.borderColor = '#166534';
                      btnStyle.color = '#166534';
                      btnStyle.fontWeight = 700;
                    } else if (isSelected && !isCorrect) {
                      btnStyle.backgroundColor = '#fee2e2';
                      btnStyle.borderColor = '#dc2626';
                      btnStyle.color = '#991b1b';
                    } else {
                      btnStyle.opacity = 0.6;
                    }
                  }

                  return (
                    <div
                      key={optIdx}
                      style={btnStyle}
                      onClick={() => handleQuizOptionClick(optIdx, activeSolution.practice_question.correct_index)}
                    >
                      <span>{opt}</span>
                      {quizSubmitted && isCorrect && <Check size={16} strokeWidth={2.8} color="#166534" />}
                      {quizSubmitted && isSelected && !isCorrect && <X size={16} strokeWidth={2.8} color="#dc2626" />}
                    </div>
                  );
                })}
              </div>

              {/* Explanation feedback */}
              {quizSubmitted && (
                <div
                  style={{
                    backgroundColor: selectedOptionIdx === activeSolution.practice_question.correct_index ? '#ecfdf5' : '#fffbeb',
                    border: `1.5px solid ${selectedOptionIdx === activeSolution.practice_question.correct_index ? '#10b981' : '#f59e0b'}`,
                    padding: '1rem 1.15rem',
                    borderRadius: 'var(--radius-xs)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
                    {selectedOptionIdx === activeSolution.practice_question.correct_index ? (
                      <>
                        <CheckCircle2 size={16} color="#059669" strokeWidth={2.5} />
                        <strong style={{ color: '#065f46' }}>CORRECT! EXCELLENT INTUITION.</strong>
                      </>
                    ) : (
                      <>
                        <HelpCircle size={16} color="#d97706" strokeWidth={2.5} />
                        <strong style={{ color: '#92400e' }}>CONCEPT REVIEW NEEDED:</strong>
                      </>
                    )}
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {activeSolution.practice_question.explanation}
                  </p>
                  <button
                    type="button"
                    className="btn-tech-outline"
                    onClick={() => {
                      setSelectedOptionIdx(null);
                      setQuizSubmitted(false);
                    }}
                    style={{ marginTop: '0.75rem', padding: '0.25rem 0.65rem', fontSize: '0.72rem' }}
                  >
                    <RotateCcw size={12} />
                    <span>RE-ATTEMPT QUESTION</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div
          className="corner-frame-subtle"
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface-low)',
            border: '1.5px dashed var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              backgroundColor: 'var(--bg-surface-lowest)',
              border: '1.5px solid var(--border-strong)',
              borderRadius: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            <Zap size={28} strokeWidth={2} color="var(--primary-deep)" />
          </div>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', margin: '0 0 0.5rem' }}>
            READY FOR ACADEMIC REASONING
          </h3>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              maxWidth: '460px',
              margin: '0 auto',
              lineHeight: 1.5,
            }}
          >
            Select a syllabus subject above or write any university or high-school level concept, formula, or problem to generate instant LaTeX and pedagogical explanations.
          </p>
        </div>
      )}

      {/* ── 5. Engine Configuration Modal ── */}
      {showConfigModal && (
        <div className="tech-modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="tech-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1.5px solid var(--border-strong)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <Settings size={20} strokeWidth={2.4} />
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
                  GROQ LPU ENGINE CONFIGURATION
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-main)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveGroqConfig}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  GROQ API KEY (Starts with gsk_):
                </label>
                <input
                  type="password"
                  placeholder="gsk_..."
                  className="tech-input"
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
                <p style={{ margin: '0.35rem 0 0', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  Free Groq API key configured in `.env`.
                </p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  PREFERRED REASONING MODEL:
                </label>
                <select
                  className="tech-select"
                  value={groqModel}
                  onChange={(e) => setGroqModel(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                >
                  <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Recommended • Fast Academic Reasoning)</option>
                  <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Deep Reasoning)</option>
                  <option value="openai/gpt-oss-20b">openai/gpt-oss-20b (Ultra-fast)</option>
                  <option value="allam-2-7b">allam-2-7b (Multilingual)</option>
                </select>
              </div>

              {configFeedback && (
                <div
                  style={{
                    backgroundColor: configFeedback.type === 'success' ? '#ecfdf5' : '#fee2e2',
                    border: `1.5px solid ${configFeedback.type === 'success' ? '#10b981' : '#dc2626'}`,
                    color: configFeedback.type === 'success' ? '#065f46' : '#991b1b',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-xs)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  {configFeedback.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-tech-outline"
                  onClick={() => setShowConfigModal(false)}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="btn-lime"
                  disabled={savingConfig}
                >
                  {savingConfig ? 'SAVING...' : 'SAVE CONFIGURATION'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
