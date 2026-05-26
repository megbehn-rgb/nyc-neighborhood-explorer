/**
 * Greedy graph coloring for neighborhood polygons.
 * Builds an adjacency graph from GeoJSON features (sharing any boundary edge),
 * then assigns colors so no two adjacent neighborhoods share the same color.
 *
 * Color candidate selection starts at (nodeIndex % numColors) and wraps around,
 * which distributes usage across the full palette rather than always assigning
 * the lowest-index color (which would bottleneck at 4–5 colors for planar graphs).
 */

const TOLERANCE = 0.002; // degrees (~150m) — enough to catch shared edges

// Returns all outer-ring coordinates regardless of Polygon vs MultiPolygon geometry.
function getAllCoords(feature) {
  const { type, coordinates } = feature.geometry;
  if (type === 'Polygon') return coordinates[0];
  if (type === 'MultiPolygon') return coordinates.flatMap(poly => poly[0]);
  return [];
}

function bboxOf(feature) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of getAllCoords(feature)) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

function bboxesOverlap(a, b) {
  return (
    a.maxX + TOLERANCE >= b.minX &&
    b.maxX + TOLERANCE >= a.minX &&
    a.maxY + TOLERANCE >= b.minY &&
    b.maxY + TOLERANCE >= a.minY
  );
}

function shareEdge(featA, featB) {
  const coordsA = getAllCoords(featA);
  const coordsB = getAllCoords(featB);
  for (const [ax, ay] of coordsA) {
    for (const [bx, by] of coordsB) {
      if (Math.abs(ax - bx) < TOLERANCE && Math.abs(ay - by) < TOLERANCE) {
        return true;
      }
    }
  }
  return false;
}

export function buildAdjacency(features) {
  const n = features.length;
  const bboxes = features.map(bboxOf);
  const adj = Array.from({ length: n }, () => new Set());

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (bboxesOverlap(bboxes[i], bboxes[j]) && shareEdge(features[i], features[j])) {
        adj[i].add(j);
        adj[j].add(i);
      }
    }
  }
  return adj;
}

export function greedyColor(features, numColors = 6) {
  const adj = buildAdjacency(features);
  const n = features.length;
  const colors = new Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    const usedByNeighbors = new Set();
    for (const j of adj[i]) {
      if (colors[j] !== -1) usedByNeighbors.add(colors[j]);
    }
    // Rotate start index so each node prefers a different color,
    // spreading usage across the full palette.
    const start = i % numColors;
    for (let delta = 0; delta < numColors; delta++) {
      const c = (start + delta) % numColors;
      if (!usedByNeighbors.has(c)) {
        colors[i] = c;
        break;
      }
    }
    if (colors[i] === -1) colors[i] = i % numColors;
  }

  const colorMap = {};
  for (let i = 0; i < n; i++) {
    colorMap[features[i].properties.id] = colors[i];
  }
  return colorMap;
}
