import { useState, useRef, useCallback } from 'react';
import neighborhoodData from '../data/neighborhoodData';
import './SearchBar.css';

export default function SearchBar({ onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const results = query.trim().length > 0
    ? neighborhoodData
        .filter(n => n.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
    : [];

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
          {results.map(hood => (
            <li
              key={hood.id}
              role="option"
              className="search-option"
              onMouseDown={() => handleSelect(hood)}
            >
              <span className="search-option-name">{hood.name}</span>
              <span className="search-option-tags">
                {hood.vibe_tags.slice(0, 2).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
