// Guard behaviour: a small state machine per watchman. Patrol follows a waypoint
// loop with pauses; a half-filled suspicion sends the guard to look at whatever it
// half-saw or heard; a full meter means chase, and losing the trail means search
// the last seen spot, then give up and walk back to the loop. Because suspicion
// fills over time and drains out of sight, a player who breaks the line of sight
// quickly can always recover — that recovery is the heart of the game.

import { ALARM, GUARD } from './config.js';
import { clamp, distance, slideCircle, turnToward, wrapAngle } from './geometry.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

export const GEVENT_SPOTTED = 1;
export const GEVENT_SUSPICIOUS = 2;

export function createGuard(definition, index) {
  const first = definition.waypoints[0];
  const second = definition.waypoints[1] ?? first;
  return {
    index,
    x: first[0],
    y: first[1],
    facing: Math.atan2(second[1] - first[1], second[0] - first[0]),
    waypoints: definition.waypoints,
    waypointIndex: 1 % definition.waypoints.length,
    pauseAtWaypoint: definition.pause ?? 1,
    pauseTimer: 0,
    state: GUARD_PATROL,
    suspicion: 0,
    seenPoint: null,
    investigatePoint: null,
    searchTimer: 0,
    searchBaseFacing: 0,
    scanBase: 0,
    scanPhase: index * 1.7,
    stepPhase: 0,
    moving: false,
  };
}

/** Move the guard toward a point, turning its facing as it goes; true on arrival. */
function moveToward(guard, tx, ty, speed, dt, solids, field, turnRate) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  guard.moving = dist > 4;
  if (!guard.moving) return true;
  const targetFacing = Math.atan2(dy, dx);
  guard.facing = turnToward(guard.facing, targetFacing, turnRate * dt);
  const step = Math.min(dist, speed * dt);
  const moved = slideCircle(
    guard.x + Math.cos(guard.facing) * step * Math.max(0.25, Math.cos(wrapAngle(targetFacing - guard.facing))),
    guard.y + Math.sin(guard.facing) * step * Math.max(0.25, Math.cos(wrapAngle(targetFacing - guard.facing))),
    GUARD.radius, solids, field,
  );
  // Sliding along the facing can stall in a corner; fall back to a direct push.
  if (Math.hypot(moved.x - guard.x, moved.y - guard.y) < step * 0.3) {
    const direct = slideCircle(guard.x + (dx / dist) * step, guard.y + (dy / dist) * step, GUARD.radius, solids, field);
    guard.x = direct.x;
    guard.y = direct.y;
  } else {
    guard.x = moved.x;
    guard.y = moved.y;
  }
  guard.stepPhase += dt * speed * 0.09;
  return dist <= Math.max(6, step + 2);
}

/** Idle scan: the facing sweeps slowly either side of a base direction. */
function scan(guard, dt, baseFacing, sweep) {
  guard.moving = false;
  guard.scanPhase += dt;
  guard.facing = baseFacing + Math.sin(guard.scanPhase * 1.6) * sweep;
}

/**
 * Advance one guard. `sight` is this guard's current sight strength on the player
 * (0..1, from vision.js); `stimulus` is a noise or coin point the guard noticed
 * this step, or null. Returns GEVENT_* flags for sound and announcements.
 */
export function updateGuard(guard, dt, env) {
  let events = 0;
  const { player, solids, field, sight, stimulus } = env;
  const wasFull = guard.suspicion >= 1;

  // The suspicion meter: clear sight fills it (faster the stronger the view),
  // darkness and cover drain it.
  if (sight > 0) {
    const fillSeconds = GUARD.detectSecondsClose + (GUARD.detectSecondsFar - GUARD.detectSecondsClose) * (1 - sight);
    guard.suspicion = clamp(guard.suspicion + dt / fillSeconds, 0, 1);
    guard.seenPoint = { x: player.x, y: player.y };
    if (guard.suspicion >= 0.3 && guard.state === GUARD_PATROL) {
      guard.state = GUARD_INVESTIGATE;
      guard.investigatePoint = { x: player.x, y: player.y };
      events |= GEVENT_SUSPICIOUS;
    }
  } else {
    guard.suspicion = clamp(guard.suspicion - GUARD.suspicionDecay * dt, 0, 1);
  }
  if (guard.suspicion >= 1 && !wasFull) events |= GEVENT_SPOTTED;

  // A coin's clink or loud footsteps pull a calm guard off its loop to look.
  if (stimulus && guard.state !== GUARD_CHASE && guard.suspicion < 0.9) {
    guard.state = GUARD_INVESTIGATE;
    guard.investigatePoint = { x: stimulus.x, y: stimulus.y };
    guard.suspicion = Math.max(guard.suspicion, 0.35);
  }

  const boost = env.alarmLevel >= ALARM.max ? ALARM.patrolBoost : 1;

  switch (guard.state) {
    case GUARD_CHASE: {
      if (sight > 0) {
        moveToward(guard, player.x, player.y, GUARD.chaseSpeed, dt, solids, field, 6.5);
        guard.searchTimer = GUARD.searchSeconds;
      } else {
        const target = guard.seenPoint ?? player;
        if (moveToward(guard, target.x, target.y, GUARD.investigateSpeed, dt, solids, field, 5)) {
          guard.state = GUARD_SEARCH;
          guard.searchBaseFacing = guard.facing;
          guard.searchTimer = GUARD.searchSeconds;
        }
      }
      if (guard.suspicion <= 0.05 && sight === 0) guard.state = GUARD_RETURN;
      break;
    }
    case GUARD_SEARCH: {
      guard.searchTimer -= dt;
      scan(guard, dt, guard.searchBaseFacing, 1.15);
      if (guard.suspicion >= 1) guard.state = GUARD_CHASE;
      else if (guard.searchTimer <= 0) {
        guard.suspicion = Math.min(guard.suspicion, 0.25);
        guard.state = GUARD_RETURN;
      }
      break;
    }
    case GUARD_INVESTIGATE: {
      const target = guard.investigatePoint ?? guard.seenPoint;
      if (guard.suspicion >= 1) { guard.state = GUARD_CHASE; break; }
      if (target === null) { guard.state = GUARD_RETURN; break; }
      if (moveToward(guard, target.x, target.y, GUARD.investigateSpeed * boost, dt, solids, field, 5)) {
        guard.state = GUARD_SEARCH;
        guard.searchBaseFacing = guard.facing;
        guard.searchTimer = Math.min(GUARD.searchSeconds, 1.6);
      }
      if (guard.suspicion <= 0.02 && sight === 0) guard.state = GUARD_RETURN;
      break;
    }
    case GUARD_RETURN: {
      let nearest = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < guard.waypoints.length; i += 1) {
        const d = distance(guard.x, guard.y, guard.waypoints[i][0], guard.waypoints[i][1]);
        if (d < nearestDist) { nearestDist = d; nearest = i; }
      }
      const wp = guard.waypoints[nearest];
      if (moveToward(guard, wp[0], wp[1], GUARD.investigateSpeed * boost, dt, solids, field, 4.5)) {
        guard.waypointIndex = (nearest + 1) % guard.waypoints.length;
        guard.state = GUARD_PATROL;
        guard.pauseTimer = 0;
      }
      if (guard.suspicion >= 0.3) guard.state = GUARD_INVESTIGATE;
      if (guard.suspicion >= 1) guard.state = GUARD_CHASE;
      break;
    }
    default: { // patrol
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        scan(guard, dt, guard.scanBase, 0.5);
        break;
      }
      const wp = guard.waypoints[guard.waypointIndex];
      if (moveToward(guard, wp[0], wp[1], GUARD.patrolSpeed * boost, dt, solids, field, 3.4)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = guard.pauseAtWaypoint;
        guard.scanBase = guard.facing;
      }
      break;
    }
  }
  return events;
}
