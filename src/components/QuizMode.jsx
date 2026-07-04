import './QuizMode.css';
import neighborhoodData from '../data/neighborhoodData';

const BY_ID = Object.fromEntries(neighborhoodData.map(n => [n.id, n]));

const ALL_BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens'];

export default function QuizMode({
  current, score, result, finished, total,
  quizBoroughs, onBoroughToggle,
  onExit, onRestart,
}) {
  const currentName = current           ? (BY_ID[current]?.name           ?? current)           : null;
  const clickedName = result?.clickedId ? (BY_ID[result.clickedId]?.name  ?? result.clickedId)  : null;
  const correctName = result?.correctId ? (BY_ID[result.correctId]?.name  ?? result.correctId)  : null;

  if (finished) {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    const msg =
      pct === 100 ? 'Perfect score! You know every block.' :
      pct >= 80   ? 'Impressive — you really know the city.' :
      pct >= 60   ? "Not bad! A few more walks and you'll have it." :
                    'Time to explore more neighborhoods!';
    return (
      <div className="quiz-overlay">
        <div className="quiz-summary glass">
          <div className="quiz-summary-icon">🗺</div>
          <h2 className="quiz-summary-title">Quiz Complete!</h2>
          <div className="quiz-summary-score">{score.correct}<span className="quiz-summary-denom">/{score.total}</span></div>
          <p className="quiz-summary-msg">{msg}</p>
          <div className="quiz-summary-actions">
            <button className="quiz-btn quiz-btn-primary" onClick={onRestart}>Play Again</button>
            <button className="quiz-btn quiz-btn-secondary" onClick={onExit}>Exit Quiz</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="quiz-bar glass">
        <div className="quiz-prompt">
          <span className="quiz-label">Where is</span>
          <span className="quiz-name">{currentName}?</span>
        </div>
        <div className="quiz-right">
          <div className="quiz-boroughs">
            {ALL_BOROUGHS.map(b => (
              <button
                key={b}
                className={`quiz-borough-btn${quizBoroughs.includes(b) ? ' quiz-borough-btn--active' : ''}`}
                onClick={() => onBoroughToggle(b)}
                title={`${quizBoroughs.includes(b) ? 'Exclude' : 'Include'} ${b}`}
              >
                {b === 'Manhattan' ? 'MN' : b === 'Brooklyn' ? 'BK' : 'QN'}
              </button>
            ))}
          </div>
          <span className="quiz-score">
            {score.correct}&thinsp;/&thinsp;{score.total}
            <span className="quiz-score-label"> correct</span>
          </span>
          <span className="quiz-remaining">{total - score.total} left</span>
          <button className="quiz-exit-btn" onClick={onExit}>Exit Quiz</button>
        </div>
      </div>

      {result && (
        <div className={`quiz-result glass ${result.isCorrect ? 'quiz-result--correct' : 'quiz-result--wrong'}`}>
          {result.isCorrect
            ? `✓ Correct! That's ${correctName}.`
            : result.clickedId
              ? `✗ That's ${clickedName}. ${correctName} is highlighted in green.`
              : `✗ Missed! ${correctName} is highlighted in green.`}
        </div>
      )}
    </>
  );
}
