// render.js — everything the player sees: the city, cars, people, HUD,
// minimap, and the title / pause / busted / wasted screens.

import { WORLD, PALETTE, STORY } from './config.js';
import { dist } from './random.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  draw(game) {
    const ctx = this.ctx;
    const cam = game.camera;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (game.state === 'title') {
      this.drawTitle(game);
      return;
    }

    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    this.drawWorld(game);
    this.drawMarker(game);
    this.drawCars(game);
    this.drawPeds(game);
    this.drawPlayer(game);
    this.drawBullets(game);
    this.drawCashPile(game);
    this.drawPickups(game);
    ctx.restore();

    this.drawHUD(game);
    if (game.state === 'paused') this.drawPause(game);
    if (game.state === 'busted') this.drawCenterCard(game, 'BUSTED!', 'The Solmar PD caught you. You lost 20% of your cash.', 'Press ENTER to keep playing');
    if (game.state === 'wasted') this.drawCenterCard(game, 'WASTED', 'Marco Vale is down. The city keeps moving without you.', 'Press ENTER to wake up at St. Marina Hospital');
    if (game.state === 'storyEnd') this.drawStoryEnd(game);
  }

  drawWorld(game) {
    const ctx = this.ctx;
    const city = game.city;
    const cam = game.camera;
    const vw = this.canvas.width / cam.zoom;
    const vh = this.canvas.height / cam.zoom;
    const x0 = cam.x - 40;
    const y0 = cam.y - 40;
    const x1 = cam.x + vw + 40;
    const y1 = cam.y + vh + 40;

    // Ground: grass, then sand and sea at the south edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (y1 > WORLD.beachY) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(x0, Math.max(y0, WORLD.beachY), x1 - x0, Math.min(y1, WORLD.waterY) - Math.max(y0, WORLD.beachY));
    }
    if (y1 > WORLD.waterY) {
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(x0, Math.max(y0, WORLD.waterY), x1 - x0, y1 - Math.max(y0, WORLD.waterY));
      ctx.fillStyle = PALETTE.waterDeep;
      for (let wx = 100; wx < WORLD.width; wx += 260) {
        const wy = WORLD.waterY + 60 + ((wx * 7) % 120);
        if (wy > y0 && wy < y1) {
          ctx.fillRect(wx, wy, 90, 3);
        }
      }
    }

    // Parks.
    for (const p of city.parks) {
      if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    // Roads: dark asphalt with center dashes, plus sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const cx of city.xs) ctx.fillRect(cx - WORLD.roadWidth / 2 - 8, y0, WORLD.roadWidth + 16, y1 - y0);
    for (const cy of city.ys) ctx.fillRect(x0, cy - WORLD.roadWidth / 2 - 8, x1 - x0, WORLD.roadWidth + 16);
    ctx.fillStyle = PALETTE.road;
    for (const cx of city.xs) ctx.fillRect(cx - WORLD.roadWidth / 2, y0, WORLD.roadWidth, y1 - y0);
    for (const cy of city.ys) ctx.fillRect(x0, cy - WORLD.roadWidth / 2, x1 - x0, WORLD.roadWidth);
    ctx.fillStyle = PALETTE.roadLine;
    for (const cx of city.xs) {
      for (let y = Math.floor(y0 / 46) * 46; y < y1; y += 46) {
        if (Math.abs(y - WORLD.beachY) < 40) continue;
        ctx.fillRect(cx - 2, y, 4, 24);
      }
    }
    for (const cy of city.ys) {
      for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) {
        ctx.fillRect(x, cy - 2, 24, 4);
      }
    }

    // Landmark buildings (bigger, labelled).
    for (const lm of Object.values(city.landmarks)) {
      if (lm.x + lm.w / 2 < x0 || lm.x - lm.w / 2 > x1 || lm.y + lm.h / 2 < y0 || lm.y - lm.h / 2 > y1) continue;
      ctx.fillStyle = '#2b2f38';
      ctx.fillRect(lm.x - lm.w / 2 - 4, lm.y - lm.h / 2 - 4, lm.w + 8, lm.h + 8);
      ctx.fillStyle = '#e8dcc8';
      ctx.fillRect(lm.x - lm.w / 2, lm.y - lm.h / 2, lm.w, lm.h);
      ctx.fillStyle = '#c96f4a';
      ctx.fillRect(lm.x - lm.w / 2, lm.y - lm.h / 2, lm.w, 14);
      ctx.fillStyle = '#222831';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lm.name, lm.x, lm.y + 4);
    }

    // Buildings: wall + roof + windows.
    for (const b of city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      ctx.fillStyle = '#00000033';
      ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if ((i * 7 + j * 13 + b.seed) % 3 === 0) {
            ctx.fillRect(b.x + 8 + i * 26, b.y + 8 + j * 26, 12, 10);
          }
        }
      }
    }

    // Trees.
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = t.palm ? '#7a5a34' : '#5a4632';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
      ctx.fillStyle = t.palm ? '#3f9e4d' : '#2e7d32';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 7, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMarker(game) {
    const ctx = this.ctx;
    const pos = game.missions.markerPos();
    if (!pos || game.state !== 'playing') return;
    const pulse = 1 + Math.sin(game.time * 4) * 0.12;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,0,0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(-9, -30);
    ctx.lineTo(9, -30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawCars(game) {
    const ctx = this.ctx;
    for (const car of game.cars) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      // Shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-24, -11, 48, 24);
      // Body.
      ctx.fillStyle = car.color;
      const len = car.kind === 'truck' || car.kind === 'van' ? 56 : 48;
      const wid = car.kind === 'truck' || car.kind === 'van' ? 26 : 22;
      ctx.fillRect(-len / 2, -wid / 2, len, wid);
      // Cabin + windshield.
      ctx.fillStyle = 'rgba(20,30,45,0.85)';
      ctx.fillRect(-6, -wid / 2 + 3, 14, wid - 6);
      // Headlights / taillights.
      ctx.fillStyle = '#fff8c0';
      ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 4);
      ctx.fillRect(len / 2 - 2, wid / 2 - 6, 3, 4);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-len / 2 - 1, -wid / 2 + 2, 3, 4);
      ctx.fillRect(-len / 2 - 1, wid / 2 - 6, 3, 4);
      if (car.kind === 'taxi') {
        ctx.fillStyle = '#111';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAXI', 0, 3);
      }
      if (car.isTarget) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('★ TARGET', 0, -wid / 2 - 8);
      }
      ctx.restore();

      // Police light bar (flashing).
      if (car.isPolice) {
        const phase = Math.floor(game.time * 4 + car.sirenPhase) % 2;
        ctx.fillStyle = phase === 0 ? '#ff2d2d' : '#2d6bff';
        ctx.beginPath();
        ctx.arc(car.x, car.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,45,45,0.15)';
        ctx.beginPath();
        ctx.arc(car.x, car.y, 26 + Math.sin(game.time * 6) * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      // Smoke when wrecked / damaged.
      if (car.health < 45 && car.health > 0) {
        ctx.fillStyle = 'rgba(80,80,80,0.5)';
        ctx.beginPath();
        ctx.arc(car.x - 10, car.y - 8, 6 + Math.sin(game.time * 5 + car.id) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (car.smoke > 0) {
        ctx.fillStyle = 'rgba(60,60,60,0.6)';
        ctx.beginPath();
        ctx.arc(car.x, car.y - 10, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawPeds(game) {
    const ctx = this.ctx;
    for (const ped of game.peds) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      if (ped.down > 0) {
        // Lying flat.
        ctx.rotate(ped.angle + Math.PI / 2);
        ctx.fillStyle = ped.shirt;
        ctx.fillRect(-11, -5, 22, 10);
        ctx.fillStyle = ped.skin;
        ctx.beginPath();
        ctx.arc(14, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.rotate(ped.angle);
        // Little walking person: body + head, feet shuffle.
        const step = Math.sin(game.time * 8 + ped.wanderSeed) * 3;
        ctx.fillStyle = '#222831';
        ctx.fillRect(-4, -6 + step, 4, 4);
        ctx.fillRect(-4, 2 - step, 4, 4);
        ctx.fillStyle = ped.shirt;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ped.skin;
        ctx.beginPath();
        ctx.arc(5, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawPlayer(game) {
    const ctx = this.ctx;
    const p = game.player;
    if (!p.onFoot) return; // inside the car already drawn
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const step = Math.sin(game.time * 10) * 3;
    ctx.fillStyle = '#222831';
    ctx.fillRect(-4, -7 + step, 4, 4);
    ctx.fillRect(-4, 3 - step, 4, 4);
    ctx.fillStyle = '#e8b62a'; // Marco's yellow jacket
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath();
    ctx.arc(6, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222831';
    ctx.beginPath();
    ctx.arc(8, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Direction tick so the player can see where Marco faces.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14);
    ctx.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
    ctx.stroke();
  }

  drawBullets(game) {
    const ctx = this.ctx;
    ctx.fillStyle = '#ffe14d';
    for (const b of game.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCashPile(game) {
    const ctx = this.ctx;
    const pile = game.missions.cashPile;
    if (!pile) return;
    const bob = Math.sin(game.time * 5) * 3;
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(pile.x - 12, pile.y - 8 + bob, 24, 16);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', pile.x, pile.y + 4 + bob);
  }

  drawPickups(game) {
    const ctx = this.ctx;
    for (const pk of game.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(game.time * 4 + pk.x) * 2;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-11, -11, 22, 22);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222831';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AMMO', 0, 4);
      }
      ctx.restore();
    }
  }

  drawHUD(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const p = game.player;

    // Top-left: cash + health.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, 12, 230, 64);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('$' + p.cash.toLocaleString('en-US'), 22, 40);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(22, 50, 150, 10);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(22, 50, 150 * Math.max(0, p.health / 100), 10);
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.fillText('HP ' + Math.max(0, Math.round(p.health)), 178, 59);
    if (!p.onFoot) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('SPEED ' + Math.round(Math.abs(p.inCar.speed) * 0.35) + ' mph', 22, 92 - 14 + 6);
    }

    // Top-center: wanted stars.
    const stars = game.wanted;
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    const starW = 30;
    const totalW = stars * starW + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W / 2 - totalW / 2 - 14, 12, totalW + 28, 44);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < stars ? '#ffd700' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', W / 2 - totalW / 2 + 12 + i * starW, 44);
    }

    // Top-right: minimap.
    this.drawMinimap(game, W - 216, 12, 204, 168);

    // Bottom-center: objective.
    const obj = game.missions.objectiveText();
    ctx.font = 'bold 14px sans-serif';
    const objW = Math.min(W - 40, ctx.measureText(obj).width + 28);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - objW / 2, H - 64, objW, 30);
    ctx.fillStyle = '#ffd700';
    ctx.fillText(obj, W / 2, H - 44);

    // Bottom-left: controls.
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const controls = p.onFoot
      ? 'WASD move · SHIFT run · E enter car · F punch · CLICK shoot · M mute · P pause'
      : 'W/S drive · A/D steer · E exit car · SPACE handbrake · M mute · P pause';
    ctx.fillText(controls, 14, H - 14);

    // Ammo (on foot).
    if (p.onFoot) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(12, H - 108, 110, 30);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('AMMO ' + p.ammo, 22, H - 88);
    }

    // Toast messages.
    if (game.toastTimer > 0) {
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      const tw = Math.min(W - 60, ctx.measureText(game.toastText).width + 30);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(W / 2 - tw / 2, 66, tw, 34);
      ctx.fillStyle = '#fff';
      ctx.fillText(game.toastText, W / 2, 89);
    }
  }

  drawMinimap(game, x, y, w, h) {
    const ctx = this.ctx;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    ctx.fillStyle = '#1d2b1a';
    ctx.fillRect(x, y, w, h);
    // Water + sand.
    ctx.fillStyle = '#2f7fc4';
    ctx.fillRect(x, y + WORLD.waterY * sy, w, h - WORLD.waterY * sy);
    ctx.fillStyle = '#e6cf8f';
    ctx.fillRect(x, y + WORLD.beachY * sy, w, (WORLD.waterY - WORLD.beachY) * sy);
    // Roads.
    ctx.fillStyle = '#6a707c';
    for (const cx of game.city.xs) ctx.fillRect(x + cx * sx - 1, y, 2, WORLD.beachY * sy);
    for (const cy of game.city.ys) ctx.fillRect(x, y + cy * sy - 1, w, 2);
    // Mission marker.
    const pos = game.missions.markerPos();
    if (pos) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(x + pos.x * sx, y + pos.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police (red), traffic (white), player (green arrow).
    for (const car of game.cars) {
      if (car === game.player.inCar) continue;
      ctx.fillStyle = car.isPolice ? '#ff3b30' : 'rgba(255,255,255,0.85)';
      ctx.fillRect(x + car.x * sx - 1.5, y + car.y * sy - 1.5, 3, 3);
    }
    const p = game.player;
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Viewport rectangle.
    const cam = game.camera;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x + cam.x * sx,
      y + cam.y * sy,
      (this.canvas.width / cam.zoom) * sx,
      (this.canvas.height / cam.zoom) * sy,
    );
  }

  drawTitle(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    // Backdrop: a slow pan over the city.
    const t = game.time * 12;
    const keepCam = game.camera;
    game.camera = { x: 500 + (t % 1100), y: 250, zoom: 0.55 };
    ctx.save();
    ctx.scale(game.camera.zoom, game.camera.zoom);
    ctx.translate(-game.camera.x, -game.camera.y);
    this.drawWorld(game);
    ctx.restore();
    game.camera = keepCam;
    // Traffic silhouettes drifting across the title.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText(STORY.title, W / 2, H * 0.3);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(STORY.subtitle, W / 2, H * 0.3 + 34);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const lines = wrapText(this.ctx, STORY.intro, W * 0.62, 15);
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.42 + i * 22));

    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 22px sans-serif';
    const blink = Math.floor(game.time * 2) % 2 === 0;
    if (blink) {
      ctx.fillText(game.hasSave ? 'ENTER — CONTINUE ($' + game.saveCash + ' saved)' : 'ENTER — NEW GAME', W / 2, H * 0.72);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText('WASD move · E enter / steal car · F punch · CLICK shoot · P pause · M mute', W / 2, H * 0.72 + 32);
    ctx.fillText('4 jobs for Rosa Delgado · wanted stars bring the Solmar PD · progress autosaves', W / 2, H * 0.72 + 56);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px sans-serif';
    ctx.fillText('A 100% original game: Solmar City, Marco Vale, Rosa Delgado. No Rockstar content.', W / 2, H - 18);
  }

  drawPause(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', W / 2, H * 0.4);
    ctx.font = '16px sans-serif';
    ctx.fillText('P — resume · S — save & quit to title · M — mute (' + (game.sound.muted ? 'muted' : 'sound on') + ')', W / 2, H * 0.4 + 36);
    ctx.fillText('Cash $' + game.player.cash.toLocaleString('en-US') + ' · ' + game.missions.objectiveText(), W / 2, H * 0.4 + 64);
  }

  drawCenterCard(game, title, line, hint) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3b30';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(title, W / 2, H * 0.42);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText(line, W / 2, H * 0.42 + 36);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(hint, W / 2, H * 0.42 + 68);
  }

  drawStoryEnd(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('SOLMAR CITY — COMPLETE', W / 2, H * 0.36);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('All four jobs done. Rosa is paid, the PD lost the trail, and Marco Vale', W / 2, H * 0.36 + 40);
    ctx.fillText('is $' + game.player.cash.toLocaleString('en-US') + ' richer. The city is yours — keep driving.', W / 2, H * 0.36 + 66);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('ENTER — keep playing free roam', W / 2, H * 0.36 + 110);
  }
}

function wrapText(ctx, text, maxWidth, fontSize) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
