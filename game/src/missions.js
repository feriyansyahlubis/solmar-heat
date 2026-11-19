// Story missions: steal, deliver, escape, race, heist. Debt $10,000.

import * as THREE from 'three';
import { MISSIONS } from './config.js';

export const MISSION_LIST = [
  {
    id: 0,
    title: 'Welcome Back',
    reward: 300,
    brief: "Leo's back in Solmar. Steal any car and bring it to Dante's Garage.",
  },
  {
    id: 1,
    title: 'Pizza Run',
    reward: 500,
    brief: 'Three deliveries across town. 150 seconds on the clock.',
  },
  {
    id: 2,
    title: 'The Getaway',
    reward: 800,
    brief: 'Three stars on your tail. Lose the heat or reach the pier in 90 seconds.',
  },
  {
    id: 3,
    title: 'Street King',
    reward: 1200,
    brief: 'Eight checkpoints against three rivals. Finish top 2.',
  },
  {
    id: 4,
    title: 'The Big Score',
    reward: 2500,
    brief: 'Wreck four rival cars around the bank, then escape to the pier.',
  },
  {
    id: 5,
    title: 'The Last Score',
    reward: 4700,
    brief: "Dante's final job: lift the gold Comet from Hotel Palma and run it to the pier in 150 seconds — with the whole force on your tail.",
  },
];

const PIZZA_POINTS = [
  new THREE.Vector3(-203, 0, 87),
  new THREE.Vector3(145, 0, -145),
  new THREE.Vector3(87, 0, 203),
];

const RACE_POINTS = [
  new THREE.Vector3(-145, 0, -87),
  new THREE.Vector3(87, 0, -145),
  new THREE.Vector3(203, 0, -29),
  new THREE.Vector3(145, 0, 145),
  new THREE.Vector3(-29, 0, 203),
  new THREE.Vector3(-203, 0, 87),
  new THREE.Vector3(-203, 0, -203),
  new THREE.Vector3(-87, 0, -87),
];

export function createMissions(scene, landmarks, vehicles, rng, events) {
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 17;
  beacon.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.3),
    new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.9 }),
  );
  diamond.position.y = 3;
  beacon.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);

  let current = -1;
  let active = false;
  let timer = 0;
  let checkpoint = 0;
  let deliveries = 0;
  let wrecked = 0;
  let phase = 'main';
  let rivals = [];
  let rivalState = new Map();
  let ramCooldown = new Map();
  let goldCar = null;
  let inGoldCar = false;
  const GOLD_SPOT = new THREE.Vector3(-58, 0, 260);

  function clearRivals() {
    for (const r of rivals) vehicles.remove(r);
    rivals = [];
    rivalState = new Map();
    ramCooldown = new Map();
    if (goldCar) {
      vehicles.remove(goldCar);
      goldCar = null;
    }
    inGoldCar = false;
  }

  function spawnRival(type, x, z, heading) {
    const car = vehicles.spawn(type, x, z, heading, undefined);
    car.parked = false;
    rivals.push(car);
    rivalState.set(car.id, { checkpoint: 0, stuckT: 0, finished: false, lastPos: new THREE.Vector3(x, 0, z) });
    return car;
  }

  function startMission(i) {
    if (i < 0 || i >= MISSION_LIST.length) return;
    clearRivals();
    current = i;
    active = true;
    timer = 0;
    checkpoint = 0;
    deliveries = 0;
    wrecked = 0;
    phase = 'main';
    const m = MISSION_LIST[i];
    if (i === 1) timer = 150;
    if (i === 2) {
      timer = 90;
      events.setWanted(3);
    }
    if (i === 3) {
      // Three rivals line up near the player start area.
      const spots = [
        [-160, -70, Math.PI / 2],
        [-150, -70, Math.PI / 2],
        [-140, -70, Math.PI / 2],
      ];
      const types = ['sports', 'sedan', 'sports'];
      spots.forEach(([x, z, h], k) => spawnRival(types[k], x, z, h));
    }
    if (i === 4) {
      const b = landmarks.bank;
      const spots = [
        [b.x + 24, b.z - 18],
        [b.x - 24, b.z + 18],
        [b.x + 26, b.z + 22],
        [b.x - 26, b.z - 20],
      ];
      spots.forEach(([x, z], k) => spawnRival(k % 2 === 0 ? 'sedan' : 'sports', x, z, rng.range(0, Math.PI * 2)));
    }
    if (i === 5) {
      // The gold Comet waits on the beach road by Hotel Palma.
      timer = 150;
      goldCar = vehicles.spawn('sports', GOLD_SPOT.x, GOLD_SPOT.z, Math.PI / 2, 0xffd24d);
      goldCar.parked = true;
      events.setWanted(2);
    }
    beacon.visible = true;
    events.toast(`${m.title} — $${m.reward}`);
    events.objective(objectiveText());
  }

  function startNext() {
    const next = events.completedCount();
    if (next < MISSION_LIST.length) startMission(next);
  }

  function finishMission() {
    const m = MISSION_LIST[current];
    active = false;
    beacon.visible = false;
    clearRivals();
    events.complete(m);
  }

  function failMission(reason) {
    const m = MISSION_LIST[current];
    active = false;
    beacon.visible = false;
    clearRivals();
    events.fail(m.title, reason);
  }

  function driveToward(car, target, dt, throttle) {
    const desired = Math.atan2(target.x - car.pos.x, target.z - car.pos.z);
    let dh = desired - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-0.55, Math.min(0.55, dh * 1.6));
    vehicles.drive(car, throttle, steer, false, dt);
    return dh;
  }

  function update(dt, ctx, time) {
    // Beacon animation.
    beacon.rotation.y += dt * 0.8;
    diamond.position.y = 3 + Math.sin(time * 2) * 0.5;
    diamond.rotation.y += dt * 1.5;
    const pulse = 1 + Math.sin(time * 3) * 0.12;
    ring.scale.set(pulse, pulse, 1);
    const target = targetPos();
    if (active && target) beacon.position.set(target.x, 0, target.z);
    if (!active) return;

    const pp = ctx.playerPos;

    if (current === 0) {
      // Welcome Back: steal any car, drive to the garage marker.
      if (ctx.inCar) {
        const d = Math.hypot(pp.x - landmarks.garage.x, pp.z - landmarks.garage.z);
        if (d < 10) finishMission();
      }
    } else if (current === 1) {
      timer -= dt;
      if (timer <= 0) {
        failMission('Out of time on the pizza run.');
        return;
      }
      const p = PIZZA_POINTS[deliveries];
      const d = Math.hypot(pp.x - p.x, pp.z - p.z);
      if (d < 8) {
        deliveries++;
        events.pickup();
        events.toast(`Delivery ${deliveries}/3 done`);
        if (deliveries >= 3) finishMission();
        else events.objective(objectiveText());
      }
    } else if (current === 2) {
      timer -= dt;
      if (timer <= 0) {
        failMission('The heat caught up with you.');
        return;
      }
      if (ctx.wanted === 0) {
        finishMission();
        return;
      }
      const d = Math.hypot(pp.x - landmarks.pier.x, pp.z - landmarks.pier.z);
      if (d < 12) finishMission();
    } else if (current === 3) {
      // Race: rivals drive the checkpoints too.
      for (const r of rivals) {
        const st = rivalState.get(r.id);
        if (!st || st.finished) continue;
        if (r.health <= 0) {
          st.finished = true; // wrecked rival drops out (counts as last)
          continue;
        }
        const cp = RACE_POINTS[st.checkpoint];
        driveToward(r, cp, dt, r.speed > 26 ? 0 : 0.9);
        const d = Math.hypot(r.pos.x - cp.x, r.pos.z - cp.z);
        if (d < 10) {
          st.checkpoint++;
          if (st.checkpoint >= RACE_POINTS.length) st.finished = true;
        }
        // Stuck recovery.
        st.stuckT += dt;
        if (st.stuckT > 2) {
          const moved = Math.hypot(r.pos.x - st.lastPos.x, r.pos.z - st.lastPos.z);
          if (moved < 2) r.heading += Math.PI * 0.6;
          st.lastPos.copy(r.pos);
          st.stuckT = 0;
        }
      }
      const cp = RACE_POINTS[checkpoint];
      const d = Math.hypot(pp.x - cp.x, pp.z - cp.z);
      if (d < 10) {
        checkpoint++;
        events.toast(`Checkpoint ${checkpoint}/8`);
        if (checkpoint >= RACE_POINTS.length) {
          const rivalsAhead = rivals.filter((r) => rivalState.get(r.id).finished).length;
          const rank = 1 + rivalsAhead;
          if (rank <= 2) finishMission();
          else failMission(`Finished ${rank}th — need top 2.`);
        } else {
          events.objective(objectiveText());
        }
      }
    } else if (current === 4) {
      if (phase === 'main') {
        // Rivals ram the player; player rams back at speed.
        for (const r of [...rivals]) {
          if (r.health <= 0) continue;
          driveToward(r, pp, dt, 1);
          if (ctx.inCar && ctx.playerCarSpeed > 6) {
            const d = Math.hypot(r.pos.x - pp.x, r.pos.z - pp.z);
            const cd = ramCooldown.get(r.id) || 0;
            if (d < 4.5 && cd <= 0) {
              r.health -= 26;
              ramCooldown.set(r.id, 0.5);
              if (ctx.onRivalHit) ctx.onRivalHit(r);
            }
          }
        }
        for (const [id, cd] of ramCooldown) ramCooldown.set(id, cd - dt);
        // Count wrecked rivals.
        for (let i = rivals.length - 1; i >= 0; i--) {
          const r = rivals[i];
          if (r.health <= 0) {
            vehicles.remove(r);
            rivals.splice(i, 1);
            wrecked++;
            events.toast(`Rival wrecked! ${wrecked}/4 down`);
          }
        }
        if (wrecked >= 4) {
          phase = 'escape';
          events.toast('All rivals down — escape to the pier!');
          events.objective(objectiveText());
        }
      } else {
        const d = Math.hypot(pp.x - landmarks.pier.x, pp.z - landmarks.pier.z);
        if (d < 12) finishMission();
      }
    } else if (current === 5) {
      // The Last Score: steal the gold Comet, run it to the pier.
      timer -= dt;
      if (timer <= 0) {
        failMission('The Comet never made it to the pier.');
        return;
      }
      inGoldCar = ctx.car === goldCar;
      if (inGoldCar) {
        const d = Math.hypot(pp.x - landmarks.pier.x, pp.z - landmarks.pier.z);
        if (d < 12) finishMission();
      }
    }
  }

  function objectiveText() {
    if (!active) return '';
    if (current === 0) return "Steal a car — bring it to Dante's Garage";
    if (current === 1) return `Pizza Run: deliver ${deliveries + 1}/3 — ${Math.ceil(timer)}s left`;
    if (current === 2) return `The Getaway: lose the heat or reach the pier — ${Math.ceil(timer)}s`;
    if (current === 3) return `Street King: checkpoint ${checkpoint + 1}/8 — finish top 2`;
    if (current === 4) {
      return phase === 'main'
        ? `The Big Score: wreck the rival cars — ${wrecked}/4 down`
        : 'The Big Score: escape to the pier!';
    }
    if (current === 5) {
      return inGoldCar
        ? `The Last Score: run the Comet to the pier — ${Math.ceil(timer)}s`
        : `The Last Score: steal the gold Comet at Hotel Palma — ${Math.ceil(timer)}s`;
    }
    return '';
  }

  function targetPos() {
    if (!active) return null;
    if (current === 0) return landmarks.garage.clone();
    if (current === 1) return PIZZA_POINTS[deliveries].clone();
    if (current === 2) return landmarks.pier.clone();
    if (current === 3) return RACE_POINTS[Math.min(checkpoint, RACE_POINTS.length - 1)].clone();
    if (current === 4) {
      if (phase === 'escape') return landmarks.pier.clone();
      // Nearest live rival.
      let best = null;
      let bestD = Infinity;
      for (const r of rivals) {
        const d = Math.hypot(r.pos.x - landmarks.bank.x, r.pos.z - landmarks.bank.z);
        if (d < bestD) {
          bestD = d;
          best = r;
        }
      }
      return best ? new THREE.Vector3(best.pos.x, 0, best.pos.z) : landmarks.bank.clone();
    }
    if (current === 5) {
      if (inGoldCar) return landmarks.pier.clone();
      return goldCar ? new THREE.Vector3(goldCar.pos.x, 0, goldCar.pos.z) : GOLD_SPOT.clone();
    }
    return null;
  }

  return {
    MISSION_LIST,
    startMission,
    startNext,
    update,
    objectiveText,
    targetPos,
    get rivals() {
      return rivals;
    },
    get active() {
      return active;
    },
    get current() {
      return current;
    },
    beacon,
    get debtGoal() {
      return MISSIONS.DEBT_GOAL;
    },
  };
}
