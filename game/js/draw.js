// All canvas rendering: city, cars, people, effects, minimap.

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, city, view, time) {
  const { cam, vw, vh } = view;
  ctx.fillStyle = '#22262d';
  ctx.fillRect(0, 0, vw, vh);
  const ox = -cam.x + vw / 2, oy = -cam.y + vh / 2;
  ctx.save();
  ctx.translate(ox, oy);
  // Beach + sea on the south/east edges.
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
  ctx.fillStyle = '#1f5f8b';
  ctx.fillRect(city.water.x, city.water.y, city.water.w, city.water.h);
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const wy = 300 + i * 380 + Math.sin(time * 0.7 + i) * 8;
    ctx.beginPath(); ctx.moveTo(city.water.x + 12, wy); ctx.lineTo(city.water.x + 110, wy); ctx.stroke();
  }
  // Park.
  ctx.fillStyle = '#2f6b3a';
  ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
  ctx.fillStyle = '#3f8a4a';
  for (let i = 0; i < 14; i++) {
    const tx = city.park.x + 30 + ((i * 67) % 250);
    const ty = city.park.y + 30 + ((i * 97) % 250);
    ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
  }
  // Pier deck.
  ctx.fillStyle = '#8a6d4b';
  ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  ctx.strokeStyle = '#6b4f33';
  for (let x = city.pier.x + 20; x < city.pier.x + city.pier.w; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, city.pier.y); ctx.lineTo(x, city.pier.y + city.pier.h); ctx.stroke();
  }
  // Roads.
  for (const r of city.roads) {
    ctx.fillStyle = '#454b57';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.strokeStyle = '#d8c56a';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const r of city.roads) {
    ctx.beginPath();
    if (r.axis === 'v') { ctx.moveTo(r.x + r.w / 2, r.y); ctx.lineTo(r.x + r.w / 2, r.y + r.h); }
    else { ctx.moveTo(r.x, r.y + r.h / 2); ctx.lineTo(r.x + r.w, r.y + r.h / 2); }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Buildings.
  for (const b of city.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 34, 14, 10);
    }
    if (b.name) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2);
      ctx.textAlign = 'left';
    }
  }
  ctx.restore();
}

function drawCarShape(ctx, c, isCop, time) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  rr(ctx, -c.len / 2 + 3, -c.wid / 2 + 4, c.len, c.wid, 6); ctx.fill();
  ctx.fillStyle = c.color;
  rr(ctx, -c.len / 2, -c.wid / 2, c.len, c.wid, 6); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,.85)';
  rr(ctx, -c.len / 2 + 10, -c.wid / 2 + 3, 12, c.wid - 6, 3); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.fillRect(-c.len / 2 + 2, -c.wid / 2 - 2, 6, 4);
  ctx.fillRect(-c.len / 2 + 2, c.wid / 2 - 2, 6, 4);
  ctx.fillRect(c.len / 2 - 8, -c.wid / 2 - 2, 6, 4);
  ctx.fillRect(c.len / 2 - 8, c.wid / 2 - 2, 6, 4);
  if (isCop) {
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2e2e' : '#2e7bff';
    ctx.fillRect(-6, -c.wid / 2 + 2, 12, 6);
    ctx.fillStyle = flash ? '#2e7bff' : '#ff2e2e';
    ctx.fillRect(-6, c.wid / 2 - 8, 12, 6);
  }
  if (c.kind === 'comet') {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, -c.wid / 2 - 8);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

export function drawEntities(ctx, city, state, time) {
  const { hero, cars, peds, police, jobs } = state;
  const ox = -state.cam.x + 640, oy = -state.cam.y + 360;
  ctx.save();
  ctx.translate(ox, oy);
  // Mission target marker.
  if (jobs.target) {
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.save();
    ctx.translate(jobs.target.x, jobs.target.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(0, -26); ctx.lineTo(10, -8); ctx.lineTo(28, -6); ctx.lineTo(14, 6);
    ctx.lineTo(18, 24); ctx.lineTo(0, 14); ctx.lineTo(-18, 24); ctx.lineTo(-14, 6);
    ctx.lineTo(-28, -6); ctx.lineTo(-10, -8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,210,62,.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(jobs.target.x, jobs.target.y, 46 + Math.sin(time * 4) * 6, 0, Math.PI * 2); ctx.stroke();
  }
  for (const p of peds) {
    if (p.state === 'down') {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 14, 8, p.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of cars) drawCarShape(ctx, c, false, time);
  for (const c of police.cops) drawCarShape(ctx, c, true, time);
  if (jobs.comet) drawCarShape(ctx, jobs.comet, false, time);
  if (jobs.van) drawCarShape(ctx, jobs.van, false, time);
  // Bullets.
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 3;
  for (const b of state.weapons.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 18, b.y - Math.sin(b.angle) * 18);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Marco.
  if (!hero.inCar) {
    const bob = hero.moving ? Math.sin(time * 12) * 2 : 0;
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.arc(hero.x, hero.y + bob, hero.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hero.x, hero.y + bob, hero.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(hero.x + Math.cos(hero.angle) * 6, hero.y + Math.sin(hero.angle) * 6 + bob, 6, 0, Math.PI * 2); ctx.fill();
    if (hero.punchTimer > 0) {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.arc(hero.x + Math.cos(hero.angle) * 30, hero.y + Math.sin(hero.angle) * 30, 9, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    drawCarShape(ctx, hero.inCar, false, time);
  }
  ctx.restore();
}

export function drawMinimap(mctx, city, state) {
  const mw = 160, mh = 120;
  const sx = mw / city.w, sy = mh / city.h;
  mctx.clearRect(0, 0, mw, mh);
  mctx.fillStyle = '#20242b';
  mctx.fillRect(0, 0, mw, mh);
  mctx.fillStyle = '#1f5f8b';
  mctx.fillRect(city.water.x * sx, 0, city.water.w * sx, mh);
  mctx.fillStyle = '#5a6270';
  for (const r of city.roads) mctx.fillRect(r.x * sx, r.y * sy, Math.max(1, r.w * sx), Math.max(1, r.h * sy));
  mctx.fillStyle = '#8a6d3b';
  for (const name of Object.keys(city.landmarks)) {
    const lm = city.landmarks[name];
    mctx.fillRect(lm.x * sx, lm.y * sy, Math.max(2, lm.w * sx), Math.max(2, lm.h * sy));
  }
  const hero = state.hero;
  const px = hero.inCar ? hero.inCar.x : hero.x;
  const py = hero.inCar ? hero.inCar.y : hero.y;
  if (state.jobs.target) {
    mctx.fillStyle = '#ffd23e';
    mctx.beginPath(); mctx.arc(state.jobs.target.x * sx, state.jobs.target.y * sy, 4, 0, Math.PI * 2); mctx.fill();
  }
  mctx.fillStyle = '#ff3b30';
  for (const c of state.police.cops) {
    mctx.beginPath(); mctx.arc(c.x * sx, c.y * sy, 2.5, 0, Math.PI * 2); mctx.fill();
  }
  mctx.fillStyle = '#fff';
  mctx.beginPath(); mctx.arc(px * sx, py * sy, 3.5, 0, Math.PI * 2); mctx.fill();
  mctx.strokeStyle = '#ffd23e';
  mctx.lineWidth = 1.5;
  mctx.beginPath(); mctx.arc(px * sx, py * sy, 5.5, 0, Math.PI * 2); mctx.stroke();
}
