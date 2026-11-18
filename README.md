# Solmar Bay — an open-world crime game

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-orange)](https://make.fun/c/gta6-01)
[![GitHub](https://img.shields.io/github/stars/gunawanbk7/gta6-01?style=social)](https://github.com/gunawanbk7/gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Solmar Bay** is a complete open-world crime game in the spirit of GTA 6, built
for the [make.fun gta6-01 competition](https://make.fun/c/gta6-01). It runs
entirely offline in a desktop browser from static files — no network, no build
step, no account.

Mara Voss is back in Solmar Bay, a sun-soaked coastal city of palms, piers and
fast money, with $120 and nothing to lose. Rico Vane, the fixer of the marina,
has four jobs that pay. The Solmar Bay Police Department has other ideas.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html`.

## What is in the game

- **An open world to explore** — a procedural 3D coastal city (three.js): a road
  grid, towers and hotels, Solmar Plaza, a beach, a pier and a living ocean.
- **On foot and by car** — walk, run, steal any car on the street and drive it,
  with arcade handling, handbrake and a chase camera.
- **Traffic and pedestrians** — cars cruise the roads, locals stroll the
  sidewalks and flee when shots are fired.
- **A wanted system** — 1–5 stars. SBPD cruisers chase, ram and try to bust
  you; slip away and the heat cools down.
- **A story in four missions** — *First Wheels*, *Sunset Courier*,
  *Bayfront Heat* and *The Marina Job*, with markers, dialogue, timers and
  cash rewards up to $1,500.
- **Combat** — fists and a pistol, with tracers, muzzle flash and hostile
  marina guards who shoot back.
- **A full HUD** — cash, health, wanted stars, speed, mission objective,
  message feed, dialogue and a live minimap.
- **Start screen, pause and save** — progress (cash, health, missions,
  position) saves to localStorage automatically after every mission.
- **Synthesised sound** — engine hum, sirens, gunshots and mission jingles,
  all generated live with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move / drive |
| Shift | Run |
| Mouse drag | Look around |
| E | Steal / enter / exit car |
| Space | Handbrake |
| F | Punch |
| 1 / 2 | Fists / pistol |
| Click / J | Shoot |
| R | Reload |
| Esc / P | Pause & save |
| M | Mute |

## Structure

```
main.ts                  entry program: copies game/ + screenshots/ to /output
                         and writes dossier.json (Node 22, stdlib only)
game/
  index.html             the page: HUD, start / pause / end screens
  vendor/three.min.js    three.js r160 (vendored)
  src/
    main.js              game loop, camera, states, car stealing
    city.js              the city: roads, buildings, beach, pier, ocean
    player.js            the player on foot
    vehicles.js          car models and arcade driving
    traffic.js           traffic cars and pedestrians
    police.js            wanted level and SBPD pursuit
    combat.js            fists, pistol, tracers, guards shooting back
    missions.js          the 4-mission story chain
    hud.js               HUD and live minimap
    audio.js             synthesised WebAudio sound
    save.js              localStorage save / load
    input.js             keyboard and mouse
    util.js              math and seeded random helpers
screenshots/            real renders of the game, taken in headless Chrome
```

## Originality

Solmar Bay is an original game: its city, characters, vehicles, names, story,
art and sounds were made for this game alone. Nothing is taken from Rockstar
Games or any other commercial game.

## License

MIT — see [LICENSE](LICENSE).
