[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/feriyansyahlubis/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/feriyansyahlubis/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar Heat

An original open-world crime game for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01): a sun-soaked coastal city, on foot and by car, traffic and pedestrians, car theft, a wanted level with police chases, five story missions, combat, a HUD with a minimap, a start screen and a save — all in screenshots of the game itself.

**Story:** Leo Vega owes **$10,000**. Fixer Dante has jobs. Steal cars, run deliveries, lose the heat, win a street race, pull one big score — clear the debt and own Solmar City.

Everything is original: own city, characters, vehicles, names and story, procedural art, synthesized sound. No Rockstar names, logos, characters, maps or assets.

## Play

Open `game/index.html` in desktop Chrome (or run `node serve.ts` and visit http://localhost:8080). No network needed — the game runs fully offline from static files.

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse drag | Look around |
| Click | Shoot pistol |
| E | Enter / exit car |
| Shift | Run |
| Space | Jump (on foot) / handbrake (driving) |
| F | Punch |
| M | Jobs list (click the current job to restart it) |
| R | Radio on/off |
| Esc / P | Pause |

`?lowfx=1` disables shadow maps (weak-machine mode). `?shot=cover|chase|mission|city` stages a deterministic screenshot scene and sets `window.__shotReady` when it is framed.

## The city

Solmar City is a 9×9 block grid (44 m blocks, 14 m roads) with a beach and ocean to the south, a pier, palms, parks and streetlights. Landmarks: **Solmar Tower** downtown, **Dante's Garage**, **Solmar Bank**, **Hotel Palma** on the beachfront. Buildings are procedural — warm facades with lit windows, roof slabs and AC boxes.

## Missions

1. **Welcome Back** ($300) — steal any car, bring it to Dante's Garage.
2. **Pizza Run** ($500) — three deliveries in 150 seconds.
3. **The Getaway** ($800) — starts at 3 stars; lose the heat or reach the pier in 90 seconds.
4. **Street King** ($1,200) — eight-checkpoint race against three rivals, finish top 2.
5. **The Big Score** ($2,500) — wreck four rival cars around the bank, then escape to the pier.

Finish all five and the debt is cleared — free roam.

## Wanted

Stealing a parked car is clean. Stealing a moving traffic car is +1 star, hitting a pedestrian +1, ramming a police car +1, shooting +2. Stars bring 1–5 police chasers; at 3+ stars they shoot back. Stay out of sight and the heat decays. Get caught on foot and you are busted: −$200 and a wake-up at the garage.

## Build & structure

- `main.ts` — hand-in program: copies `game/` + `screenshots/` to `/output` (`MAKEFUN_OUTPUT_DIR` overrides) and writes `dossier.json` via the kit's `buildDossier`.
- `serve.ts` — tiny static server for local testing (port 8080).
- `shots.json` — the four staged screenshot scenes.
- `game/index.html` — HUD, overlays, import map (`three` → vendored three.js).
- `game/src/` — one clear job per file:
  - `config.js` — world, player, car, wanted and mission constants.
  - `random.js` — seeded RNG (mulberry32).
  - `input.js` — keyboard + mouse-drag input.
  - `textures.js` — procedural canvas textures (ground map, facades, signs, ocean, sky).
  - `city.js` — the city, landmarks, props, colliders.
  - `vehicles.js` — car meshes and arcade driving physics.
  - `player.js` — Leo on foot.
  - `traffic.js` — traffic cars and pedestrians.
  - `police.js` — wanted stars, chasers, bust, decay, shooting.
  - `combat.js` — pistol ray test, tracer, muzzle flash.
  - `missions.js` — the five story missions and the beacon.
  - `hud.js` — money, health, stars, objective, toast, minimap, jobs panel.
  - `audio.js` — WebAudio engine, siren, effects, radio bassline.
  - `save.js` — localStorage progress.
  - `shots.js` — staged screenshot scenes.
  - `main.js` — boot, fixed-step loop, cameras, screens, shot mode.
- `game/vendor/three.module.min.js` — three.js r160 (vendored, minified).
- `screenshots/` — 1-cover, 2-chase, 3-mission, 4-city.

## License

MIT — see `LICENSE`.
