// combat.js — bullets, punching, and the wanted-level consequences of crime.

import { dist, angleTo } from './random.js';

export function makeBullets() {
  return [];
}

export function fireBullet(game) {
  const p = game.player;
  if (p.ammo <= 0 || p.shootCooldown > 0) return false;
  p.ammo -= 1;
  p.shootCooldown = 0.22;
  const mx = game.camera.x + game.input.mouse.x / game.camera.zoom;
  const my = game.camera.y + game.input.mouse.y / game.camera.zoom;
  const a = angleTo(p.x, p.y, mx, my);
  game.bullets.push({
    x: p.x + Math.cos(a) * 20,
    y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * 760,
    vy: Math.sin(a) * 760,
    life: 0.7,
    fromPlayer: true,
  });
  game.sound.gunshot();
  game.addWanted(1, 'firing a weapon');
  return true;
}

export function punch(game) {
  const p = game.player;
  if (p.punchCooldown > 0 || !p.onFoot) return;
  p.punchCooldown = 0.45;
  game.sound.punch();
  const reach = 46;
  const px = p.x + Math.cos(p.angle) * reach;
  const py = p.y + Math.sin(p.angle) * reach;
  let hit = false;
  for (const ped of game.peds) {
    if (ped.down > 0) continue;
    if (dist(px, py, ped.x, ped.y) < 30) {
      ped.down = 4;
      ped.flee = 6;
      hit = true;
    }
  }
  for (const car of game.cars) {
    if (car.isPolice && dist(px, py, car.x, car.y) < 40) {
      car.health -= 10;
      hit = true;
    }
  }
  if (hit) game.addWanted(1, 'assault');
}

export function updateBullets(game, dt) {
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Hit a pedestrian.
      for (const ped of game.peds) {
        if (ped.down > 0) continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 14) {
          ped.down = 6;
          ped.flee = 8;
          dead = true;
          game.addWanted(1, 'shooting a pedestrian');
          break;
        }
      }
    }
    if (!dead) {
      // Hit a car (not the player's own).
      for (const car of game.cars) {
        if (car === game.player.inCar) continue;
        const dx = b.x - car.x;
        const dy = b.y - car.y;
        const ca = Math.cos(-car.angle);
        const sa = Math.sin(-car.angle);
        const lx = dx * ca - dy * sa;
        const ly = dx * sa + dy * ca;
        if (Math.abs(lx) < 26 && Math.abs(ly) < 13) {
          car.health -= 34;
          dead = true;
          if (car.isPolice) game.addWanted(1, 'shooting police');
          if (car.health <= 0) {
            car.health = 0;
            car.driver = null;
            car.smoke = 1;
            if (car.isTarget) game.missions.onTargetCarDisabled();
          }
          break;
        }
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }
}
