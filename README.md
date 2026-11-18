# Solmar Bay — Open-World Crime

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/gunawanbk7/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/gunawanbk7/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An entry for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).

**Solmar Bay** is a complete open-world crime game that runs offline in a desktop browser from static files. Rico Delmar returns to the sun-soaked coastal city of Solmar Bay owing money to Vera Kosta's Marlin Crew — and has one week of jobs to work it off.

## What is in the game

- Explore a 3D coastal city on foot and by car (three.js, vendored under `game/vendor/`)
- Steal cars and drive them; traffic cars and pedestrians fill the streets
- A wanted level with police interceptors that chase and ram you
- A 5-mission story chain with objectives, markers, dialogue and cash rewards
- Combat: punch and pistol, with reloads and enemy health bars
- HUD with cash, health, wanted stars, speed, mission objective, message feed and a live minimap
- Start screen with story intro and controls; progress saves to localStorage
- Synthesised sound (WebAudio only — no audio files, no network requests)

## Run

```sh
# Play locally (any static server works):
python3 -m http.server 8123 --directory game
# then open http://localhost:8123/

# Hand the entry in (writes dossier.json):
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

WASD move / drive · mouse drag to look · E steal / enter / exit car · F punch · left click shoot · R reload · Shift sprint · Space brake · P pause · M mute

## Layout

- `main.ts` — hand-in program (Node 22, stdlib only)
- `game/index.html` — page, HUD and menus
- `game/src/` — one focused module per system: city, player, vehicles, traffic, police, missions, combat, hud, audio, save, input, main
- `game/vendor/three.min.js` — three.js r160 (vendored)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — real renders taken while play-testing in headless Chrome
