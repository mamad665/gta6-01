// world.js — Solmar City generation: road grid, blocks, buildings, parks,
// beach, docks and landmarks. Everything is placed from a seed so a given
// seed always builds the same city.

import { WORLD, PALETTE } from './config.js';
import { makeRng } from './random.js';

export function roadCenters() {
  const xs = [];
  const ys = [];
  for (let x = 150; x < WORLD.width - 100; x += WORLD.roadGap) xs.push(x);
  for (let y = 150; y < WORLD.beachY - 100; y += WORLD.roadGap) ys.push(y);
  return { xs, ys };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const { xs, ys } = roadCenters();
  const buildings = [];
  const trees = [];
  const parks = [];

  // Landmarks: fixed, named places the story and missions use.
  const landmarks = {
    garage: { name: "Rosa's Garage", x: 450, y: 450, w: 170, h: 110 },
    cityHall: { name: 'City Hall', x: 1650, y: 450, w: 200, h: 130 },
    bank: { name: 'Solmar Bank', x: 2550, y: 750, w: 180, h: 120 },
    mall: { name: 'Sunset Mall', x: 750, y: 1650, w: 230, h: 150 },
    hospital: { name: 'St. Marina Hospital', x: 1950, y: 1950, w: 200, h: 130 },
    docks: { name: 'Port Docks', x: 3350, y: 1350, w: 190, h: 170 },
    hideout: { name: 'Hideout — Pier 9', x: 3300, y: 2400, w: 150, h: 100 },
    marina: { name: 'Marina', x: 300, y: 2400, w: 170, h: 110 },
  };

  const roadHalf = WORLD.roadWidth / 2;
  const block = WORLD.roadGap;

  // Fill every block between roads with buildings or a park.
  for (let ci = 0; ci < xs.length - 1; ci++) {
    for (let ri = 0; ri < ys.length - 1; ri++) {
      const x0 = xs[ci] + roadHalf + 14;
      const y0 = ys[ri] + roadHalf + 14;
      const x1 = xs[ci + 1] - roadHalf - 14;
      const y1 = ys[ri + 1] - roadHalf - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 60 || h < 60) continue;

      // Skip blocks that hold a landmark.
      let taken = false;
      for (const lm of Object.values(landmarks)) {
        if (lm.x > x0 - 20 && lm.x < x1 + 20 && lm.y > y0 - 20 && lm.y < y1 + 20) {
          taken = true;
          break;
        }
      }
      if (taken) continue;

      if (rng.chance(0.16)) {
        // Park: grass + trees.
        parks.push({ x: x0, y: y0, w, h });
        const n = rng.int(4, 8);
        for (let i = 0; i < n; i++) {
          trees.push({
            x: rng.range(x0 + 14, x1 - 14),
            y: rng.range(y0 + 14, y1 - 14),
            r: rng.range(9, 15),
          });
        }
        continue;
      }

      // 1–3 buildings per block.
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const bw = rng.range(w * 0.3, w * 0.62);
        const bh = rng.range(h * 0.3, h * 0.62);
        const bx = rng.range(x0, x1 - bw);
        const by = rng.range(y0, y1 - bh);
        buildings.push({
          x: bx,
          y: by,
          w: bw,
          h: bh,
          roof: rng.pick(PALETTE.buildingRoof),
          wall: rng.pick(PALETTE.buildingWall),
          floors: rng.int(1, 4),
          seed: rng.int(0, 99999),
        });
      }
      // A tree or two on the block corners.
      if (rng.chance(0.6)) {
        trees.push({ x: x0 + 12, y: y0 + 12, r: 10 });
        trees.push({ x: x1 - 12, y: y1 - 12, r: 10 });
      }
    }
  }

  // Palm trees along the beach.
  for (let x = 120; x < WORLD.width; x += 130) {
    trees.push({ x: x + rng.range(-20, 20), y: WORLD.beachY + rng.range(30, 90), r: 12, palm: true });
  }

  return { seed, xs, ys, buildings, trees, parks, landmarks };
}

export function isRoad(city, x, y) {
  const half = WORLD.roadWidth / 2 + 6;
  if (y > WORLD.beachY) return false;
  for (const cx of city.xs) if (Math.abs(x - cx) < half) return true;
  for (const cy of city.ys) if (Math.abs(y - cy) < half) return true;
  return false;
}

// Nearest point on the road network (used to spawn traffic / police).
export function nearestRoadPoint(city, x, y, rng) {
  let best = null;
  let bestD = Infinity;
  for (const cx of city.xs) {
    const d = Math.abs(x - cx);
    if (d < bestD) {
      bestD = d;
      best = { x: cx, y };
    }
  }
  for (const cy of city.ys) {
    const d = Math.abs(y - cy);
    if (d < bestD) {
      bestD = d;
      best = { x, y: cy };
    }
  }
  if (!best) return { x: 450, y: 450 };
  // Nudge onto the road and add a little lane offset.
  if (rng) {
    best.x += rng.range(-14, 14);
    best.y += rng.range(-14, 14);
  }
  return best;
}

export function nearestIntersection(city, x, y) {
  let bx = city.xs[0];
  let by = city.ys[0];
  for (const cx of city.xs) if (Math.abs(cx - x) < Math.abs(bx - x)) bx = cx;
  for (const cy of city.ys) if (Math.abs(cy - y) < Math.abs(by - y)) by = cy;
  return { x: bx, y: by };
}

// Circle vs building rects: push the circle out. Returns corrected {x, y}.
export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // Center inside the rect: push out along the smallest axis.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = b.x - r;
      else if (m === right) x = b.x + b.w + r;
      else if (m === top) y = b.y - r;
      else y = b.y + b.h + r;
    }
  }
  for (const lm of Object.values(city.landmarks)) {
    const hw = lm.w / 2;
    const hh = lm.h / 2;
    const cx = Math.max(lm.x - hw, Math.min(x, lm.x + hw));
    const cy = Math.max(lm.y - hh, Math.min(y, lm.y + hh));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    }
  }
  return { x, y };
}

export function insideWorld(x, y, margin) {
  const m = margin || 0;
  return x > m && x < WORLD.width - m && y > m && y < WORLD.height - m;
}
