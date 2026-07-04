/**
 * Fetches Brooklyn and Queens NTA 2020 GeoJSON from ArcGIS,
 * slugifies the IDs to match the existing Manhattan format,
 * and writes a combined MN+BK+QN file to public/nyc-neighborhoods.geojson.
 */
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const BASE = 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/2020_NTAs/FeatureServer/0/query';
const params = new URLSearchParams({
  where: 'BoroCode IN (3,4)',
  outFields: 'NTAName,NTA2020,BoroCode,BoroName',
  outSR: '4326',
  f: 'geojson',
  resultRecordCount: '1000',
});

console.log('Fetching BK+QN NTA geometries…');
const r = await fetch(`${BASE}?${params}`);
if (!r.ok) throw new Error(`HTTP ${r.status}`);
const raw = await r.json();
console.log(`  Got ${raw.features.length} features`);

const bkqnFeatures = raw.features.map(f => ({
  type: 'Feature',
  properties: {
    name: f.properties.NTAName,
    id: slugify(f.properties.NTAName),
    borough: f.properties.BoroName,
  },
  geometry: f.geometry,
}));

// Print id map for reference
console.log('\nID mapping:');
bkqnFeatures.forEach(f => console.log(`  ${f.properties.id}  |  ${f.properties.name}`));

// Merge with existing Manhattan GeoJSON
const mnPath = join(__dirname, '../public/manhattan-neighborhoods.geojson');
const mn = JSON.parse(readFileSync(mnPath, 'utf8'));
// Ensure Manhattan features have borough property
mn.features.forEach(f => { if (!f.properties.borough) f.properties.borough = 'Manhattan'; });

const combined = {
  type: 'FeatureCollection',
  features: [...mn.features, ...bkqnFeatures],
};

const outPath = join(__dirname, '../public/nyc-neighborhoods.geojson');
writeFileSync(outPath, JSON.stringify(combined));
const kb = Math.round(JSON.stringify(combined).length / 1024);
console.log(`\nWrote ${combined.features.length} features to nyc-neighborhoods.geojson (${kb} KB)`);
