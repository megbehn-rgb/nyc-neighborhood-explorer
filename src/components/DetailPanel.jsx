import { useState, useEffect } from 'react';
import './DetailPanel.css';

export default function DetailPanel({ neighborhood, onClose }) {
  const [imgError, setImgError] = useState(false);
  const open = !!neighborhood;

  useEffect(() => { setImgError(false); }, [neighborhood?.id]);

  return (
    <div className={`detail-panel ${open ? 'detail-panel--open' : ''}`} role="complementary">
      <div className="detail-drag-handle" aria-hidden="true" />
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

            {/* ── Stats ──────────────────────────────────────────── */}
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

            {/* ── About ──────────────────────────────────────────── */}
            <div className="detail-about">
              <h3 className="detail-section-heading">About</h3>
              <p className="detail-about-blurb">{neighborhood.blurb}</p>
              <p className="detail-about-context">{neighborhood.establishedContext}</p>
            </div>

            {/* ── Boundaries ─────────────────────────────────────── */}
            {neighborhood.streetContext && (
              <div className="detail-section">
                <h3 className="detail-section-heading">Boundaries</h3>
                <p className="detail-section-body">{neighborhood.streetContext}</p>
              </div>
            )}

            {/* ── Notable sites ───────────────────────────────────── */}
            <div className="detail-section">
              <h3 className="detail-section-heading">Notable sites</h3>
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
