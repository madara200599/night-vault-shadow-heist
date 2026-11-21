// Everything the player sees, drawn on one canvas in world coordinates scaled to
// fit the window: the vault floor with its light pools and shadow patches, cover
// you can read at a glance (stone walls, wooden crates), vision cones that flush
// from pale yellow through orange to red as suspicion rises, the watchmen and the
// thief, and the HUD — relics, the great eye of detection, alarm pips and timer.

import { FIELD, GUARD, PLAYER } from './config.js';
import { clamp } from './geometry.js';
import { GUARD_CHASE, GUARD_INVESTIGATE, GUARD_SEARCH } from './guards.js';
import { visionConePolygon } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

const FONT = '600 %dpx "Segoe UI", system-ui, sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, width: 0, height: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * dpr);
    canvas.height = Math.round(view.height * dpr);
    view.scale = Math.min(view.width / FIELD.width, view.height / FIELD.height);
    view.ox = (view.width - FIELD.width * view.scale) / 2;
    view.oy = (view.height - FIELD.height * view.scale) / 2;
    view.dpr = dpr;
  }
  window.addEventListener('resize', resize);
  resize();

  function toWorld(clientX, clientY) {
    return { x: (clientX - view.ox) / view.scale, y: (clientY - view.oy) / view.scale };
  }

  function font(size) { return FONT.replace('%d', String(Math.round(size))); }

  function drawFloor(state) {
    const level = state.level;
    ctx.fillStyle = '#1b2130';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); }
    for (let y = 0; y <= FIELD.height; y += 64) { ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); }
    ctx.stroke();
    for (const patch of level.shadows) {
      ctx.fillStyle = 'rgba(4,6,12,0.55)';
      ctx.beginPath();
      ctx.ellipse(patch.x, patch.y, patch.rx, patch.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pool of level.lights) {
      const grad = ctx.createRadialGradient(pool.x, pool.y, 8, pool.x, pool.y, Math.max(pool.rx, pool.ry));
      grad.addColorStop(0, 'rgba(255,214,130,0.30)');
      grad.addColorStop(1, 'rgba(255,214,130,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(pool.x, pool.y, pool.rx, pool.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const open = state.relics.every((r) => r.taken);
    ctx.save();
    if (open) {
      ctx.shadowColor = '#39e07a';
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#14532d';
    } else {
      ctx.fillStyle = '#3a2027';
    }
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = open ? '#39e07a' : '#8a4453';
    ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = open ? '#a7f3c9' : '#c98a96';
    ctx.font = font(21);
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 - 2);
    ctx.font = font(12);
    ctx.fillText(open ? 'OPEN' : 'SEALED', exit.x + exit.w / 2, exit.y + exit.h / 2 + 18);
    ctx.restore();
  }

  function drawRelics(state, now) {
    for (const relic of state.relics) {
      if (relic.taken) continue;
      const bob = Math.sin(now / 380 + relic.x) * 3;
      ctx.save();
      ctx.translate(relic.x, relic.y + bob);
      ctx.shadowColor = '#ffd34d';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8a6410';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function coneColour(guard) {
    if (guard.state === GUARD_CHASE || guard.suspicion >= 1) return 'rgba(255,64,48,';
    if (guard.suspicion >= 0.55) return 'rgba(255,140,40,';
    if (guard.suspicion >= 0.25) return 'rgba(255,196,64,';
    return 'rgba(255,226,130,';
  }

  function drawCones(state) {
    for (const guard of state.guards) {
      const polygon = visionConePolygon(guard, state.edges);
      const base = coneColour(guard);
      const grad = ctx.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, GUARD.sightRange);
      grad.addColorStop(0, `${base}0.44)`);
      grad.addColorStop(1, `${base}0.17)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(polygon[0][0], polygon[0][1]);
      for (let i = 1; i < polygon.length; i += 1) ctx.lineTo(polygon[i][0], polygon[i][1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSolids(state) {
    for (const wallRect of state.level.walls) {
      ctx.fillStyle = '#4b5872';
      ctx.fillRect(wallRect.x, wallRect.y, wallRect.w, wallRect.h);
      ctx.fillStyle = '#67769a';
      ctx.fillRect(wallRect.x, wallRect.y, wallRect.w, Math.min(5, wallRect.h));
      ctx.fillRect(wallRect.x, wallRect.y, Math.min(5, wallRect.w), wallRect.h);
    }
    for (const crateRect of state.level.crates) {
      ctx.fillStyle = '#8a6134';
      ctx.fillRect(crateRect.x, crateRect.y, crateRect.w, crateRect.h);
      ctx.strokeStyle = '#5f421f';
      ctx.lineWidth = 3;
      ctx.strokeRect(crateRect.x + 2, crateRect.y + 2, crateRect.w - 4, crateRect.h - 4);
      ctx.beginPath();
      ctx.moveTo(crateRect.x + 3, crateRect.y + 3);
      ctx.lineTo(crateRect.x + crateRect.w - 3, crateRect.y + crateRect.h - 3);
      ctx.moveTo(crateRect.x + crateRect.w - 3, crateRect.y + 3);
      ctx.lineTo(crateRect.x + 3, crateRect.y + crateRect.h - 3);
      ctx.stroke();
    }
  }

  function drawGuard(guard, now) {
    // Patrol dots: the loop a patient thief can learn.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (const wp of guard.waypoints) {
      ctx.beginPath();
      ctx.arc(wp[0], wp[1], 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.rotate(guard.facing);
    ctx.fillStyle = guard.state === GUARD_CHASE ? '#c93a30' : '#31456e';
    ctx.beginPath();
    ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b23a';
    ctx.beginPath();
    ctx.moveTo(GUARD.radius + 5, 0);
    ctx.lineTo(GUARD.radius - 5, -6);
    ctx.lineTo(GUARD.radius - 5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#dbe4f5';
    ctx.beginPath();
    ctx.arc(2, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Suspicion arc and state mark above the head.
    if (guard.suspicion > 0.02) {
      ctx.strokeStyle = guard.suspicion >= 1 ? '#ff5040' : '#ffb340';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD.radius + 8, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      ctx.stroke();
    }
    const alert = guard.state === GUARD_CHASE || guard.suspicion >= 1;
    const curious = guard.state === GUARD_INVESTIGATE || guard.state === GUARD_SEARCH || guard.suspicion >= 0.3;
    if (alert || curious) {
      ctx.font = font(24);
      ctx.textAlign = 'center';
      ctx.fillStyle = alert ? '#ff5040' : '#ffd34d';
      const bounce = alert ? Math.sin(now / 90) * 2 : 0;
      ctx.fillText(alert ? '!' : '?', guard.x, guard.y - GUARD.radius - 14 + bounce);
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.moving && !player.crouching) {
      ctx.strokeStyle = 'rgba(160,220,255,0.13)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.walkNoiseRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.facing);
    const radius = player.crouching ? PLAYER.radius - 3 : PLAYER.radius;
    ctx.fillStyle = '#1f9d74';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d5c40';
    ctx.beginPath();
    ctx.moveTo(radius + 4, 0);
    ctx.lineTo(-2, -radius + 2);
    ctx.lineTo(-2, radius - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(3, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (player.crouching) {
      ctx.strokeStyle = 'rgba(120,255,200,0.35)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawCoin(state, now) {
    const coin = state.coin;
    if (!coin.active) return;
    let x = coin.x;
    let y = coin.y;
    let r = 6;
    if (!coin.landed) {
      const t = clamp(coin.t / 0.45, 0, 1);
      x = coin.fromX + (coin.x - coin.fromX) * t;
      y = coin.fromY + (coin.y - coin.fromY) * t - Math.sin(t * Math.PI) * 42;
      r = 5;
    } else {
      const pulse = 14 + Math.sin(now / 160) * 5;
      ctx.strokeStyle = 'rgba(255,211,77,0.4)';
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAim(state, meta) {
    // A small ring where the mouse points, so a coin toss can be aimed before the click.
    if (!meta.aim || !meta.aim.inside) return;
    ctx.strokeStyle = 'rgba(255,211,77,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(meta.aim.x, meta.aim.y, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(meta.aim.x - 17, meta.aim.y);
    ctx.lineTo(meta.aim.x - 7, meta.aim.y);
    ctx.moveTo(meta.aim.x + 7, meta.aim.y);
    ctx.lineTo(meta.aim.x + 17, meta.aim.y);
    ctx.moveTo(meta.aim.x, meta.aim.y - 17);
    ctx.lineTo(meta.aim.x, meta.aim.y - 7);
    ctx.moveTo(meta.aim.x, meta.aim.y + 7);
    ctx.lineTo(meta.aim.x, meta.aim.y + 17);
    ctx.stroke();
  }

  function drawHud(state, meta) {
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    ctx.fillRect(0, 0, FIELD.width, 46);
    ctx.fillStyle = '#e8ecf5';
    ctx.font = font(19);
    ctx.textAlign = 'left';
    ctx.fillText(state.level.name, 16, 30);

    // Relics: one diamond per prize, lit when lifted.
    const total = state.relics.length;
    const taken = state.relics.filter((r) => r.taken).length;
    const midX = FIELD.width / 2;
    for (let i = 0; i < total; i += 1) {
      const x = midX + (i - (total - 1) / 2) * 30;
      ctx.save();
      ctx.translate(x, 23);
      ctx.fillStyle = state.relics[i].taken ? '#ffd34d' : 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.font = font(15);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aeb9cf';
    ctx.fillText(`${taken} / ${total} relics`, midX, 43 - 1);

    // The great eye: the highest suspicion anywhere, as a filling bar.
    const maxSuspicion = state.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
    const eyeX = FIELD.width - 330;
    ctx.font = font(17);
    ctx.textAlign = 'left';
    ctx.fillStyle = maxSuspicion >= 1 ? '#ff5040' : maxSuspicion > 0.25 ? '#ffb340' : '#8fa3c8';
    ctx.fillText('👁', eyeX, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(eyeX + 30, 16, 110, 10);
    ctx.fillStyle = maxSuspicion >= 1 ? '#ff5040' : '#ffb340';
    ctx.fillRect(eyeX + 30, 16, 110 * maxSuspicion, 10);

    // Alarm pips and the clock.
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < state.alarm ? '#ff5040' : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(FIELD.width - 158 + i * 20, 21, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    const seconds = Math.floor(state.elapsed);
    ctx.font = font(19);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8ecf5';
    ctx.fillText(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, FIELD.width - 16, 30);

    ctx.font = font(15);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(220,228,245,0.66)';
    const hint = meta.hint ?? 'WASD move · SHIFT crouch (silent, low) · CLICK toss a coin to lure · stay out of the light cones';
    ctx.fillText(hint, FIELD.width / 2, FIELD.height - 12);
  }

  function overlay(state, screen, meta, now) {
    if (screen === SCREEN_PLAY) return;
    ctx.fillStyle = 'rgba(5,7,13,0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = '#ffd34d';
      ctx.font = font(72);
      ctx.fillText('NIGHT VAULT', FIELD.width / 2, 268);
      ctx.fillStyle = '#7fe7c0';
      ctx.font = font(30);
      ctx.fillText('S H A D O W   H E I S T', FIELD.width / 2, 314);
      ctx.fillStyle = '#e8ecf5';
      ctx.font = font(21);
      ctx.fillText(state.level.briefing, FIELD.width / 2, 380);
      ctx.fillStyle = '#aeb9cf';
      ctx.font = font(18);
      ctx.fillText('Move with WASD or the arrow keys. Hold SHIFT to crouch: slow, silent, hard to see.', FIELD.width / 2, 428);
      ctx.fillText('Click anywhere to toss a coin — guards will go and look at the clink.', FIELD.width / 2, 456);
      ctx.fillText('A guard who only glimpses you can be escaped: break the line of sight and stay hidden.', FIELD.width / 2, 484);
      ctx.fillStyle = '#ffd34d';
      ctx.font = font(24);
      ctx.fillText('Press SPACE or click to slip inside', FIELD.width / 2, 548);
      if (meta.best) {
        ctx.fillStyle = '#8fa3c8';
        ctx.font = font(16);
        ctx.fillText(`Best run so far: ${meta.best}`, FIELD.width / 2, 586);
      }
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = '#e8ecf5';
      ctx.font = font(44);
      ctx.fillText('PAUSED', FIELD.width / 2, 380);
      ctx.font = font(19);
      ctx.fillStyle = '#aeb9cf';
      ctx.fillText('Press P or SPACE to keep sneaking', FIELD.width / 2, 424);
    } else if (screen === SCREEN_CAUGHT) {
      ctx.fillStyle = '#ff5040';
      ctx.font = font(56);
      ctx.fillText('CAUGHT!', FIELD.width / 2, 350);
      ctx.fillStyle = '#e8ecf5';
      ctx.font = font(21);
      ctx.fillText('The watch closes in. The vault resets — the patrols do not change.', FIELD.width / 2, 402);
      ctx.fillStyle = '#ffd34d';
      ctx.font = font(22);
      ctx.fillText('Press SPACE to try this floor again', FIELD.width / 2, 452);
    } else if (screen === SCREEN_CLEAR) {
      ctx.fillStyle = '#39e07a';
      ctx.font = font(48);
      ctx.fillText('FLOOR CLEARED', FIELD.width / 2, 330);
      ctx.fillStyle = '#e8ecf5';
      ctx.font = font(21);
      ctx.fillText(meta.clearLine ?? '', FIELD.width / 2, 384);
      ctx.fillStyle = '#ffd34d';
      ctx.font = font(22);
      ctx.fillText('Press SPACE for the next floor', FIELD.width / 2, 436);
    } else if (screen === SCREEN_WIN) {
      ctx.fillStyle = '#ffd34d';
      ctx.font = font(54);
      ctx.fillText('THE VAULT IS EMPTY', FIELD.width / 2, 316);
      ctx.fillStyle = '#7fe7c0';
      ctx.font = font(30);
      ctx.fillText(meta.rank ?? '', FIELD.width / 2, 372);
      ctx.fillStyle = '#e8ecf5';
      ctx.font = font(20);
      ctx.fillText(meta.clearLine ?? '', FIELD.width / 2, 416);
      ctx.fillStyle = '#aeb9cf';
      ctx.font = font(19);
      ctx.fillText('Press SPACE to run the whole vault again', FIELD.width / 2, 466);
    }
  }

  function draw(state, screen, meta = {}, now = performance.now()) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    drawFloor(state);
    drawExit(state);
    drawRelics(state, now);
    drawCones(state);
    drawSolids(state);
    drawCoin(state, now);
    for (const guard of state.guards) drawGuard(guard, now);
    if (screen !== SCREEN_TITLE) drawPlayer(state);
    if (screen === SCREEN_PLAY) drawAim(state, meta);
    drawHud(state, meta);
    overlay(state, screen, meta, now);
    // Vignette: the vault's edges fall away into dark.
    const vignette = ctx.createRadialGradient(640, 400, 420, 640, 400, 900);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  return { draw, toWorld, resize };
}
