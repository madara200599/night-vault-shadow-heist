// The rules of Night Vault in one state machine with no drawing and no browser in
// it: the thief's movement and crouch, coin tosses, guard updates fed by sight and
// sound, relic pickups, the house alarm, being caught, and reaching the exit.
// step() advances one fixed step and returns event flags, so the shell can play
// sounds and announcements without the world knowing about either.

import { COIN, FIELD, GUARD, PLAYER } from './config.js';
import { LEVELS } from './levels.js';
import { clamp, distance, slideCircle } from './geometry.js';
import { createGuard, updateGuard, GEVENT_SPOTTED, GEVENT_SUSPICIOUS, GUARD_PATROL, GUARD_RETURN } from './guards.js';
import { buildEdges, sightStrength } from './vision.js';

export const EVENT_RELIC = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_SUSPICIOUS = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_EXIT_OPEN = 16;
export const EVENT_LEVEL_CLEAR = 32;
export const EVENT_COIN_TOSS = 64;
export const EVENT_COIN_LAND = 128;
export const EVENT_PLAYER_STEP = 256;
export const EVENT_GUARD_STEP = 512;

export function createWorld() {
  const state = {
    levelIndex: 0,
    level: null,
    solids: [],
    edges: [],
    player: { x: 0, y: 0, facing: -Math.PI / 2, crouching: false, moving: false, stepAcc: 0 },
    guards: [],
    relics: [],
    coin: { active: false, landed: false, x: 0, y: 0, fromX: 0, fromY: 0, t: 0 },
    coinCooldown: 0,
    alarm: 0,
    elapsed: 0,
    timesSpotted: 0,
    caught: false,
    cleared: false,
    exitAnnounced: false,
    loudestGuardStep: 0,
  };

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.solids = [...level.walls, ...level.crates];
    state.edges = buildEdges(state.solids, FIELD);
    state.player.x = level.start.x;
    state.player.y = level.start.y;
    state.player.facing = -Math.PI / 2;
    state.player.crouching = false;
    state.player.moving = false;
    state.player.stepAcc = 0;
    state.guards = level.guards.map((def, i) => createGuard(def, i));
    state.relics = level.relics.map((r) => ({ ...r, taken: false }));
    state.coin.active = false;
    state.coinCooldown = 0;
    state.alarm = 0;
    state.elapsed = 0;
    state.timesSpotted = 0;
    state.caught = false;
    state.cleared = false;
    state.exitAnnounced = false;
  }

  function tossCoin(targetX, targetY) {
    if (state.coinCooldown > 0 || state.coin.active) return 0;
    const player = state.player;
    const dist = distance(player.x, player.y, targetX, targetY);
    const scale = dist > COIN.maxThrow ? COIN.maxThrow / dist : 1;
    state.coin.active = true;
    state.coin.landed = false;
    state.coin.fromX = player.x;
    state.coin.fromY = player.y;
    state.coin.x = player.x + (targetX - player.x) * scale;
    state.coin.y = player.y + (targetY - player.y) * scale;
    state.coin.t = 0;
    state.coinCooldown = PLAYER.coinCooldown;
    return EVENT_COIN_TOSS;
  }

  function step(dt, control) {
    let events = 0;
    if (state.caught || state.cleared) return events;
    state.elapsed += dt;
    const player = state.player;
    if (state.coinCooldown > 0) state.coinCooldown -= dt;

    // --- the thief ---
    const dir = control.direction;
    const length = Math.hypot(dir.x, dir.y);
    player.crouching = control.crouch;
    player.moving = length > 0;
    if (player.moving) {
      const speed = player.crouching ? PLAYER.crouchSpeed : PLAYER.walkSpeed;
      const nx = (dir.x / length) * speed * dt;
      const ny = (dir.y / length) * speed * dt;
      const moved = slideCircle(player.x + nx, player.y + ny, PLAYER.radius, state.solids, FIELD);
      const walked = distance(player.x, player.y, moved.x, moved.y);
      player.x = moved.x;
      player.y = moved.y;
      player.facing = Math.atan2(dir.y, dir.x);
      player.stepAcc += walked;
      const stride = player.crouching ? 26 : 36;
      if (player.stepAcc >= stride) {
        player.stepAcc = 0;
        events |= EVENT_PLAYER_STEP;
      }
    }
    if (control.toss) events |= tossCoin(control.toss.x, control.toss.y);

    // --- the coin ---
    let coinStimulus = null;
    if (state.coin.active) {
      state.coin.t += dt;
      if (!state.coin.landed && state.coin.t >= COIN.flightSeconds) {
        state.coin.landed = true;
        events |= EVENT_COIN_LAND;
        coinStimulus = { x: state.coin.x, y: state.coin.y };
      } else if (state.coin.landed && state.coin.t > COIN.flightSeconds + 6) {
        state.coin.active = false;
      }
    }

    // --- the watch ---
    state.loudestGuardStep = 0;
    for (const guard of state.guards) {
      const sight = sightStrength(guard, player, state.solids, state.level);
      let stimulus = null;
      if (coinStimulus && distance(guard.x, guard.y, coinStimulus.x, coinStimulus.y) <= COIN.lureRadius) {
        stimulus = coinStimulus;
      } else if (
        player.moving && !player.crouching &&
        (guard.state === GUARD_PATROL || guard.state === GUARD_RETURN) &&
        distance(guard.x, guard.y, player.x, player.y) <= PLAYER.walkNoiseRadius
      ) {
        stimulus = { x: player.x, y: player.y };
      }
      const beforePhase = Math.floor(guard.stepPhase);
      const guardEvents = updateGuard(guard, dt, {
        player, solids: state.solids, field: FIELD, sight, stimulus, alarmLevel: state.alarm,
      });
      if (Math.floor(guard.stepPhase) > beforePhase) {
        const closeness = clamp(1 - distance(guard.x, guard.y, player.x, player.y) / 420, 0, 1);
        if (closeness > state.loudestGuardStep) state.loudestGuardStep = closeness;
        events |= EVENT_GUARD_STEP;
      }
      if (guardEvents & GEVENT_SUSPICIOUS) events |= EVENT_SUSPICIOUS;
      if (guardEvents & GEVENT_SPOTTED) {
        events |= EVENT_SPOTTED;
        state.timesSpotted += 1;
        state.alarm = Math.min(3, state.alarm + 1);
      }
      if (distance(guard.x, guard.y, player.x, player.y) <= GUARD.catchRadius) {
        state.caught = true;
        events |= EVENT_CAUGHT;
      }
    }

    // --- relics and the way out ---
    for (const relic of state.relics) {
      if (!relic.taken && distance(player.x, player.y, relic.x, relic.y) <= PLAYER.radius + 17) {
        relic.taken = true;
        events |= EVENT_RELIC;
        if (state.relics.every((r) => r.taken) && !state.exitAnnounced) {
          state.exitAnnounced = true;
          events |= EVENT_EXIT_OPEN;
        }
      }
    }
    const exit = state.level.exit;
    if (
      state.relics.every((r) => r.taken) &&
      player.x >= exit.x && player.x <= exit.x + exit.w && player.y >= exit.y && player.y <= exit.y + exit.h
    ) {
      state.cleared = true;
      events |= EVENT_LEVEL_CLEAR;
    }
    return events;
  }

  loadLevel(0);
  return { state, loadLevel, step };
}
