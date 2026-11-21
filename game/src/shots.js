// shots.js — deterministic scene presets for screenshots (?shot=<name>).
// Each preset drops the player into a moment that shows a different system:
// the title, the street on foot, a police chase, and a mission in progress.

import { WORLD } from './config.js';
import { makeCar, makePed, spawnPeds } from './entities.js';
import { nearestRoadPoint } from './world.js';

export function applyShot(game, name) {
  const rng = game.rng;
  const p = game.player;

  if (name === 'start') {
    game.state = 'title';
    return;
  }

  game.state = 'playing';

  if (name === 'street') {
    // On foot at a busy downtown intersection: traffic, pedestrians, shops.
    p.x = 1050;
    p.y = 750;
    p.angle = Math.PI / 4;
    game.missions.startMission(0);
    // Crowd the frame: extra pedestrians and traffic near the player.
    for (let i = 0; i < 10; i++) {
      const ped = makePed(p.x + rng.range(-260, 260), p.y + rng.range(-180, 180), rng);
      game.peds.push(ped);
    }
    for (let i = 0; i < 4; i++) {
      const pt = nearestRoadPoint(game.city, p.x + rng.range(-300, 300), p.y + rng.range(-200, 200), rng);
      const car = makeCar(pt.x, pt.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), {
        color: ['#d63a2f', '#2f6fd6', '#e8b62a', '#3fae5a'][i % 4],
        kind: 'sedan',
        driver: 'traffic',
        cruise: 110,
      });
      car.target = { x: pt.x + 300, y: pt.y };
      game.cars.push(car);
    }
    return;
  }

  if (name === 'chase') {
    // Driving down the main avenue at speed, three stars, PD in pursuit.
    // Clear the stretch ahead so the chase reads at a glance.
    game.cars = game.cars.filter((c) => {
      const d = Math.hypot(c.x - 1350, c.y - 750);
      return d > 520 || c.driver === null;
    });
    const car = makeCar(1350, 750, 0, {
      color: '#d63a2f',
      kind: 'sport',
      driver: 'player',
      isPlayerOwned: true,
    });
    car.speed = 380;
    game.cars.push(car);
    p.inCar = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    game.wanted = 3;
    game.timeSinceCrime = 0;
    game.missions.startMission(0);
    // Three police cars closing in from behind.
    const spots = [
      { x: 1030, y: 725 },
      { x: 980, y: 775 },
      { x: 1080, y: 700 },
    ];
    for (const s of spots) {
      const pc = makeCar(s.x, s.y, 0, { color: '#1d4ed8', kind: 'sedan', isPolice: true, driver: 'police' });
      pc.speed = 400;
      game.cars.push(pc);
      game.police.push(pc);
    }
    return;
  }

  if (name === 'mission') {
    // Job 2: the yellow Comet GT by Sunset Mall, marker overhead, on foot.
    game.missions.startMission(1);
    const lm = game.city.landmarks.mall;
    p.x = lm.x + 40;
    p.y = lm.y + 150;
    p.angle = -Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const ped = makePed(p.x + rng.range(-220, 220), p.y + rng.range(-160, 160), rng);
      game.peds.push(ped);
    }
    return;
  }

  // Unknown shot name: just play from the garage.
  p.x = game.city.landmarks.garage.x;
  p.y = game.city.landmarks.garage.y + 90;
}
