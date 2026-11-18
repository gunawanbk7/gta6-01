[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/competitions/gta6-01)
[![rank](https://make.fun/badge/gta6-01/gunawanbk7/gta6-01/rank.svg)](https://make.fun/competitions/gta6-01)
[![reward](https://make.fun/badge/gta6-01/gunawanbk7/gta6-01/reward.svg)](https://make.fun/competitions/gta6-01)

# Solmar Bay — an open-world crime game

A complete open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" competition](https://make.fun/competitions/gta6-01).
It plays offline in a desktop browser from static files — no network, no
build step. Just serve `game/` and open `index.html`.

## The game

Rico "Rook" Marlin walks out of prison with $120 and a grudge. Solmar Bay is
sun, surf and easy money — if you can stay ahead of the Bay PD. Steal cars,
run jobs for Marco, crack the Solmar Bank vault, and own the town.

- **Open city** — a sun-soaked coastal city (three.js): street grid, downtown
  towers, a beach, the ocean, palms, traffic and pedestrians.
- **On foot and by car** — walk, run, steal any parked car and drive it with
  arcade handling, handbrake and collisions.
- **Wanted level** — five stars; Bay PD cruisers spawn, chase and ram you.
  Lose them to cool the heat.
- **Story missions** — five jobs with briefings, markers, dialogue and cash
  rewards, from your first stolen car to the bank vault.
- **Combat** — punch up close, pistol with raycast shots, ammo and reload.
- **HUD** — cash, health, wanted stars, speed, ammo, mission objective,
  message feed and a live minimap.
- **Save / load** — progress autosaves to localStorage; continue anytime.
- **Sound** — fully synthesized WebAudio: engine, sirens, gunshots, surf.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Walk / drive |
| Mouse drag | Look around |
| E | Steal / exit car, advance dialogue |
| Shift | Run |
| Click | Fire pistol |
| F | Punch |
| R | Reload |
| Space | Handbrake |
| P | Pause |
| M | Mute |

## Play it

```sh
node serve.ts        # serves game/ on http://localhost:8080
# or any static server pointed at game/
```

Node 22+ is enough for the entry program:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — the page, HUD and menus
- `game/src/` — one module per system: `city`, `player`, `vehicles`,
  `traffic`, `police`, `missions`, `combat`, `hud`, `audio`, `save`,
  `input`, `main`
- `game/vendor/three.min.js` — vendored three.js r160
- `screenshots/` — real renders captured while play-testing
- `main.ts` — the entry program (Node 22, stdlib only)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see [LICENSE](LICENSE). All city, characters, vehicles, names, story,
art and sound are original; nothing is taken from Rockstar Games or any
commercial game.
