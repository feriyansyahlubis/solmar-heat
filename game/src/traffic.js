// Traffic and pedestrians: the city feels alive because cars follow the roads
// and people walk the sidewalks, and both scatter when things get loud.
import * as THREE from 'three';
import { WORLD, PITCH, HALF_CITY } from './config.js';
import { ROAD_LINES } from './city.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'sedan', 'sports'];
const SHIRT_COLORS = [0xe84a4a, 0x4a7fb5, 0x3f9e4d, 0xe8b13a, 0x8a5fb5, 0xe8e8e8, 0x2a2a2e, 0xff8c42];

function makePedestrianMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a075 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.32), shirt);
  torso.position.y = 1.14;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
  head.position.y = 1.68;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.74, 0.24), pants);
  legL.position.set(-0.16, 0.4, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  group.userData = { legL, legR };
  return group;
}

export function createTraffic(scene, vehicles, colliders, rng) {
  const trafficCars = [];
  const pedestrians = [];
  const MAX_TRAFFIC = 14;
  const MAX_PEDS = 26;

  function randomRoad() {
    const line = rng.pick(ROAD_LINES);
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const dir = rng.chance(0.5) ? 1 : -1;
    return { line, axis, dir };
  }

  function spawnTrafficCar(near) {
    const road = randomRoad();
    const type = rng.pick(TRAFFIC_TYPES);
    // Place it on a road near the player, or anywhere when first filling.
    let x;
    let z;
    if (road.axis === 'x') {
      z = road.line + (road.dir > 0 ? 3.5 : -3.5);
      x = near ? near.x + rng.range(-120, 120) : rng.range(-HALF_CITY, HALF_CITY);
      x = Math.max(-HALF_CITY - 4, Math.min(HALF_CITY + 4, x));
    } else {
      x = road.line + (road.dir > 0 ? -3.5 : 3.5);
      z = near ? near.z + rng.range(-120, 120) : rng.range(-HALF_CITY, HALF_CITY);
      z = Math.max(-HALF_CITY - 4, Math.min(HALF_CITY + 4, z));
    }
    const heading = road.axis === 'x' ? (road.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (road.dir > 0 ? 0 : Math.PI);
    const car = vehicles.spawn(type, x, z, heading, rng.chance(0.8) ? undefined : vehicles.randomColor());
    car.parked = false;
    const t = { car, road, speed: rng.range(8, 12), targetSpeed: rng.range(8, 12) };
    trafficCars.push(t);
    return t;
  }

  function spawnPedestrian(near) {
    const road = randomRoad();
    const side = rng.chance(0.5) ? 1 : -1;
    let x;
    let z;
    if (road.axis === 'x') {
      z = road.line + side * (WORLD.ROAD / 2 + 2.5);
      x = near ? near.x + rng.range(-100, 100) : rng.range(-HALF_CITY, HALF_CITY);
    } else {
      x = road.line + side * (WORLD.ROAD / 2 + 2.5);
      z = near ? near.z + rng.range(-100, 100) : rng.range(-HALF_CITY, HALF_CITY);
    }
    x = Math.max(-HALF_CITY - 4, Math.min(HALF_CITY + 4, x));
    z = Math.max(-HALF_CITY - 4, Math.min(HALF_CITY + 4, z));
    const mesh = makePedestrianMesh(rng.pick(SHIRT_COLORS));
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const ped = {
      mesh,
      pos: mesh.position,
      axis: road.axis,
      dir: rng.chance(0.5) ? 1 : -1,
      speed: rng.range(1.1, 1.8),
      state: 'walk',
      stateTime: 0,
      walkPhase: rng.range(0, 6),
      down: false,
    };
    mesh.rotation.y = ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
    pedestrians.push(ped);
    return ped;
  }

  // A car ahead on the same lane, within `ahead` metres.
  function carAhead(t, ahead) {
    const { car } = t;
    let nearest = Infinity;
    for (const other of vehicles.cars) {
      if (other === car) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const forward = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
      const lateral = Math.abs(Math.cos(car.heading) * dx - Math.sin(car.heading) * dz);
      if (forward > 0 && forward < ahead && lateral < 2.4) nearest = Math.min(nearest, forward);
    }
    return nearest;
  }

  function updateTraffic(dt, playerPos) {
    // Keep the streets full near the player; recycle cars that drifted far.
    for (let i = trafficCars.length - 1; i >= 0; i -= 1) {
      const t = trafficCars[i];
      const d = Math.hypot(t.car.pos.x - playerPos.x, t.car.pos.z - playerPos.z);
      if (d > 220) {
        vehicles.remove(t.car);
        trafficCars.splice(i, 1);
      }
    }
    while (trafficCars.length < MAX_TRAFFIC) spawnTrafficCar(playerPos);
    for (const t of trafficCars) {
      const { car } = t;
      const ahead = carAhead(t, 14);
      const want = ahead < 14 ? 0 : t.targetSpeed;
      car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      // At the end of a road, pick a new road at the next intersection.
      const along = t.road.axis === 'x' ? car.pos.x : car.pos.z;
      if ((t.road.dir > 0 && along > HALF_CITY + 2) || (t.road.dir < 0 && along < -HALF_CITY - 2)) {
        const road = randomRoad();
        t.road = road;
        if (road.axis === 'x') {
          car.pos.z = road.line + (road.dir > 0 ? 3.5 : -3.5);
          car.pos.x = Math.max(-HALF_CITY, Math.min(HALF_CITY, car.pos.x));
        } else {
          car.pos.x = road.line + (road.dir > 0 ? -3.5 : 3.5);
          car.pos.z = Math.max(-HALF_CITY, Math.min(HALF_CITY, car.pos.z));
        }
        car.heading = road.axis === 'x' ? (road.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (road.dir > 0 ? 0 : Math.PI);
        car.speed = t.targetSpeed;
      }
      // Keep the wheels turning.
      const wheels = car.mesh.userData.wheels;
      for (const w of wheels) w.rotation.x += (car.speed * dt) / 0.36;
    }
  }

  function scarePeds(at, radius) {
    for (const ped of pedestrians) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - at.x, ped.pos.z - at.z);
      if (d < radius) {
        ped.state = 'flee';
        ped.stateTime = 3;
        ped.fleeFrom = { x: at.x, z: at.z };
      }
    }
  }

  function updatePeds(dt, playerPos, playerCar) {
    for (let i = pedestrians.length - 1; i >= 0; i -= 1) {
      const ped = pedestrians[i];
      const d = Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
      if (d > 200) {
        scene.remove(ped.mesh);
        pedestrians.splice(i, 1);
        continue;
      }
      ped.stateTime -= dt;
      if (ped.state === 'down') {
        if (ped.stateTime <= 0) {
          ped.state = 'flee';
          ped.stateTime = 4;
          ped.fleeFrom = { x: playerPos.x, z: playerPos.z };
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
        }
        continue;
      }
      if (ped.state === 'flee' && ped.stateTime <= 0) ped.state = 'walk';
      let speed = ped.speed;
      let hx;
      let hz;
      if (ped.state === 'flee') {
        speed = 5.2;
        const dx = ped.pos.x - ped.fleeFrom.x;
        const dz = ped.pos.z - ped.fleeFrom.z;
        const len = Math.hypot(dx, dz) || 1;
        hx = dx / len;
        hz = dz / len;
      } else {
        hx = ped.axis === 'x' ? ped.dir : 0;
        hz = ped.axis === 'z' ? ped.dir : 0;
      }
      ped.pos.x += hx * speed * dt;
      ped.pos.z += hz * speed * dt;
      ped.mesh.rotation.y = Math.atan2(hx, hz);
      ped.walkPhase += dt * 9 * (speed / 1.5);
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      // A fast player car mows a pedestrian down.
      if (playerCar && playerCar.speed > 5) {
        const pd = Math.hypot(ped.pos.x - playerCar.pos.x, ped.pos.z - playerCar.pos.z);
        if (pd < 2.0) {
          ped.state = 'down';
          ped.stateTime = 10;
          ped.mesh.rotation.x = -Math.PI / 2;
          ped.mesh.position.y = 0.3;
          return { hitPed: ped };
        }
      }
    }
    while (pedestrians.length < MAX_PEDS) spawnPedestrian(playerPos);
    return null;
  }

  function nearestPed(pos, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const ped of pedestrians) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < bestDist) {
        bestDist = d;
        best = ped;
      }
    }
    return best;
  }

  function knockDown(ped) {
    ped.state = 'down';
    ped.stateTime = 10;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.3;
  }

  return { trafficCars, pedestrians, updateTraffic, updatePeds, scarePeds, nearestPed, knockDown };
}
