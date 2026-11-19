// Staged screenshot scenes for ?shot=cover|chase|mission|city.
// Each scene sets up the world once, then drives an autopilot update(dt)
// until its duration elapses; main.js then sets window.__shotReady.

import * as THREE from 'three';

// Steer a car along a road line. lane centre = line +/- 3.5 by direction
// (right-hand traffic). axis 'x' travels along Z, axis 'z' along X.
export function laneFollow(car, axis, line, dir, targetSpeed, vehicles) {
  const laneCentre = axis === 'x'
    ? line + 3.5 * (dir > 0 ? -1 : 1)
    : line + 3.5 * (dir > 0 ? 1 : -1);
  const lateral = axis === 'x' ? car.pos.x - laneCentre : car.pos.z - laneCentre;
  const baseHeading = axis === 'x'
    ? dir > 0 ? 0 : Math.PI
    : dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  const corr = axis === 'x' ? -lateral * 0.05 * dir : lateral * 0.05 * dir;
  const desired = baseHeading + corr;
  let dh = desired - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const steer = Math.max(-0.5, Math.min(0.5, dh * 2));
  const throttle = car.speed < targetSpeed ? 0.8 : 0;
  vehicles.drive(car, throttle, steer, false, 1 / 60);
  return car;
}

// Kinematic formation placement: chaser sits `back` metres behind and
// `side` metres to the side of the player car, matching its heading.
export function formationChaser(car, playerCar, back, side, dt) {
  const h = playerCar.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const rx = -Math.cos(h);
  const rz = Math.sin(h);
  car.pos.x = playerCar.pos.x - fx * back + rx * side;
  car.pos.z = playerCar.pos.z - fz * back + rz * side;
  car.heading = h;
  car.mesh.rotation.y = h;
  car.speed = playerCar.speed;
}

export function stageShot(name, G) {
  const V = G.vehicles;
  const noOp = () => {};

  if (name === 'cover') {
    // Red sports car north up the central avenue (x = 29, lane 32.5),
    // oncoming traffic, two police cruisers in formation, 2 stars.
    const car = V.spawn('sports', 32.5, 60, Math.PI, 0xc0392b);
    car.speed = 16;
    G.enterCar(car, true);
    const oncoming = V.spawn('sedan', 25.5, -90, 0, 0x2e86c1);
    oncoming.speed = 10;
    const oncoming2 = V.spawn('sedan', 25.5, -30, 0, 0x27ae60);
    oncoming2.speed = 10;
    const taxi = V.spawn('taxi', -10, 83.5, Math.PI / 2, 0xf5c542);
    taxi.speed = 9;
    const c1 = V.spawn('police', 36.5, 66, Math.PI, 0x1a1a1a);
    const c2 = V.spawn('police', 28.5, 64, Math.PI, 0x1a1a1a);
    G.police.setStars(2);
    G.setObjective("Drive to Dante's Garage");
    G.missions.beacon.visible = true;
    return {
      seconds: 3.0,
      update(dt) {
        laneFollow(car, 'x', 29, -1, 18, V);
        laneFollow(oncoming, 'x', 29, 1, 10, V);
        laneFollow(oncoming2, 'x', 29, 1, 10, V);
        laneFollow(taxi, 'z', 87, 1, 9, V);
        formationChaser(c1, car, 6, 4, dt);
        formationChaser(c2, car, 4, -3, dt);
        G.missions.beacon.position.set(29, 0, -180);
      },
    };
  }

  if (name === 'chase') {
    // 3-star chase east along road z = 87 at ~30 m/s.
    const car = V.spawn('sports', -60, 90.5, Math.PI / 2, 0xc0392b);
    car.speed = 28;
    G.enterCar(car, true);
    const ahead = V.spawn('taxi', 10, 90.5, Math.PI / 2, 0xf5c542);
    ahead.speed = 12;
    const van = V.spawn('van', 60, 83.5, Math.PI / 2, 0x5d8a66);
    van.speed = 14;
    const c1 = V.spawn('police', -66, 94.5, Math.PI / 2, 0x1a1a1a);
    const c2 = V.spawn('police', -64, 86.5, Math.PI / 2, 0x1a1a1a);
    const c3 = V.spawn('police', -72, 90.5, Math.PI / 2, 0x1a1a1a);
    G.police.setStars(3);
    G.setObjective('Lose the heat or reach the pier');
    return {
      seconds: 3.2,
      update(dt) {
        laneFollow(car, 'z', 87, 1, 30, V);
        laneFollow(ahead, 'z', 87, 1, 12, V);
        laneFollow(van, 'z', 87, 1, 14, V);
        formationChaser(c1, car, 6, 4, dt);
        formationChaser(c2, car, 4, -3, dt);
        formationChaser(c3, car, 9, 0, dt);
      },
    };
  }

  if (name === 'mission') {
    // Leo on foot at Solmar Bank, three rivals closing in, two police
    // cruisers rolling past on the avenue, two stars on the board.
    // Leo stands on the bank plaza, clear of the traffic lanes, so no
    // passing car can hide him from the camera.
    // (exitCar is a no-op when not driving, so set the camera mode here.)
    G.exitCar(true);
    G.setCameraMode('foot');
    G.player.pos.set(58, 0, 80);
    G.player.heading = Math.PI;
    G.player.mesh.rotation.y = Math.PI;
    G.cameraYaw = 0;
    G.police.setStars(2);
    const rivals = [
      V.spawn('sedan', 72, 70, Math.PI, 0x1a1a1a),
      V.spawn('sports', 44, 64, 0, 0xc0392b),
      V.spawn('sedan', 78, 74, Math.PI, 0x2e86c1),
    ];
    for (const r of rivals) r.speed = 0;
    // Both cruisers on the far lane (z = 83.5), westbound and staggered,
    // so they cross the frame in front of Leo instead of slipping past
    // behind the camera.
    const c1 = V.spawn('police', 85, 83.5, -Math.PI / 2, 0x1a1a1a);
    const c2 = V.spawn('police', 70, 83.5, -Math.PI / 2, 0x1a1a1a);
    c1.speed = 7;
    c2.speed = 7;
    G.setObjective('The Big Score: wreck the rival cars — 0/4 down');
    G.setCameraFrame(14, 9);
    G.setCameraLookAt(58, 2, 72);
    G.missions.beacon.visible = true;
    return {
      seconds: 3.0,
      update(dt) {
        // Rivals roll slowly toward Leo, capped at 4 m/s.
        for (const rival of rivals) {
          const target = G.player.pos;
          const desired = Math.atan2(target.x - rival.pos.x, target.z - rival.pos.z);
          let dh = desired - rival.heading;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          const steer = Math.max(-0.5, Math.min(0.5, dh * 1.5));
          V.drive(rival, rival.speed < 4 ? 0.5 : 0, steer, false, dt);
        }
        // Police cruise past on the far lane of road z = 87.
        laneFollow(c1, 'z', 87, -1, 7, V);
        laneFollow(c2, 'z', 87, -1, 7, V);
        G.missions.beacon.position.set(58, 0, 67);
      },
    };
  }

  // city (default): postcard from the pier — Leo on the planks, ocean at
  // his feet, beach, Hotel Palma and the tower skyline ahead.
  G.exitCar(true);
  G.player.pos.set(0, 0, 345);
  G.player.heading = Math.PI;
  G.player.mesh.rotation.y = Math.PI;
  G.cameraYaw = 0;
  const b1 = V.spawn('sedan', -60, 264.5, Math.PI / 2, 0x27ae60);
  b1.speed = 9;
  const b2 = V.spawn('sports', 80, 257.5, -Math.PI / 2, 0xe67e22);
  b2.speed = 11;
  const b3 = V.spawn('taxi', 120, 264.5, Math.PI / 2, 0xf5c542);
  b3.speed = 10;
  G.setObjective('Free roam — press M for jobs');
  G.setCameraMode('foot');
  G.setCameraFrame(30, 13);
  G.setCameraLookAt(0, 6, 285);
  return {
    seconds: 1.6,
    update(dt) {
      laneFollow(b1, 'z', 261, 1, 9, V);
      laneFollow(b2, 'z', 261, -1, 11, V);
      laneFollow(b3, 'z', 261, 1, 10, V);
    },
  };
}
