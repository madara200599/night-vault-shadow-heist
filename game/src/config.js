// Night Vault: Shadow Heist — every tuning number in one place, so the feel of the game
// (speeds, sight ranges, how fast a guard's suspicion fills and fades) can be balanced
// without hunting through the logic files.

/** The play field in world units; the renderer scales it to fill the window. */
export const FIELD = { width: 1280, height: 800 };

/** The fixed step the world advances in, in seconds: rules never depend on frame rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  walkSpeed: 168,
  crouchSpeed: 92,
  /** Detection fills this much slower while crouched: low profile, quieter steps. */
  crouchVisibility: 0.45,
  /** Standing in a lit pool of floor multiplies detection by this; shadow divides it. */
  litVisibility: 1.6,
  shadowVisibility: 0.5,
  /** Noise radius while walking upright; a guard inside it turns to look. Crouching is silent. */
  walkNoiseRadius: 96,
  coinCooldown: 2.5,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 74,
  investigateSpeed: 118,
  chaseSpeed: 196,
  searchSpeed: 96,
  /** How long a guard pauses at each patrol waypoint, seconds. */
  waypointPause: 1.1,
  /** Vision: a cone this long and this wide (full angle, degrees). */
  sightRange: 252,
  sightHalfAngle: 38,
  /** Inside this radius a guard notices the player even outside the cone (peripheral sense). */
  nearRadius: 44,
  /** Seconds of clear sight at arm's length needed to go from calm to full alarm. */
  detectSecondsClose: 0.45,
  detectSecondsFar: 1.6,
  /** Suspicion drains this fast per second once the player is out of sight. */
  suspicionDecay: 0.34,
  /** A chasing guard who loses the trail searches this long before giving up. */
  searchSeconds: 3.4,
  /** Touching distance: a guard this close catches the player. */
  catchRadius: 26,
};

export const COIN = {
  /** A tossed coin lands this far toward the click, at most. */
  maxThrow: 300,
  /** Guards within this radius of the landing clink go to look at it. */
  lureRadius: 330,
  flightSeconds: 0.45,
};

export const ALARM = {
  /** Each full sighting raises the house alarm; at the cap, patrols speed up. */
  max: 3,
  patrolBoost: 1.18,
};

/** localStorage key for the best (fastest, cleanest) finished run. */
export const BEST_KEY = 'night-vault-best-v1';
