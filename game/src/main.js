// Solmar Heat: boot, the one loop, the screens, and the wiring between every
// system. The game runs in fixed 1/60 s steps; the camera, the HUD and the
// sound follow what the world did.
//
// ?seed=N fixes the city. ?shot=cover|chase|mission|city (with &seed=N)
// stages that scene instead of the title screen, plays it forward and sets
// window.__shotReady for a screenshot.
import * as THREE from 'three';
import { STEP, WORLD, HALF_CITY, WANTED, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION } from './input.js';
import { buildCity, insideCity } from './city.js';
import { createPlayer } from './player.js';
import { createVehicleSystem } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions, MISSION_LIST } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const lowfx = params.get('lowfx') === '1'; // weak machines: no shadow maps
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const rng = createRandom(seed);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = !lowfx;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd8b48a, 180, 620);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

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

const game = {
  money: 0,
  completed: [],
  screen: 'title',
  drivingCar: null,
  cameraYaw: 0.6,
  cameraPitch: 0.45,
  cameraMode: 'foot',
  objectiveText: 'Welcome to Solmar City',
  nextMissionTimer: 0,
  titleAngle: 0,
  mouseYawOffset: 0,
};

function saveGame() {
  writeSave({ money: game.money, completed: game.completed, totalEarned: game.money });
}

function loadGame() {
  const save = loadSave();
  if (save) {
    game.money = save.money;
    game.completed = save.completed || [];
  }
}

// The object the screenshot scenes steer.
const G = {
  player,
  vehicles,
  traffic,
  police,
  missions: null,
  city,
  cameraYaw: 0.6,
  setObjective(text) { game.objectiveText = text; },
  setCameraMode(mode) { game.cameraMode = mode; },
  setCameraFrame(dist, height) { game.shotCamDist = dist; game.shotCamHeight = height; },
  setCameraLookAt(x, y, z) { game.shotLookAt = new THREE.Vector3(x, y, z); },
  enterCar(car, silent) { enterCar(car, silent); },
  exitCar(silent) { exitCar(silent); },
};

const missionEvents = {
  toast: (text) => hud.showToast(text),
  objective: (text) => { game.objectiveText = text; },
  money: (amount) => {
    game.money += amount;
    saveGame();
  },
  complete: (m) => {
    game.completed.push(m.id);
    audio.complete();
    hud.showToast(`${m.title} complete! +$${m.reward.toLocaleString()}`);
    saveGame();
    if (game.completed.length >= MISSION_LIST.length) {
      showFinale();
    } else {
      game.nextMissionTimer = 2.5;
    }
  },
  fail: (title, reason) => {
    hud.showToast(`${title} failed — ${reason} (press M to retry)`);
    audio.busted();
  },
  setWanted: (n) => police.setStars(n),
  pickup: () => audio.pickup(),
  completedCount: () => game.completed.length,
  onRivalHit: () => audio.crash(),
};
const missions = createMissions(scene, city.landmarks, vehicles, rng, missionEvents);
G.missions = missions;

function announce(message) {
  statusEl.textContent = message;
}

function showOverlay(id) {
  for (const name of ['title', 'pause', 'busted', 'finale']) {
    document.getElementById(name).classList.toggle('hidden', name !== id);
  }
  if (!id) {
    for (const name of ['title', 'pause', 'busted', 'finale']) document.getElementById(name).classList.add('hidden');
  }
}

function showFinale() {
  game.screen = 'finale';
  document.getElementById('finale-text').textContent =
    `Five jobs, $${game.money.toLocaleString()} in the bank, and the debt is gone. ` +
    'Solmar City is yours now, Leo — keep cruising, or start a new story.';
  showOverlay('finale');
  announce('Debt cleared. You won Solmar Heat.');
}

function goBusted(wasted) {
  if (game.screen !== 'play') return;
  game.screen = 'busted';
  const title = document.querySelector('#busted h1');
  const text = document.getElementById('busted-text');
  if (wasted) {
    title.textContent = 'WASTED!';
    text.textContent = 'Leo took one hit too many. The paramedics patched him up — minus $200 for the trouble.';
  } else {
    title.textContent = 'BUSTED!';
    text.textContent = 'The Solmar PD caught up with you. Bail set, ride impounded, pride dented. That cost you $200.';
  }
  game.money = Math.max(0, game.money - 200);
  police.clear();
  exitCar(true);
  player.health = 100;
  player.pos.copy(city.playerSpawn);
  player.vel.set(0, 0, 0);
  saveGame();
  audio.busted();
  showOverlay('busted');
  announce(wasted ? 'Wasted.' : 'Busted.');
}

function enterCar(car, silent) {
  if (game.drivingCar) return;
  game.drivingCar = car;
  car.isPlayer = true;
  car.parked = false;
  player.mesh.visible = false;
  game.cameraMode = 'chase';
  game.mouseYawOffset = 0;
  if (!silent) {
    if (car.isPolice) {
      police.addWanted(2);
      hud.showToast('You stole a police cruiser! +2★');
    } else if (car.isTraffic) {
      police.addWanted(WANTED.STEAL_CAR);
      hud.showToast('Carjacked! +1★');
      traffic.scarePeds(car.pos, 30);
    }
    audio.pickup();
  }
}

function exitCar(silent) {
  const car = game.drivingCar;
  if (!car) return;
  game.drivingCar = null;
  car.isPlayer = false;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  player.pos.set(car.pos.x + side.x * 2.2, 0, car.pos.z + side.z * 2.2);
  player.vel.set(0, 0, 0);
  player.mesh.visible = true;
  game.cameraMode = 'foot';
  if (!silent) audio.pickup();
}

// Parked cars along the curbs: free to take, no wanted level for it.
function spawnParkedCars() {
  const spots = [
    [-158, -25.5, Math.PI / 2], [-25.5, -60, Math.PI], [25.5, 20, 0], [-83.5, 100, Math.PI / 2], [90.5, -40, -Math.PI / 2],
    [-145.5, -145, 0], [145.5, 60, Math.PI], [-32.5, 180, Math.PI], [32.5, -180, 0],
    [-203.5, 29, Math.PI / 2], [203.5, -87, -Math.PI / 2], [-87.5, -203, 0], [87.5, 145, Math.PI],
  ];
  const types = ['sports', 'sedan', 'taxi', 'sports', 'pickup', 'van', 'sedan', 'sedan', 'sports', 'sedan', 'taxi', 'pickup', 'sedan'];
  spots.forEach(([x, z, heading], i) => {
    const car = vehicles.spawn(types[i % types.length], x, z, heading);
    car.parked = true;
  });
}

function shoot() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
  const peds = traffic.pedestrians;
  const cars = vehicles.cars.filter((c) => c !== game.drivingCar);
  const result = combat.shoot(origin, dir, { peds, cars });
  audio.shoot();
  traffic.scarePeds(player.pos, 40);
  if (result.hit) {
    if (result.hit.kind === 'ped') {
      traffic.knockDown(result.hit.target);
      police.addWanted(2);
      hud.showToast('You shot a pedestrian! +2★');
    } else {
      const car = result.hit.target;
      if (car.isPolice) police.addWanted(1);
      if (car.health <= 0) {
        car.speed = 0;
        hud.showToast('Car disabled!');
      }
    }
  }
}

function punch() {
  if (!player.punch()) return;
  audio.punch();
  const facing = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  const ped = traffic.nearestPed(player.pos, 2.2);
  if (ped) {
    const to = new THREE.Vector3(ped.pos.x - player.pos.x, 0, ped.pos.z - player.pos.z).normalize();
    if (to.dot(facing) > 0.3) {
      traffic.knockDown(ped);
      police.addWanted(1);
      hud.showToast('You punched a pedestrian! +1★');
      traffic.scarePeds(player.pos, 25);
    }
  }
}

function updateCamera(dt) {
  const mode = game.cameraMode;
  if (mode === 'vista') {
    // The postcard shot: over Leo's shoulder on the beach, into the city.
    camera.position.set(player.pos.x + Math.sin(game.titleAngle * 0.1) * 6, 15, player.pos.z + 24);
    camera.lookAt(player.pos.x, 4, player.pos.z - 90);
    camera.fov = 58;
    camera.updateProjectionMatrix();
    return;
  }
  if (mode === 'chase' && game.drivingCar) {
    const car = game.drivingCar;
    const yaw = car.heading + Math.PI + game.mouseYawOffset;
    const dist = 10.5;
    const height = 4.3;
    const tx = car.pos.x + Math.sin(yaw) * dist;
    const tz = car.pos.z + Math.cos(yaw) * dist;
    camera.position.lerp(new THREE.Vector3(tx, height, tz), Math.min(1, dt * 6));
    camera.lookAt(car.pos.x + Math.sin(car.heading) * 8, 1.4, car.pos.z + Math.cos(car.heading) * 8);
    const targetFov = 62 + Math.min(14, Math.abs(car.speed) * 0.32);
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
    game.mouseYawOffset *= Math.max(0, 1 - dt * 0.8);
    return;
  }
  // On foot: orbit around Leo.
  const dist = game.shotCamDist ?? (6.5 - game.cameraPitch * 1.5);
  const height = game.shotCamHeight ?? (2.2 + game.cameraPitch * 4.5);
  camera.position.set(
    player.pos.x + Math.sin(game.cameraYaw) * dist,
    height,
    player.pos.z + Math.cos(game.cameraYaw) * dist,
  );
  const lookTarget = game.shotLookAt ?? new THREE.Vector3(player.pos.x, 1.6, player.pos.z);
  camera.lookAt(lookTarget);
  camera.fov = 62;
  camera.updateProjectionMatrix();
}

function updateTitleCamera(dt) {
  game.titleAngle += dt * 0.05;
  const r = 190;
  camera.position.set(Math.cos(game.titleAngle) * r, 70, Math.sin(game.titleAngle) * r);
  camera.lookAt(0, 12, 0);
  camera.fov = 55;
  camera.updateProjectionMatrix();
}

function stepWorld(dt, time) {
  const axis = input.axis();
  const actions = input.takeActions();
  const look = input.takeLook();

  if (game.screen === 'play') {
    game.cameraYaw -= look.dx * 0.005;
    game.cameraPitch = Math.max(0.05, Math.min(1.1, game.cameraPitch + look.dy * 0.004));
    game.mouseYawOffset -= look.dx * 0.003;

    if (actions & ACTION.PAUSE) {
      game.screen = 'paused';
      document.getElementById('pause-stats').textContent =
        `Money $${game.money.toLocaleString()} · Jobs done ${game.completed.length}/${MISSION_LIST.length} · Wanted ${'★'.repeat(police.getStars()) || '—'}`;
      showOverlay('pause');
      return;
    }
    if (actions & ACTION.MISSIONS) {
      hud.toggleMissionList(MISSION_LIST, game.completed.length);
    }
    if (actions & ACTION.RADIO) {
      const on = audio.toggleRadio();
      hud.showToast(on ? 'Radio on — Solmar FM' : 'Radio off');
    }

    if (game.drivingCar) {
      const car = game.drivingCar;
      vehicles.drive(car, axis.y, axis.x, input.handbrake(), dt);
      if (actions & ACTION.ENTER_CAR) exitCar(false);
      if (Math.abs(car.speed) > 2 && !insideCity(car.pos.x, car.pos.z)) {
        car.speed *= 0.9;
      }
      if (car.health <= 0) {
        hud.showToast('Your ride is wrecked — get out!');
        exitCar(false);
      }
    } else {
      const walked = player.update(dt, axis.x, axis.y, game.cameraYaw, input.run());
      void walked;
      if (actions & ACTION.JUMP) player.jump();
      if (actions & ACTION.ENTER_CAR) {
        const car = vehicles.nearestCar(player.pos, 3.6);
        if (car) enterCar(car, false);
      }
      if (actions & ACTION.PUNCH) punch();
      if (input.clicked()) shoot();
    }

    // The living city. Wherever Leo is — on foot or in a car — is the focus.
    const focusPos = game.drivingCar ? game.drivingCar.pos : player.pos;
    traffic.updateTraffic(dt, focusPos);
    const hit = traffic.updatePeds(dt, focusPos, game.drivingCar);
    if (hit && hit.hitPed) {
      police.addWanted(WANTED.HIT_PEDESTRIAN);
      hud.showToast('You ran someone over! +1★');
      traffic.scarePeds(focusPos, 30);
      audio.crash();
    }
    vehicles.update(dt, time);
    const shot = police.update(dt, focusPos, game.drivingCar, !game.drivingCar, () => goBusted(false));
    if (shot && shot.shotPlayer) {
      player.health -= shot.damage;
      hud.showToast('Police hit you!');
      if (player.health <= 0) goBusted(true);
    }
    if (shot && !shot.shotPlayer && shot.from) {
      audio.shoot();
    }
    combat.update(dt);
    missions.update(dt, {
      // When Leo is driving, the car is where he is.
      playerPos: game.drivingCar ? game.drivingCar.pos : player.pos,
      inCar: !!game.drivingCar,
      wanted: police.getStars(),
      playerCarSpeed: game.drivingCar ? Math.abs(game.drivingCar.speed) : 0,
      onRivalHit: () => audio.crash(),
    }, time);
    if (game.nextMissionTimer > 0) {
      game.nextMissionTimer -= dt;
      if (game.nextMissionTimer <= 0 && !missions.active) missions.startNext();
    }
    if (police.getStars() === 0 && player.health < 100) player.health = Math.min(100, player.health + 3 * dt);

    // Sound follows the action.
    if (game.drivingCar) audio.setEngine(Math.abs(game.drivingCar.speed) / 42, axis.y > 0 ? 1 : 0);
    else audio.setEngine(0, 0);
    const nearestCop = police.chasers.length > 0
      ? Math.min(...police.chasers.map((c) => Math.hypot(c.car.pos.x - focusPos.x, c.car.pos.z - focusPos.z)))
      : Infinity;
    audio.setSiren(police.getStars() > 0 && nearestCop < 90, dt);
    audio.update(dt);

    // The sun's shadows follow the player.
    city.sun.position.set(focusPos.x + 180, 260, focusPos.z + 210);
    city.sun.target.position.set(focusPos.x, 0, focusPos.z);
    city.sun.target.updateMatrixWorld();
    city.ocean.material.map.offset.x += dt * 0.008;
  }

  updateCamera(dt);
  hud.update({
    money: game.money,
    health: player.health,
    wanted: police.getStars(),
    driving: !!game.drivingCar,
    speed: game.drivingCar ? game.drivingCar.speed : 0,
    objective: game.objectiveText,
    hint: game.screen === 'play'
      ? (game.drivingCar ? 'E — get out · SPACE — handbrake · R — radio' : (vehicles.nearestCar(player.pos, 3.6) ? 'E — get in the car' : 'WASD move · SHIFT run · E car · F punch · CLICK shoot'))
      : '',
    target: missions.targetPos(),
    traffic: traffic.trafficCars.map((t) => t.car),
    police: police.chasers,
    player: game.drivingCar ? game.drivingCar.pos : player.pos,
    heading: game.drivingCar ? game.drivingCar.heading : player.heading,
  }, time);
}

function startGame(fromSave) {
  audio.start();
  if (fromSave) loadGame();
  else {
    game.money = 0;
    game.completed = [];
  }
  player.pos.copy(city.playerSpawn);
  player.vel.set(0, 0, 0);
  player.health = 100;
  player.mesh.visible = true;
  game.screen = 'play';
  showOverlay(null);
  hud.closeMissionList();
  announce('Playing Solmar Heat.');
  if (game.completed.length < MISSION_LIST.length && !missions.active) {
    game.nextMissionTimer = 0.8;
  }
}

// Buttons.
document.getElementById('btn-start').addEventListener('click', () => startGame(false));
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', () => {
  game.screen = 'play';
  showOverlay(null);
});
document.getElementById('btn-quit').addEventListener('click', () => {
  saveGame();
  game.screen = 'title';
  showOverlay('title');
});
document.getElementById('btn-busted').addEventListener('click', () => {
  game.screen = 'play';
  showOverlay(null);
});
document.getElementById('btn-finale').addEventListener('click', () => {
  game.screen = 'play';
  showOverlay(null);
});
document.getElementById('mission-panel').addEventListener('click', (event) => {
  const row = event.target.closest('[data-mission]');
  if (!row) return;
  const index = Number(row.dataset.mission);
  if (index === game.completed.length && game.screen === 'play') {
    hud.closeMissionList();
    missions.startMission(index);
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.screen === 'play') {
    game.screen = 'paused';
    document.getElementById('pause-stats').textContent =
      `Money $${game.money.toLocaleString()} · Jobs done ${game.completed.length}/${MISSION_LIST.length}`;
    showOverlay('pause');
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// The world idles behind the title screen.
spawnParkedCars();
player.pos.copy(city.playerSpawn);
if (loadSave()) {
  const save = loadSave();
  const btn = document.getElementById('btn-continue');
  btn.classList.remove('hidden');
  btn.textContent = `CONTINUE — $${Math.floor(save.money).toLocaleString()}`;
}

let shot = null;
let shotElapsed = 0;
let shotDone = false;
if (shotName) {
  showOverlay(null);
  game.screen = 'play';
  document.body.dataset.shot = '1';
  shot = stageShot(shotName, G);
  announce(`Screenshot scene ${shotName}.`);
}

let last = performance.now();
let accumulator = 0;
let time = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  if (shotDone) {
    renderer.render(scene, camera);
    return;
  }
  accumulator += dt;
  while (accumulator >= STEP) {
    accumulator -= STEP;
    time += STEP;
    if (shot) {
      shot.step(STEP);
      shotElapsed += STEP;
      vehicles.update(STEP, time);
      missions.update(STEP, {
        playerPos: game.drivingCar ? game.drivingCar.pos : player.pos,
        inCar: !!game.drivingCar,
        wanted: police.getStars(),
        playerCarSpeed: game.drivingCar ? Math.abs(game.drivingCar.speed) : 0,
        onRivalHit: () => {},
      }, time);
      combat.update(STEP);
      updateCamera(STEP);
      hud.update({
        money: game.money,
        health: player.health,
        wanted: police.getStars(),
        driving: !!game.drivingCar,
        speed: game.drivingCar ? game.drivingCar.speed : 0,
        objective: game.objectiveText,
        hint: '',
        target: missions.targetPos(),
        traffic: traffic.trafficCars.map((t) => t.car),
        police: police.chasers,
        player: game.drivingCar ? game.drivingCar.pos : player.pos,
        heading: game.drivingCar ? game.drivingCar.heading : player.heading,
      }, time);
      if (shotElapsed >= shot.seconds) {
        shotDone = true;
        window.__shotReady = true;
      }
    } else if (game.screen === 'title') {
      traffic.updateTraffic(STEP, player.pos);
      traffic.updatePeds(STEP, player.pos, null);
      vehicles.update(STEP, time);
      updateTitleCamera(STEP);
      hud.update({
        money: game.money, health: 100, wanted: 0, driving: false, speed: 0,
        objective: '', hint: '', target: null,
        traffic: traffic.trafficCars.map((t) => t.car), police: [],
        player: player.pos, heading: 0,
      }, time);
    } else {
      stepWorld(STEP, time);
    }
  }
  renderer.render(scene, camera);
}

announce('Solmar Heat. Press Space or click Start to play.');
requestAnimationFrame(frame);
