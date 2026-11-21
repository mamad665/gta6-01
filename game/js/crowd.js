// Pedestrians wandering the sidewalks; they flee from gunfire and crashes.

import { mulberry32 } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f39c12', '#1abc9c', '#e67e22', '#fd79a8', '#a29bfe', '#00cec9'];

export function spawnPeds(city, count) {
  const rand = mulberry32(4242);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = city.randomRoadPoint();
    peds.push({
      x: p.x, y: p.y, angle: rand() * Math.PI * 2,
      speed: 34 + rand() * 30, r: 11,
      color: SHIRTS[Math.floor(rand() * SHIRTS.length)],
      state: 'walk', tx: p.x, ty: p.y, wait: rand() * 2, hp: 1, scared: 0,
    });
  }
  return peds;
}

export function updatePeds(city, peds, hero, gunfire, dt) {
  for (const p of peds) {
    if (gunfire) {
      const d = Math.hypot(p.x - gunfire.x, p.y - gunfire.y);
      if (d < 320) { p.state = 'flee'; p.scared = 2.5; }
    }
    if (p.state === 'flee') {
      p.scared -= dt;
      const dx = p.x - hero.x, dy = p.y - hero.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = p.x + (dx / len) * p.speed * 2.1 * dt;
      const ny = p.y + (dy / len) * p.speed * 2.1 * dt;
      if (!city.solidAt(nx, ny, p.r)) { p.x = nx; p.y = ny; }
      p.angle = Math.atan2(dy, dx);
      if (p.scared <= 0) p.state = 'walk';
      continue;
    }
    p.wait -= dt;
    if (p.wait <= 0) {
      const t = city.randomRoadPoint();
      p.tx = t.x; p.ty = t.y;
      p.wait = 3 + Math.random() * 5;
    }
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 8) {
      const nx = p.x + (dx / dist) * p.speed * dt;
      const ny = p.y + (dy / dist) * p.speed * dt;
      if (!city.solidAt(nx, ny, p.r)) { p.x = nx; p.y = ny; }
      p.angle = Math.atan2(dy, dx);
    }
  }
}

// Peds hit by a moving car get knocked down and the driver earns a star.
export function carHitsPeds(car, peds, onHit) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const p of peds) {
    if (p.state === 'down') continue;
    const dx = p.x - car.x, dy = p.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (Math.abs(car.speed) > 120 && Math.abs(along) < 26 && side < 20) {
      p.state = 'down';
      p.wait = 4;
      onHit(p);
    }
  }
  for (const p of peds) {
    if (p.state === 'down') {
      p.wait -= 1 / 60;
      if (p.wait <= 0) { p.state = 'walk'; p.x += 30; p.y += 30; }
    }
  }
}
