// Leo Vega on foot: low-poly character, camera-relative movement, punch.

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCircleCollision } from './city.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x264653, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1d1a16, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), hair);
  hairTop.position.y = 1.94;
  group.add(hairTop);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
  legL.position.set(-0.17, 0.36, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.18, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);

  scene.add(group);

  const state = {
    mesh: group,
    pos: group.position,
    vel: new THREE.Vector3(),
    heading: 0,
    vy: 0,
    onGround: true,
    walkPhase: 0,
    moving: false,
    health: 100,
    punchCooldown: 0,
    colliders: [],
    parts: { legL, legR, armL, armR, torso, head },
  };

  function setColliders(colliders) {
    state.colliders = colliders;
  }

  function update(dt, moveX, moveZ, cameraYaw, running) {
    // Camera-relative: forward = (-sin(yaw), 0, -cos(yaw)).
    const fx = -Math.sin(cameraYaw);
    const fz = -Math.cos(cameraYaw);
    const rx = -fz;
    const rz = fx;
    let mx = fx * moveZ + rx * moveX;
    let mz = fz * moveZ + rz * moveX;
    const len = Math.hypot(mx, mz);
    state.moving = len > 0.01;
    if (state.moving) {
      mx /= len;
      mz /= len;
      const speed = running ? PLAYER.RUN : PLAYER.WALK;
      state.vel.x += (mx * speed - state.vel.x) * Math.min(1, dt * PLAYER.ACCEL * 0.35);
      state.vel.z += (mz * speed - state.vel.z) * Math.min(1, dt * PLAYER.ACCEL * 0.35);
      state.heading = Math.atan2(mx, mz);
    } else {
      state.vel.x *= Math.max(0, 1 - dt * 10);
      state.vel.z *= Math.max(0, 1 - dt * 10);
    }

    state.pos.x += state.vel.x * dt;
    state.pos.z += state.vel.z * dt;
    resolveCircleCollision(state.pos, PLAYER.RADIUS, state.colliders);
    state.pos.x = Math.max(-268, Math.min(268, state.pos.x));
    state.pos.z = Math.max(-268, Math.min(400, state.pos.z));

    // Gravity + jump.
    state.vy -= 22 * dt;
    state.pos.y += state.vy * dt;
    if (state.pos.y <= 0) {
      state.pos.y = 0;
      state.vy = 0;
      state.onGround = true;
    }

    // Face movement direction.
    group.rotation.y = state.heading;

    // Walk cycle.
    const spd = Math.hypot(state.vel.x, state.vel.z);
    if (state.moving && state.onGround) state.walkPhase += dt * spd * 1.9;
    const swing = state.moving ? Math.sin(state.walkPhase) * 0.55 : 0;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;
    torso.position.y = 1.15 + Math.abs(Math.sin(state.walkPhase)) * 0.04;

    if (state.punchCooldown > 0) state.punchCooldown -= dt;
  }

  function jump() {
    if (!state.onGround) return false;
    state.vy = PLAYER.JUMP;
    state.onGround = false;
    return true;
  }

  function punch() {
    if (state.punchCooldown > 0) return false;
    state.punchCooldown = 0.45;
    armR.rotation.x = -1.5;
    return true;
  }

  return { ...state, update, jump, punch, setColliders };
}
