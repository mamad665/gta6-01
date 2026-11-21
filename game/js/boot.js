// Solmar City — main loop, state machine, HUD, missions wiring.

import { buildCity } from './city.js';
import { createInput } from './keys.js';
import { createSound } from './sound.js';
import { saveGame, loadGame } from './storage.js';
import { createHero, moveHero, punchHit, damageHero } from './hero.js';
import { spawnTraffic, updateTraffic, driveCar, moveCarWithCollision, nearestCar } from './cars.js';
import { createPolice, addWanted, updatePolice, resetPolice } from './cops.js';
import { spawnPeds, updatePeds, carHitsPeds } from './crowd.js';
import { createJobs, currentJobText, startJob, updateJobs, JOBS } from './jobs.js';
import { createWeapons, shoot, updateBullets, aimAngle } from './weapons.js';
import { drawWorld, drawEntities, drawMinimap } from './draw.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d');
const el = (id) => document.getElementById(id);

const city = buildCity();
const input = createInput();
const sound = createSound();

const hero = createHero(city);
const cars = spawnTraffic(city, 16);
const peds = spawnPeds(city, 36);
const police = createPolice();
const jobs = createJobs(city);
const weapons = createWeapons();

const state = {
  mode: 'title',
  hero, city, cars, peds, police, jobs, weapons,
  cam: { x: hero.x, y: hero.y },
  time: 0,
  gunfire: null,
  toastUntil: 0,
  saved: loadGame(),
};
if (state.saved) {
  el('continueNote').textContent = `Save found: $${state.saved.cash} cash, job ${Math.min(state.saved.missionIndex + 1, 4)}/4 — press START ENGINE to continue.`;
}

function showToast(text, secs) {
  el('toast').textContent = text.length > 80 ? text.slice(0, 80) + '…' : text;
  state.toastUntil = state.time + (secs || 4);
}

function applySave() {
  const s = state.saved;
  if (!s) return;
  hero.cash = s.cash;
  hero.health = s.health || 100;
  hero.ammo = s.ammo || 12;
  jobs.index = Math.max(0, Math.min(s.missionIndex, JOBS.length - 1));
}

function startGame() {
  sound.unlock();
  applySave();
  state.saved = null;
  el('titleScreen').classList.add('hidden');
  state.mode = 'playing';
  const intro = startJob(jobs);
  showToast(intro, 6);
  saveGame({ cash: hero.cash, missionIndex: jobs.index, health: hero.health, ammo: hero.ammo });
}

function respawnAt(name) {
  const lm = city.landmarks[name];
  hero.x = lm.x + lm.w / 2;
  hero.y = lm.y + lm.h + 50;
  hero.health = 100;
  hero.ammo = 12;
  hero.inCar = null;
  resetPolice(police);
  state.cam.x = hero.x;
  state.cam.y = hero.y;
}

function enterCar() {
  if (hero.inCar) {
    const car = hero.inCar;
    hero.inCar = null;
    hero.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    hero.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    if (!city.solidAt(hero.x, hero.y, hero.r)) return;
    hero.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
    hero.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
    return;
  }
  const car = nearestCar([...cars, jobs.comet, jobs.van].filter(Boolean), hero.x, hero.y, 64);
  if (!car) return;
  hero.inCar = car;
  if (car.traffic) {
    car.traffic = false;
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    addWanted(police, 1);
    showToast('Car stolen! The cops are onto you.', 3);
  } else if (car.kind === 'van') {
    addWanted(police, 2);
    showToast('Bank van taken! Lose the cops!', 3);
  }
  sound.pickup();
}

function doPunch() {
  if (hero.punchTimer > 0 || hero.inCar) return;
  hero.punchTimer = 0.18;
  sound.punch();
  const hits = punchHit(hero, [...peds.filter((p) => p.state !== 'down'), ...police.cops]);
  for (const t of hits) {
    if (t.hp !== undefined) {
      t.hp -= 1;
      if (t.hp <= 0) {
        t._dead = true;
        addWanted(police, 1);
      }
    } else {
      t.state = 'down';
      t.wait = 4;
      addWanted(police, 1);
    }
  }
  police.cops = police.cops.filter((c) => !c._dead);
}

function doShoot() {
  if (hero.inCar) return;
  const rect = canvas.getBoundingClientRect();
  const mx = input.mouse.x * (canvas.width / rect.width);
  const my = input.mouse.y * (canvas.height / rect.height);
  const angle = aimAngle(hero, state.cam, { x: mx, y: my }, canvas.width, canvas.height);
  if (hero.ammo <= 0) { showToast('Out of ammo — finish a job to restock.', 3); return; }
  if (!shoot(weapons, hero, angle)) return;
  sound.shoot();
  state.gunfire = { x: hero.x, y: hero.y };
  hero.angle = angle;
}

function update(dt) {
  state.time += dt;
  if (hero.hurtTimer > 0) hero.hurtTimer -= dt;
  if (hero.punchTimer > 0) hero.punchTimer -= dt;

  if (input.wasPressed('p') || input.wasPressed('escape')) {
    state.mode = 'paused';
    el('pauseScreen').classList.remove('hidden');
    return;
  }
  if (input.wasPressed('m')) {
    const muted = sound.toggleMute();
    showToast(muted ? 'Sound muted.' : 'Sound on.', 2);
  }
  if (input.wasPressed('e')) enterCar();
  if (input.wasPressed('f')) doPunch();
  if (input.wasPressed('g') || input.mouse.clicked) doShoot();

  if (hero.inCar) {
    driveCar(hero.inCar, input, dt);
    moveCarWithCollision(city, hero.inCar, dt);
    hero.x = hero.inCar.x;
    hero.y = hero.inCar.y;
    carHitsPeds(hero.inCar, peds, () => {
      addWanted(police, 1);
      sound.crash();
      showToast('You hit a pedestrian! Wanted up.', 3);
    });
  } else {
    moveHero(hero, city, input, dt);
  }

  updateTraffic(city, cars, dt);
  updatePeds(city, peds, hero, state.gunfire, dt);
  state.gunfire = null;
  updatePolice(city, police, hero, dt);
  sound.siren(police.wanted > 0);

  const hits = updateBullets(weapons, city, [
    ...peds.filter((p) => p.state !== 'down'),
    ...police.cops,
    ...cars,
  ], dt);
  for (const t of hits) {
    if (t.hp !== undefined) {
      t.hp -= 1;
      if (t.hp <= 0) { t._dead = true; addWanted(police, 1); }
    } else if (t.state !== undefined) {
      t.state = 'down';
      t.wait = 4;
      addWanted(police, 1);
      showToast('You shot a pedestrian! Wanted up.', 3);
    } else {
      t._dead = true;
      t.speed = 0;
      addWanted(police, 1);
    }
  }
  police.cops = police.cops.filter((c) => !c._dead);
  for (let i = cars.length - 1; i >= 0; i--) {
    if (cars[i]._dead) cars.splice(i, 1);
  }

  // Cops touching Marco on foot hurt him.
  if (!hero.inCar) {
    for (const cop of police.cops) {
      if (Math.hypot(cop.x - hero.x, cop.y - hero.y) < 40) {
        if (damageHero(hero, 12)) sound.punch();
      }
    }
  }
  if (police.bustTimer > 1.5) {
    state.mode = 'busted';
    sound.busted();
    sound.siren(false);
    hero.cash = Math.floor(hero.cash / 2);
    el('bustedScreen').classList.remove('hidden');
    return;
  }
  if (hero.health <= 0) {
    state.mode = 'wasted';
    sound.busted();
    sound.siren(false);
    hero.cash = Math.max(0, hero.cash - 200);
    el('wastedScreen').classList.remove('hidden');
    return;
  }

  updateJobs(jobs, hero,
    (text) => { showToast(text, 5); sound.mission(); },
    (job) => {
      showToast(`Job complete: ${job.name} +$${job.pay}`, 5);
      sound.cash();
      hero.ammo = 12;
      saveGame({ cash: hero.cash, missionIndex: jobs.index, health: hero.health, ammo: hero.ammo });
      if (jobs.done) {
        state.mode = 'ended';
        el('endText').textContent = `All four jobs done. You banked $${hero.cash} and Rosa owns the city now — with you at the wheel.`;
        el('endScreen').classList.remove('hidden');
      }
    });

  const px = hero.inCar ? hero.inCar.x : hero.x;
  const py = hero.inCar ? hero.inCar.y : hero.y;
  state.cam.x += (Math.max(640, Math.min(city.w - 640, px)) - state.cam.x) * Math.min(1, dt * 5);
  state.cam.y += (Math.max(360, Math.min(city.h - 360, py)) - state.cam.y) * Math.min(1, dt * 5);
}

function render() {
  const view = { cam: state.cam, vw: canvas.width, vh: canvas.height };
  drawWorld(ctx, city, view, state.time);
  drawEntities(ctx, city, state, state.time);
  drawMinimap(mctx, city, state);
  el('cash').textContent = `$${hero.cash}`;
  el('healthFill').style.width = `${Math.max(0, hero.health)}%`;
  el('stars').textContent = '★'.repeat(police.wanted) + '☆'.repeat(5 - police.wanted);
  el('objective').textContent = currentJobText(jobs);
  if (state.time > state.toastUntil) el('toast').textContent = '';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === 'playing') update(dt);
  else state.time += dt;
  render();
  input.endFrame();
  requestAnimationFrame(frame);
}

el('startBtn').addEventListener('click', startGame);
el('resumeBtn').addEventListener('click', () => {
  el('pauseScreen').classList.add('hidden');
  state.mode = 'playing';
});
el('bustedBtn').addEventListener('click', () => {
  el('bustedScreen').classList.add('hidden');
  respawnAt("Rosa's Garage");
  state.mode = 'playing';
});
el('wastedBtn').addEventListener('click', () => {
  el('wastedScreen').classList.add('hidden');
  respawnAt('St. Marina Hospital');
  state.mode = 'playing';
});
el('endBtn').addEventListener('click', () => {
  el('endScreen').classList.add('hidden');
  state.mode = 'playing';
});

window.__solmar = {
  state, hero, city, police, jobs, cars, peds, weapons,
  version: 'rebuild-1',
  start: startGame,
  teleport(x, y) {
    if (hero.inCar) { hero.inCar.x = x; hero.inCar.y = y; }
    hero.x = x; hero.y = y;
    state.cam.x = x; state.cam.y = y;
  },
  setWanted(n) { police.wanted = n; },
  setMode(m) { state.mode = m; },
};
requestAnimationFrame(frame);
