// Combat: the pistol. A ray from the player (or the car) toward the aim
// point, tested against pedestrians, rival cars and police cars — no
// projectiles, just a fast line, a flash and a result.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createCombat(scene) {
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.frustumCulled = false;
  scene.add(tracer);
  const flash = new THREE.PointLight(0xffd23a, 0, 12);
  scene.add(flash);
  let tracerTime = 0;
  let flashTime = 0;

  function rayHit(origin, dir, target, radius) {
    const to = new THREE.Vector3().subVectors(target, origin);
    const along = to.dot(dir);
    if (along < 0 || along > PLAYER.PISTOL_RANGE) return Infinity;
    const closest = new THREE.Vector3().copy(origin).addScaledVector(dir, along);
    return closest.distanceTo(target) < radius ? along : Infinity;
  }

  // origin: Vector3 at the muzzle; dir: normalized aim direction.
  // targets: { peds, cars } — cars are { pos, health, radius }.
  function shoot(origin, dir, targets) {
    let bestDist = PLAYER.PISTOL_RANGE;
    let best = null;
    for (const ped of targets.peds || []) {
      if (ped.state === 'down') continue;
      const d = rayHit(origin, dir, new THREE.Vector3(ped.pos.x, 1.2, ped.pos.z), 1.1);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: 'ped', target: ped };
      }
    }
    for (const car of targets.cars || []) {
      const d = rayHit(origin, dir, new THREE.Vector3(car.pos.x, 1, car.pos.z), 2.4);
      if (d < bestDist) {
        bestDist = d;
        best = { kind: 'car', target: car };
      }
    }
    const end = new THREE.Vector3().copy(origin).addScaledVector(dir, bestDist);
    tracerGeo.setFromPoints([origin, end]);
    tracerMat.opacity = 1;
    tracerTime = 0.09;
    flash.position.copy(origin);
    flash.intensity = 60;
    flashTime = 0.06;
    if (best) {
      if (best.kind === 'ped') best.target.health = 0;
      else best.target.health -= PLAYER.PISTOL_DAMAGE;
    }
    return { hit: best, end };
  }

  function update(dt) {
    if (tracerTime > 0) {
      tracerTime -= dt;
      if (tracerTime <= 0) tracerMat.opacity = 0;
    }
    if (flashTime > 0) {
      flashTime -= dt;
      if (flashTime <= 0) flash.intensity = 0;
    }
  }

  return { shoot, update };
}
