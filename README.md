# Night Vault: Shadow Heist

[![make.fun bounty](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/madara200599/night-vault-shadow-heist/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/madara200599/night-vault-shadow-heist/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

An original top-down stealth game in plain HTML and JavaScript — no build step, no
libraries, no network requests. You are a thief inside the Night Vault after hours.
Three floors, twelve patrolling watchmen between you and the way out.

**Steal every relic on the floor, then reach the green EXIT unseen.**

## How to play

Serve `game/` with any static file server (or run `node serve.ts` and open
http://localhost:8080), then:

- **WASD / arrow keys** — move
- **SHIFT (hold)** — crouch: slow and silent, with a lower profile in a vision cone
- **Click / E** — toss a coin; a small aim ring shows where it will land, and guards leave their patrol to investigate the clink
- **P / Esc** — pause

Guards patrol waypoint loops with raycast vision cones that walls and crates block.
Suspicion fills while you are seen — faster up close, in a light pool, or standing
upright — and drains while you are hidden, so a glimpse can always be escaped:
break the line of sight and wait it out. Walking upright makes noise a nearby
guard will turn toward; crouching is silent. Full sightings raise the house alarm
and speed the patrols up. Get caught and the floor resets — the patrols do not
change, so what you learned still holds. Finish all three floors and the run is
ranked: **GHOST** if you were never spotted at all.

All sound is synthesized live with WebAudio — footsteps (a nearby guard's steps
are audible, so your ears work as radar), the coin's clink, suspicion blips, alarm
stings and the vault's low hum. No audio files.

## Layout

- `main.ts` — the hand-in program (Node 22, standard library only): copies
  `game/` and `screenshots/` to `/output` and writes `dossier.json` with the
  vendored `vendor/makefun-game.ts`.
- `game/index.html` — the page; everything it loads lives under `game/`.
- `game/src/` — the game, one job per file:
  - `config.js` — every tuning number (speeds, sight range, detection rates)
  - `levels.js` — the three floors as data: walls, crates, light, shadow, patrols
  - `geometry.js` — segment/ray math, line of sight, circle collision
  - `vision.js` — raycast vision-cone polygons and sight strength
  - `guards.js` — the watchmen's state machine: patrol, investigate, chase, search, return
  - `world.js` — the rules: movement, coins, relics, alarm, capture, the exit
  - `render.js` — canvas drawing: floor, cones, cover, HUD, aim ring, screens
  - `input.js` — keyboard and mouse as state for the loop
  - `audio.js` — the WebAudio synth
  - `shots.js` — the staged scenes behind `?shot=cover|sneak|alarm|exit`
  - `main.js` — boot, the fixed-step loop, screens, sounds, the best-run record
- `screenshots/` — four real renders of the game, staged by `shots.js`
  (see `shots.json`), the first is the cover.
- `serve.ts` — a tiny local static server for play-testing.

## Verify the hand-in locally

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Entered via referral code r7k9dyj1
