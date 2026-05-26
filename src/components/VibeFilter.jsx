import { ALL_VIBE_TAGS } from '../data/neighborhoodData';
import './VibeFilter.css';

export default function VibeFilter({ activeTags, onToggle }) {
  return (
    <div className="vibe-filter glass" role="group" aria-label="Filter by vibe">
      {ALL_VIBE_TAGS.map(tag => (
        <button
          key={tag}
          className={`vibe-tag ${activeTags.includes(tag) ? 'vibe-tag--active' : ''}`}
          onClick={() => onToggle(tag)}
          aria-pressed={activeTags.includes(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
