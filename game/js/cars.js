// Cars: traffic that follows the road grid, plus Marco's driving.

import { mulberry32 } from './city.js';

const TRAFFIC_COLORS = ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2ecc71', '#e67e22', '#9b59b6', '#7f8c8d'];
const SPORT_COLORS = ['#ffd23e', '#ff5a5a', '#39c5ff'];

export function makeCar(x, y, angle, color, kind) {
  return { x, y, angle, color, kind: kind || 'sedan', speed: 0, maxSpeed: 300 + Math.random() * 60, len: 44, wid: 20, traffic: false, dir: 1, targetSpeed: 0 };
}

export function spawnTraffic(city, count) {
  const rand = mulberry32(777);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = city.randomRoadPoint();
    const angle = p.axis === 'h' ? (rand() < 0.5 ? 0 : Math.PI) : (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const c = makeCar(p.x, p.y, angle, TRAFFIC_COLORS[Math.floor(rand() * TRAFFIC_COLORS.length)], 'sedan');
    c.traffic = true;
    c.targetSpeed = 110 + rand() * 90;
    c.speed = c.targetSpeed;
    cars.push(c);
  }
  return cars;
}

function carAhead(car, cars, dist) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  for (const o of cars) {
    if (o === car) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(-dx * fy + dy * fx);
    if (along > 0 && along < dist && side < 26) return true;
  }
  return false;
}

export function updateTraffic(city, cars, dt) {
  for (const c of cars) {
    if (!c.traffic) continue;
    const want = carAhead(c, cars, 70) ? 0 : c.targetSpeed;
    c.speed += (want - c.speed) * Math.min(1, dt * 2);
    let nx = c.x + Math.cos(c.angle) * c.speed * dt;
    let ny = c.y + Math.sin(c.angle) * c.speed * dt;
    // At an intersection, sometimes turn onto a crossing road.
    const road = city.pointOnRoad(nx, ny);
    if (!road) {
      // reached the end of the road: turn around at the block edge
      c.angle += Math.PI;
      nx = c.x; ny = c.y;
    } else if (Math.abs(Math.sin(c.angle)) < 0.01 || Math.abs(Math.cos(c.angle)) < 0.01) {
      // axis-aligned: check if we are centered on a crossing road
      const cross = city.pointOnRoad(nx, ny);
      if (cross && cross.axis !== road.axis && Math.random() < dt * 0.25) {
        c.angle = cross.axis === 'h' ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
    if (!city.solidAt(nx, ny, 12)) { c.x = nx; c.y = ny; }
    c.x = Math.max(20, Math.min(city.w - 20, c.x));
    c.y = Math.max(20, Math.min(city.h - 20, c.y));
  }
}

// Player driving: arcade handling with acceleration, braking, steering.
export function driveCar(car, input, dt) {
  const a = input.axis();
  const forward = -a.y; // W accelerates
  const steer = a.x;
  if (forward > 0) car.speed += 420 * dt;
  else if (forward < 0) car.speed -= 520 * dt;
  else car.speed -= Math.sign(car.speed) * 140 * dt;
  if (Math.abs(car.speed) < 8 && forward === 0) car.speed = 0;
  car.speed = Math.max(-140, Math.min(car.maxSpeed, car.speed));
  if (Math.abs(car.speed) > 20) {
    car.angle += steer * 2.4 * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 160);
  }
  return car.speed;
}

export function moveCarWithCollision(city, car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!city.solidAt(nx, car.y, 14)) car.x = nx; else car.speed *= 0.4;
  if (!city.solidAt(car.x, ny, 14)) car.y = ny; else car.speed *= 0.4;
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function spawnParkedCar(city, nearX, nearY, color) {
  const p = city.nearestRoadPoint(nearX, nearY);
  const angle = p.axis === 'h' ? 0 : Math.PI / 2;
  const c = makeCar(p.x, p.y, angle, color || SPORT_COLORS[0], 'sport');
  c.maxSpeed = 520;
  return c;
}
