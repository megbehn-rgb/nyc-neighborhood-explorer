import { useState, useCallback, useEffect } from 'react';
import MapView from './components/MapView';
import DetailPanel from './components/DetailPanel';
import SearchBar from './components/SearchBar';
import VibeFilter from './components/VibeFilter';
import RandomButton from './components/RandomButton';
import QuizMode from './components/QuizMode';
import neighborhoodData from './data/neighborhoodData';
import './App.css';

const ALL_IDS = neighborhoodData.map(n => n.id);
const ALL_BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens'];
const TOTAL_NEIGHBORHOODS = neighborhoodData.length;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadVisited() {
  try {
    const raw = localStorage.getItem('nyc-explorer-visited');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveVisited(set) {
  try { localStorage.setItem('nyc-explorer-visited', JSON.stringify([...set])); } catch {}
}

export default function App() {
  // ── Normal mode state ────────────────────────────────────────────
  const [selected,        setSelected]        = useState(null);
  const [activeTags,      setActiveTags]      = useState([]);
  const [activeBoroughs,  setActiveBoroughs]  = useState([...ALL_BOROUGHS]);
  const [flyToId,         setFlyToId]         = useState(null);
  const [subwayVisible,   setSubwayVisible]   = useState(false);
  const [visitedIds,      setVisitedIds]      = useState(loadVisited);

  // ── Find Me state ────────────────────────────────────────────────
  const [findMeState, setFindMeState] = useState('idle');
  const [toast,       setToast]       = useState(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(id);
  }, [toast]);

  const showToast        = useCallback((msg) => setToast(msg), []);
  const handleFindMe     = useCallback(() => setFindMeState('locating'), []);
  const onFindMeComplete = useCallback(() => setFindMeState('idle'), []);

  // ── Quiz state ───────────────────────────────────────────────────
  const [quizActive,    setQuizActive]    = useState(false);
  const [quizQueue,     setQuizQueue]     = useState([]);
  const [quizCurrent,   setQuizCurrent]   = useState(null);
  const [quizScore,     setQuizScore]     = useState({ correct: 0, total: 0 });
  const [quizResult,    setQuizResult]    = useState(null);
  const [quizFinished,  setQuizFinished]  = useState(false);
  const [quizBoroughs,  setQuizBoroughs]  = useState([...ALL_BOROUGHS]);
  const [quizTotal,     setQuizTotal]     = useState(ALL_IDS.length);

  // ── Normal mode handlers ─────────────────────────────────────────
  const selectNeighborhood = useCallback((hood) => {
    setSelected(hood);
    setFlyToId(hood?.id ?? null);
    if (hood?.id) {
      setVisitedIds(prev => {
        if (prev.has(hood.id)) return prev;
        const next = new Set(prev);
        next.add(hood.id);
        saveVisited(next);
        return next;
      });
    }
  }, []);

  const closePanel = useCallback(() => {
    setSelected(null);
    setFlyToId('__reset__');
  }, []);

  const handleRandom = useCallback(() => {
    const idx = Math.floor(Math.random() * neighborhoodData.length);
    selectNeighborhood(neighborhoodData[idx]);
  }, [selectNeighborhood]);

  const toggleTag = useCallback((tag) => {
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }, []);

  const toggleBorough = useCallback((borough) => {
    setActiveBoroughs(prev => {
      if (prev.includes(borough)) {
        // Keep at least one active
        if (prev.length === 1) return prev;
        return prev.filter(b => b !== borough);
      }
      return [...prev, borough];
    });
  }, []);

  // ── Quiz handlers ────────────────────────────────────────────────
  const startQuiz = useCallback(() => {
    const filtered = neighborhoodData
      .filter(n => quizBoroughs.includes(n.borough))
      .map(n => n.id);
    const order = shuffle(filtered);
    setQuizTotal(order.length);
    setQuizQueue(order.slice(1));
    setQuizCurrent(order[0]);
    setQuizScore({ correct: 0, total: 0 });
    setQuizResult(null);
    setQuizFinished(false);
    setQuizActive(true);
    setSelected(null);
    setFlyToId('__reset__');
  }, [quizBoroughs]);

  const exitQuiz = useCallback(() => {
    setQuizActive(false);
    setQuizCurrent(null);
    setQuizResult(null);
    setQuizFinished(false);
    setQuizScore({ correct: 0, total: 0 });
    setFlyToId('__reset__');
  }, []);

  const handleQuizBoroughToggle = useCallback((borough) => {
    setQuizBoroughs(prev => {
      if (prev.includes(borough)) {
        if (prev.length === 1) return prev;
        return prev.filter(b => b !== borough);
      }
      return [...prev, borough];
    });
    // Reset quiz with new borough selection
    setQuizResult(null);
    setQuizFinished(false);
    setQuizScore({ correct: 0, total: 0 });
    // Re-start with updated boroughs via startQuiz (triggered by quizBoroughs state change)
  }, []);

  // When quiz borough selection changes mid-quiz, restart with new pool
  useEffect(() => {
    if (!quizActive) return;
    const filtered = neighborhoodData
      .filter(n => quizBoroughs.includes(n.borough))
      .map(n => n.id);
    const order = shuffle(filtered);
    setQuizTotal(order.length);
    setQuizQueue(order.slice(1));
    setQuizCurrent(order[0]);
    setQuizScore({ correct: 0, total: 0 });
    setQuizResult(null);
    setQuizFinished(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizBoroughs]);

  const handleQuizClick = useCallback((clickedId) => {
    if (quizResult) return;
    const isCorrect = clickedId === quizCurrent;
    setQuizScore(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
    setQuizResult({ correctId: quizCurrent, clickedId, isCorrect });

    const nextQueue = quizQueue;
    setTimeout(() => {
      setQuizResult(null);
      if (nextQueue.length === 0) {
        setQuizFinished(true);
        setQuizCurrent(null);
      } else {
        setQuizCurrent(nextQueue[0]);
        setQuizQueue(nextQueue.slice(1));
      }
    }, 2000);
  }, [quizResult, quizCurrent, quizQueue]);

  const visitedCount = visitedIds.size;

  return (
    <div className="app">
      {quizActive ? (
        /* ── Quiz chrome ──────────────────────────────────────── */
        <QuizMode
          current={quizCurrent}
          score={quizScore}
          result={quizResult}
          finished={quizFinished}
          total={quizTotal}
          quizBoroughs={quizBoroughs}
          onBoroughToggle={handleQuizBoroughToggle}
          onExit={exitQuiz}
          onRestart={startQuiz}
        />
      ) : (
        /* ── Normal chrome ────────────────────────────────────── */
        <div className="topbar">
          <div className="topbar-main">
            <h1 className="app-title">NYC Neighborhood Explorer</h1>
            <SearchBar onSelect={selectNeighborhood} />
            <div className="topbar-actions">
              <RandomButton onClick={handleRandom} />
              <button
                className={`subway-btn${subwayVisible ? ' subway-btn--active' : ''}`}
                onClick={() => setSubwayVisible(v => !v)}
                aria-pressed={subwayVisible}
              >
                🚇 Subway
              </button>
              <button
                className="findme-btn"
                onClick={handleFindMe}
                disabled={findMeState === 'locating'}
                aria-label="Find my location"
              >
                {findMeState === 'locating' ? (
                  <><span className="findme-spinner" aria-hidden="true" /> Locating…</>
                ) : (
                  '📍 Find Me'
                )}
              </button>
              <button className="quiz-me-btn" onClick={startQuiz}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 11v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Quiz Me
              </button>
            </div>
          </div>

          {/* ── Borough filter ──────────────────────────────────── */}
          <div className="borough-filter">
            <span className="borough-filter-label">Borough</span>
            {ALL_BOROUGHS.map(b => (
              <button
                key={b}
                className={`borough-btn${activeBoroughs.includes(b) ? ' borough-btn--active' : ''}`}
                onClick={() => toggleBorough(b)}
                aria-pressed={activeBoroughs.includes(b)}
              >
                {b}
              </button>
            ))}
            <span className="visited-counter">
              <strong>{visitedCount}</strong> / {TOTAL_NEIGHBORHOODS} visited
            </span>
          </div>

          <VibeFilter activeTags={activeTags} onToggle={toggleTag} />
        </div>
      )}

      {/* ── Map ───────────────────────────────────────────────── */}
      <MapView
        selected={selected}
        activeTags={activeTags}
        activeBoroughs={activeBoroughs}
        flyToId={flyToId}
        onFlyComplete={() => setFlyToId(null)}
        onSelect={selectNeighborhood}
        quizMode={quizActive}
        quizResult={quizResult}
        onQuizClick={handleQuizClick}
        subwayVisible={subwayVisible}
        findMeActive={findMeState === 'locating'}
        onFindMeComplete={onFindMeComplete}
        onToast={showToast}
      />

      {/* ── Detail panel (hidden in quiz mode) ────────────────── */}
      {!quizActive && (
        <DetailPanel neighborhood={selected} onClose={closePanel} />
      )}

      {/* ── Toast notification ────────────────────────────────── */}
      {toast && <div className="app-toast" role="status">{toast}</div>}
    </div>
  );
}
