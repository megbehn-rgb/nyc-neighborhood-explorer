import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import neighborhoodData from '../data/neighborhoodData';
import { greedyColor } from '../utils/graphColoring';

const PALETTE = [
  '#7eb0d5',
  '#b2e061',
  '#fd7f6f',
  '#ffb55a',
  '#8bd3c7',
  '#e8a0bf',
];

const FILL_OPACITY_BASE  = 0.45;
const FILL_OPACITY_HOVER = 0.72;
const STROKE_WIDTH_BASE  = 1.2;
const STROKE_WIDTH_HOVER = 2.5;
const DIM_OPACITY        = 0.12;

const BY_ID = Object.fromEntries(neighborhoodData.map(n => [n.id, n]));

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({
  selected, activeTags, flyToId, onFlyComplete, onSelect,
  quizMode, quizResult, onQuizClick,
}) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const hoveredRef     = useRef(null);
  const geojsonRef     = useRef(null);
  const colorMapRef    = useRef(null);

  // Stable refs for values used inside once-registered event handlers
  const quizModeRef     = useRef(quizMode);
  const quizResultRef   = useRef(quizResult);
  const onQuizClickRef  = useRef(onQuizClick);
  const onSelectRef     = useRef(onSelect);
  const rebuildPaintRef = useRef(null);

  useEffect(() => { quizModeRef.current    = quizMode;    }, [quizMode]);
  useEffect(() => { quizResultRef.current  = quizResult;  }, [quizResult]);
  useEffect(() => { onQuizClickRef.current = onQuizClick; }, [onQuizClick]);
  useEffect(() => { onSelectRef.current    = onSelect;    }, [onSelect]);

  const getFillColor = useCallback((id, colorMap) => {
    const idx = colorMap[id] ?? 0;
    return PALETTE[idx % PALETTE.length];
  }, []);

  const rebuildPaint = useCallback(() => {
    const map = mapRef.current;
    if (!map || !geojsonRef.current || !colorMapRef.current) return;
    if (!map.getLayer('hoods-fill')) return;

    const features = geojsonRef.current.features;
    const colorMap = colorMapRef.current;

    // ── Quiz mode ────────────────────────────────────────────────────
    if (quizMode) {
      if (quizResult) {
        const { correctId, clickedId } = quizResult;
        const fillColors    = ['match', ['get', 'id']];
        const fillOpacities = ['match', ['get', 'id']];
        const strokeOps     = ['match', ['get', 'id']];
        const strokeWidths  = ['match', ['get', 'id']];

        fillColors.push(correctId, '#4ade80');
        fillOpacities.push(correctId, 0.75);
        strokeOps.push(correctId, 1);
        strokeWidths.push(correctId, 2.5);

        if (clickedId && clickedId !== correctId) {
          fillColors.push(clickedId, '#f87171');
          fillOpacities.push(clickedId, 0.65);
          strokeOps.push(clickedId, 0.9);
          strokeWidths.push(clickedId, 2.5);
        }

        fillColors.push('#ccc');
        fillOpacities.push(0);
        strokeOps.push(0);
        strokeWidths.push(STROKE_WIDTH_BASE);

        map.setPaintProperty('hoods-fill', 'fill-color', fillColors);
        map.setPaintProperty('hoods-fill', 'fill-opacity', fillOpacities);
        map.setPaintProperty('hoods-stroke', 'line-opacity', strokeOps);
        map.setPaintProperty('hoods-stroke', 'line-width', strokeWidths);
      } else {
        // No result yet — completely hide polygons so the map is neutral
        map.setPaintProperty('hoods-fill', 'fill-opacity', 0);
        map.setPaintProperty('hoods-stroke', 'line-opacity', 0);
      }
      return;
    }

    // ── Normal mode ───────────────────────────────────────────────────
    const hoveredId = hoveredRef.current;
    const dimmedSet = activeTags.length > 0
      ? new Set(
          neighborhoodData
            .filter(n => !n.vibe_tags.some(t => activeTags.includes(t)))
            .map(n => n.id)
        )
      : new Set();

    const fillColorExpr   = ['match', ['get', 'id']];
    const fillOpacityExpr = ['match', ['get', 'id']];
    const strokeOpExpr    = ['match', ['get', 'id']];

    for (const feat of features) {
      const id = feat.properties.id;
      const baseColor = getFillColor(id, colorMap);
      const isDimmed  = dimmedSet.has(id);
      const isHovered = id === hoveredId;

      fillColorExpr.push(id, baseColor);
      fillOpacityExpr.push(id, isDimmed ? DIM_OPACITY : isHovered ? FILL_OPACITY_HOVER : FILL_OPACITY_BASE);
      strokeOpExpr.push(id, isDimmed ? DIM_OPACITY : isHovered ? 1 : 0.7);
    }
    fillColorExpr.push('#ccc');
    fillOpacityExpr.push(FILL_OPACITY_BASE);
    strokeOpExpr.push(0.7);

    map.setPaintProperty('hoods-fill', 'fill-color', fillColorExpr);
    map.setPaintProperty('hoods-fill', 'fill-opacity', fillOpacityExpr);
    map.setPaintProperty('hoods-stroke', 'line-opacity', strokeOpExpr);
    map.setPaintProperty('hoods-stroke', 'line-width', [
      'match', ['get', 'id'],
      hoveredId ?? '__none__', STROKE_WIDTH_HOVER,
      STROKE_WIDTH_BASE,
    ]);
  }, [activeTags, quizMode, quizResult, getFillColor]);

  // ── Init map (runs once) ───────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-73.971, 40.776],
      zoom: 11.5,
      minZoom: 10,
      maxZoom: 16,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'map-tooltip';
    tooltip.style.cssText = `
      position:absolute; pointer-events:none; display:none;
      background:rgba(255,255,255,0.92); backdrop-filter:blur(8px);
      border:1px solid rgba(0,0,0,0.08); border-radius:6px;
      padding:5px 10px; font:500 13px/1.4 Inter,system-ui,sans-serif;
      color:#1a1a1a; box-shadow:0 2px 8px rgba(0,0,0,0.12);
      white-space:nowrap; z-index:5;
    `;
    containerRef.current.appendChild(tooltip);

    map.on('load', async () => {
      // Hide Mapbox's built-in neighborhood labels from the basemap.
      // Targets: layers whose ID contains "neighborhood", the settlement-subdivision
      // label layer (Mapbox v3 style name for quarters/neighbourhoods), and any
      // symbol layer on the place_label source-layer whose filter references
      // the "neighbourhood" place type (Mapbox uses British spelling in tile data).
      for (const layer of map.getStyle().layers) {
        const id = layer.id.toLowerCase();
        const filterStr = layer.filter ? JSON.stringify(layer.filter).toLowerCase() : '';
        if (
          id.includes('neighborhood') ||
          id.includes('settlement-subdivision') ||
          (layer.type === 'symbol' &&
           layer['source-layer'] === 'place_label' &&
           filterStr.includes('neighbourhood'))
        ) {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
      }

      const res = await fetch('/manhattan-neighborhoods.geojson');
      const geojson = await res.json();
      geojsonRef.current = geojson;
      colorMapRef.current = greedyColor(geojson.features, PALETTE.length);

      map.addSource('neighborhoods', { type: 'geojson', data: geojson });

      map.addLayer({
        id: 'hoods-fill',
        type: 'fill',
        source: 'neighborhoods',
        paint: { 'fill-color': '#ccc', 'fill-opacity': FILL_OPACITY_BASE },
      });

      map.addLayer({
        id: 'hoods-stroke',
        type: 'line',
        source: 'neighborhoods',
        paint: { 'line-color': '#fff', 'line-width': STROKE_WIDTH_BASE, 'line-opacity': 0.85 },
      });

      rebuildPaint();

      // ── Hover (disabled in quiz mode) ───────────────────────────
      map.on('mousemove', 'hoods-fill', (e) => {
        if (quizModeRef.current) return;
        if (!e.features.length) return;
        const id = e.features[0].properties.id;
        if (hoveredRef.current !== id) {
          hoveredRef.current = id;
          map.getCanvas().style.cursor = 'pointer';
          rebuildPaintRef.current?.();
        }
        tooltip.textContent = BY_ID[id]?.name ?? id;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.originalEvent.offsetX + 14) + 'px';
        tooltip.style.top  = (e.originalEvent.offsetY - 32) + 'px';
      });

      map.on('mouseleave', 'hoods-fill', () => {
        if (quizModeRef.current) return;
        hoveredRef.current = null;
        map.getCanvas().style.cursor = '';
        tooltip.style.display = 'none';
        rebuildPaintRef.current?.();
      });

      // ── Normal click ────────────────────────────────────────────
      map.on('click', 'hoods-fill', (e) => {
        if (quizModeRef.current) return;
        if (!e.features.length) return;
        const id = e.features[0].properties.id;
        const hood = BY_ID[id];
        if (hood) onSelectRef.current(hood);
      });

      // ── Quiz click (global, uses turf PIP) ─────────────────────
      map.on('click', (e) => {
        if (!quizModeRef.current) return;
        if (quizResultRef.current) return; // waiting for result to clear
        const pt = {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
          properties: {},
        };
        let clickedId = null;
        for (const feat of geojsonRef.current.features) {
          if (booleanPointInPolygon(pt, feat)) {
            clickedId = feat.properties.id;
            break;
          }
        }
        onQuizClickRef.current?.(clickedId);
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ref current so once-registered hover handlers always call the latest version
  useEffect(() => { rebuildPaintRef.current = rebuildPaint; }, [rebuildPaint]);

  // Rebuild paint whenever relevant state changes
  useEffect(() => { rebuildPaint(); }, [rebuildPaint]);

  // Crosshair cursor when quiz mode is active
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = quizMode ? 'crosshair' : '';
    // Reset hover when entering/leaving quiz mode
    hoveredRef.current = null;
  }, [quizMode]);

  // ── flyTo / fitBounds ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToId) return;

    if (flyToId === '__reset__') {
      map.flyTo({ center: [-73.971, 40.776], zoom: 11.5, duration: 900 });
      onFlyComplete?.();
      return;
    }

    const geojson = geojsonRef.current;
    if (!geojson) return;
    const feat = geojson.features.find(f => f.properties.id === flyToId);
    if (!feat) return;

    const { type, coordinates } = feat.geometry;
    const rings     = type === 'MultiPolygon' ? coordinates.flatMap(p => p) : coordinates;
    const allCoords = rings.flat();

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lng, lat] of allCoords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: { top: 120, bottom: 60, left: 60, right: 420 }, maxZoom: 15, duration: 900 }
    );
    onFlyComplete?.();
  }, [flyToId, onFlyComplete]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
