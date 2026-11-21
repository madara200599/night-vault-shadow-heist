// Keyboard and mouse, read as state rather than events where the game loop wants
// state: held movement keys become a direction each frame, crouch is a held key,
// and one-shot actions (toss a coin, pause, confirm) are queued as flags the loop
// drains. The mouse aim is tracked in world coordinates for coin tosses.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_TOSS = 4;

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};

export function createInput(canvas, toWorld) {
  const held = { left: false, right: false, up: false, down: false };
  let crouchHeld = false;
  let queued = 0;
  const mouse = { x: 0, y: 0, inside: false };

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (name) { held[name] = true; event.preventDefault(); }
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyC') crouchHeld = true;
    else if (event.code === 'Space' || event.code === 'Enter') { queued |= ACTION_CONFIRM; event.preventDefault(); }
    else if (event.code === 'Escape' || event.code === 'KeyP') queued |= ACTION_PAUSE;
    else if (event.code === 'KeyE' || event.code === 'KeyF') queued |= ACTION_TOSS;
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'KeyC') crouchHeld = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const point = toWorld(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
    mouse.inside = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toWorld(event.clientX, event.clientY);
    mouse.x = point.x;
    mouse.y = point.y;
    queued |= ACTION_TOSS;
  });
  canvas.addEventListener('pointerleave', () => { mouse.inside = false; });

  return {
    /** Held movement as a unit-ish vector (diagonals are normalised by the player). */
    direction() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    crouching() { return crouchHeld; },
    mouse() { return mouse; },
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
  };
}
