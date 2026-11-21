// Solmar City map: deterministic road grid, blocks, landmarks, collision.
// All geometry is generated from a fixed seed so every load sees the same city.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROAD_W = 96;
const VERTICAL_ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
const HORIZONTAL_ROADS = [200, 600, 1000, 1400, 1800, 2200];

export function buildCity() {
  const rand = mulberry32(20261122);
  const W = 3200, H = 2400;
  const roads = [];
  for (const x of VERTICAL_ROADS) roads.push({ x: x - ROAD_W / 2, y: 0, w: ROAD_W, h: H, axis: 'v', at: x });
  for (const y of HORIZONTAL_ROADS) roads.push({ x: 0, y: y - ROAD_W / 2, w: W, h: ROAD_W, axis: 'h', at: y });

  const palette = ['#5a6b8a', '#6b5a7d', '#7d6b52', '#4f6b5a', '#71525a', '#55627a', '#7a6a4f'];
  const buildings = [];
  const landmarks = {};

  function addBlock(bx, by, bw, bh, name) {
    // one landmark building per reserved block
    const pad = 26;
    buildings.push({ x: bx + pad, y: by + pad, w: bw - pad * 2, h: bh - pad * 2, color: '#8a6d3b', name });
    landmarks[name] = { x: bx + pad, y: by + pad, w: bw - pad * 2, h: bh - pad * 2 };
  }

  // Landmark blocks: (col,row) in the road grid. Roads at 200..3000 x, 200..2200 y.
  addBlock(248, 248, 304, 304, "Rosa's Garage");      // west, near start
  addBlock(1448, 248, 304, 304, 'City Hall');          // north-center
  addBlock(1848, 648, 304, 304, 'Solmar Bank');        // center-east
  addBlock(2248, 1048, 304, 304, 'Sunset Mall');       // east
  addBlock(648, 1448, 304, 304, 'St. Marina Hospital');// south-west
  addBlock(2648, 1848, 304, 304, 'Port Docks');        // south-east
  addBlock(2648, 1048, 304, 304, 'Pier 9 Hideout');    // east edge
  addBlock(248, 1848, 304, 304, 'Marina');             // south-west corner

  // Fill every other block with 1-2 ordinary buildings.
  const landmarkKeys = new Set(Object.keys(landmarks));
  const reserved = new Set(['248,248', '1448,248', '1848,648', '2248,1048', '648,1448', '2648,1848', '2648,1048', '248,1848', '1048,1448']);
  for (let ci = 0; ci < VERTICAL_ROADS.length - 1; ci++) {
    for (let ri = 0; ri < HORIZONTAL_ROADS.length - 1; ri++) {
      const bx = VERTICAL_ROADS[ci] + ROAD_W / 2;
      const by = HORIZONTAL_ROADS[ri] + ROAD_W / 2;
      const bw = VERTICAL_ROADS[ci + 1] - VERTICAL_ROADS[ci] - ROAD_W;
      const bh = HORIZONTAL_ROADS[ri + 1] - HORIZONTAL_ROADS[ri] - ROAD_W;
      if (reserved.has(`${bx},${by}`)) continue;
      const count = rand() < 0.55 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = bw * (count === 2 ? 0.42 : 0.62) * (0.8 + rand() * 0.4);
        const h = bh * (count === 2 ? 0.42 : 0.62) * (0.8 + rand() * 0.4);
        const x = bx + (count === 2 ? (i === 0 ? 8 : bw - w - 8) : (bw - w) / 2);
        const y = by + (count === 2 ? (i === 0 ? 8 : bh - h - 8) : (bh - h) / 2);
        buildings.push({ x, y, w, h, color: palette[Math.floor(rand() * palette.length)] });
      }
    }
  }

  const park = { x: 1048, y: 1448, w: 304, h: 304 };
  const beach = { x: 0, y: 2248, w: W, h: 152 };
  const water = { x: 3050, y: 0, w: 150, h: H };
  const pier = { x: 2950, y: 1050, w: 250, h: 60 };

  const city = { w: W, h: H, roads, buildings, landmarks, park, beach, water, pier, rand };

  city.pointOnRoad = function (x, y) {
    for (const r of roads) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  };
  city.solidAt = function (x, y, r) {
    if (x < r || y < r || x > W - r || y > H - r) return true;
    if (x > pier.x && x < pier.x + pier.w && y > pier.y && y < pier.y + pier.h) return false; // the pier deck is walkable
    if (x > water.x) return true; // the sea is not walkable
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  };
  city.nearestRoadPoint = function (x, y) {
    let best = null, bd = Infinity;
    for (const r of roads) {
      const cx = Math.max(r.x, Math.min(x, r.x + r.w));
      const cy = Math.max(r.y, Math.min(y, r.y + r.h));
      const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d < bd) { bd = d; best = { x: cx, y: cy, axis: r.axis }; }
    }
    return best;
  };
  city.randomRoadPoint = function () {
    const r = roads[Math.floor(rand() * roads.length)];
    return { x: r.x + rand() * r.w, y: r.y + rand() * r.h, axis: r.axis };
  };
  return city;
}
