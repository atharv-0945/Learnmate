import React, { useState, useEffect } from 'react';
import {
  Upload,
  Layers,
  Sparkles,
  FileText,
  Trash2,
  Brain,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Flame,
  ChevronDown,
  ChevronUp,
  Terminal,
  ArrowRight,
  Check,
  Award,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import * as api from '../api';

export default function FlashcardsView() {
  const [file, setFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Mode: 'overview' | 'quiz' | 'flashcards'
  const [activeTabMode, setActiveTabMode] = useState('overview');

  // Generation controls
  const [nCards, setNCards] = useState(8);
  const [nQuizQuestions, setNQuizQuestions] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [generatingCards, setGeneratingCards] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [msg, setMsg] = useState(null);

  // Active Document Quiz State
  const [docQuiz, setDocQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizCurrentIdx, setQuizCurrentIdx] = useState(0);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Active Flashcards Deck Study View
  const [activeDeck, setActiveDeck] = useState(null);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Register as Subject controls
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [customSubjName, setCustomSubjName] = useState('');
  const [examDate, setExamDate] = useState(
    new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10)
  );
  const [prio, setPrio] = useState(1);
  const [registering, setRegistering] = useState(false);

  // Saved sets
  const [savedSets, setSavedSets] = useState([]);

  useEffect(() => {
    loadSavedSets();
  }, []);

  const loadSavedSets = async () => {
    try {
      const res = await api.getFlashcardSets();
      setSavedSets(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    try {
      setUploading(true);
      setMsg(null);
      const res = await api.uploadDocumentFile(selectedFile);
      setExtractedData(res);
      setCustomSubjName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      setActiveTabMode('overview');
    } catch (err) {
      setMsg(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // ── Flashcard Generation ──
  const handleGenerateFlashcards = async () => {
    if (!extractedData) return;
    try {
      setGeneratingCards(true);
      setMsg(null);
      const res = await api.generateDocFlashcards({
        document_text: extractedData.extracted_text,
        n_cards: nCards,
        title: extractedData.filename.replace(/\.[^/.]+$/, ''),
      });

      if (res.cards && res.cards.length > 0) {
        setActiveDeck({
          id: res.set_id,
          title: extractedData.filename,
          cards: res.cards,
        });
        setCurrentCardIdx(0);
        setIsFlipped(false);
        setActiveTabMode('flashcards');
        try {
          confetti({ particleCount: 50, spread: 60 });
        } catch {
          // ignore
        }
      }
      loadSavedSets();
    } catch (err) {
      setMsg(`Flashcard generation failed: ${err.message}`);
    } finally {
      setGeneratingCards(false);
    }
  };

  // ── Quiz Generation from Document ──
  const handleGenerateQuiz = async () => {
    if (!extractedData) return;
    try {
      setGeneratingQuiz(true);
      setMsg(null);
      const res = await api.generateDocQuiz({
        document_text: extractedData.extracted_text,
        n_questions: nQuizQuestions,
        difficulty: quizDifficulty,
        title: extractedData.filename.replace(/\.[^/.]+$/, '') + ' Quiz',
      });

      if (res.questions && res.questions.length > 0) {
        setDocQuiz({
          quiz_id: res.quiz_id,
          title: res.title || extractedData.filename,
          questions: res.questions,
        });
        setQuizAnswers(new Array(res.questions.length).fill(null));
        setQuizCurrentIdx(0);
        setQuizSubmitted(false);
        setQuizResult(null);
        setActiveTabMode('quiz');
        try {
          confetti({ particleCount: 50, spread: 60 });
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setMsg(`Quiz generation failed: ${err.message}`);
    } finally {
      setGeneratingQuiz(false);
    }
  };

  // ── Quiz Interactions ──
  const handleSelectQuizAnswer = (optIdx) => {
    if (quizSubmitted) return;
    const next = [...quizAnswers];
    next[quizCurrentIdx] = optIdx;
    setQuizAnswers(next);
  };

  const handleSubmitQuiz = async () => {
    if (!docQuiz) return;
    if (quizAnswers.includes(null)) {
      if (!confirm('You have unanswered questions. Submit anyway?')) return;
    }
    try {
      setSubmittingQuiz(true);
      const res = await api.submitQuiz({
        quiz_id: docQuiz.quiz_id,
        questions: docQuiz.questions,
        answers: quizAnswers,
      });
      setQuizSubmitted(true);
      setQuizResult(res);

      if (res.score_percentage >= 70) {
        try {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        } catch {
          // ignore
        }
      }
    } catch (err) {
      alert(`Quiz submission error: ${err.message}`);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // ── Syllabus Extraction ──
  const handleRegisterAsSubject = async () => {
    if (!extractedData || !customSubjName.trim()) return;
    try {
      setRegistering(true);
      setMsg(null);
      await api.registerDocSubject({
        name: customSubjName.trim(),
        subject_name: customSubjName.trim(),
        exam_date: examDate,
        priority: prio,
        document_text: extractedData.extracted_text,
      });
      setMsg(`SUCCESS: Document converted into active Syllabus subject '${customSubjName}'!`);
      setShowRegisterForm(false);
    } catch (err) {
      setMsg(`Subject registration error: ${err.message}`);
    } finally {
      setRegistering(false);
    }
  };

  const handleDeleteSet = async (id) => {
    if (!confirm('Are you sure you want to delete this flashcard set?')) return;
    try {
      await api.deleteFlashcardSet(id);
      loadSavedSets();
      if (activeDeck?.id === id) {
        setActiveDeck(null);
        if (activeTabMode === 'flashcards') setActiveTabMode('overview');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStudySavedSet = (set) => {
    setActiveDeck({
      id: set.id,
      title: set.title,
      cards: set.cards || [],
    });
    setCurrentCardIdx(0);
    setIsFlipped(false);
    setActiveTabMode('flashcards');
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const nextCard = () => {
    setIsFlipped(false);
    if (activeDeck && currentCardIdx < activeDeck.cards.length - 1) {
      setCurrentCardIdx((prev) => prev + 1);
    } else {
      try {
        confetti({ particleCount: 50, spread: 60 });
      } catch {
        // ignore
      }
    }
  };

  const prevCard = () => {
    setIsFlipped(false);
    if (currentCardIdx > 0) {
      setCurrentCardIdx((prev) => prev - 1);
    }
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
              // KNOWLEDGE SYNTHESIS & DOCUMENT INGESTION
            </span>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', textTransform: 'uppercase', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
              PPT LECTURES, FLASHCARDS & AI QUIZZES
            </h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', fontSize: '0.92rem' }}>
              Upload your lecture slides (.pptx, .ppt, .pdf). The AI immediately parses slides and gives you instant options to generate custom <strong>Active Recall Flashcards</strong> and interactive <strong>Multiple-Choice Quizzes</strong>.
            </p>
          </div>

          <div className="tag-mono" style={{ textAlign: 'right' }}>
            <span>INSTANT SYNTHESIS ENGINE</span><br />
            <span className="badge-tech lime" style={{ marginTop: '0.35rem' }}>QUIZ + FLASHCARDS READY</span>
          </div>
        </div>

        {msg && (
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
            <span>{msg}</span>
            <button
              onClick={() => setMsg(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
            >
              [DISMISS]
            </button>
          </div>
        )}

        {/* View Mode Bar */}
        {(activeDeck || docQuiz) && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            flexWrap: 'wrap'
          }}>
            <button
              className={activeTabMode === 'overview' ? 'btn-lime' : 'btn-tech-outline'}
              onClick={() => setActiveTabMode('overview')}
            >
              <FileText size={15} />
              <span>Document Overview</span>
            </button>

            {docQuiz && (
              <button
                className={activeTabMode === 'quiz' ? 'btn-lime' : 'btn-tech-outline'}
                onClick={() => setActiveTabMode('quiz')}
              >
                <Brain size={15} />
                <span>Active Quiz ({docQuiz.questions?.length} Qs)</span>
              </button>
            )}

            {activeDeck && (
              <button
                className={activeTabMode === 'flashcards' ? 'btn-lime' : 'btn-tech-outline'}
                onClick={() => setActiveTabMode('flashcards')}
              >
                <Layers size={15} />
                <span>Flashcard Deck ({activeDeck.cards?.length} Cards)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Document Upload Area (Always accessible or when in overview mode) */}
      {(activeTabMode === 'overview' || (!docQuiz && !activeDeck)) && (
        <div className="corner-frame" style={{ padding: '2rem' }}>
          <span className="corner-bracket top-left">┌</span>
          <span className="corner-bracket top-right">┐</span>
          <span className="corner-bracket bottom-left">└</span>
          <span className="corner-bracket bottom-right">┘</span>

          <div className="tag-mono" style={{ marginBottom: '1rem' }}>
            // INGESTION_SOURCE_TERMINAL
          </div>

          <div style={{
            border: '2px dashed var(--border-strong)',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface-low)',
            position: 'relative',
          }}>
            <Upload size={34} style={{ margin: '0 auto 0.75rem', opacity: 0.75, color: 'var(--primary-deep)' }} />
            <h3 style={{ textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              {uploading ? 'INGESTING & EXTRACTING SLIDES...' : file ? `Loaded File: ${file.name}` : 'Drop Lecture Slides (PPTX, PPT, PDF) Here'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 1.25rem' }}>
              Upload your course PPT or PDF. LearnMate extracts every slide, term, and formula, allowing you to generate both <strong>Quizzes</strong> and <strong>Flashcards</strong>.
            </p>

            <label className="btn-lime" style={{ cursor: 'pointer', display: 'inline-flex' }}>
              <span>Browse Lecture Files</span>
              <input
                type="file"
                accept=".pptx,.ppt,.pdf,.txt,.docx"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Extracted Document Actions Deck */}
          {extractedData && (
            <div style={{
              marginTop: '1.75rem',
              padding: '1.75rem',
              backgroundColor: 'var(--bg-surface-lowest)',
              border: '2px solid var(--border-strong)',
              boxShadow: 'var(--shadow-hard)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <span className="tag-mono" style={{ color: 'var(--primary-deep)', fontWeight: 700 }}>
                    // DOCUMENT_ANALYZED_READY_FOR_GENERATION
                  </span>
                  <h3 style={{ fontSize: '1.3rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                    {extractedData.filename}
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {extractedData.slide_count && (
                    <span className="badge-tech lime">
                      {extractedData.slide_count} SLIDES DETECTED
                    </span>
                  )}
                  <span className="badge-tech gray">
                    {extractedData.char_count} CHARACTERS
                  </span>
                </div>
              </div>

              {/* Text Preview Box */}
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-surface-low)',
                padding: '0.85rem',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.5rem',
                maxHeight: '120px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
              }}>
                {extractedData.text_preview}
              </div>

              {/* ── DUAL GENERATION CONTROL CARDS ── */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                gap: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                {/* 1. QUIZ GENERATION CARD */}
                <div style={{
                  padding: '1.5rem',
                  border: '2px solid var(--border-strong)',
                  backgroundColor: 'var(--bg-surface-low)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-subtle)',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Brain size={20} color="var(--primary-deep)" strokeWidth={2.4} />
                      <span className="tag-mono" style={{ fontWeight: 800, color: 'var(--text-main)' }}>OPTION 1: AI QUIZ</span>
                    </div>
                    <h4 style={{ textTransform: 'uppercase', fontSize: '1.1rem', marginBottom: '0.35rem' }}>
                      Generate MCQ Quiz
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                      Synthesizes interactive 4-choice questions directly from your slide topics, with instant scoring & explanations.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <div>
                        <label className="tag-mono" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.72rem' }}>Questions</label>
                        <select
                          className="tech-select"
                          value={nQuizQuestions}
                          onChange={(e) => setNQuizQuestions(Number(e.target.value))}
                          style={{ width: '100%' }}
                        >
                          <option value={3}>3 Questions</option>
                          <option value={5}>5 Questions</option>
                          <option value={8}>8 Questions</option>
                          <option value={10}>10 Questions</option>
                        </select>
                      </div>
                      <div>
                        <label className="tag-mono" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.72rem' }}>Difficulty</label>
                        <select
                          className="tech-select"
                          value={quizDifficulty}
                          onChange={(e) => setQuizDifficulty(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn-lime"
                    onClick={handleGenerateQuiz}
                    disabled={generatingQuiz}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Sparkles size={16} strokeWidth={2.4} />
                    <span>{generatingQuiz ? 'Synthesizing Quiz...' : `Generate & Start Quiz (${nQuizQuestions} Qs)`}</span>
                  </button>
                </div>

                {/* 2. FLASHCARD GENERATION CARD */}
                <div style={{
                  padding: '1.5rem',
                  border: '2px solid var(--border-strong)',
                  backgroundColor: 'var(--bg-surface-low)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-subtle)',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Layers size={20} color="var(--primary-deep)" strokeWidth={2.4} />
                      <span className="tag-mono" style={{ fontWeight: 800, color: 'var(--text-main)' }}>OPTION 2: FLASHCARDS</span>
                    </div>
                    <h4 style={{ textTransform: 'uppercase', fontSize: '1.1rem', marginBottom: '0.35rem' }}>
                      Active Recall Flashcards
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                      Extracts high-yield flip cards covering definitions, formulas, and takeaways for spaced repetition.
                    </p>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label className="tag-mono" style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.72rem' }}>Number of Cards</label>
                      <select
                        className="tech-select"
                        value={nCards}
                        onChange={(e) => setNCards(Number(e.target.value))}
                        style={{ width: '100%' }}
                      >
                        <option value={5}>5 Flashcards</option>
                        <option value={8}>8 Flashcards</option>
                        <option value={10}>10 Flashcards</option>
                        <option value={15}>15 Flashcards</option>
                      </select>
                    </div>
                  </div>

                  <button
                    className="btn-lime"
                    onClick={handleGenerateFlashcards}
                    disabled={generatingCards}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Layers size={16} strokeWidth={2.4} />
                    <span>{generatingCards ? 'Synthesizing Cards...' : `Generate ${nCards} Flashcards`}</span>
                  </button>
                </div>
              </div>

              {/* 3. OPTIONAL: Register as Syllabus Subject */}
              <div style={{
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <span className="tag-mono" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  Want this lecture incorporated into your daily study timetable?
                </span>
                <button
                  className="btn-tech-outline"
                  onClick={() => setShowRegisterForm(!showRegisterForm)}
                >
                  <BookOpen size={14} />
                  <span>{showRegisterForm ? 'Hide Syllabus Drawer' : 'Extract into Syllabus Subject'}</span>
                </button>
              </div>

              {showRegisterForm && (
                <div style={{
                  marginTop: '1.25rem',
                  padding: '1.25rem',
                  border: '1.5px solid var(--border-strong)',
                  backgroundColor: 'var(--bg-surface-low)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}>
                  <div className="tag-mono">// CONVERT_TO_CURRICULUM_MODULE</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label className="tag-mono" style={{ display: 'block', marginBottom: '0.35rem' }}>Subject Name</label>
                      <input
                        type="text"
                        value={customSubjName}
                        onChange={(e) => setCustomSubjName(e.target.value)}
                        className="tech-input"
                      />
                    </div>
                    <div>
                      <label className="tag-mono" style={{ display: 'block', marginBottom: '0.35rem' }}>Exam Target Date</label>
                      <input
                        type="date"
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                        className="tech-input"
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button className="btn-tech-outline" onClick={() => setShowRegisterForm(false)}>
                      Cancel
                    </button>
                    <button className="btn-lime" onClick={handleRegisterAsSubject} disabled={registering}>
                      {registering ? 'Extracting...' : 'Register as Subject'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. ACTIVE QUIZ RUNNER VIEWPORT */}
      {activeTabMode === 'quiz' && docQuiz && (
        <div className="corner-frame" style={{ padding: '2rem' }}>
          <span className="crosshair-corner top-left">┼</span>
          <span className="crosshair-corner top-right">┼</span>
          <span className="crosshair-corner bottom-left">┼</span>
          <span className="crosshair-corner bottom-right">┼</span>

          {/* Quiz Top Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '1.25rem',
            marginBottom: '1.5rem',
            borderBottom: '2px solid var(--border-strong)',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <span className="tag-mono" style={{ color: 'var(--primary-deep)', fontWeight: 700 }}>
                // DOCUMENT_LECTURE_QUIZ
              </span>
              <h2 style={{ fontSize: '1.4rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                {docQuiz.title}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="badge-tech lime">
                QUESTION {quizCurrentIdx + 1} OF {docQuiz.questions.length}
              </span>
              <button
                className="btn-tech-outline"
                onClick={() => setActiveTabMode('overview')}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              >
                Back to Document
              </button>
            </div>
          </div>

          {!quizSubmitted ? (
            /* Active Question Form */
            <div>
              {/* Question Navigation Bubbles */}
              <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {docQuiz.questions.map((_, qIdx) => (
                  <button
                    key={qIdx}
                    onClick={() => setQuizCurrentIdx(qIdx)}
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: '1.5px solid var(--border-strong)',
                      backgroundColor:
                        quizCurrentIdx === qIdx
                          ? 'var(--primary)'
                          : quizAnswers[qIdx] !== null
                          ? 'var(--border-strong)'
                          : 'var(--bg-surface-lowest)',
                      color:
                        quizCurrentIdx === qIdx
                          ? 'var(--text-main)'
                          : quizAnswers[qIdx] !== null
                          ? 'var(--bg-main)'
                          : 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    {qIdx + 1}
                  </button>
                ))}
              </div>

              {/* Current Question Body */}
              <div style={{
                padding: '2rem',
                backgroundColor: 'var(--bg-surface-lowest)',
                border: '2px solid var(--border-strong)',
                boxShadow: 'var(--shadow-hard)',
                marginBottom: '1.5rem'
              }}>
                <div className="tag-mono" style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  TOPIC: {docQuiz.questions[quizCurrentIdx]?.topic || 'Lecture Concept'}
                </div>
                <h3 style={{ fontSize: '1.25rem', lineHeight: 1.45, marginBottom: '1.5rem' }}>
                  {docQuiz.questions[quizCurrentIdx]?.question}
                </h3>

                {/* 4 MCQ Option Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {docQuiz.questions[quizCurrentIdx]?.options.map((opt, optIdx) => {
                    const isSelected = quizAnswers[quizCurrentIdx] === optIdx;
                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleSelectQuizAnswer(optIdx)}
                        style={{
                          padding: '1rem 1.25rem',
                          border: isSelected ? '2px solid var(--border-strong)' : '1.5px solid var(--border-subtle)',
                          backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-surface-low)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          fontWeight: isSelected ? 800 : 500,
                          transition: 'all 0.1s ease',
                        }}
                      >
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          border: '1.5px solid var(--border-strong)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: isSelected ? 'var(--border-strong)' : 'transparent',
                          color: isSelected ? 'var(--primary)' : 'inherit',
                          flexShrink: 0,
                        }}>
                          {String.fromCharCode(65 + optIdx)}
                        </div>
                        <span style={{ fontSize: '0.92rem', lineHeight: 1.4 }}>{opt}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Nav / Submit Controls */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-tech-outline"
                    onClick={() => setQuizCurrentIdx((prev) => Math.max(0, prev - 1))}
                    disabled={quizCurrentIdx === 0}
                  >
                    Previous
                  </button>
                  <button
                    className="btn-tech-outline"
                    onClick={() => setQuizCurrentIdx((prev) => Math.min(docQuiz.questions.length - 1, prev + 1))}
                    disabled={quizCurrentIdx === docQuiz.questions.length - 1}
                  >
                    Next
                  </button>
                </div>

                <button
                  className="btn-lime"
                  onClick={handleSubmitQuiz}
                  disabled={submittingQuiz}
                  style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}
                >
                  <Check size={18} strokeWidth={2.4} />
                  <span>{submittingQuiz ? 'Evaluating...' : 'Submit Answers & Calculate Score'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Quiz Completed Results & Explanations */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                padding: '2rem',
                backgroundColor: 'var(--bg-surface-lowest)',
                border: '2px solid var(--border-strong)',
                boxShadow: 'var(--shadow-hard)',
                textAlign: 'center',
              }}>
                <div className="tag-mono" style={{ marginBottom: '0.5rem' }}>
                  // ASSESSMENT_EVALUATION_REPORT
                </div>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>
                  {quizResult?.score_pct || 0}%
                </h2>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                  You scored {quizResult?.score || 0} out of {quizResult?.total || docQuiz.questions.length} questions correctly.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn-lime"
                    onClick={() => {
                      setQuizSubmitted(false);
                      setQuizAnswers(new Array(docQuiz.questions.length).fill(null));
                      setQuizCurrentIdx(0);
                    }}
                  >
                    <RotateCcw size={16} />
                    <span>Retake Quiz</span>
                  </button>
                  <button
                    className="btn-tech-outline"
                    onClick={handleGenerateFlashcards}
                  >
                    <Layers size={16} />
                    <span>Generate Flashcards from PPT</span>
                  </button>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <span className="tag-mono" style={{ fontWeight: 800 }}>// QUESTION_BY_QUESTION_BREAKDOWN</span>
                {docQuiz.questions.map((q, idx) => {
                  const userAns = quizAnswers[idx];
                  const isCorrect = userAns === q.correct_index;
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '1.5rem',
                        border: '1.5px solid var(--border-strong)',
                        backgroundColor: 'var(--bg-surface-low)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span className="tag-mono">QUESTION {idx + 1}</span>
                        {isCorrect ? (
                          <span className="badge-tech lime" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={13} /> CORRECT
                          </span>
                        ) : (
                          <span className="badge-tech" style={{ backgroundColor: '#fee2e2', color: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <XCircle size={13} /> INCORRECT
                          </span>
                        )}
                      </div>

                      <h4 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>{q.question}</h4>

                      <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
                        <div>
                          <strong>Your Answer:</strong> {userAns !== null ? q.options[userAns] : 'Unanswered'}
                        </div>
                        {!isCorrect && (
                          <div style={{ color: '#166534', fontWeight: 700 }}>
                            <strong>Correct Answer:</strong> {q.options[q.correct_index]}
                          </div>
                        )}
                      </div>

                      {q.explanation && (
                        <div style={{
                          padding: '0.75rem',
                          backgroundColor: 'var(--bg-surface-lowest)',
                          borderLeft: '3px solid var(--primary-deep)',
                          fontSize: '0.82rem',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          <strong>Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. ACTIVE FLASHCARDS STUDY VIEWPORT */}
      {activeTabMode === 'flashcards' && activeDeck && activeDeck.cards?.length > 0 && (
        <div className="corner-frame" style={{ padding: '2rem' }}>
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
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <span className="tag-mono">// ACTIVE_STUDY_SESSION</span>
              <h2 style={{ fontSize: '1.35rem', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                {activeDeck.title}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="tag-mono" style={{ fontWeight: 700 }}>
                CARD {currentCardIdx + 1} OF {activeDeck.cards.length}
              </span>
              <button
                className="btn-tech-outline"
                onClick={() => setActiveTabMode('overview')}
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
              >
                Back to Document
              </button>
            </div>
          </div>

          {/* Flashcard interactive body */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            style={{
              minHeight: '260px',
              padding: '2.5rem 2rem',
              backgroundColor: isFlipped ? 'var(--primary)' : 'var(--bg-surface-lowest)',
              border: '2px solid var(--border-strong)',
              boxShadow: 'var(--shadow-hard)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              textAlign: 'center',
              userSelect: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div className="tag-mono" style={{ color: 'var(--border-strong)', opacity: 0.7 }}>
              {isFlipped ? '[BACK / RATIONALE]' : '[FRONT / ACTIVE PROMPT] — CLICK TO FLIP'}
            </div>

            <div style={{
              fontFamily: isFlipped ? 'var(--font-mono)' : 'var(--font-body)',
              fontSize: isFlipped ? '1.15rem' : '1.35rem',
              fontWeight: 800,
              lineHeight: 1.5,
              maxWidth: '680px',
              margin: '0 auto',
            }}>
              {isFlipped
                ? activeDeck.cards[currentCardIdx]?.back
                : activeDeck.cards[currentCardIdx]?.front}
            </div>

            <div className="tag-mono" style={{ fontSize: '0.68rem', opacity: 0.6 }}>
              {isFlipped ? 'Click card again to flip back' : 'Press or click to reveal recall answer'}
            </div>
          </div>

          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <button
              className="btn-tech-outline"
              onClick={prevCard}
              disabled={currentCardIdx === 0}
            >
              Previous Card
            </button>

            {/* Difficulty Rating Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-tech-outline"
                onClick={nextCard}
                style={{ backgroundColor: '#fee2e2', color: '#991b1b', borderColor: '#991b1b' }}
              >
                Again
              </button>
              <button
                className="btn-tech-outline"
                onClick={nextCard}
                style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#92400e' }}
              >
                Hard
              </button>
              <button
                className="btn-tech-outline"
                onClick={nextCard}
                style={{ backgroundColor: '#dcfce7', color: '#166534', borderColor: '#166534' }}
              >
                Good
              </button>
              <button
                className="btn-lime"
                onClick={nextCard}
              >
                Easy
              </button>
            </div>

            <button
              className="btn-tech-outline"
              onClick={nextCard}
              disabled={currentCardIdx === activeDeck.cards.length - 1}
            >
              Next Card
            </button>
          </div>
        </div>
      )}

      {/* 5. Saved Flashcard Decks */}
      <div className="corner-frame" style={{ padding: '1.75rem' }}>
        <span className="tag-mono" style={{ marginBottom: '1rem', display: 'block' }}>
          // PERSISTENT_FLASHCARD_SETS ({savedSets.length})
        </span>

        {savedSets.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            No saved flashcard sets yet. Upload a lecture PPT above to generate your first study deck!
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {savedSets.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '1.25rem',
                  border: '1.5px solid var(--border-strong)',
                  backgroundColor: 'var(--bg-surface-low)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span className="badge-tech lime">{s.card_count} CARDS</span>
                    <button
                      onClick={() => handleDeleteSet(s.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      title="Delete deck"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h4 style={{ textTransform: 'uppercase', fontSize: '1rem' }}>
                    {s.title}
                  </h4>
                  <span className="tag-mono" style={{ fontSize: '0.68rem', opacity: 0.6 }}>
                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Active Set'}
                  </span>
                </div>

                <button
                  className="btn-lime"
                  onClick={() => handleStudySavedSet(s)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Play size={14} />
                  <span>Study This Deck</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
