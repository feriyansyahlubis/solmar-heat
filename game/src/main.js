// Solmar Heat — boot, game loop, cameras, screens, shot mode.

import * as THREE from 'three';
import { WORLD, STEP, MAX_FRAME, PLAYER, CAR, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION } from './input.js';
import { buildCity } from './city.js';
import { createVehicleSystem } from './vehicles.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions, MISSION_LIST } from './missions.js';
import { createActivities } from './activities.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const lowfx = params.get('lowfx') === '1';
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '1337', 10);
const rng = createRandom(seed);

// --- Renderer / scene ---
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = !lowfx;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe8a06a, 220, 900);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

// --- Systems ---
const city = buildCity(scene, rng);
const vehicles = createVehicleSystem(scene, city.colliders);
const player = createPlayer(scene);
player.setColliders(city.colliders);
const traffic = createTraffic(scene, vehicles, city.colliders, rng);
const police = createPolice(scene, vehicles, rng);
const combat = createCombat(scene);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

let money = 0;
let completed = [];
const saved = loadSave();
if (saved) {
  money = saved.money || 0;
  completed = saved.completed || [];
}

// --- Progress persistence (missions + coins) ---
let activities = null;
function persist() {
  writeSave({
    money,
    completed,
    coins: activities ? activities.takenIndices() : saved && saved.coins ? saved.coins : [],
  });
}

// --- Missions ---
let hudObjective = '';
const missions = createMissions(scene, city.landmarks, vehicles, rng, {
  toast: (t) => hud.showToast(t),
  objective: (t) => {
    hudObjective = t;
  },
  money: (n) => {
    money += n;
  },
  complete: (m) => {
    money += m.reward;
    completed.push(m.id);
    persist();
    audio.complete();
    hud.showToast(`Mission complete! +$${m.reward}`);
    if (completed.length >= MISSION_LIST.length) {
      showScreen('finale');
    } else {
      nextMissionTimer = 2.5;
    }
  },
  fail: (title, reason) => {
    hud.showToast(`${title} failed — ${reason} Press M to retry.`, 4200);
  },
  pickup: () => audio.pickup(),
  setWanted: (n) => police.setStars(n),
  completedCount: () => completed.length,
});

// --- Side activity: Solmar Coins ---
activities = createActivities(scene, {
  onCoin: (index, collected, value) => {
    money += value;
    hud.showToast(`Solmar Coin +$${value} — ${collected}/${activities.total} found`);
    audio.pickup();
    persist();
  },
});
if (saved && saved.coins) activities.restore(saved.coins);

// --- State ---
let screen = 'title';
let playerCar = null;
let nextMissionTimer = 0;
let time = 0;
let ramPoliceCooldown = 0;
const cam = { yaw: 0, pitch: 0.25, mode: 'title', dist: null, height: null, lookAt: null };
let titleAngle = 0;

function focusPos() {
  return playerCar ? playerCar.pos : player.pos;
}

function showScreen(name) {
  screen = name;
  for (const id of ['title', 'pause', 'busted', 'finale']) {
    const el = document.getElementById(id);
    if (el) el.style.display = id === name ? 'flex' : 'none';
  }
  if (name === 'pause') {
    const stats = document.getElementById('pause-stats');
    if (stats) stats.textContent = `Cash $${money.toLocaleString('en-US')} — Jobs done ${completed.length}/${MISSION_LIST.length} — Debt $${(10000 - money).toLocaleString('en-US')} to go`;
  }
}

function enterCar(car, silent) {
  playerCar = car;
  car.isPlayer = true;
  car.parked = false;
  player.mesh.visible = false;
  cam.mode = 'chase';
  cam.dist = null;
  cam.height = null;
  cam.lookAt = null;
  if (!silent) {
    if (car.isPolice) {
      police.addWanted(WANTED.SHOOT);
      hud.showToast('You stole a police car! +2 stars');
    } else if (car.traffic) {
      police.addWanted(WANTED.STEAL_CAR);
      hud.showToast('Car stolen! +1 star');
    }
    audio.start();
  }
}

function exitCar(silent) {
  if (!playerCar) return;
  const car = playerCar;
  car.isPlayer = false;
  player.pos.set(car.pos.x + 2.5, 0, car.pos.z);
  player.heading = car.heading;
  player.mesh.rotation.y = car.heading;
  player.mesh.visible = true;
  playerCar = null;
  cam.mode = 'foot';
  cam.dist = null;
  cam.height = null;
  cam.lookAt = null;
  if (!silent) hud.showToast('On foot');
}

function onBusted() {
  if (screen === 'busted') return;
  money = Math.max(0, money - 200);
  police.clear();
  if (playerCar) exitCar(true);
  player.pos.set(city.landmarks.garage.x, 0, city.landmarks.garage.z);
  player.heading = 0;
  player.mesh.rotation.y = 0;
  player.health = 100;
  cam.mode = 'foot';
  persist();
  audio.busted();
  showScreen('busted');
}

function spawnParkedCars() {
  const spots = [
    ['sports', -158, -25.5, Math.PI / 2, 0xc0392b],
    ['sedan', -120, -40, 0, 0x7a8a99],
    ['pickup', -200, 30, Math.PI / 2, 0x8e6b3d],
    ['van', 100, -100, 0, 0x5d8a66],
    ['sedan', 145, 40, -Math.PI / 2, 0x2e86c1],
    ['sports', -40, 200, Math.PI, 0xe67e22],
    ['taxi', 200, 145, Math.PI / 2, 0xf5c542],
    ['sedan', -100, -180, 0, 0xecf0f1],
  ];
  for (const [type, x, z, h, color] of spots) {
    const car = vehicles.spawn(type, x, z, h, color);
    car.parked = true;
  }
}
spawnParkedCars();

// Player starts at the garage marker.
player.pos.set(city.playerSpawn.x, 0, city.playerSpawn.z);

// --- Shot mode ---
const shotMode = !!shotName;
let shotObj = null;
let shotTime = 0;
let shotDone = false;
const G = {
  player,
  vehicles,
  traffic,
  police,
  missions,
  city,
  get cameraYaw() {
    return cam.yaw;
  },
  set cameraYaw(v) {
    cam.yaw = v;
  },
  setObjective: (t) => {
    hudObjective = t;
  },
  setCameraMode: (m) => {
    cam.mode = m;
  },
  setCameraFrame: (dist, height) => {
    cam.dist = dist;
    cam.height = height;
  },
  setCameraLookAt: (x, y, z) => {
    cam.lookAt = new THREE.Vector3(x, y, z);
  },
  enterCar,
  exitCar,
};
if (shotMode) {
  document.body.dataset.shot = '1';
  showScreen('play');
  screen = 'play';
  shotObj = stageShot(shotName, G);
  audio.start();
}

// --- Overlay buttons ---
const btnStart = document.getElementById('btn-start');
if (btnStart) {
  btnStart.addEventListener('click', () => {
    money = 0;
    completed = [];
    activities.reset();
    persist();
    player.health = 100;
    player.pos.set(city.playerSpawn.x, 0, city.playerSpawn.z);
    audio.start();
    showScreen('play');
    nextMissionTimer = 0.8;
    hud.showToast("Welcome back, Leo. Steal a car — Dante's waiting.");
  });
}
const btnContinue = document.getElementById('btn-continue');
if (btnContinue) {
  if (!saved || completed.length === 0) btnContinue.style.display = 'none';
  btnContinue.addEventListener('click', () => {
    player.health = 100;
    player.pos.set(city.playerSpawn.x, 0, city.playerSpawn.z);
    audio.start();
    showScreen('play');
    nextMissionTimer = 0.8;
    hud.showToast(`Welcome back, Leo. $${money} in the bank, ${completed.length}/${MISSION_LIST.length} jobs done.`);
  });
}
const btnResume = document.getElementById('btn-resume');
if (btnResume) btnResume.addEventListener('click', () => showScreen('play'));
const btnQuit = document.getElementById('btn-quit');
if (btnQuit) {
  btnQuit.addEventListener('click', () => {
    persist();
    showScreen('title');
  });
}
const btnBusted = document.getElementById('btn-busted');
if (btnBusted) {
  btnBusted.addEventListener('click', () => {
    player.health = 100;
    showScreen('play');
  });
}
const btnFinale = document.getElementById('btn-finale');
if (btnFinale) btnFinale.addEventListener('click', () => showScreen('play'));

// Mission list: click the current job to restart it.
document.addEventListener('click', (e) => {
  const row = e.target.closest ? e.target.closest('.mission-row') : null;
  if (!row) return;
  const i = parseInt(row.dataset.mission, 10);
  if (i === completed.length && screen === 'play') {
    input.clicked(); // consume the click so it does not also fire the pistol
    hud.closeMissionList();
    missions.startMission(i);
    hud.showToast(`${MISSION_LIST[i].title} — restarted`);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play' && !shotMode) showScreen('pause');
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Per-step world update ---
function stepWorld(dt) {
  time += dt;
  const focus = focusPos();

  if (!shotMode && screen === 'play') {
    const look = input.takeLook();
    cam.yaw -= look.dx * 0.004;
    cam.pitch = Math.max(-0.4, Math.min(0.7, cam.pitch + look.dy * 0.003));

    const actions = input.takeActions();
    if (actions & ACTION.PAUSE) showScreen('pause');
    if (actions & ACTION.MISSIONS) hud.toggleMissionList(missions, completed.length);
    if (actions & ACTION.RADIO) {
      const on = audio.toggleRadio();
      hud.showToast(on ? 'Radio on — Solmar FM' : 'Radio off');
    }
    if (actions & ACTION.ENTER_CAR) {
      if (playerCar) exitCar(false);
      else {
        const car = vehicles.nearestCar(player.pos, 3.6);
        if (car) enterCar(car, false);
      }
    }
    if (actions & ACTION.JUMP && !playerCar) player.jump();
    if (actions & ACTION.PUNCH && !playerCar) {
      if (player.punch()) {
        audio.punch();
        const ped = traffic.nearestPed(player.pos, PLAYER.PUNCH_RANGE + 0.5);
        if (ped) {
          traffic.knockDown(ped);
          traffic.scarePeds(player.pos, 12);
          police.addWanted(WANTED.HIT_PEDESTRIAN);
          hud.showToast('You punched a pedestrian! +1 star');
        }
      }
    }
    if (input.clicked() && !playerCar) {
      const origin = camera.position.clone();
      const dir = camera.getWorldDirection(new THREE.Vector3());
      audio.shoot();
      const res = combat.shoot(origin, dir, { peds: traffic.pedestrians, cars: vehicles.cars });
      if (res.hit) {
        if (res.hit.kind === 'ped') {
          traffic.knockDown(res.hit.target);
          traffic.scarePeds(player.pos, 14);
          police.addWanted(WANTED.SHOOT);
          hud.showToast('You shot a pedestrian! +2 stars');
        } else if (res.hit.target.isPolice) {
          police.addWanted(WANTED.RAM_POLICE);
          hud.showToast('You shot a police car! +1 star');
        }
      }
    }

    const axis = input.axis();
    if (playerCar) {
      vehicles.drive(playerCar, axis.z, -axis.x, input.handbrake(), dt);
      // Ram a police chaser at speed: +1 star (cooldown 2 s).
      ramPoliceCooldown -= dt;
      if (ramPoliceCooldown <= 0) {
        for (const c of police.chasers) {
          const d = Math.hypot(c.pos.x - playerCar.pos.x, c.pos.z - playerCar.pos.z);
          if (d < 4.2 && Math.abs(playerCar.speed) > 8) {
            police.addWanted(WANTED.RAM_POLICE);
            audio.crash();
            hud.showToast('You rammed a police car! +1 star');
            ramPoliceCooldown = 2;
            break;
          }
        }
      }
    } else {
      player.update(dt, axis.x, axis.z, cam.yaw, input.run());
    }

    // Mission auto-start timer.
    if (nextMissionTimer > 0) {
      nextMissionTimer -= dt;
      if (nextMissionTimer <= 0 && completed.length < MISSION_LIST.length) {
        missions.startNext();
      }
    }

    // Health regen when clean.
    if (police.getStars() === 0 && player.health < 100) {
      player.health = Math.min(100, player.health + 3 * dt);
    }
  }

  // Traffic always moves (also in shot mode).
  traffic.updateTraffic(dt, focus);
  const pedRes = traffic.updatePeds(dt, focus, playerCar);
  if (pedRes.hitPed && !shotMode && screen === 'play') {
    traffic.knockDown(pedRes.hitPed);
    traffic.scarePeds(playerCar.pos, 12);
    police.addWanted(WANTED.HIT_PEDESTRIAN);
    audio.crash();
    hud.showToast('You hit a pedestrian! +1 star');
  }

  // Police + missions run in real play only (shots stage their own).
  if (!shotMode && screen === 'play') {
    const pres = police.update(dt, focus, playerCar, !playerCar, onBusted);
    if (pres.shotPlayer) {
      player.health -= pres.damage;
      hud.showToast('Shot by police! -8 HP');
      if (player.health <= 0) onBusted();
    }
    missions.update(
      dt,
      {
        playerPos: focus,
        inCar: !!playerCar,
        car: playerCar,
        wanted: police.getStars(),
        playerCarSpeed: playerCar ? Math.abs(playerCar.speed) : 0,
        onRivalHit: () => audio.crash(),
      },
      time,
    );
  }

  vehicles.update(dt, time);
  combat.update(dt);

  // Side activity: coins spin always, collect only while really playing.
  activities.update(dt, focus, time, !shotMode && screen === 'play');

  // Ocean swell + drifting clouds.
  city.ocean.position.y = 0.08 + Math.sin(time * 0.7) * 0.03;
  for (const cloud of city.clouds) {
    cloud.position.x += dt * 0.6;
    if (cloud.position.x > 430) cloud.position.x = -430;
  }

  // Shot autopilot.
  if (shotMode && shotObj && !shotDone) {
    shotTime += dt;
    shotObj.update(dt);
    if (shotTime >= shotObj.seconds) {
      shotDone = true;
      window.__shotReady = true;
    }
  }

  // Ocean drift + sun follows the player (shadows stay crisp).
  if (city.ocean.material.map) {
    city.ocean.material.map.offset.x += dt * 0.02;
    city.ocean.material.map.offset.y += dt * 0.008;
  }
  const el = WORLD.SUN_ELEVATION;
  const az = WORLD.SUN_AZIMUTH;
  const sd = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  city.sun.position.set(focus.x + sd.x * 420, sd.y * 420, focus.z + sd.z * 420);
  city.sun.target.position.set(focus.x, 0, focus.z);

  // Audio: engine + siren.
  if (playerCar) {
    audio.setEngine(Math.abs(playerCar.speed) / CAR.MAX_SPEED, Math.abs(input.axis().z));
  } else {
    audio.setEngine(0, 0);
  }
  let nearestCop = Infinity;
  for (const c of police.chasers) {
    nearestCop = Math.min(nearestCop, Math.hypot(c.pos.x - focus.x, c.pos.z - focus.z));
  }
  audio.setSiren(police.chasers.length > 0 && nearestCop < 90, dt);

  // HUD.
  if (missions.active && !shotMode) hudObjective = missions.objectiveText();
  else if (!shotMode) hudObjective = '';
  let hint = '';
  if (screen === 'play' && !shotMode) {
    if (playerCar) hint = 'E — exit car • Space — handbrake • M — jobs';
    else {
      const near = vehicles.nearestCar(player.pos, 3.6);
      hint = near ? 'E — get in the car' : 'WASD — move • Shift — run • F — punch • Click — shoot • M — jobs';
    }
    if (police.getStars() > 0) hint = 'Lose the cops! • ' + hint;
  }
  hud.update(
    {
      money,
      health: player.health,
      wanted: police.getStars(),
      driving: !!playerCar,
      speed: playerCar ? playerCar.speed : 0,
      objective: hudObjective,
      hint,
      coins: { collected: activities.collected, total: activities.total },
      coinsList: activities.positions,
      target: missions.active
        ? missions.targetPos()
        : shotMode && missions.beacon.visible
          ? missions.beacon.position
          : null,
      traffic: traffic.trafficCars,
      police: police.chasers,
      player: focus,
      heading: playerCar ? playerCar.heading : player.heading,
    },
    time,
  );
}

// --- Camera ---
function updateCamera(dt) {
  const focus = focusPos();
  if (cam.mode === 'title') {
    titleAngle += dt * 0.045;
    camera.position.set(Math.sin(titleAngle) * 190, 62, Math.cos(titleAngle) * 190);
    camera.lookAt(0, 8, 40);
    camera.fov = 62;
    camera.updateProjectionMatrix();
    return;
  }
  if (cam.mode === 'vista') {
    camera.position.set(focus.x + Math.sin(cam.yaw) * 24, 15, focus.z + Math.cos(cam.yaw) * 24);
    camera.lookAt(focus.x, 2, focus.z - 90);
    camera.fov = 62;
    camera.updateProjectionMatrix();
    return;
  }
  if (playerCar) {
    const h = playerCar.heading;
    const dist = cam.dist ?? 10.5;
    const height = cam.height ?? 4.3;
    camera.position.set(
      playerCar.pos.x - Math.sin(h) * dist,
      height,
      playerCar.pos.z - Math.cos(h) * dist,
    );
    const look = cam.lookAt ?? new THREE.Vector3(
      playerCar.pos.x + Math.sin(h) * 6,
      1.5,
      playerCar.pos.z + Math.cos(h) * 6,
    );
    camera.lookAt(look);
    const targetFov = Math.min(78, 62 + Math.abs(playerCar.speed) * 0.35);
    camera.fov += (targetFov - camera.fov) * 0.1;
    camera.updateProjectionMatrix();
    return;
  }
  const dist = cam.dist ?? (6.5 - cam.pitch * 1.5);
  const height = cam.height ?? (2.2 + cam.pitch * 4.5);
  camera.position.set(focus.x + Math.sin(cam.yaw) * dist, height, focus.z + Math.cos(cam.yaw) * dist);
  const look = cam.lookAt ?? new THREE.Vector3(focus.x, 1.6, focus.z);
  camera.lookAt(look);
  camera.fov = 62;
  camera.updateProjectionMatrix();
}

// --- Main loop: fixed-step accumulator ---
// Read-only debug handle for automated playtests (position + progress).
window.__debug = {
  get playerPos() {
    return { x: player.pos.x, z: player.pos.z, health: player.health };
  },
  get driving() {
    return !!playerCar;
  },
  get car() {
    return playerCar
      ? { x: playerCar.pos.x, z: playerCar.pos.z, heading: playerCar.heading, speed: playerCar.speed }
      : null;
  },
  get money() {
    return money;
  },
  get completed() {
    return completed.slice();
  },
  get mission() {
    return { current: missions.current, active: missions.active, objective: hudObjective };
  },
  get coins() {
    return activities ? { collected: activities.collected, total: activities.total } : null;
  },
  teleport(x, z) {
    if (playerCar) exitCar(true);
    player.pos.set(x, 0, z);
  },
};

let last = performance.now();
let acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let frame = (now - last) / 1000;
  last = now;
  if (frame > MAX_FRAME) frame = MAX_FRAME;
  if (screen !== 'pause' && !(shotMode && shotDone)) {
    acc += frame;
    while (acc >= STEP) {
      stepWorld(STEP);
      acc -= STEP;
    }
  }
  updateCamera(frame);
  renderer.render(scene, camera);
}

showScreen(shotMode ? 'play' : 'title');
requestAnimationFrame(loop);
