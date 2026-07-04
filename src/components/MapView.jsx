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
  '#c9b8e8',
  '#f4d06f',
];

const FILL_OPACITY_BASE  = 0.45;
const FILL_OPACITY_HOVER = 0.72;
const STROKE_WIDTH_BASE  = 1.2;
const STROKE_WIDTH_HOVER = 2.5;
const DIM_OPACITY        = 0.12;

const BY_ID = Object.fromEntries(neighborhoodData.map(n => [n.id, n]));

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Stable device-capability checks (evaluated once at module load)
const IS_MOBILE     = window.matchMedia('(max-width: 767px)').matches;
const SUPPORTS_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Maps each MTA color to the combined label shown on the badge
const LABEL_GROUPS = {
  '#EE352E': '1·2·3',
  '#00933C': '4·5·6',
  '#B933AD': '7',
  '#0039A6': 'A·C·E',
  '#FF6319': 'B·D·F·M',
  '#6CBE45': 'G',
  '#996633': 'J·Z',
  '#A7A9AC': 'L',
  '#FCCC0A': 'N·Q·R·W',
};

export default function MapView({
  selected, activeTags, activeBoroughs, flyToId, onFlyComplete, onSelect,
  quizMode, quizResult, onQuizClick, subwayVisible,
  findMeActive, onFindMeComplete, onToast,
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
  const subwayVisibleRef = useRef(subwayVisible);

  // Find Me refs
  const locationMarkerRef    = useRef(null);
  const onFindMeCompleteRef  = useRef(onFindMeComplete);
  const onToastRef           = useRef(onToast);

  useEffect(() => { quizModeRef.current     = quizMode;       }, [quizMode]);
  useEffect(() => { quizResultRef.current   = quizResult;     }, [quizResult]);
  useEffect(() => { onQuizClickRef.current  = onQuizClick;    }, [onQuizClick]);
  useEffect(() => { onSelectRef.current     = onSelect;       }, [onSelect]);
  useEffect(() => { subwayVisibleRef.current = subwayVisible; }, [subwayVisible]);
  useEffect(() => { onFindMeCompleteRef.current = onFindMeComplete; }, [onFindMeComplete]);
  useEffect(() => { onToastRef.current          = onToast;          }, [onToast]);

  const getFillColor = useCallback((id, colorMap) => {
    const idx = colorMap[id] ?? 0;
    return PALETTE[idx % PALETTE.length];
  }, []);

  const rebuildPaint = useCallback(() => {
    const map = mapRef.current;
    if (!map || !geojsonRef.current) return;
    if (!map.getLayer('hoods-fill')) return;

    const features = geojsonRef.current.features;

    // ── Quiz mode ────────────────────────────────────────────────────
    // Quiz mode doesn't need the color map — handle it before the colorMap guard.
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
    if (!colorMapRef.current) return;
    const colorMap = colorMapRef.current;
    const hoveredId = hoveredRef.current;
    const allBoroughs = ['Manhattan', 'Brooklyn', 'Queens'];
    const boroughFilterActive = activeBoroughs && activeBoroughs.length < allBoroughs.length;
    const dimmedSet = new Set(
      neighborhoodData
        .filter(n => {
          const boroughDimmed = boroughFilterActive && !activeBoroughs.includes(n.borough);
          const tagDimmed = activeTags.length > 0 && !n.vibe_tags.some(t => activeTags.includes(t));
          return boroughDimmed || tagDimmed;
        })
        .map(n => n.id)
    );

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
  }, [activeTags, activeBoroughs, quizMode, quizResult, getFillColor]);

  // ── Init map (runs once) ───────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-73.94, 40.70],
      zoom: IS_MOBILE ? 10 : 10,
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

      const res = await fetch('/nyc-neighborhoods.geojson');
      const geojson = await res.json();
      geojsonRef.current = geojson;

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

      // Defer graph coloring — lets the map render immediately, then applies colors
      setTimeout(() => {
        colorMapRef.current = greedyColor(geojson.features, PALETTE.length);
        rebuildPaintRef.current?.();
      }, 0);

      // ── Subway overlay ──────────────────────────────────────────
      try {
        const r = await fetch('/subway-lines.geojson');
        if (!r.ok) throw new Error(`subway fetch failed: ${r.status}`);
        const subwayData = await r.json();

        map.addSource('subway', { type: 'geojson', data: subwayData });

        const initVis = subwayVisibleRef.current ? 'visible' : 'none';

        map.addLayer({
          id: 'subway-halo',
          type: 'line',
          source: 'subway',
          layout: { 'line-join': 'round', 'line-cap': 'round', visibility: initVis },
          paint: {
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 16, 7],
            'line-opacity': 0.85,
          },
        });

        map.addLayer({
          id: 'subway-lines',
          type: 'line',
          source: 'subway',
          layout: { 'line-join': 'round', 'line-cap': 'round', visibility: initVis },
          paint: {
            'line-color': ['get', 'lineColor'],
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 16, 4],
            'line-opacity': 0.9,
          },
        });

        // Build a label source grouped by color (one MultiLineString per MTA color group)
        // so combined labels like "A·C·E" appear instead of three separate badges.
        const byColor = {};
        for (const f of subwayData.features) {
          const color = f.properties.lineColor;
          if (!byColor[color]) {
            byColor[color] = {
              type: 'Feature',
              properties: {
                lineColor: color,
                label: LABEL_GROUPS[color] ?? f.properties.ref,
              },
              geometry: { type: 'MultiLineString', coordinates: [] },
            };
          }
          const segs = f.geometry.type === 'MultiLineString'
            ? f.geometry.coordinates : [f.geometry.coordinates];
          byColor[color].geometry.coordinates.push(...segs);
        }

        map.addSource('subway-label-src', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: Object.values(byColor) },
        });

        map.addLayer({
          id: 'subway-labels',
          type: 'symbol',
          source: 'subway-label-src',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 11, 250, 14, 400],
            'text-field': ['get', 'label'],
            'text-font': ['DIN Pro Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 13],
            'text-rotation-alignment': 'map',
            'text-pitch-alignment': 'viewport',
            'text-allow-overlap': false,
            'text-padding': 3,
            visibility: initVis,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': ['get', 'lineColor'],
            'text-halo-width': 8,
            'text-halo-blur': 0,
          },
        });
      } catch (err) {
        console.warn('Subway overlay unavailable:', err);
      }

      // ── Hover (disabled in quiz mode) ───────────────────────────
      map.on('mousemove', 'hoods-fill', (e) => {
        if (quizModeRef.current) return;
        if (!SUPPORTS_HOVER) return; // no hover effects on touch devices
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

  // Toggle subway layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('subway-lines')) return;
    const v = subwayVisible ? 'visible' : 'none';
    map.setLayoutProperty('subway-halo',   'visibility', v);
    map.setLayoutProperty('subway-lines',  'visibility', v);
    if (map.getLayer('subway-labels')) {
      map.setLayoutProperty('subway-labels', 'visibility', v);
    }
  }, [subwayVisible]);

  // ── Find Me geolocation ───────────────────────────────────────────
  useEffect(() => {
    if (!findMeActive) return;

    if (!navigator.geolocation) {
      onToastRef.current?.('Geolocation is not supported by your browser.');
      onFindMeCompleteRef.current?.();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current;
        if (!map) { onFindMeCompleteRef.current?.(); return; }

        // Fly to user's location
        map.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 });

        // Create or reposition the pulsing dot marker
        if (locationMarkerRef.current) {
          locationMarkerRef.current.setLngLat([lng, lat]);
        } else {
          const el = document.createElement('div');
          el.className = 'find-me-marker';
          el.innerHTML = '<div class="find-me-pulse"></div><div class="find-me-dot"></div>';
          locationMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map);
        }

        // Point-in-polygon: open panel if inside a Manhattan neighborhood
        const geojson = geojsonRef.current;
        if (geojson) {
          const pt = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {},
          };
          let foundId = null;
          for (const feat of geojson.features) {
            if (booleanPointInPolygon(pt, feat)) {
              foundId = feat.properties.id;
              break;
            }
          }
          if (foundId) {
            const hood = BY_ID[foundId];
            if (hood) onSelectRef.current(hood);
          } else {
            onToastRef.current?.("You're outside the mapped area — explore the map to find neighborhoods");
          }
        }

        onFindMeCompleteRef.current?.();
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          onToastRef.current?.(
            'Location access was denied — enable it in your browser settings to use this feature.'
          );
        } else {
          onToastRef.current?.('Unable to determine your location. Please try again.');
        }
        onFindMeCompleteRef.current?.();
      },
      { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findMeActive]);

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
      map.flyTo({ center: [-73.94, 40.70], zoom: 10, duration: 900 });
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

    const padding = IS_MOBILE
      ? { top: 50, bottom: Math.round(window.innerHeight * 0.58), left: 20, right: 20 }
      : { top: 80, bottom: 60, left: 60, right: 420 };
    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding, maxZoom: 15, duration: 900 }
    );
    onFlyComplete?.();
  }, [flyToId, onFlyComplete]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
