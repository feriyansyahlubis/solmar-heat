// Leo Vega on foot: a low-poly walker with a swing animation, jumping,
// punching and a camera-relative run.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCircleCollision } from './city.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a075 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e8b8b });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
  head.position.y = 1.74;
  head.castShadow = true;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.36), hair);
  hairTop.position.y = 1.94;
  group.add(hairTop);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), pants);
  legL.position.set(-0.17, 0.42, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), pants);
  legR.position.set(0.17, 0.42, 0);
  legR.castShadow = true;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.2, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armR.position.set(0.42, 1.2, 0);
  armR.castShadow = true;
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
  };

  // Move with WASD relative to the camera yaw; returns the distance walked.
  function update(dt, moveX, moveZ, cameraYaw, running) {
    state.punchCooldown = Math.max(0, state.punchCooldown - dt);
    const speed = running ? PLAYER.RUN_SPEED : PLAYER.WALK_SPEED;
    // Camera-relative movement: forward is where the camera looks.
    const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3()
      .addScaledVector(forward, moveZ)
      .addScaledVector(right, moveX);
    if (wish.lengthSq() > 0.001) {
      wish.normalize();
      state.vel.x += (wish.x * speed - state.vel.x) * Math.min(1, dt * PLAYER.ACCEL * 0.3);
      state.vel.z += (wish.z * speed - state.vel.z) * Math.min(1, dt * PLAYER.ACCEL * 0.3);
      state.heading = Math.atan2(state.vel.x, state.vel.z);
      state.moving = true;
    } else {
      state.vel.x *= Math.max(0, 1 - dt * 10);
      state.vel.z *= Math.max(0, 1 - dt * 10);
      state.moving = false;
    }
    state.pos.x += state.vel.x * dt;
    state.pos.z += state.vel.z * dt;
    resolveCircleCollision(state.pos, PLAYER.RADIUS, state.colliders);
    // Gravity and jumping.
    state.vy -= 22 * dt;
    state.pos.y += state.vy * dt;
    if (state.pos.y <= 0) {
      state.pos.y = 0;
      state.vy = 0;
      state.onGround = true;
    }
    group.rotation.y = state.heading;
    // Walk cycle: legs and arms swing opposite each other.
    const speedRatio = Math.min(1, Math.hypot(state.vel.x, state.vel.z) / PLAYER.RUN_SPEED);
    state.walkPhase += dt * 11 * speedRatio;
    const swing = Math.sin(state.walkPhase) * 0.6 * speedRatio;
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8;
    armR.rotation.x = swing * 0.8;
    return Math.hypot(state.vel.x, state.vel.z) * dt;
  }

  function jump() {
    if (state.onGround) {
      state.vy = PLAYER.JUMP_SPEED;
      state.onGround = false;
    }
  }

  function setColliders(colliders) {
    state.colliders = colliders;
  }

  function punch() {
    if (state.punchCooldown > 0) return false;
    state.punchCooldown = 0.45;
    armR.rotation.x = -1.4;
    return true;
  }

  return { ...state, update, jump, punch, setColliders };
}
