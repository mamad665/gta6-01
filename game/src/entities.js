// entities.js — player, cars, pedestrians and police.
// All movement is plain arcade physics; nothing here is a library.

import { WORLD, PLAYER, CAR, TRAFFIC, PEDS, COLORS } from './config.js';
import { clamp, dist, angleTo, angleLerp } from './random.js';
import { nearestRoadPoint, nearestIntersection, collideBuildings } from './world.js';
import { makeRng } from './random.js';

let nextCarId = 1;
let nextPedId = 1;

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    health: PLAYER.health,
    cash: 0,
    ammo: 24,
    inCar: null, // car object when driving
    onFoot: true,
    punchCooldown: 0,
    shootCooldown: 0,
    invuln: 0,
  };
}

export function makeCar(x, y, angle, opts) {
  const o = opts || {};
  return {
    id: nextCarId++,
    x, y,
    angle: angle || 0,
    speed: 0,
    color: o.color || '#d63a2f',
    kind: o.kind || 'sedan', // sedan | sport | taxi | truck | police | van
    isPolice: !!o.isPolice,
    isTaxi: !!o.isTaxi,
    isPlayerOwned: !!o.isPlayerOwned,
    isTarget: !!o.isTarget,
    health: 100,
    driver: o.driver || null, // 'traffic' | 'player' | 'police' | null (parked)
    target: null, // {x, y} waypoint for traffic / police chase target
    cruise: o.cruise || 110,
    stuck: 0,
    sirenPhase: Math.random() * 2,
    smoke: 0,
  };
}

export function makePed(x, y, rng) {
  return {
    id: nextPedId++,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(PEDS.speedMin, PEDS.speedMax),
    shirt: rng.pick(COLORS.pedShirt),
    skin: rng.pick(COLORS.pedSkin),
    dir: rng.range(0, Math.PI * 2),
    dirTimer: rng.range(2, 6),
    down: 0, // knocked-down timer
    flee: 0,
    wanderSeed: rng.range(0, 1000),
  };
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = nearestRoadPoint(city, rng.range(200, WORLD.width - 200), rng.range(200, WORLD.beachY - 200), rng);
    const angle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const kind = rng.chance(0.1) ? 'taxi' : rng.chance(0.12) ? 'truck' : 'sedan';
    const car = makeCar(p.x, p.y, angle, {
      color: kind === 'taxi' ? COLORS.taxiPaint : rng.pick(COLORS.carPaint),
      kind,
      driver: 'traffic',
      cruise: rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax),
    });
    const inter = nearestIntersection(city, p.x, p.y);
    car.target = pickNextIntersection(city, inter.x, inter.y, rng);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = nearestRoadPoint(city, rng.range(200, WORLD.width - 200), rng.range(200, WORLD.beachY - 200), rng);
    // Park along the road edge.
    const along = rng.chance(0.5);
    const off = rng.pick([-52, 52]);
    const x = along ? p.x + off : p.x;
    const y = along ? p.y : p.y + off;
    const angle = along ? 0 : Math.PI / 2;
    cars.push(makeCar(x, y, angle, {
      color: rng.pick(COLORS.carPaint),
      kind: rng.chance(0.2) ? 'sport' : 'sedan',
      driver: null,
    }));
  }
  return cars;
}

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = nearestRoadPoint(city, rng.range(200, WORLD.width - 200), rng.range(200, WORLD.beachY - 200), rng);
    peds.push(makePed(p.x + rng.range(-40, 40), p.y + rng.range(-40, 40), rng));
  }
  return peds;
}

export function pickNextIntersection(city, x, y, rng) {
  const options = [];
  const { xs, ys } = city;
  const ix = xs.indexOf(x);
  const iy = ys.indexOf(y);
  if (ix > 0) options.push({ x: xs[ix - 1], y });
  if (ix < xs.length - 1) options.push({ x: xs[ix + 1], y });
  if (iy > 0) options.push({ x, y: ys[iy - 1] });
  if (iy < ys.length - 1) options.push({ x, y: ys[iy + 1] });
  if (options.length === 0) return { x, y };
  return rng.pick(options);
}

// --- updates ---

export function updatePlayerOnFoot(game, dt) {
  const p = game.player;
  const input = game.input;
  const mv = input.moveVector();
  const running = input.down('shift');
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.x += mv.x * speed * dt;
  p.y += mv.y * speed * dt;
  if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
  const fixed = collideBuildings(game.city, p.x, p.y, PLAYER.radius);
  p.x = fixed.x;
  p.y = fixed.y;
  p.x = clamp(p.x, 20, WORLD.width - 20);
  p.y = clamp(p.y, 20, WORLD.height - 20);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
}

export function updatePlayerCar(game, dt) {
  const car = game.player.inCar;
  const input = game.input;
  const forward = input.down('w', 'arrowup');
  const back = input.down('s', 'arrowdown');
  const left = input.down('a', 'arrowleft');
  const right = input.down('d', 'arrowright');

  if (forward) car.speed += CAR.accel * dt;
  if (back) {
    if (car.speed > 10) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  }
  if (!forward && !back) {
    car.speed -= car.speed * CAR.drag * dt * 2;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CAR.turnRate * dt * dir * clamp(Math.abs(car.speed) / 120, 0.25, 1);

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(game.city, car.x, car.y, 20);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    // Hit a building: scrape off speed and play a thud.
    if (Math.abs(car.speed) > 120) {
      game.sound.crash();
      car.health -= 6;
      car.speed *= 0.4;
    } else {
      car.speed *= 0.7;
    }
  }
  car.x = fixed.x;
  car.y = fixed.y;
  car.x = clamp(car.x, 20, WORLD.width - 20);
  car.y = clamp(car.y, 20, WORLD.height - 20);

  // Keep the player glued to the car.
  game.player.x = car.x;
  game.player.y = car.y;
  game.player.angle = car.angle;
  game.player.punchCooldown = Math.max(0, game.player.punchCooldown - dt);
  game.player.shootCooldown = Math.max(0, game.player.shootCooldown - dt);
  game.player.invuln = Math.max(0, game.player.invuln - dt);

  if (car.health <= 0) {
    // Car blows out: player ends up on foot next to the wreck.
    car.health = 0;
    car.driver = null;
    car.smoke = 1;
    game.player.inCar = null;
    game.player.onFoot = true;
    game.player.x = car.x + 40;
    game.player.y = car.y + 40;
    game.addWanted(1, 'car destroyed');
    game.sound.crash();
    game.toast('Your car is wrecked!');
  }
}

export function updateTrafficCar(game, car, dt) {
  if (!car.target) return;
  const tx = car.target.x;
  const ty = car.target.y;
  const d = dist(car.x, car.y, tx, ty);
  const wantAngle = angleTo(car.x, car.y, tx, ty);
  car.angle = angleLerp(car.angle, wantAngle, Math.min(1, dt * 4));
  const slow = d < 120 ? 0.45 : 1;
  car.speed = car.cruise * slow;

  // Don't rear-end the car ahead: slow down if something is close in front.
  for (const other of game.cars) {
    if (other === car || other.speed === 0 && other.driver === null) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((other.x - car.x) * Math.sin(car.angle) - (other.y - car.y) * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 26) {
      car.speed = Math.min(car.speed, other.speed * 0.8);
    }
  }

  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (d < 26) {
    const inter = nearestIntersection(game.city, tx, ty);
    car.target = pickNextIntersection(game.city, inter.x, inter.y, game.rng);
  }
}

export function updatePoliceCar(game, car, dt) {
  const p = game.player;
  const d = dist(car.x, car.y, p.x, p.y);
  const wantAngle = angleTo(car.x, car.y, p.x, p.y);
  // Police steer toward the player, with a little wobble so they look alive.
  car.angle = angleLerp(car.angle, wantAngle + Math.sin(game.time * 2 + car.id) * 0.12, Math.min(1, dt * 3.2));
  const targetSpeed = d > 260 ? 430 : d > 90 ? 380 : 300;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = collideBuildings(game.city, car.x, car.y, 20);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    // Stuck on a building: back up a little and re-aim.
    car.stuck += dt;
    car.x = fixed.x;
    car.y = fixed.y;
    if (car.stuck > 0.6) {
      car.angle += Math.PI * 0.7;
      car.stuck = 0;
    }
    car.speed *= 0.6;
  } else {
    car.stuck = 0;
  }

  // Ramming the player.
  if (d < 34) {
    if (p.onFoot) {
      if (p.invuln <= 0) {
        p.health -= 12;
        p.invuln = 0.8;
        game.sound.crash();
        if (p.health <= 0) game.wasted();
      }
    } else if (p.inCar) {
      p.inCar.health -= 8 * dt * 10;
      p.inCar.speed *= 0.94;
      if (Math.abs(p.inCar.speed) > 60) game.sound.crash();
    }
  }

  // At 3+ stars the police shoot from the car.
  if (game.wanted >= 3 && d < 420 && p.invuln <= 0) {
    game.policeShotTimer -= dt;
    if (game.policeShotTimer <= 0) {
      game.policeShotTimer = 0.9;
      p.health -= 5;
      p.invuln = 0.3;
      game.sound.gunshot();
      if (p.health <= 0) game.wasted();
    }
  }
}

export function updatePed(game, ped, dt) {
  if (ped.down > 0) {
    ped.down -= dt;
    return;
  }
  ped.dirTimer -= dt;
  if (ped.dirTimer <= 0) {
    ped.dirTimer = game.rng.range(2, 6);
    ped.dir += game.rng.range(-1.2, 1.2);
  }
  if (ped.flee > 0) {
    ped.flee -= dt;
    const a = angleTo(game.player.x, game.player.y, ped.x, ped.y);
    ped.x += Math.cos(a) * ped.speed * 2.1 * dt;
    ped.y += Math.sin(a) * ped.speed * 2.1 * dt;
  } else {
    ped.x += Math.cos(ped.dir) * ped.speed * dt;
    ped.y += Math.sin(ped.dir) * ped.speed * dt;
  }
  const fixed = collideBuildings(game.city, ped.x, ped.y, 8);
  if (fixed.x !== ped.x || fixed.y !== ped.y) {
    ped.dir += Math.PI * 0.6;
    ped.x = fixed.x;
    ped.y = fixed.y;
  }
  ped.x = clamp(ped.x, 20, WORLD.width - 20);
  ped.y = clamp(ped.y, 20, WORLD.height - 20);
  ped.angle = ped.flee > 0 ? angleTo(game.player.x, game.player.y, ped.x, ped.y) : ped.dir;
}
