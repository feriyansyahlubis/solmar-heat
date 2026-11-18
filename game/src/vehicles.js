// Cars: meshes, arcade driving physics, collisions, police light bars.

import * as THREE from 'three';
import { CAR } from './config.js';
import { resolveCircleCollision } from './city.js';

export const CAR_TYPES = {
  sedan: { body: 0x7a8a99, cabin: 0x223344, length: 4.6, accel: 1.0, top: 1.0 },
  taxi: { body: 0xf5c542, cabin: 0x223344, length: 4.6, accel: 1.0, top: 0.98 },
  sports: { body: 0xc0392b, cabin: 0x1a1a1a, length: 4.4, accel: 1.35, top: 1.25 },
  van: { body: 0x5d8a66, cabin: 0x223344, length: 5.2, accel: 0.8, top: 0.85 },
  pickup: { body: 0x8e6b3d, cabin: 0x223344, length: 4.9, accel: 0.95, top: 0.95 },
  police: { body: 0x1a1a1a, cabin: 0x223344, length: 4.6, accel: 1.2, top: 1.15 },
};

const PAINTS = [0x7a8a99, 0xc0392b, 0x2e86c1, 0x27ae60, 0xe67e22, 0x8e44ad, 0xecf0f1, 0x1a1a1a, 0xf5c542, 0x5d8a66];

let nextId = 1;

export function buildCarMesh(type, color) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  const paint = color !== undefined ? color : def.body;
  const len = def.length;
  const car = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.35, metalness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, len), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  car.add(body);

  const cabinMat = new THREE.MeshStandardMaterial({ color: def.cabin, roughness: 0.2, metalness: 0.4 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, len * 0.45), cabinMat);
  cabin.position.set(0, 1.15, -len * 0.05);
  cabin.castShadow = true;
  car.add(cabin);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheels = [];
  const frontWheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  for (const [wx, wz, front] of [
    [-0.95, len / 2 - 0.9, true],
    [0.95, len / 2 - 0.9, true],
    [-0.95, -len / 2 + 0.9, false],
    [0.95, -len / 2 + 0.9, false],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    w.castShadow = true;
    car.add(w);
    wheels.push(w);
    if (front) frontWheels.push(w);
  }

  let lightBar = null;
  if (type === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.25, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf5c542, emissive: 0xaa8800, emissiveIntensity: 0.8, roughness: 0.4 }),
    );
    sign.position.set(0, 1.6, 0);
    car.add(sign);
  }
  if (type === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), bodyMat);
    spoiler.position.set(0, 1.05, -len / 2 + 0.2);
    spoiler.castShadow = true;
    car.add(spoiler);
  }
  if (type === 'police') {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1 }),
    );
    red.position.x = -0.3;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 1 }),
    );
    blue.position.x = 0.3;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.55, 0);
    lightBar.userData = { red, blue };
    car.add(lightBar);
    // White doors stripe.
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.3, len * 0.6),
      new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }),
    );
    stripe.position.y = 0.55;
    car.add(stripe);
  }

  car.userData = { wheels, frontWheels, lightBar, length: len };
  return car;
}

export function createVehicleSystem(scene, colliders) {
  const cars = [];

  function spawn(type, x, z, heading, color) {
    const mesh = buildCarMesh(type, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    const car = {
      id: nextId++,
      type,
      mesh,
      pos: mesh.position,
      heading,
      speed: 0,
      steer: 0,
      health: 100,
      isPlayer: false,
      isPolice: type === 'police',
      parked: false,
      smoke: 0,
    };
    cars.push(car);
    return car;
  }

  function drive(car, throttle, steerInput, handbrake, dt) {
    const def = CAR_TYPES[car.type] || CAR_TYPES.sedan;
    const maxSpeed = CAR.MAX_SPEED * def.top;
    const maxReverse = CAR.MAX_REVERSE;
    // Steering eases toward the input, less at high speed.
    const steerTarget = steerInput * CAR.STEER_MAX * (1 - Math.min(0.6, Math.abs(car.speed) / maxSpeed * 0.6));
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);

    if (throttle > 0) {
      car.speed += CAR.ENGINE_FORCE * def.accel * throttle * dt;
    } else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= CAR.BRAKE_FORCE * dt;
      else car.speed += CAR.ENGINE_FORCE * 0.6 * throttle * dt;
    }
    if (handbrake) {
      car.speed -= Math.sign(car.speed) * CAR.BRAKE_FORCE * 1.4 * dt;
      if (Math.abs(car.speed) < 0.5) car.speed = 0;
    }
    // Drag.
    car.speed -= car.speed * CAR.DRAG * dt;
    car.speed = Math.max(-maxReverse, Math.min(maxSpeed, car.speed));

    // Heading change: bicycle-model yaw rate, sign follows speed.
    car.heading += (car.speed / 2.8) * Math.tan(car.steer) * dt;

    // Move.
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    car.mesh.rotation.y = car.heading;

    // Building collision.
    const before = { x: car.pos.x, z: car.pos.z };
    resolveCircleCollision(car.pos, 2.1, colliders);
    if (car.pos.x !== before.x || car.pos.z !== before.z) {
      car.speed *= 0.45;
      car.health = Math.max(0, car.health - 2);
    }

    // Wheel spin + steer visuals.
    const spin = (car.speed * dt) / 0.36;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    for (const w of car.mesh.userData.frontWheels) w.rotation.y = car.steer;
  }

  function update(dt, time) {
    // Car-car bumps.
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.2 && d > 0.001) {
          const push = (4.2 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;
          a.speed *= 0.85;
          b.speed *= 0.85;
        }
      }
    }
    // Police light bars flash at 6 Hz; wrecked cars build smoke.
    for (const car of cars) {
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        const phase = Math.floor(time * 6) % 2 === 0;
        bar.userData.red.material.emissiveIntensity = phase ? 2.2 : 0.15;
        bar.userData.blue.material.emissiveIntensity = phase ? 0.15 : 2.2;
      }
      if (car.health < 35) car.smoke = Math.min(1, car.smoke + dt * 0.5);
    }
  }

  function nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function remove(car) {
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
    scene.remove(car.mesh);
  }

  function randomColor() {
    return PAINTS[Math.floor(Math.random() * PAINTS.length)];
  }

  return { cars, spawn, drive, update, nearestCar, remove, randomColor };
}
