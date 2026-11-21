// Night Vault: Shadow Heist — boot and the one loop. The world advances in fixed
// 1/60 s steps while the renderer paints; the shell owns the screens (title, play,
// paused, caught, floor clear, vault cleared), the run totals that decide the
// thief's rank, the sounds the world's events call for, and the best-run record.
//
// ?shot=cover|sneak|alarm|exit stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { LEVELS } from './levels.js';
import {
  createWorld, EVENT_CAUGHT, EVENT_COIN_LAND, EVENT_COIN_TOSS, EVENT_EXIT_OPEN,
  EVENT_GUARD_STEP, EVENT_LEVEL_CLEAR, EVENT_PLAYER_STEP, EVENT_RELIC,
  EVENT_SPOTTED, EVENT_SUSPICIOUS,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_TOSS, createInput } from './input.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const seconds = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  } catch {
    return 0;
  }
}

function saveBest(seconds) {
  try {
    window.localStorage.setItem(BEST_KEY, String(seconds));
  } catch {
    // Storage can be off (private windows): the best run then lasts this visit only.
  }
}

function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function rankFor(spotted, seconds) {
  if (spotted === 0) return 'RANK: GHOST — never seen, not once';
  if (spotted <= 2 && seconds <= 300) return 'RANK: SHADOW — barely a rumour';
  if (spotted <= 5) return 'RANK: FOOTPAD — seen, but slippery';
  return 'RANK: SMASH-AND-GRAB — subtlety is a work in progress';
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.meta);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toWorld(x, y));
  let screen = SCREEN_TITLE;
  let bestSeconds = readBest();
  let runSpotted = 0;
  let runSeconds = 0;
  let accumulator = 0;
  let last = performance.now();
  let pendingToss = false;
  const meta = { best: '', hint: undefined, clearLine: '', rank: '', aim: null };

  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    runSpotted = 0;
    runSeconds = 0;
    world.loadLevel(0);
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startHum();
    announce(`Floor one. ${world.state.level.briefing}`);
  }

  function retryFloor() {
    world.loadLevel(world.state.levelIndex);
    screen = SCREEN_PLAY;
    announce(`Floor ${world.state.levelIndex + 1} again. The patrols have not changed.`);
  }

  function react(events) {
    const state = world.state;
    if (events & EVENT_PLAYER_STEP) audio.playerStep(state.player.crouching);
    if (events & EVENT_GUARD_STEP) audio.guardStep(state.loudestGuardStep);
    if (events & EVENT_COIN_TOSS) audio.coinToss();
    if (events & EVENT_COIN_LAND) audio.coinLand();
    if (events & EVENT_SUSPICIOUS) {
      audio.suspicious();
      announce('A guard has half-seen something. Keep low, keep moving away.');
    }
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      runSpotted += 1;
      announce('Spotted! Break the line of sight and hide until suspicion fades.');
    }
    if (events & EVENT_RELIC) {
      audio.relic();
      const taken = state.relics.filter((r) => r.taken).length;
      announce(`Relic lifted. ${taken} of ${state.relics.length}.`);
    }
    if (events & EVENT_EXIT_OPEN) {
      audio.exitOpen();
      announce('All relics lifted. The exit stands open.');
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      screen = SCREEN_CAUGHT;
      announce('Caught. Press Space to try this floor again.');
    } else if (events & EVENT_LEVEL_CLEAR) {
      runSeconds += state.elapsed;
      if (state.levelIndex + 1 < LEVELS.length) {
        meta.clearLine = `${state.level.name} in ${formatTime(state.elapsed)} · spotted ${state.timesSpotted} time${state.timesSpotted === 1 ? '' : 's'} this floor`;
        screen = SCREEN_CLEAR;
        audio.win();
        announce(`Floor cleared. ${meta.clearLine}. Press Space for the next floor.`);
      } else {
        meta.rank = rankFor(runSpotted, runSeconds);
        meta.clearLine = `Three floors emptied in ${formatTime(runSeconds)} · spotted ${runSpotted} time${runSpotted === 1 ? '' : 's'} in all`;
        if (bestSeconds === 0 || runSeconds < bestSeconds) {
          bestSeconds = Math.round(runSeconds);
          saveBest(bestSeconds);
        }
        screen = SCREEN_WIN;
        audio.win();
        announce(`The vault is empty. ${meta.rank}.`);
      }
    }
  }

  function stepWorld() {
    const mouse = input.mouse();
    const control = {
      direction: input.direction(),
      crouch: input.crouching(),
      toss: null,
    };
    if (pendingToss) {
      control.toss = { x: mouse.x, y: mouse.y };
      pendingToss = false;
    }
    react(world.step(STEP, control));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Drain actions here so a click means "confirm" off the play screen and
    // "toss a coin" on it, never both.
    const actions = input.takeActions();
    if (screen === SCREEN_PLAY && (actions & ACTION_TOSS)) pendingToss = true;
    if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen !== SCREEN_PLAY) {
      const confirm = (actions & (ACTION_CONFIRM | ACTION_TOSS)) !== 0;
      if (screen === SCREEN_TITLE && confirm) startRun();
      else if (screen === SCREEN_CAUGHT && confirm) retryFloor();
      else if (screen === SCREEN_CLEAR && confirm) {
        world.loadLevel(world.state.levelIndex + 1);
        screen = SCREEN_PLAY;
        announce(`Floor ${world.state.levelIndex + 1}. ${world.state.level.briefing}`);
      } else if (screen === SCREEN_WIN && confirm) startRun();
      else if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepWorld();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    meta.best = bestSeconds > 0 ? `${formatTime(bestSeconds)} for the whole vault` : '';
    meta.aim = screen === SCREEN_PLAY ? input.mouse() : null;
    renderer.draw(world.state, screen, meta, now);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Night Vault: Shadow Heist. Press Space to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
