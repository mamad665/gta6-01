// Marco Vale on foot: movement, collision, health, punching.

export function createHero(city) {
  const g = city.landmarks["Rosa's Garage"];
  return {
    x: g.x + g.w / 2, y: g.y + g.h + 60,
    angle: -Math.PI / 2, speed: 230, r: 14,
    health: 100, cash: 0, ammo: 12,
    inCar: null, punchTimer: 0, hurtTimer: 0, moving: false,
  };
}

export function moveHero(hero, city, input, dt) {
  if (hero.inCar) return;
  const a = input.axis();
  hero.moving = a.x !== 0 || a.y !== 0;
  if (!hero.moving) return;
  const len = Math.hypot(a.x, a.y);
  const nx = a.x / len, ny = a.y / len;
  hero.angle = Math.atan2(ny, nx);
  const step = hero.speed * dt;
  const tryX = hero.x + nx * step;
  if (!city.solidAt(tryX, hero.y, hero.r)) hero.x = tryX;
  const tryY = hero.y + ny * step;
  if (!city.solidAt(hero.x, tryY, hero.r)) hero.y = tryY;
  hero.x = Math.max(hero.r, Math.min(city.w - hero.r, hero.x));
  hero.y = Math.max(hero.r, Math.min(city.h - hero.r, hero.y));
}

export function heroPunch(hero, peds, cops, dt) {
  if (hero.punchTimer > 0) hero.punchTimer -= dt;
  return hero.punchTimer;
}

// A punch hits anything in front of Marco within 46px.
export function punchHit(hero, targets) {
  const px = hero.x + Math.cos(hero.angle) * 30;
  const py = hero.y + Math.sin(hero.angle) * 30;
  const hits = [];
  for (const t of targets) {
    const d = Math.hypot(t.x - px, t.y - py);
    if (d < 46) hits.push(t);
  }
  return hits;
}

export function damageHero(hero, amount) {
  if (hero.hurtTimer > 0) return false;
  hero.health -= amount;
  hero.hurtTimer = 0.6;
  return true;
}
