import { useState, useEffect } from 'react';
import './DetailPanel.css';

export default function DetailPanel({ neighborhood, onClose }) {
  const [imgError, setImgError] = useState(false);
  const open = !!neighborhood;

  // Reset image error state when neighborhood changes
  useEffect(() => { setImgError(false); }, [neighborhood?.id]);

  return (
    <div className={`detail-panel ${open ? 'detail-panel--open' : ''}`} role="complementary">
      {neighborhood && (
        <>
          {/* ── Hero image ─────────────────────────────────────── */}
          <div className="detail-photo">
            {!imgError && neighborhood.wikipediaImage ? (
              <img
                src={neighborhood.wikipediaImage}
                alt={neighborhood.name}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="detail-photo-fallback">No image available</div>
            )}
          </div>

          {/* ── Header ─────────────────────────────────────────── */}
          <div className="detail-header">
            <h1 className="detail-name">{neighborhood.name}</h1>
            <button className="detail-close" onClick={onClose} aria-label="Close panel">×</button>
          </div>

          <div className="detail-scroll">
            {/* ── Vibe tags ──────────────────────────────────────── */}
            <div className="detail-tags">
              {neighborhood.vibe_tags.map(tag => (
                <span key={tag} className="detail-tag">{tag}</span>
              ))}
            </div>

            {/* ── Stats row ──────────────────────────────────────── */}
            <div className="detail-stats">
              <div className="detail-stat">
                <span className="detail-stat-label">Population</span>
                <span className="detail-stat-value">
                  {neighborhood.population.toLocaleString()}
                  <span className="detail-stat-sub"> ({neighborhood.populationYear})</span>
                </span>
              </div>
              <div className="detail-stat">
                <span className="detail-stat-label">Established</span>
                <span className="detail-stat-value">{neighborhood.established}</span>
              </div>
              <div className="detail-stat">
                <span className="detail-stat-label">Known for</span>
                <span className="detail-stat-value">{neighborhood.known_for}</span>
              </div>
            </div>

            {/* ── Blurb ──────────────────────────────────────────── */}
            <p className="detail-blurb">"{neighborhood.blurb}"</p>

            {/* ── Street context ─────────────────────────────────── */}
            {neighborhood.streetContext && (
              <div className="detail-boundaries">
                <svg className="detail-boundaries-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 1v2M8 12v2M1 7h2M12 7h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 10v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div>
                  <span className="detail-boundaries-label">Boundaries</span>
                  <p className="detail-boundaries-text">{neighborhood.streetContext}</p>
                </div>
              </div>
            )}

            {/* ── Context ────────────────────────────────────────── */}
            <p className="detail-context">{neighborhood.establishedContext}</p>

            {/* ── Notable sites ──────────────────────────────────── */}
            <div className="detail-sites">
              <h3 className="detail-sites-heading">Notable sites</h3>
              <ul className="detail-sites-list">
                {neighborhood.notable_sites.map(site => (
                  <li key={site}>{site}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
