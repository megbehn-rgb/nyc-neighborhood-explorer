/**
 * Merges Manhattan (existing), Brooklyn, and Queens neighborhood data
 * into a single neighborhoodData.js file.
 *
 * Run after both borough data files are generated:
 *   node scripts/merge-neighborhood-data.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const scratchpad = '/private/tmp/claude-501/-Users-meghanbehnke-Documents-nyc-neighborhood-explorer/d2130f69-1e1c-4d1f-9087-3fa145b8c5ff/scratchpad';

// ── Read existing Manhattan data ────────────────────────────────────────
const mnSrc = readFileSync(join(root, 'src/data/neighborhoodData.js'), 'utf8');
// Extract the array literal between the first '[' and last '];'
const mnStart = mnSrc.indexOf('[');
const mnEnd   = mnSrc.lastIndexOf('];');
const mnArrayText = mnSrc.slice(mnStart, mnEnd + 2);

// ── Read Brooklyn and Queens data ───────────────────────────────────────
const bkSrc = readFileSync(join(scratchpad, 'brooklyn-data.js'), 'utf8');
const bkStart = bkSrc.indexOf('[');
const bkEnd   = bkSrc.lastIndexOf('];');
const bkArrayText = bkSrc.slice(bkStart + 1, bkEnd).trimEnd();

const qnSrc = readFileSync(join(scratchpad, 'queens-data.js'), 'utf8');
const qnStart = qnSrc.indexOf('[');
const qnEnd   = qnSrc.lastIndexOf('];');
const qnArrayText = qnSrc.slice(qnStart + 1, qnEnd).trimEnd();

// ── Strip trailing comma from MN block, then concatenate ────────────────
// Manhattan array ends with `},\n];` — drop the `];` portion and add a comma
const mnBody = mnArrayText.slice(1, mnArrayText.lastIndexOf(']')).trimEnd();

const combined = `// Neighborhood data keyed to official NYC NTA 2020 boundaries.
// IDs must match properties.id in public/nyc-neighborhoods.geojson.
// Covers Manhattan (32), Brooklyn (53), and Queens (59) = 144 neighborhoods.

const neighborhoodData = [
${mnBody}
${bkArrayText}
${qnArrayText}
];

export default neighborhoodData;
`;

const outPath = join(root, 'src/data/neighborhoodData.js');
writeFileSync(outPath, combined);

// Quick validation
const count = (combined.match(/^\s+id:/gm) || []).length;
console.log(`Written ${count} neighborhood entries to neighborhoodData.js`);
