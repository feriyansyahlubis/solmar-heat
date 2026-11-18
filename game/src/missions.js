// The story: Leo Vega owes $10,000. Five jobs for Dante, each one a step
// toward clearing the debt — and each one teaching a system of the game.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { ROAD_LINES } from './city.js';

const DELIVERY_POINTS = [
  { x: -203, z: 87 },
  { x: 145, z: -145 },
  { x: 87, z: 203 },
];

const RACE_CHECKPOINTS = [
  { x: -145, z: -87 }, { x: 87, z: -145 }, { x: 203, z: -29 }, { x: 145, z: 145 },
  { x: -29, z: 203 }, { x: -203, z: 87 }, { x: -203, z: -203 }, { x: -87, z: -87 },
];

export const MISSION_LIST = [
  {
    id: 'welcome',
    title: 'Welcome Back',
    brief: 'Dante needs a driver. Steal any car and bring it to his garage.',
    reward: 300,
  },
  {
    id: 'pizza',
    title: 'Pizza Run',
    brief: 'Three deliveries, one very impatient city. 150 seconds on the clock.',
    reward: 500,
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    brief: 'The job went loud. Three stars on your head — lose the heat or reach the pier.',
    reward: 800,
  },
  {
    id: 'street-king',
    title: 'Street King',
    brief: 'Eight checkpoints, three rivals, one crown. Finish in the top two.',
    reward: 1200,
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    brief: 'Four rival cars guard the bank job. Wreck them all, then vanish at the pier.',
    reward: 2500,
  },
];

function makeBeacon() {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  group.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  diamond.position.y = 8;
  group.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.2;
  group.add(ring);
  group.userData = { diamond, ring };
  return group;
}

export function createMissions(scene, landmarks, vehicles, rng, events) {
  const beacon = makeBeacon();
  beacon.visible = false;
  scene.add(beacon);
  const rivals = [];
  let current = -1; // index into MISSION_LIST, -1 = none active
  let step = 0;
  let stepState = {};
  let timer = 0;
  let active = false;

  function targetPos() {
    if (!active || current < 0) return null;
    const m = MISSION_LIST[current];
    if (m.id === 'welcome') return step === 0 ? null : landmarks.garage;
    if (m.id === 'pizza') return DELIVERY_POINTS[stepState.delivered] ? new THREE.Vector3(DELIVERY_POINTS[stepState.delivered].x, 0, DELIVERY_POINTS[stepState.delivered].z) : null;
    if (m.id === 'getaway') return landmarks.pier;
    if (m.id === 'street-king') return new THREE.Vector3(RACE_CHECKPOINTS[stepState.next].x, 0, RACE_CHECKPOINTS[stepState.next].z);
    if (m.id === 'big-score') return step === 0 ? (rivals[0] ? rivals[0].car.pos : null) : landmarks.pier;
    return null;
  }

  function objectiveText() {
    if (!active || current < 0) return 'Free roam — press M for jobs';
    const m = MISSION_LIST[current];
    if (m.id === 'welcome') return step === 0 ? 'Steal any car (E near a car)' : 'Drive to Dante’s Garage';
    if (m.id === 'pizza') return `Deliver the pizzas: ${stepState.delivered}/3 — ${Math.ceil(timer)}s left`;
    if (m.id === 'getaway') return `Lose the heat or reach the pier — ${Math.ceil(timer)}s left`;
    if (m.id === 'street-king') return `Race! Checkpoint ${stepState.next + 1}/8 — you are ${racePosition()}${ordinalSuffix(racePosition())}`;
    if (m.id === 'big-score') return step === 0 ? `Wreck the rival cars: ${4 - rivals.length} down` : 'Get to the pier and vanish';
    return m.title;
  }

  function ordinalSuffix(n) {
    return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  }

  function racePosition() {
    let ahead = 1;
    for (const r of rivals) {
      if (r.checkpoints > stepState.next) ahead += 1;
      else if (r.checkpoints === stepState.next && r.distToNext < stepState.distToNext) ahead += 1;
    }
    return ahead;
  }

  function startMission(index) {
    current = index;
    step = 0;
    stepState = { delivered: 0, next: 0, distToNext: Infinity };
    active = true;
    const m = MISSION_LIST[index];
    events.toast(`${m.title} — $${m.reward}`);
    events.objective(objectiveText());
    if (m.id === 'pizza') timer = 150;
    if (m.id === 'getaway') {
      timer = 90;
      events.setWanted(3);
    }
    if (m.id === 'street-king') {
      for (let i = 0; i < 3; i += 1) {
        const car = vehicles.spawn(i === 0 ? 'sports' : 'sedan', -160 + i * 8, -100, Math.PI / 2, [0xd42a2a, 0x2a2a2e, 0x4a7fb5][i]);
        car.parked = false;
        rivals.push({ car, checkpoints: 0, distToNext: Infinity });
      }
    }
    if (m.id === 'big-score') {
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2;
        const car = vehicles.spawn('sedan', landmarks.bank.x + Math.cos(angle) * 30, landmarks.bank.z + Math.sin(angle) * 30, angle, 0x1a1a1a);
        car.parked = false;
        car.health = 100;
        rivals.push({ car, checkpoints: 0, distToNext: Infinity });
      }
    }
    updateBeacon();
  }

  function clearRivals() {
    for (const r of rivals) vehicles.remove(r.car);
    rivals.length = 0;
  }

  function completeMission() {
    const m = MISSION_LIST[current];
    clearRivals();
    active = false;
    beacon.visible = false;
    events.money(m.reward);
    events.complete(m);
    current = -1;
  }

  function failMission(reason) {
    clearRivals();
    active = false;
    beacon.visible = false;
    events.fail(MISSION_LIST[current].title, reason);
    current = -1;
  }

  function updateBeacon() {
    const target = targetPos();
    if (target) {
      beacon.visible = true;
      beacon.position.set(target.x, 0, target.z);
    } else {
      beacon.visible = false;
    }
  }

  function update(dt, ctx, time) {
    // Beacon animation.
    if (beacon.visible) {
      beacon.userData.diamond.rotation.y += dt * 2;
      beacon.userData.diamond.position.y = 8 + Math.sin(time * 2.4) * 0.8;
      const s = 1 + Math.sin(time * 3) * 0.12;
      beacon.userData.ring.scale.set(s, s, 1);
    }
    if (!active || current < 0) return;
    const m = MISSION_LIST[current];
    const playerPos = ctx.playerPos;
    timer -= dt;

    if (m.id === 'welcome') {
      if (step === 0 && ctx.inCar) {
        step = 1;
        updateBeacon();
      } else if (step === 1) {
        const d = Math.hypot(playerPos.x - landmarks.garage.x, playerPos.z - landmarks.garage.z);
        if (d < 12) completeMission();
      }
    } else if (m.id === 'pizza') {
      if (timer <= 0) { failMission('Out of time — the pizzas got cold.'); return; }
      const point = DELIVERY_POINTS[stepState.delivered];
      if (point) {
        const d = Math.hypot(playerPos.x - point.x, playerPos.z - point.z);
        if (d < 10) {
          stepState.delivered += 1;
          events.toast(`Delivered ${stepState.delivered}/3`);
          events.pickup();
          if (stepState.delivered >= 3) completeMission();
          else updateBeacon();
        }
      }
    } else if (m.id === 'getaway') {
      if (timer <= 0) { failMission('The heat never let up.'); return; }
      const d = Math.hypot(playerPos.x - landmarks.pier.x, playerPos.z - landmarks.pier.z);
      if (ctx.wanted === 0 || d < 14) completeMission();
    } else if (m.id === 'street-king') {
      if (timer <= 0) { failMission('Too slow — the crown went to someone else.'); return; }
      // Rivals chase the checkpoints at a fixed pace.
      for (const r of rivals) {
        if (r.checkpoints >= RACE_CHECKPOINTS.length) continue;
        const cp = RACE_CHECKPOINTS[r.checkpoints];
        const dx = cp.x - r.car.pos.x;
        const dz = cp.z - r.car.pos.z;
        const dist = Math.hypot(dx, dz);
        r.distToNext = dist;
        const wantHeading = Math.atan2(dx, dz);
        let diff = wantHeading - r.car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        vehicles.drive(r.car, 1, Math.max(-1, Math.min(1, diff * 1.8)), false, dt);
        if (dist < 10) r.checkpoints += 1;
      }
      const cp = RACE_CHECKPOINTS[stepState.next];
      if (cp) {
        const d = Math.hypot(playerPos.x - cp.x, playerPos.z - cp.z);
        stepState.distToNext = d;
        if (d < 10) {
          stepState.next += 1;
          events.pickup();
          if (stepState.next >= RACE_CHECKPOINTS.length) {
            const place = racePosition();
            if (place <= 2) completeMission();
            else failMission(`You finished ${place}${ordinalSuffix(place)} — top two only.`);
          } else {
            updateBeacon();
          }
        }
      }
    } else if (m.id === 'big-score') {
      if (step === 0) {
        // Rivals ram the player; the player wrecks them by ramming or shooting.
        for (const r of rivals) {
          const dx = playerPos.x - r.car.pos.x;
          const dz = playerPos.z - r.car.pos.z;
          const dist = Math.hypot(dx, dz) || 1;
          const wantHeading = Math.atan2(dx, dz);
          let diff = wantHeading - r.car.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          vehicles.drive(r.car, 1, Math.max(-1, Math.min(1, diff * 1.6)), false, dt);
          if (dist < 4.5 && ctx.playerCarSpeed > 6) {
            r.car.health -= 26;
            ctx.onRivalHit(r.car);
          }
        }
        for (let i = rivals.length - 1; i >= 0; i -= 1) {
          if (rivals[i].car.health <= 0) {
            rivals[i].car.speed = 0;
            rivals[i].car.health = 0;
            events.toast('Rival wrecked!');
            vehicles.remove(rivals[i].car);
            rivals.splice(i, 1);
          }
        }
        if (rivals.length === 0) {
          step = 1;
          updateBeacon();
          events.toast('All rivals down — get to the pier!');
        }
      } else {
        const d = Math.hypot(playerPos.x - landmarks.pier.x, playerPos.z - landmarks.pier.z);
        if (d < 14) completeMission();
      }
    }
    events.objective(objectiveText());
  }

  function startNext() {
    const next = events.completedCount();
    if (next < MISSION_LIST.length) startMission(next);
  }

  return {
    MISSION_LIST,
    startMission,
    startNext,
    update,
    objectiveText,
    targetPos,
    rivals,
    get active() { return active; },
    get current() { return current; },
    beacon,
  };
}
