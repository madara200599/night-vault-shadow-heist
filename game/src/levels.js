// The three floors of the Night Vault, laid out as data: walls and crates are solid
// rectangles (they block movement and sight alike), shadows and light pools are floor
// ellipses that change how visible the player is standing in them, guards are waypoint
// loops a patient player can learn, and every floor hides three relics between the
// start and the locked exit.

function wall(x, y, w, h) { return { x, y, w, h }; }
function crate(x, y, size = 42) { return { x, y, w: size, h: size }; }
function ellipse(x, y, rx, ry) { return { x, y, rx, ry }; }

export const LEVELS = [
  {
    name: 'Floor One — The Lobby Vault',
    briefing: 'Slip past the night watch, lift all three relics, and reach the green exit unseen.',
    parSeconds: 75,
    start: { x: 84, y: 706 },
    exit: { x: 1152, y: 30, w: 92, h: 92 },
    walls: [
      wall(392, 0, 16, 296),
      wall(392, 488, 16, 312),
      wall(852, 128, 16, 424),
      wall(860, 242, 420, 16),
      wall(0, 552, 296, 16),
    ],
    crates: [
      crate(238, 168), crate(238, 212),
      crate(566, 402), crate(706, 168),
      crate(972, 428), crate(1108, 300),
      crate(600, 600, 40), crate(168, 620, 40),
      crate(1120, 560, 40),
    ],
    shadows: [ellipse(300, 716, 130, 58), ellipse(716, 76, 120, 52), ellipse(1168, 716, 110, 56), ellipse(96, 96, 96, 52)],
    lights: [ellipse(624, 392, 96, 70), ellipse(1010, 140, 84, 60), ellipse(210, 300, 76, 56)],
    relics: [
      { x: 640, y: 108, label: 'the Sun Idol' },
      { x: 168, y: 392, label: 'the Jade Serpent' },
      { x: 1150, y: 668, label: 'the Brass Astrolabe' },
    ],
    guards: [
      { waypoints: [[486, 140], [806, 140]], pause: 1.2 },
      { waypoints: [[1052, 330], [1052, 636]], pause: 0.9 },
      { waypoints: [[486, 676], [768, 676], [768, 486], [486, 486]], pause: 0.7 },
    ],
  },
  {
    name: 'Floor Two — The Archive Stacks',
    briefing: 'Long shelves, longer sightlines. Crouch in the stacks and let the patrols pass.',
    parSeconds: 95,
    start: { x: 80, y: 96 },
    exit: { x: 1152, y: 668, w: 92, h: 92 },
    walls: [
      wall(300, 120, 16, 420),
      wall(620, 0, 16, 300),
      wall(620, 452, 16, 348),
      wall(940, 200, 16, 420),
      wall(316, 620, 420, 16),
    ],
    crates: [
      crate(120, 300), crate(120, 344), crate(120, 388),
      crate(430, 180), crate(430, 224),
      crate(430, 470), crate(474, 470),
      crate(760, 330), crate(760, 374), crate(760, 418),
      crate(1060, 90), crate(1060, 470),
      crate(820, 660, 40), crate(520, 700, 40),
    ],
    shadows: [ellipse(180, 690, 120, 56), ellipse(520, 90, 110, 50), ellipse(1090, 330, 100, 60), ellipse(700, 560, 110, 54)],
    lights: [ellipse(470, 330, 92, 66), ellipse(790, 120, 84, 58), ellipse(1080, 640, 80, 56)],
    relics: [
      { x: 520, y: 560, label: 'the Ivory Codex' },
      { x: 1096, y: 180, label: 'the Onyx Chalice' },
      { x: 180, y: 560, label: 'the Silver Astrolabe' },
    ],
    guards: [
      { waypoints: [[140, 180], [140, 520]], pause: 1.0 },
      { waypoints: [[420, 90], [560, 90], [560, 560], [420, 560]], pause: 0.6 },
      { waypoints: [[730, 560], [880, 560], [880, 130], [730, 130]], pause: 0.6 },
      { waypoints: [[1030, 620], [1180, 620], [1180, 260]], pause: 1.1 },
    ],
  },
  {
    name: 'Floor Three — The Director’s Vault',
    briefing: 'Five watchmen, one vault, no second chances. Ghost it if you can.',
    parSeconds: 110,
    start: { x: 84, y: 400 },
    exit: { x: 1156, y: 354, w: 88, h: 88 },
    walls: [
      wall(330, 0, 16, 250),
      wall(330, 410, 16, 390),
      wall(660, 150, 16, 500),
      wall(990, 0, 16, 300),
      wall(990, 460, 16, 340),
      wall(346, 250, 214, 16),
      wall(676, 560, 314, 16),
    ],
    crates: [
      crate(150, 130), crate(150, 174),
      crate(480, 420), crate(524, 420),
      crate(480, 90, 40),
      crate(800, 250), crate(800, 294),
      crate(820, 660, 40), crate(180, 620, 40),
      crate(1090, 560), crate(1090, 604),
    ],
    shadows: [ellipse(120, 760, 120, 48), ellipse(560, 700, 120, 54), ellipse(850, 90, 110, 50), ellipse(1160, 180, 100, 54)],
    lights: [ellipse(500, 330, 96, 68), ellipse(830, 430, 88, 62), ellipse(180, 420, 80, 58)],
    relics: [
      { x: 170, y: 300, label: 'the Moon Pearl' },
      { x: 830, y: 110, label: 'the Ember Crown' },
      { x: 1150, y: 690, label: 'the Tide Sceptre' },
    ],
    guards: [
      { waypoints: [[140, 90], [270, 90], [270, 700], [140, 700]], pause: 0.5 },
      { waypoints: [[420, 330], [600, 330], [600, 120], [420, 120]], pause: 0.6 },
      { waypoints: [[740, 480], [920, 480], [920, 660], [740, 660]], pause: 0.6 },
      { waypoints: [[1080, 120], [1180, 120], [1180, 300], [1080, 300]], pause: 0.8 },
      { waypoints: [[740, 90], [920, 90]], pause: 1.3 },
    ],
  },
];
