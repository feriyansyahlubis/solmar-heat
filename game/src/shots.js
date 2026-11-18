// Scripted screenshot scenes behind ?shot=cover|chase|mission|city. Each one
// stages the real game (a seeded world, real traffic, real police) and steers
// it with a simple autopilot, so every screenshot is a frame of actual play.
import * as THREE from 'three';
import { WORLD, PITCH } from './config.js';

// Steer a car to stay on its lane: aim at the road direction, correct for
// drifting off the lane line (the lane is 3.5 m to the right of the centre).
function laneFollow(car, axis, line, dir, targetSpeed) {
  const lane = axis === 'x'
    ? line + (dir > 0 ? 3.5 : -3.5)
    : line + (dir > 0 ? -3.5 : 3.5);
  const lateral = (axis === 'x' ? car.pos.z : car.pos.x) - lane;
  const wantHeading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.8 - lateral * 0.06));
  const throttle = car.speed < targetSpeed ? 1 : 0;
  return { throttle, steer };
}

// A police car holding formation behind the player's car, the way a chase
// looks on screen: a fixed distance back, a little to one side, same speed.
function formationChaser(car, playerCar, back, side, dt) {
  const h = playerCar.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const rx = -Math.cos(h);
  const rz = Math.sin(h);
  car.pos.x = playerCar.pos.x - fx * back + rx * side;
  car.pos.z = playerCar.pos.z - fz * back + rz * side;
  car.heading = h;
  car.speed = playerCar.speed;
  car.mesh.rotation.y = h;
  for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.36;
}

export function stageShot(name, G) {
  const { player, vehicles, traffic, police, missions, city } = G;
  police.clear();
  missions.beacon.visible = false;
  // Clear the streets of whatever the free roam left behind, then restage.
  for (const car of [...vehicles.cars]) {
    if (!car.isPlayer) vehicles.remove(car);
  }
  const seed = 7;
  void seed;

  if (name === 'chase') {
    // A police chase down the east-west avenue: three stars, two cruisers
    // right on the player's bumper, sirens on.
    const car = vehicles.spawn('sports', 0, 90.5, Math.PI / 2, 0xd42a2a);
    car.parked = false;
    car.isPlayer = true;
    G.enterCar(car, true);
    police.setStars(3);
    const c1 = vehicles.spawn('police', -14, 90.5, Math.PI / 2);
    c1.parked = false;
    police.chasers.push({ car: c1, stuck: 0, formation: { back: 6, side: 4 } });
    const c2 = vehicles.spawn('police', -26, 83.5, Math.PI / 2);
    c2.parked = false;
    police.chasers.push({ car: c2, stuck: 0, formation: { back: 4, side: -3 } });
    for (const [x, z] of [[40, 83.5], [80, 83.5], [120, 83.5]]) {
      const t = vehicles.spawn('sedan', x, z, -Math.PI / 2);
      t.parked = false;
      traffic.trafficCars.push({ car: t, road: { axis: 'x', line: 87, dir: -1 }, speed: 9, targetSpeed: 9 });
    }
    G.setObjective('Lose the heat or reach the pier');
    G.setCameraMode('chase');
    return {
      seconds: 3.2,
      step(dt) {
        const input = laneFollow(car, 'x', 87, 1, 30);
        vehicles.drive(car, input.throttle, input.steer, false, dt);
        // The chasers hold formation on the player's bumper, sirens flashing.
        for (const c of police.chasers) {
          formationChaser(c.car, car, c.formation.back, c.formation.side, dt);
        }
        for (const t of traffic.trafficCars) {
          const fx = Math.sin(t.car.heading);
          const fz = Math.cos(t.car.heading);
          t.car.pos.x += fx * t.car.speed * dt;
          t.car.pos.z += fz * t.car.speed * dt;
        }
      },
    };
  }

  if (name === 'mission') {
    // On foot at the bank for the big score: the beacon over the target, a
    // rival car rolling in along the road, the objective on the HUD.
    player.pos.set(58, 0, 85);
    player.heading = Math.PI;
    player.mesh.visible = true;
    G.exitCar(true);
    const rival = vehicles.spawn('sedan', 72, 70, -Math.PI / 2, 0x1a1a1a);
    rival.parked = false;
    missions.rivals.push({ car: rival, checkpoints: 0, distToNext: Infinity });
    missions.beacon.visible = true;
    missions.beacon.position.set(58, 0, 67);
    G.setObjective('Wreck the rival cars: 0 down');
    G.setCameraMode('foot');
    G.setCameraFrame(11, 6);
    G.setCameraLookAt(58, 4, 72);
    G.cameraYaw = 0;
    return {
      seconds: 2.2,
      step(dt) {
        const dx = player.pos.x - rival.pos.x;
        const dz = player.pos.z - rival.pos.z;
        const want = Math.atan2(dx, dz);
        let diff = want - rival.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        vehicles.drive(rival, 1, Math.max(-1, Math.min(1, diff * 1.6)), false, dt);
        if (rival.speed > 4) rival.speed = 4;
      },
    };
  }

  if (name === 'city') {
    // The postcard: Leo on the beach at sunset, the skyline, the hotel and
    // the palms behind him, traffic rolling down the beachfront road.
    player.pos.set(0, 0, 292);
    player.heading = Math.PI;
    player.mesh.visible = true;
    G.exitCar(true);
    for (const [x, z, h] of [[-60, 264.5, Math.PI / 2], [30, 257.5, -Math.PI / 2], [90, 264.5, Math.PI / 2], [150, 257.5, -Math.PI / 2]]) {
      const t = vehicles.spawn('sedan', x, z, h);
      t.parked = false;
      traffic.trafficCars.push({ car: t, road: { axis: 'x', line: 261, dir: h > 0 ? 1 : -1 }, speed: 9, targetSpeed: 9 });
    }
    G.setObjective('Free roam — press M for jobs');
    G.setCameraMode('vista');
    return {
      seconds: 1.6,
      step(dt) {
        for (const t of traffic.trafficCars) {
          const fx = Math.sin(t.car.heading);
          const fz = Math.cos(t.car.heading);
          t.car.pos.x += fx * t.car.speed * dt;
          t.car.pos.z += fz * t.car.speed * dt;
        }
      },
    };
  }

  // Default: cover. Leo driving his sports car up the central avenue, palms
  // on both sides, traffic ahead, two cruisers behind, two stars on the HUD.
  const car = vehicles.spawn('sports', 32.5, 40, Math.PI, 0xd42a2a);
  car.parked = false;
  car.isPlayer = true;
  G.enterCar(car, true);
  police.setStars(2);
  const c1 = vehicles.spawn('police', 32.5, 78, Math.PI);
  c1.parked = false;
  police.chasers.push({ car: c1, stuck: 0, formation: { back: 6, side: 4 } });
  const c2 = vehicles.spawn('police', 25.5, 92, Math.PI);
  c2.parked = false;
  police.chasers.push({ car: c2, stuck: 0, formation: { back: 4, side: -3 } });
  // Oncoming traffic in the other lane, so the player passes real traffic.
  for (const [x, z] of [[25.5, -20], [25.5, -70], [25.5, -120]]) {
    const t = vehicles.spawn('sedan', x, z, 0);
    t.parked = false;
    traffic.trafficCars.push({ car: t, road: { axis: 'z', line: 29, dir: 1 }, speed: 9, targetSpeed: 9 });
  }
  missions.beacon.visible = true;
  missions.beacon.position.set(29, 0, -180);
  G.setObjective('Drive to Dante’s Garage');
  G.setCameraMode('chase');
  return {
    seconds: 3.0,
    step(dt) {
      const input = laneFollow(car, 'z', 29, -1, 26);
      vehicles.drive(car, input.throttle, input.steer, false, dt);
      for (const c of police.chasers) {
        formationChaser(c.car, car, c.formation.back, c.formation.side, dt);
      }
      for (const t of traffic.trafficCars) {
        const fx = Math.sin(t.car.heading);
        const fz = Math.cos(t.car.heading);
        t.car.pos.x += fx * t.car.speed * dt;
        t.car.pos.z += fz * t.car.speed * dt;
      }
    },
  };
}
