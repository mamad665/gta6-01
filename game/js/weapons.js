// Combat: fists and the pistol. Bullets are simple hitscan tracers.

export function createWeapons() {
  return { bullets: [], muzzle: 0, lastShot: 0 };
}

export function shoot(weapons, hero, aimAngle) {
  if (hero.ammo <= 0) return false;
  if (weapons.muzzle > 0) return false;
  hero.ammo -= 1;
  weapons.muzzle = 0.09;
  const sx = hero.x + Math.cos(aimAngle) * 24;
  const sy = hero.y + Math.sin(aimAngle) * 24;
  weapons.bullets.push({ x: sx, y: sy, angle: aimAngle, life: 0.12, traveled: 0 });
  return true;
}

// Move tracers; return the first target hit (peds, cops, or traffic cars).
export function updateBullets(weapons, city, targets, dt) {
  const hits = [];
  for (const b of weapons.bullets) {
    b.life -= dt;
    const step = 900 * dt;
    b.x += Math.cos(b.angle) * step;
    b.y += Math.sin(b.angle) * step;
    b.traveled += step;
    if (city.solidAt(b.x, b.y, 2) || b.traveled > 520) { b.life = 0; continue; }
    for (const t of targets) {
      if (t._dead) continue;
      const d = Math.hypot(t.x - b.x, t.y - b.y);
      const r = t.r || 24;
      if (d < r + 6) { hits.push(t); t._dead = true; b.life = 0; break; }
    }
  }
  weapons.bullets = weapons.bullets.filter((b) => b.life > 0);
  if (weapons.muzzle > 0) weapons.muzzle -= dt;
  return hits;
}

export function aimAngle(hero, cam, mouse, canvasW, canvasH) {
  const sx = hero.x - cam.x + canvasW / 2;
  const sy = hero.y - cam.y + canvasH / 2;
  return Math.atan2(mouse.y - sy, mouse.x - sx);
}
