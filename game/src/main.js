// main.js — Solmar City entrypoint: game loop, state machine, wanted level,
// police spawning, entering / stealing cars, save & load.

import { WORLD, PLAYER, SAVE_KEY } from './config.js';
import { makeRng, clamp, dist } from './random.js';
import { buildCity, nearestRoadPoint, nearestIntersection } from './world.js';
import {
  makePlayer, makeCar, makePed, spawnTraffic, spawnParked, spawnPeds,
  updatePlayerOnFoot, updatePlayerCar, updateTrafficCar, updatePoliceCar, updatePed,
} from './entities.js';
import { fireBullet, punch, updateBullets } from './combat.js';
import { MissionManager } from './missions.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');

export class Game {
  constructor(seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.city = buildCity(seed);
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.renderer = new Renderer(canvas);
    this.missions = new MissionManager(this);
    this.state = 'title'; // title | playing | paused | busted | wasted | storyEnd
    this.time = 0;
    this.wanted = 0;
    this.timeSinceCrime = 999;
    this.lastWantedGain = -10;
    this.decayTimer = 0;
    this.bustedTimer = 0;
    this.policeShotTimer = 0;
    this.autosaveTimer = 0;
    this.toastText = '';
    this.toastTimer = 0;
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.hasSave = false;
    this.saveCash = 0;

    const g = this.city.landmarks.garage;
    this.player = makePlayer(g.x, g.y + 90);
    this.cars = [];
    this.peds = [];
    this.police = [];
    this.bullets = [];
    this.pickups = [];

    // Traffic, parked cars and pedestrians fill the city.
    this.cars.push(...spawnTraffic(this.city, this.rng, 16));
    this.cars.push(...spawnParked(this.city, this.rng, 10));
    this.peds.push(...spawnPeds(this.city, this.rng, 26));
    // A starter car for Marco, parked by the garage.
    const starter = makeCar(g.x + 60, g.y + 90, 0, {
      color: '#3fae5a', kind: 'sedan', driver: null, isPlayerOwned: true,
    });
    this.cars.push(starter);

    // Pickups: health at the hospital, ammo at the garage and the docks.
    const h = this.city.landmarks.hospital;
    const d = this.city.landmarks.docks;
    this.pickups.push(
      { x: h.x - 130, y: h.y, kind: 'health', taken: false },
      { x: h.x + 130, y: h.y, kind: 'health', taken: false },
      { x: g.x - 120, y: g.y + 60, kind: 'ammo', taken: false },
      { x: d.x, y: d.y + 120, kind: 'ammo', taken: false },
    );

    this.loadSaveMeta();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.__game = this;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h);
    this.camera.zoom = Math.max(0.6, Math.min(w / 1280, h / 720));
  }

  // --- save / load ---

  loadSaveMeta() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.hasSave = true;
      this.saveCash = s.cash || 0;
      this.savedState = s;
    } catch (e) {
      this.hasSave = false;
    }
  }

  save() {
    try {
      const p = this.player;
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: p.cash,
        health: p.health,
        ammo: p.ammo,
        x: p.x,
        y: p.y,
        missionIndex: this.missions.index,
        missionStep: this.missions.step,
        done: this.missions.done,
      }));
      this.hasSave = true;
      this.saveCash = p.cash;
    } catch (e) {}
  }

  loadSave() {
    const s = this.savedState;
    if (!s) return;
    const p = this.player;
    p.cash = s.cash || 0;
    p.health = s.health || 100;
    p.ammo = s.ammo || 24;
    p.x = s.x || p.x;
    p.y = s.y || p.y;
    this.missions.index = Math.min(s.missionIndex || 0, 3);
    this.missions.step = s.missionStep || 0;
    this.missions.done = !!s.done;
    if (!this.missions.done && this.missions.current()) {
      if (this.missions.current().id === 'hot-wheels') this.missions.spawnSportCar();
      if (this.missions.current().id === 'bank-van') this.missions.spawnBankVan();
    }
  }

  clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    this.hasSave = false;
    this.saveCash = 0;
    this.savedState = null;
  }

  // --- helpers used by entities / combat / missions ---

  toast(msg, seconds) {
    // Keep toasts short so they never cover the HUD: one line, max 80 chars.
    const text = msg.length > 80 ? msg.slice(0, 77) + '...' : msg;
    this.toastText = text;
    this.toastTimer = seconds || 4;
  }

  addWanted(n, reason) {
    if (this.wanted >= 5) return;
    const now = this.time;
    const big = reason === 'grand theft auto' || reason === 'car destroyed';
    if (!big && now - this.lastWantedGain < 2.0) return;
    this.lastWantedGain = now;
    this.timeSinceCrime = 0;
    this.wanted = Math.min(5, this.wanted + n);
    this.sound.wantedUp();
  }

  storyComplete() {
    this.state = 'storyEnd';
    this.save();
  }

  busted() {
    this.state = 'busted';
    const lost = Math.floor(this.player.cash * 0.2);
    this.player.cash -= lost;
    this.wanted = 0;
    this.removePolice();
    this.player.health = 100;
    this.toast('Busted! Lost $' + lost, 4);
    this.save();
  }

  wasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    const lost = Math.floor(this.player.cash * 0.1);
    this.player.cash -= lost;
    this.wanted = 0;
    this.removePolice();
    this.toast('Wasted! Lost $' + lost, 4);
    this.save();
  }

  removePolice() {
    this.cars = this.cars.filter((c) => !c.isPolice);
    this.police = [];
  }

  // --- entering / stealing cars ---

  nearestCar(maxD) {
    const p = this.player;
    let best = null;
    let bestD = maxD;
    for (const car of this.cars) {
      if (car.isPolice && car.driver === 'police') continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  tryEnterCar() {
    const p = this.player;
    if (!p.onFoot) {
      // Get out of the car.
      const car = p.inCar;
      car.speed = 0;
      car.driver = null;
      p.inCar = null;
      p.onFoot = true;
      p.x = car.x + 42;
      p.y = car.y + 42;
      this.sound.stopEngine();
      return;
    }
    const car = this.nearestCar(78);
    if (!car) return;
    if (car.driver === 'traffic') {
      // Steal it: the driver bails out and runs.
      const ped = makePed(car.x + 30, car.y + 30, this.rng);
      ped.flee = 8;
      this.peds.push(ped);
      car.driver = 'player';
      this.addWanted(1, 'grand theft auto');
      this.toast('Car stolen! The PD is on its way.', 3);
    } else if (car.isPolice) {
      car.driver = 'player';
      this.addWanted(2, 'grand theft auto');
      this.toast('You stole a police cruiser!', 3);
    } else {
      car.driver = 'player';
    }
    p.inCar = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    this.sound.startEngine(true);
  }

  // --- police ---

  desiredPolice() {
    if (this.wanted <= 0) return 0;
    return Math.min(1 + this.wanted, 5);
  }

  spawnPolice() {
    const p = this.player;
    const pt = nearestRoadPoint(this.city, p.x + this.rng.range(-700, 700), p.y + this.rng.range(-700, 700), this.rng);
    const d = dist(pt.x, pt.y, p.x, p.y);
    if (d < 420) return; // too close: don't pop in on top of the player
    const car = makeCar(pt.x, pt.y, 0, {
      color: '#1d4ed8', kind: 'sedan', isPolice: true, driver: 'police',
    });
    this.cars.push(car);
    this.police.push(car);
  }

  updatePolice(dt) {
    const want = this.desiredPolice();
    while (this.police.length < want) this.spawnPolice();
    if (this.wanted <= 0) {
      // Cops drive off once the heat is gone.
      for (let i = this.police.length - 1; i >= 0; i--) {
        const car = this.police[i];
        if (dist(car.x, car.y, this.player.x, this.player.y) > 700) {
          this.cars.splice(this.cars.indexOf(car), 1);
          this.police.splice(i, 1);
        }
      }
    }
    for (const car of this.police) updatePoliceCar(this, car, dt);
  }

  // --- main update ---

  update(dt) {
    this.time += dt;
    if (this.toastTimer > 0) this.toastTimer -= dt;

    if (this.state === 'title') {
      // Let traffic drift behind the title screen.
      for (const car of this.cars) {
        if (car.driver === 'traffic') updateTrafficCar(this, car, dt);
      }
      for (const ped of this.peds) updatePed(this, ped, dt);
      this.updateCamera(dt);
      return;
    }
    if (this.state !== 'playing') return;

    const input = this.input;
    const p = this.player;

    // Global keys.
    if (input.wasPressed('m')) this.sound.toggleMute();

    // On foot or driving.
    if (p.onFoot) {
      updatePlayerOnFoot(this, dt);
      if (input.wasPressed('e')) this.tryEnterCar();
      if (input.wasPressed('f')) punch(this);
      if (input.mouse.clicked) fireBullet(this);
    } else {
      updatePlayerCar(this, dt);
      if (input.wasPressed('e')) this.tryEnterCar();
      if (input.down(' ')) {
        p.inCar.speed *= Math.max(0, 1 - 3.5 * dt);
      }
    }

    // Traffic + pedestrians + police.
    for (const car of this.cars) {
      if (car.driver === 'traffic') updateTrafficCar(this, car, dt);
    }
    for (const ped of this.peds) updatePed(this, ped, dt);
    this.updatePolice(dt);
    updateBullets(this, dt);
    this.missions.update(dt);

    // Collisions: player car vs other cars.
    if (!p.onFoot && p.inCar) {
      for (const car of this.cars) {
        if (car === p.inCar) continue;
        const d = dist(p.inCar.x, p.inCar.y, car.x, car.y);
        if (d < 46 && d > 0.01) {
          const push = (46 - d) / 2;
          const nx = (car.x - p.inCar.x) / d;
          const ny = (car.y - p.inCar.y) / d;
          car.x += nx * push;
          car.y += ny * push;
          p.inCar.x -= nx * push;
          p.inCar.y -= ny * push;
          if (Math.abs(p.inCar.speed) > 140) {
            this.sound.crash();
            p.inCar.health -= 4;
            car.health -= 4;
            p.inCar.speed *= 0.6;
            if (car.isPolice) this.addWanted(1, 'ramming police');
          }
          if (car.health <= 0 && car.driver !== 'player') {
            car.health = 0;
            car.driver = null;
            car.smoke = 1;
            if (car.isTarget) this.missions.onTargetCarDisabled();
          }
        }
      }
      // Running over pedestrians.
      for (const ped of this.peds) {
        if (ped.down > 0) continue;
        if (dist(p.inCar.x, p.inCar.y, ped.x, ped.y) < 30 && Math.abs(p.inCar.speed) > 60) {
          ped.down = 5;
          ped.flee = 8;
          this.addWanted(1, 'hit and run');
          this.sound.crash();
        }
      }
    }

    // Pickups.
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (dist(p.x, p.y, pk.x, pk.y) < 30) {
        pk.taken = true;
        if (pk.kind === 'health') {
          p.health = Math.min(100, p.health + 50);
          this.toast('Health +50', 2);
        } else {
          p.ammo += 24;
          this.toast('Ammo +24', 2);
        }
        this.sound.pickup();
      }
    }

    // Wanted decay: lay low and the heat fades.
    this.timeSinceCrime += dt;
    let policeNear = false;
    for (const car of this.police) {
      if (dist(car.x, car.y, p.x, p.y) < 450) {
        policeNear = true;
        break;
      }
    }
    if (this.wanted > 0 && this.timeSinceCrime > 25 && !policeNear) {
      this.decayTimer += dt;
      if (this.decayTimer > 8) {
        this.decayTimer = 0;
        this.wanted -= 1;
        if (this.wanted === 0) this.removePolice();
      }
    } else {
      this.decayTimer = 0;
    }

    // Busted: a cop catches you on foot.
    if (p.onFoot && this.wanted > 0) {
      let near = false;
      for (const car of this.police) {
        if (dist(car.x, car.y, p.x, p.y) < 48) {
          near = true;
          break;
        }
      }
      this.bustedTimer = near ? this.bustedTimer + dt : 0;
      if (this.bustedTimer > 1.0) this.busted();
    } else {
      this.bustedTimer = 0;
    }

    // Engine + siren audio follow the action.
    if (!p.onFoot && p.inCar) {
      this.sound.startEngine(true);
      this.sound.setEngine(Math.abs(p.inCar.speed) / 460);
    } else {
      this.sound.stopEngine();
    }
    this.sound.siren(this.police.length > 0, dt);

    // Autosave.
    this.autosaveTimer += dt;
    if (this.autosaveTimer > 30) {
      this.autosaveTimer = 0;
      this.save();
    }

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const cam = this.camera;
    const vw = this.renderer.canvas.width / cam.zoom;
    const vh = this.renderer.canvas.height / cam.zoom;
    const tx = this.player.x - vw / 2;
    const ty = this.player.y - vh / 2;
    const k = Math.min(1, dt * 5);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.x = clamp(cam.x, 0, Math.max(0, WORLD.width - vw));
    cam.y = clamp(cam.y, 0, Math.max(0, WORLD.height - vh));
  }

  handleMenus() {
    const input = this.input;
    if (this.state === 'playing' && input.wasPressed('p', 'escape')) {
      // Pause lives here (not in update) so one press can't pause-and-resume
      // in the same frame.
      this.state = 'paused';
      this.sound.stopEngine();
      return;
    }
    if (this.state === 'title' && input.wasPressed('enter')) {
      this.sound.ensure();
      if (this.hasSave && this.savedState) {
        this.loadSave();
      }
      this.state = 'playing';
      if (this.missions.index === 0 && this.missions.step === 0 && !this.missions.done) {
        this.missions.startMission(0);
      }
      const g = this.city.landmarks.garage;
      this.camera.x = this.player.x - 640;
      this.camera.y = this.player.y - 360;
    } else if (this.state === 'paused') {
      if (input.wasPressed('p', 'escape', 'enter')) {
        this.state = 'playing';
      } else if (input.wasPressed('s')) {
        this.save();
        this.state = 'title';
        this.sound.stopEngine();
      }
    } else if (this.state === 'busted' && input.wasPressed('enter')) {
      const g = this.city.landmarks.garage;
      this.player.x = g.x;
      this.player.y = g.y + 90;
      this.player.health = 100;
      this.state = 'playing';
    } else if (this.state === 'wasted' && input.wasPressed('enter')) {
      const h = this.city.landmarks.hospital;
      this.player.x = h.x;
      this.player.y = h.y + 90;
      this.player.health = 100;
      this.state = 'playing';
    } else if (this.state === 'storyEnd' && input.wasPressed('enter')) {
      this.state = 'playing';
    }
  }

  frame(dt) {
    this.handleMenus();
    this.update(dt);
    this.renderer.draw(this);
    this.input.endFrame();
  }
}

// --- boot ---

function boot() {
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || '7', 10) || 7;
  const shot = params.get('shot');
  const game = new Game(seed);
  if (shot) applyShot(game, shot);

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.frame(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

boot();
