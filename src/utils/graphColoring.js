/**
 * Greedy graph coloring for neighborhood polygons.
 * Builds an adjacency graph from GeoJSON features (sharing any boundary edge),
 * then assigns colors so no two adjacent neighborhoods share the same color.
 */

// Shared-edge threshold: two features are adjacent if their bounding boxes
// overlap and they share at least one coordinate pair within this tolerance.
const TOLERANCE = 0.002; // degrees (~150m) — enough to catch shared edges

function bboxOf(feature) {
  const coords = feature.geometry.coordinates[0];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
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
  const coordsA = featA.geometry.coordinates[0];
  const coordsB = featB.geometry.coordinates[0];
  // Check if any vertex of A is within TOLERANCE of any vertex of B
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
    for (let c = 0; c < numColors; c++) {
      if (!usedByNeighbors.has(c)) {
        colors[i] = c;
        break;
      }
    }
    // Fallback: cycle through colors if all are used
    if (colors[i] === -1) colors[i] = i % numColors;
  }

  // Return a map from neighborhood id → color index
  const colorMap = {};
  for (let i = 0; i < n; i++) {
    colorMap[features[i].properties.id] = colors[i];
  }
  return colorMap;
}
