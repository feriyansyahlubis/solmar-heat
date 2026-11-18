// Cars: their models, arcade driving physics, stealing and parking.
// Every car is built from boxes, so the whole fleet is code, not assets.
import * as THREE from 'three';
import { CAR } from './config.js';
import { resolveCircleCollision } from './city.js';

export const CAR_TYPES = {
  sedan: { body: 0x4a7fb5, cabin: 0x1a2a3a, length: 4.6, accel: 1.0, top: 1.0 },
  taxi: { body: 0xffd23a, cabin: 0x1a2a3a, length: 4.6, accel: 0.95, top: 0.95 },
  sports: { body: 0xd42a2a, cabin: 0x14181f, length: 4.4, accel: 1.35, top: 1.18 },
  van: { body: 0x8a94a6, cabin: 0x2a3438, length: 5.2, accel: 0.8, top: 0.85 },
  pickup: { body: 0x3f9e4d, cabin: 0x1a2a3a, length: 4.9, accel: 1.0, top: 0.95 },
  police: { body: 0xf2f2f2, cabin: 0x14181f, length: 4.6, accel: 1.15, top: 1.08 },
};

const CAR_COLORS = [0x4a7fb5, 0xd42a2a, 0x3f9e4d, 0xe8e8e8, 0x2a2a2e, 0x8a5fb5, 0xe88a2a, 0x4ecdc4];

function buildCarMesh(type, color) {
  const spec = CAR_TYPES[type];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: color ?? spec.body });
  const darkMat = new THREE.MeshLambertMaterial({ color: spec.cabin });
  const L = spec.length;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.72, L), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, L * 0.48), darkMat);
  cabin.position.set(0, 1.25, -L * 0.06);
  cabin.castShadow = true;
  group.add(cabin);
  if (type === 'van') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, L * 0.55), bodyMat);
    box.position.set(0, 1.35, -L * 0.18);
    box.castShadow = true;
    group.add(box);
  }
  if (type === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.35), darkMat);
    spoiler.position.set(0, 1.15, -L / 2 + 0.2);
    group.add(spoiler);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.4), new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0xaa8800, emissiveIntensity: 0.5 }));
    sign.position.set(0, 1.72, -L * 0.06);
    group.add(sign);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0xfff2a0, emissiveIntensity: 0.8 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xaa0000, emissiveIntensity: 0.6 });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.06), headMat);
    head.position.set(sx, 0.72, L / 2 + 0.01);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.06), tailMat);
    tail.position.set(sx, 0.72, -L / 2 - 0.01);
    group.add(tail);
  }
  // Wheels: cylinders with the axle along X.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const wheels = [];
  const frontWheels = [];
  for (const [wx, wz] of [[-0.95, L * 0.32], [0.95, L * 0.32], [-0.95, -L * 0.32], [0.95, -L * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
    if (wz > 0) frontWheels.push(wheel);
  }
  // Police light bar, red and blue, flashing in the update.
  let lightBar = null;
  if (type === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 1 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshLambertMaterial({ color: 0x2266ff, emissive: 0x0044ff, emissiveIntensity: 1 }));
    blue.position.x = 0.35;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.62, -L * 0.06);
    group.add(lightBar);
    lightBar.userData = { red, blue };
  }
  group.userData = { wheels, frontWheels, lightBar, length: L };
  return group;
}

export function createVehicleSystem(scene, colliders) {
  const cars = [];
  let idCounter = 1;

  function spawn(type, x, z, heading, color) {
    const mesh = buildCarMesh(type, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      id: idCounter++,
      type,
      mesh,
      pos: mesh.position,
      heading,
      speed: 0,
      steer: 0,
      health: 100,
      isPlayer: false,
      isPolice: type === 'police',
      parked: true,
      smoke: 0,
    };
    cars.push(car);
    return car;
  }

  // Arcade driving: throttle, steering and a little drift on the handbrake.
  function drive(car, throttle, steerInput, handbrake, dt) {
    const spec = CAR_TYPES[car.type];
    if (throttle > 0) car.speed += CAR.ENGINE_FORCE * spec.accel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= CAR.BRAKE_FORCE * dt;
      else car.speed -= CAR.ENGINE_FORCE * 0.6 * spec.accel * dt;
    }
    car.speed -= car.speed * CAR.DRAG * dt;
    if (handbrake) car.speed -= car.speed * 2.2 * dt;
    const top = CAR.MAX_SPEED * spec.top;
    car.speed = Math.max(-CAR.MAX_REVERSE, Math.min(top, car.speed));
    const steerTarget = steerInput * CAR.STEER_MAX / (1 + Math.abs(car.speed) * 0.028);
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
    const grip = handbrake ? CAR.GRIP * 0.45 : CAR.GRIP;
    car.heading += (car.speed / 2.7) * Math.tan(car.steer) * grip * 0.14 * dt;
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    const wheels = car.mesh.userData.wheels;
    const frontWheels = car.mesh.userData.frontWheels;
    for (const w of wheels) w.rotation.x += (car.speed * dt) / 0.36;
    for (const w of frontWheels) w.rotation.y = car.steer * 0.9;
    if (resolveCircleCollision(car.pos, 2.1, colliders)) {
      car.speed *= 0.45;
      car.health -= Math.abs(car.speed) * 0.05;
    }
  }

  function update(dt, time) {
    // Car-to-car bumps: push apart and bleed speed.
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 4.2 && dist > 0.01) {
          const push = (4.2 - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;
          a.speed *= 0.85;
          b.speed *= 0.85;
        }
      }
    }
    // Police light bars flash; wrecked cars smoke.
    for (const car of cars) {
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        const on = Math.floor(time * 6) % 2 === 0;
        bar.userData.red.material.emissiveIntensity = on ? 2.2 : 0.2;
        bar.userData.blue.material.emissiveIntensity = on ? 0.2 : 2.2;
      }
      if (car.health < 35 && car.health > 0) {
        car.smoke += dt;
      }
    }
  }

  function nearestCar(pos, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of cars) {
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  function remove(car) {
    scene.remove(car.mesh);
    const index = cars.indexOf(car);
    if (index >= 0) cars.splice(index, 1);
  }

  return { cars, spawn, drive, update, nearestCar, remove, randomColor: () => CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] };
}
