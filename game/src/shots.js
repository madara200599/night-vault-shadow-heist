// The screenshot scenes behind ?shot=cover|sneak|alarm|exit. Each one loads a real
// floor, places the thief and the watch exactly where a moment of real play would
// put them, lets the rules settle for a few steps, and leaves the world ready for
// the renderer — so every screenshot is the game's own code showing its own state:
// cover play, a close sneak, a blown alarm, and the run for the open exit.

import { GUARD_CHASE, GUARD_INVESTIGATE, GUARD_PATROL } from './guards.js';
import { SCREEN_PLAY } from './render.js';

function placeGuard(guard, x, y, facing, state, suspicion) {
  guard.x = x;
  guard.y = y;
  guard.facing = facing;
  guard.state = state;
  guard.suspicion = suspicion;
  guard.pauseTimer = 0;
  guard.moving = false;
}

function settle(world, steps) {
  const idle = { direction: { x: 0, y: 0 }, crouch: false, toss: null };
  for (let i = 0; i < steps; i += 1) world.step(1 / 60, idle);
}

export function stageShot(name, world) {
  const state = world.state;
  if (name === 'sneak') {
    world.loadLevel(0);
    settle(world, 30);
    state.player.x = 512;
    state.player.y = 528;
    state.player.facing = 0.5;
    state.player.crouching = false;
    state.relics[0].taken = true;
    placeGuard(state.guards[2], 618, 486, 0.15, GUARD_PATROL, 0.08);
    placeGuard(state.guards[0], 706, 140, Math.PI, GUARD_PATROL, 0);
    placeGuard(state.guards[1], 1052, 430, -Math.PI / 2, GUARD_PATROL, 0);
    state.elapsed = 38;
    return { screen: SCREEN_PLAY, meta: { hint: 'One relic lifted. Slip behind the patrol — walking upright makes noise he can hear.' } };
  }
  if (name === 'alarm') {
    world.loadLevel(0);
    settle(world, 30);
    state.player.x = 884;
    state.player.y = 618;
    state.player.facing = -0.4;
    state.relics[0].taken = true;
    state.relics[1].taken = true;
    placeGuard(state.guards[1], 996, 548, 2.35, GUARD_CHASE, 1);
    placeGuard(state.guards[0], 700, 140, 2.8, GUARD_INVESTIGATE, 0.62);
    placeGuard(state.guards[2], 560, 676, 0, GUARD_PATROL, 0.3);
    state.alarm = 2;
    state.elapsed = 63;
    return { screen: SCREEN_PLAY, meta: { hint: 'SPOTTED! Break the line of sight and stay hidden — suspicion drains while no guard can see you.' } };
  }
  if (name === 'exit') {
    world.loadLevel(0);
    settle(world, 30);
    for (const relic of state.relics) relic.taken = true;
    state.exitAnnounced = true;
    state.player.x = 1086;
    state.player.y = 96;
    state.player.facing = 0.35;
    placeGuard(state.guards[0], 520, 140, Math.PI, GUARD_PATROL, 0);
    placeGuard(state.guards[1], 1052, 620, Math.PI / 2, GUARD_PATROL, 0.12);
    placeGuard(state.guards[2], 700, 676, Math.PI, GUARD_PATROL, 0);
    state.elapsed = 71;
    return { screen: SCREEN_PLAY, meta: { hint: 'All three relics lifted — the exit stands open. One clean run: never spotted.' } };
  }
  // cover (the default scene): crouched behind the crate stack as a cone sweeps past.
  world.loadLevel(0);
  settle(world, 30);
  state.player.x = 262;
  state.player.y = 292;
  state.player.facing = 0.4;
  state.player.crouching = true;
  placeGuard(state.guards[0], 528, 140, 2.55, GUARD_PATROL, 0.3);
  placeGuard(state.guards[1], 1052, 452, -Math.PI / 2, GUARD_PATROL, 0);
  placeGuard(state.guards[2], 626, 676, 0, GUARD_PATROL, 0.05);
  state.elapsed = 12;
  return { screen: SCREEN_PLAY, meta: { hint: 'Crouched behind cover, the vision cone cannot reach you. Lift all 3 relics, then reach the EXIT unseen.' } };
}
