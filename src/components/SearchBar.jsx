import { useState, useRef, useCallback, useMemo } from 'react';
import neighborhoodData from '../data/neighborhoodData';
import './SearchBar.css';

// Built once at module load against static data
const SEARCH_INDEX = neighborhoodData.map(n => ({
  neighborhood: n,
  nameNorm: n.name.toLowerCase(),
  fields: [
    { label: 'Known for',  textNorm: (n.known_for  || '').toLowerCase(), text: n.known_for  || '' },
    { label: 'Tagged',     textNorm: (n.vibe_tags  || []).join(' ').toLowerCase(), text: (n.vibe_tags || []).join(', ') },
    { label: 'Notable',    textNorm: (n.notable_sites || []).join(' ').toLowerCase(), items: n.notable_sites || [] },
    { label: 'About',      textNorm: (n.blurb || '').toLowerCase(), text: n.blurb || '' },
    { label: 'Boundaries', textNorm: (n.streetContext || '').toLowerCase(), text: n.streetContext || '' },
    { label: 'Overview',   textNorm: (n.establishedContext || '').toLowerCase(), text: n.establishedContext || '' },
  ],
}));

function makeHint(field, q) {
  if (!field.textNorm.includes(q)) return null;
  if (field.items) {
    const hit = field.items.find(s => s.toLowerCase().includes(q));
    return hit ? `${field.label}: ${hit}` : null;
  }
  const val = field.text;
  if (val.length <= 60) return `${field.label}: ${val}`;
  const idx = field.textNorm.indexOf(q);
  const start = Math.max(0, idx - 15);
  const end   = Math.min(val.length, idx + q.length + 40);
  const pre  = start > 0 ? '…' : '';
  const post = end < val.length ? '…' : '';
  return `${field.label}: ${pre}${val.slice(start, end)}${post}`;
}

function runSearch(q) {
  if (!q) return [];
  const nameMatches    = [];
  const contentMatches = [];

  for (const entry of SEARCH_INDEX) {
    if (entry.nameNorm.includes(q)) {
      nameMatches.push({ neighborhood: entry.neighborhood, matchHint: null });
      continue;
    }
    for (const field of entry.fields) {
      const hint = makeHint(field, q);
      if (hint) {
        contentMatches.push({ neighborhood: entry.neighborhood, matchHint: hint });
        break;
      }
    }
  }

  return [...nameMatches, ...contentMatches].slice(0, 8);
}

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('');
  const [open,  setOpen]  = useState(false);
  const inputRef = useRef(null);

  const results = useMemo(() => runSearch(query.trim().toLowerCase()), [query]);

  const handleSelect = useCallback((hood) => {
    setQuery('');
    setOpen(false);
    onSelect(hood);
    inputRef.current?.blur();
  }, [onSelect]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setQuery('');
      setOpen(false);
      inputRef.current?.blur();
    }
  }, []);

  return (
    <div className="search-wrap glass">
      <span className="search-icon">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="#888" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        placeholder="Search neighborhoods…"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        aria-label="Search neighborhoods"
        autoComplete="off"
      />
      {query && (
        <button className="search-clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>×</button>
      )}
      {open && results.length > 0 && (
        <ul className="search-dropdown glass" role="listbox">
          {results.map(({ neighborhood, matchHint }) => (
            <li
              key={neighborhood.id}
              role="option"
              className="search-option"
              onMouseDown={() => handleSelect(neighborhood)}
            >
              <span className="search-option-name">{neighborhood.name}</span>
              {matchHint
                ? <span className="search-option-hint">{matchHint}</span>
                : <span className="search-option-tags">{neighborhood.vibe_tags.slice(0, 2).join(' · ')}</span>
              }
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
