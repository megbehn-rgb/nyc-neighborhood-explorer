import { useState, useCallback } from 'react';
import MapView from './components/MapView';
import DetailPanel from './components/DetailPanel';
import SearchBar from './components/SearchBar';
import VibeFilter from './components/VibeFilter';
import RandomButton from './components/RandomButton';
import QuizMode from './components/QuizMode';
import neighborhoodData from './data/neighborhoodData';
import './App.css';

const ALL_IDS = neighborhoodData.map(n => n.id);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function App() {
  // ── Normal mode state ────────────────────────────────────────────
  const [selected,   setSelected]   = useState(null);
  const [activeTags, setActiveTags] = useState([]);
  const [flyToId,    setFlyToId]    = useState(null);

  // ── Quiz state ───────────────────────────────────────────────────
  const [quizActive,   setQuizActive]   = useState(false);
  const [quizQueue,    setQuizQueue]    = useState([]);
  const [quizCurrent,  setQuizCurrent]  = useState(null);
  const [quizScore,    setQuizScore]    = useState({ correct: 0, total: 0 });
  const [quizResult,   setQuizResult]   = useState(null);
  const [quizFinished, setQuizFinished] = useState(false);

  // ── Normal mode handlers ─────────────────────────────────────────
  const selectNeighborhood = useCallback((hood) => {
    setSelected(hood);
    setFlyToId(hood?.id ?? null);
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

  // ── Quiz handlers ────────────────────────────────────────────────
  const startQuiz = useCallback(() => {
    const order = shuffle(ALL_IDS);
    setQuizQueue(order.slice(1));
    setQuizCurrent(order[0]);
    setQuizScore({ correct: 0, total: 0 });
    setQuizResult(null);
    setQuizFinished(false);
    setQuizActive(true);
    setSelected(null);
    setFlyToId('__reset__');
  }, []);

  const exitQuiz = useCallback(() => {
    setQuizActive(false);
    setQuizCurrent(null);
    setQuizResult(null);
    setQuizFinished(false);
    setQuizScore({ correct: 0, total: 0 });
    setFlyToId('__reset__');
  }, []);

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

  return (
    <div className="app">
      {quizActive ? (
        /* ── Quiz chrome ──────────────────────────────────────── */
        <QuizMode
          current={quizCurrent}
          score={quizScore}
          result={quizResult}
          finished={quizFinished}
          total={ALL_IDS.length}
          onExit={exitQuiz}
          onRestart={startQuiz}
        />
      ) : (
        /* ── Normal chrome ────────────────────────────────────── */
        <div className="topbar">
          <div className="topbar-main">
            <h1 className="app-title">🧸 Teddy Graham's NYC Neighborhood Explorer 🧸</h1>
            <SearchBar onSelect={selectNeighborhood} />
            <div className="topbar-actions">
              <RandomButton onClick={handleRandom} />
              <button className="quiz-me-btn" onClick={startQuiz}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 11v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Quiz Me
              </button>
            </div>
          </div>
          <VibeFilter activeTags={activeTags} onToggle={toggleTag} />
        </div>
      )}

      {/* ── Map ───────────────────────────────────────────────── */}
      <MapView
        selected={selected}
        activeTags={activeTags}
        flyToId={flyToId}
        onFlyComplete={() => setFlyToId(null)}
        onSelect={selectNeighborhood}
        quizMode={quizActive}
        quizResult={quizResult}
        onQuizClick={handleQuizClick}
      />

      {/* ── Detail panel (hidden in quiz mode) ────────────────── */}
      {!quizActive && (
        <DetailPanel neighborhood={selected} onClose={closePanel} />
      )}
    </div>
  );
}
