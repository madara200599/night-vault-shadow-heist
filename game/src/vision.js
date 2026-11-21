// What a guard can see: a fan of rays clipped at walls and crates makes the cone
// polygon the renderer draws, and canSeePlayer answers the rules question — is the
// player inside the cone, in range, and not hidden behind cover — with a strength
// from 0 to 1 that the detection meter feeds on (distance, light and crouch all
// bend it, so an edge-of-cone glimpse fills the meter far slower than a close one).

import { GUARD, PLAYER } from './config.js';
import { clamp, distance, lineBlocked, raySegment, wrapAngle } from './geometry.js';

const CONE_RAYS = 33;

/** The four edges of every solid, precomputed once per level for the ray fan. */
export function buildEdges(solids, field) {
  const edges = [];
  const addRect = (r) => {
    edges.push([r.x, r.y, r.x + r.w, r.y], [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
      [r.x + r.w, r.y + r.h, r.x, r.y + r.h], [r.x, r.y + r.h, r.x, r.y]);
  };
  for (const solid of solids) addRect(solid);
  addRect({ x: -8, y: -8, w: field.width + 16, h: 8 });
  addRect({ x: -8, y: field.height, w: field.width + 16, h: 8 });
  addRect({ x: -8, y: 0, w: 8, h: field.height });
  addRect({ x: field.width, y: 0, w: 8, h: field.height });
  return edges;
}

/** Polygon of the guard's visible wedge: rays swept across the cone, each stopped at the first wall. */
export function visionConePolygon(guard, edges) {
  const points = [[guard.x, guard.y]];
  const half = (GUARD.sightHalfAngle * Math.PI) / 180;
  for (let i = 0; i < CONE_RAYS; i += 1) {
    const angle = guard.facing - half + (2 * half * i) / (CONE_RAYS - 1);
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let best = GUARD.sightRange;
    for (let e = 0; e < edges.length; e += 1) {
      const edge = edges[e];
      const t = raySegment(guard.x, guard.y, dx, dy, edge[0], edge[1], edge[2], edge[3]);
      if (t < best) best = t;
    }
    points.push([guard.x + dx * best, guard.y + dy * best]);
  }
  return points;
}

/** Which floor lighting covers a point: 1 in a light pool, -1 in shadow, 0 elsewhere. */
export function floorLightAt(x, y, level) {
  for (const pool of level.lights) {
    const nx = (x - pool.x) / pool.rx;
    const ny = (y - pool.y) / pool.ry;
    if (nx * nx + ny * ny <= 1) return 1;
  }
  for (const patch of level.shadows) {
    const nx = (x - patch.x) / patch.rx;
    const ny = (y - patch.y) / patch.ry;
    if (nx * nx + ny * ny <= 1) return -1;
  }
  return 0;
}

/**
 * Strength of a guard's view of the player, 0 (unseen) to 1 (point blank in a light
 * pool). Zero when out of range, outside the cone (beyond the near-sense radius), or
 * with cover between them — cover always wins, which is what makes hiding work.
 */
export function sightStrength(guard, player, solids, level) {
  const dist = distance(guard.x, guard.y, player.x, player.y);
  if (dist > GUARD.sightRange) return 0;
  if (dist > GUARD.nearRadius) {
    const toPlayer = Math.atan2(player.y - guard.y, player.x - guard.x);
    const half = (GUARD.sightHalfAngle * Math.PI) / 180;
    if (Math.abs(wrapAngle(toPlayer - guard.facing)) > half) return 0;
  }
  if (lineBlocked(guard.x, guard.y, player.x, player.y, solids)) return 0;
  let strength = 1.15 - dist / GUARD.sightRange;
  const light = floorLightAt(player.x, player.y, level);
  if (light > 0) strength *= PLAYER.litVisibility;
  else if (light < 0) strength *= PLAYER.shadowVisibility;
  if (player.crouching) strength *= PLAYER.crouchVisibility;
  return clamp(strength, 0, 1);
}
