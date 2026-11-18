// Traffic cars + pedestrians.

import * as THREE from 'three';
import { WORLD, ROAD_LINES } from './config.js';
import { buildCarMesh, CAR_TYPES } from './vehicles.js';

const MAX_TRAFFIC = 14;
const MAX_PEDS = 26;

function randomLanePoint(rng, axis) {
  const line = ROAD_LINES[Math.floor(rng.next() * ROAD_LINES.length)];
  const other = rng.range(-240, 240);
  return axis === 'x' ? { x: line, z: other } : { x: other, z: line };
}

function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirtColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xfd79a8];
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColors[Math.floor(rng.next() * shirtColors.length)], roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.28), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skin);
  head.position.y = 1.55;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), pants);
  legL.position.set(-0.14, 0.31, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  g.userData = { legL, legR };
  return g;
}

export function createTraffic(scene, vehicles, colliders, rng) {
  const trafficCars = [];
  const pedestrians = [];

  function spawnTrafficCar() {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const p = randomLanePoint(rng, axis);
    const dir = rng.chance(0.5) ? 1 : -1;
    // Heading: forward = (sin h, cos h); axis 'x' travels along Z, 'z' along X.
    const heading = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    const type = rng.pick(['sedan', 'sedan', 'taxi', 'sports', 'van', 'pickup']);
    const car = vehicles.spawn(type, p.x, p.z, heading, undefined);
    car.parked = false;
    car.traffic = {
      axis,
      line: axis === 'x' ? p.x : p.z,
      dir,
      targetSpeed: rng.range(8, 12),
    };
    trafficCars.push(car);
    return car;
  }

  function spawnPed() {
    const mesh = makePedMesh(rng);
    // Sidewalk: offset ROAD/2 + 2.5 from a road line.
    const line = ROAD_LINES[Math.floor(rng.next() * ROAD_LINES.length)];
    const side = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(-240, 240);
    const onXRoad = rng.chance(0.5);
    const x = onXRoad ? line + side * (WORLD.ROAD / 2 + 2.5) : along;
    const z = onXRoad ? along : line + side * (WORLD.ROAD / 2 + 2.5);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const ped = {
      mesh,
      pos: mesh.position,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 1.8),
      state: 'walk',
      stateT: 0,
      walkPhase: rng.range(0, 6),
      health: 100,
    };
    pedestrians.push(ped);
    return ped;
  }

  for (let i = 0; i < MAX_TRAFFIC; i++) spawnTrafficCar();
  for (let i = 0; i < MAX_PEDS; i++) spawnPed();

  function carAhead(car, dist) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    for (const other of vehicles.cars) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < dist && side < 3.2) return other;
    }
    return null;
  }

  function updateTraffic(dt, playerPos) {
    for (const car of trafficCars) {
      const t = car.traffic;
      if (!t) continue;
      // Slow/stop behind a car within 14 m.
      const ahead = carAhead(car, 14);
      let target = t.targetSpeed;
      if (ahead) {
        const d = Math.hypot(ahead.pos.x - car.pos.x, ahead.pos.z - car.pos.z);
        target = d < 7 ? 0 : t.targetSpeed * 0.4;
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
      // Lane keeping: steer toward lane centre (line +/- 3.5 by direction).
      const laneCentre = t.line + 3.5 * t.dir;
      const lateral = t.axis === 'x' ? car.pos.x - laneCentre : car.pos.z - laneCentre;
      // Desired heading: along the road, corrected by lateral error.
      const baseHeading = t.axis === 'x' ? (t.dir > 0 ? 0 : Math.PI) : t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const corr = t.axis === 'x' ? -lateral * 0.05 * t.dir : lateral * 0.05 * t.dir;
      const desired = baseHeading + corr;
      let dh = desired - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-0.5, Math.min(0.5, dh * 2));
      vehicles.drive(car, car.speed < t.targetSpeed ? 0.6 : 0, steer, false, dt);
      // Re-route at road ends: turn around.
      const along = t.axis === 'x' ? car.pos.z : car.pos.x;
      if (along > 250 || along < -250) {
        t.dir *= -1;
        car.heading += Math.PI;
      }
      // Recycle far away cars near the player.
      const dPlayer = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (dPlayer > 220) {
        const p = randomLanePoint(rng, t.axis);
        car.pos.x = p.x;
        car.pos.z = p.z;
        car.speed = t.targetSpeed;
      }
    }
  }

  function updatePeds(dt, playerPos, playerCar) {
    let hitPed = null;
    for (const ped of pedestrians) {
      ped.stateT -= dt;
      if (ped.state === 'down') {
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.4;
        if (ped.stateT <= 0) {
          ped.state = 'flee';
          ped.stateT = 3;
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
        }
        continue;
      }
      const speed = ped.state === 'flee' ? 5.2 : ped.speed;
      const fx = Math.sin(ped.heading);
      const fz = Math.cos(ped.heading);
      ped.pos.x += fx * speed * dt;
      ped.pos.z += fz * speed * dt;
      // Wander: small random heading changes; keep inside the city.
      if (rng.chance(dt * 0.25)) ped.heading += rng.range(-0.9, 0.9);
      if (Math.abs(ped.pos.x) > 255 || Math.abs(ped.pos.z) > 255 || ped.pos.z > 290) {
        ped.heading += Math.PI;
      }
      ped.walkPhase += dt * speed * 4;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.rotation.y = ped.heading;
      if (ped.state === 'flee' && ped.stateT <= 0) ped.state = 'walk';

      // Hit by the player's car?
      if (playerCar && playerCar.speed > 5) {
        const d = Math.hypot(ped.pos.x - playerCar.pos.x, ped.pos.z - playerCar.pos.z);
        if (d < 2.0 && !hitPed) hitPed = ped;
      }
    }
    return { hitPed };
  }

  function scarePeds(at, radius) {
    for (const ped of pedestrians) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - at.x, ped.pos.z - at.z);
      if (d < radius) {
        ped.state = 'flee';
        ped.stateT = 3;
        // Run away from the scare point.
        ped.heading = Math.atan2(ped.pos.x - at.x, ped.pos.z - at.z);
      }
    }
  }

  function nearestPed(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of pedestrians) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  function knockDown(ped) {
    ped.state = 'down';
    ped.stateT = 10;
    ped.health = 0;
  }

  return { trafficCars, pedestrians, updateTraffic, updatePeds, scarePeds, nearestPed, knockDown };
}
