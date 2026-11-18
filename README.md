# Solmar Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/feriyansyahlubis/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/feriyansyahlubis/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game for the make.fun **gta6-01** bounty: a sun-soaked
coastal city you can cross on foot or by car, with traffic and pedestrians,
car theft, a five-star wanted level with police chases, five story missions,
combat, a HUD with a minimap, and a save that remembers your progress.

Leo Vega is back in Solmar City, and he owes $10,000 to the wrong people.
Steal cars, outrun the Solmar PD, run jobs for the fixer Dante — and clear
the debt before the city clears you. Every place, character, vehicle, name
and story beat is original; nothing here is taken from any commercial game.

## Play it

Serve the game folder and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: the game is plain static files, and the
3D engine (three.js r160) is vendored under `game/vendor/`. `?seed=N` fixes
the city layout; `?shot=cover|chase|mission|city&seed=1` stages one of the
four screenshot scenes.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| SHIFT | Run (on foot) |
| SPACE | Jump (on foot) / handbrake (driving) |
| E | Get in / out of a car |
| F | Punch |
| CLICK | Shoot the pistol |
| M | Mission list (click the current job to retry it) |
| R | Radio on / off |
| P / ESC | Pause |
| Drag mouse | Look around |

## The city

Solmar City is a 9×9 grid of blocks (522 m across) with a beach and a pier
at its southern edge, a downtown tower, Dante's Garage, Solmar Bank and
Hotel Palma. Traffic follows the road lanes, pedestrians use the sidewalks
and flee from danger, and police cruisers spawn by wanted level, chase,
ram, and shoot at three stars and up.

Stealing a parked car is free. Stealing a moving car, hitting a pedestrian,
ramming a police car, or firing the pistol raises your wanted level; lay low
and it cools off. Get busted and you lose $200 and wake up at the garage.

## Missions

1. **Welcome Back** ($300) — steal any car, drive to Dante's Garage.
2. **Pizza Run** ($500) — three deliveries in 150 seconds.
3. **The Getaway** ($800) — lose a three-star wanted level or reach the pier.
4. **Street King** ($1,200) — an eight-checkpoint race against three rivals.
5. **The Big Score** ($2,500) — wreck four rival cars at the bank, then escape.

Clear all five and the debt is gone; the city stays open for free roam.
Progress and money are saved in the browser.

## How it is built

```
game/
  index.html        the page, the HUD and the overlays
  src/
    main.js         boot, the loop, the screens, the wiring
    config.js       every tunable number in one place
    city.js         the city: blocks, landmarks, palms, beach, pier
    vehicles.js     car meshes and arcade driving physics
    traffic.js      traffic cars and pedestrians
    police.js       wanted level, chases, busts, decay
    missions.js     the five jobs and their rules
    player.js       Leo on foot
    combat.js       pistol shots and tracers
    hud.js          money, health, stars, objective, minimap
    audio.js        WebAudio engine, sirens, radio, effects
    shots.js        the four scripted screenshot scenes
    save.js         localStorage save
    input.js        keyboard and mouse
    random.js       seeded random
    textures.js     procedural canvas textures
  vendor/three.module.min.js   three.js r160, vendored
main.ts             the hand-in: copies game/ + screenshots/ to /output
                    and writes dossier.json
```

The code is split so each file owns one system, and every number that
tunes the feel lives in `config.js`. The game runs offline from static
files; the only state it keeps is the save in `localStorage`.

## Screenshots

The four screenshots in `screenshots/` are frames of real play, staged by
`?shot=` scenes: driving up the central avenue with a two-star wanted
level, a three-star police chase, the big score at the bank, and the city
from the beach at sunset.
