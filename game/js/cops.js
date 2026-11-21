// Solmar PD: wanted stars, cop spawn + chase AI, busting.

export function createPolice() {
  return { cops: [], wanted: 0, quietTimer: 0, bustTimer: 0 };
}

export function addWanted(police, amount, maxStars) {
  police.wanted = Math.max(0, Math.min(maxStars || 5, police.wanted + amount));
  police.quietTimer = 0;
}

function spawnCop(city, hero) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 620 + Math.random() * 260;
  let x = hero.x + Math.cos(angle) * dist;
  let y = hero.y + Math.sin(angle) * dist;
  x = Math.max(30, Math.min(city.w - 30, x));
  y = Math.max(30, Math.min(city.h - 30, y));
  const p = city.nearestRoadPoint(x, y);
  return { x: p.x, y: p.y, angle: 0, speed: 0, maxSpeed: 330, len: 44, wid: 20, color: '#1c2733', kind: 'police', onFoot: false, hp: 3 };
}

export function updatePolice(city, police, hero, dt) {
  const want = Math.min(2 + police.wanted, 6);
  while (police.cops.length < want && police.wanted > 0) police.cops.push(spawnCop(city, hero));
  if (police.wanted === 0) {
    police.cops.length = 0;
    return;
  }
  police.quietTimer += dt;
  if (police.quietTimer > 24) {
    police.wanted = Math.max(0, police.wanted - 1);
    police.quietTimer = 0;
  }
  let anyClose = false;
  for (const cop of police.cops) {
    const dx = hero.x - cop.x, dy = hero.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    // Creep in close on foot so the arrest can happen; stop on top of Marco.
    const cruise = hero.inCar ? 430 : (dist < 130 ? 70 : 300);
    if (!hero.inCar && dist < 34) cop.speed = 0;
    else cop.speed += (cruise - cop.speed) * Math.min(1, dt * 1.4);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!city.solidAt(nx, ny, 13)) { cop.x = nx; cop.y = ny; }
    // A close cop on foot starts the bust timer; in a car, cops ram instead.
    if (!hero.inCar && dist < 42) {
      anyClose = true;
    } else if (hero.inCar && dist < 52) {
      hero.inCar.speed *= 0.92;
      cop.speed *= 0.9;
    }
  }
  if (anyClose) police.bustTimer += dt;
  else police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  // Remove cops that fell far behind.
  police.cops = police.cops.filter((c) => Math.hypot(c.x - hero.x, c.y - hero.y) < 1400);
}

export function resetPolice(police) {
  police.cops = [];
  police.wanted = 0;
  police.quietTimer = 0;
  police.bustTimer = 0;
}
