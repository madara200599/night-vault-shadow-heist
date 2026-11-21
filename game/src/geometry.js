// Small 2D geometry helpers shared by vision, movement and rendering: segment
// intersection for line of sight, circle-vs-rectangle tests for cover collision, and
// angle wrapping so guards turn the short way around.

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Wrap an angle to (-PI, PI] so differences take the short way around the circle. */
export function wrapAngle(angle) {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= Math.PI * 2;
  while (wrapped <= -Math.PI) wrapped += Math.PI * 2;
  return wrapped;
}

/** Turn `facing` toward `target` by at most `maxTurn` radians. */
export function turnToward(facing, target, maxTurn) {
  const diff = wrapAngle(target - facing);
  if (Math.abs(diff) <= maxTurn) return target;
  return facing + Math.sign(diff) * maxTurn;
}

/** Do segments p1-p2 and p3-p4 cross? Touching at an endpoint counts. */
export function segmentsCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1 = direction(x3, y3, x4, y4, x1, y1);
  const d2 = direction(x3, y3, x4, y4, x2, y2);
  const d3 = direction(x1, y1, x2, y2, x3, y3);
  const d4 = direction(x1, y1, x2, y2, x4, y4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}

function direction(ax, ay, bx, by, px, py) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/**
 * Distance from point (px,py) along ray (ox,oy)+t*(dx,dy) to segment (x3,y3)-(x4,y4);
 * Infinity when the ray never meets it. Used to clip vision cones at walls and cover.
 */
export function raySegment(ox, oy, dx, dy, x3, y3, x4, y4) {
  const ex = x4 - x3;
  const ey = y4 - y3;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-9) return Infinity;
  const sx = x3 - ox;
  const sy = y3 - oy;
  const t = (sx * ey - sy * ex) / denom;
  const u = (sx * dy - sy * dx) / denom;
  if (t < 0 || u < 0 || u > 1) return Infinity;
  return t;
}

/** True when the straight line between two points crosses any solid rectangle's edge. */
export function lineBlocked(x1, y1, x2, y2, solids) {
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) continue;
    if (
      segmentsCross(x1, y1, x2, y2, r.x, r.y, r.x + r.w, r.y) ||
      segmentsCross(x1, y1, x2, y2, r.x + r.w, r.y, r.x + r.w, r.y + r.h) ||
      segmentsCross(x1, y1, x2, y2, r.x + r.w, r.y + r.h, r.x, r.y + r.h) ||
      segmentsCross(x1, y1, x2, y2, r.x, r.y + r.h, r.x, r.y)
    ) return true;
  }
  return false;
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/** Push a circle at (x,y) out of every solid rectangle; returns the corrected position. */
export function slideCircle(x, y, radius, solids, field) {
  let nx = clamp(x, radius, field.width - radius);
  let ny = clamp(y, radius, field.height - radius);
  for (let i = 0; i < solids.length; i += 1) {
    const r = solids[i];
    const closestX = clamp(nx, r.x, r.x + r.w);
    const closestY = clamp(ny, r.y, r.y + r.h);
    const dx = nx - closestX;
    const dy = ny - closestY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      nx = closestX + (dx / d) * radius;
      ny = closestY + (dy / d) * radius;
    } else {
      // Centre inside the rect: leave by the shallowest side.
      const left = nx - r.x;
      const right = r.x + r.w - nx;
      const top = ny - r.y;
      const bottom = r.y + r.h - ny;
      const shallowest = Math.min(left, right, top, bottom);
      if (shallowest === left) nx = r.x - radius;
      else if (shallowest === right) nx = r.x + r.w + radius;
      else if (shallowest === top) ny = r.y - radius;
      else ny = r.y + r.h + radius;
    }
  }
  return { x: nx, y: ny };
}
