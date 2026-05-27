/**
 * Fetches NYC subway route geometries from OpenStreetMap via Overpass API
 * and writes public/subway-lines.geojson for the map overlay.
 *
 * Run once: node scripts/fetch-subway.mjs
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../public/subway-lines.geojson');

const MTA_COLORS = {
  A: '#0039A6', C: '#0039A6', E: '#0039A6',
  B: '#FF6319', D: '#FF6319', F: '#FF6319', M: '#FF6319',
  G: '#6CBE45',
  J: '#996633', Z: '#996633',
  L: '#A7A9AC',
  N: '#FCCC0A', Q: '#FCCC0A', R: '#FCCC0A', W: '#FCCC0A',
  1: '#EE352E', 2: '#EE352E', 3: '#EE352E',
  4: '#00933C', 5: '#00933C', 6: '#00933C',
  7: '#B933AD',
};

function colorFromRef(ref) {
  if (!ref) return '#888888';
  const key = String(ref).trim().charAt(0).toUpperCase();
  return MTA_COLORS[key] ?? '#888888';
}

// Fetch subway route relations that pass through Manhattan, with full way geometry
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Manhattan bounding box
const BBOX = '40.65,-74.05,40.90,-73.85';

const QUERY = `
[out:json][timeout:90];
(
  relation["route"="subway"]["ref"~"^[1-9ABCDEFGJLMNQRWZ]$"](${BBOX});
);
(._;>;);
out geom;
`.trim();

console.log('Fetching subway relations from Overpass API…');
const res = await fetch(OVERPASS_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'nyc-neighborhood-explorer/1.0 (data-prep-script)',
    'Accept': 'application/json',
  },
  body: 'data=' + encodeURIComponent(QUERY),
});
if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
const data = await res.json();

// Index nodes by id for geometry lookup
const nodeById = {};
for (const el of data.elements) {
  if (el.type === 'node') nodeById[el.id] = [el.lon, el.lat];
}

// Index ways by id
const wayById = {};
for (const el of data.elements) {
  if (el.type === 'way') {
    const coords = el.geometry
      ? el.geometry.map(g => [g.lon, g.lat])
      : (el.nodes ?? []).map(n => nodeById[n]).filter(Boolean);
    wayById[el.id] = coords;
  }
}

// Build one MultiLineString feature per route relation
const features = [];
for (const el of data.elements) {
  if (el.type !== 'relation') continue;
  const ref = el.tags?.ref;
  if (!ref || ref === 'S') continue; // skip shuttles

  // Collect all way member coordinates
  const lines = [];
  for (const member of (el.members ?? [])) {
    if (member.type === 'way') {
      const coords = wayById[member.ref];
      if (coords && coords.length >= 2) lines.push(coords);
    }
  }
  if (lines.length === 0) continue;

  features.push({
    type: 'Feature',
    properties: {
      ref,
      name: el.tags?.name ?? ref,
      lineColor: colorFromRef(ref),
    },
    geometry: {
      type: 'MultiLineString',
      coordinates: lines,
    },
  });
}

// Deduplicate by ref (keep one feature per route letter, merged)
const byRef = {};
for (const f of features) {
  const r = f.properties.ref;
  if (!byRef[r]) {
    byRef[r] = f;
  } else {
    byRef[r].geometry.coordinates.push(...f.geometry.coordinates);
  }
}

const geojson = {
  type: 'FeatureCollection',
  features: Object.values(byRef),
};

writeFileSync(OUT, JSON.stringify(geojson));
console.log(`Wrote ${geojson.features.length} route features → ${OUT}`);
for (const f of geojson.features) {
  console.log(`  ${f.properties.ref.padEnd(3)} ${f.properties.lineColor}  (${f.geometry.coordinates.length} segments)`);
}
