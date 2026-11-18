// Pistol combat: ray test vs peds/cars, tracer + muzzle flash.

import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createCombat(scene) {
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);
  const flash = new THREE.PointLight(0xffc860, 0, 12);
  scene.add(flash);
  let tracerT = 0;

  function shoot(origin, dir, targets) {
    const end = origin.clone().addScaledVector(dir, PLAYER.PISTOL_RANGE);
    let best = null;
    let bestD = PLAYER.PISTOL_RANGE;
    let bestPoint = end.clone();

    // Peds: sphere radius 1.1 at y 1.2.
    for (const ped of targets.peds || []) {
      if (ped.state === 'down') continue;
      const c = new THREE.Vector3(ped.pos.x, 1.2, ped.pos.z);
      const to = c.clone().sub(origin);
      const along = to.dot(dir);
      if (along < 0 || along > PLAYER.PISTOL_RANGE) continue;
      const closest = origin.clone().addScaledVector(dir, along);
      const d = closest.distanceTo(c);
      if (d < 1.1 && along < bestD) {
        bestD = along;
        best = { kind: 'ped', target: ped };
        bestPoint = closest;
      }
    }
    // Cars: sphere radius 2.4 at y 1.
    for (const car of targets.cars || []) {
      const c = new THREE.Vector3(car.pos.x, 1, car.pos.z);
      const to = c.clone().sub(origin);
      const along = to.dot(dir);
      if (along < 0 || along > PLAYER.PISTOL_RANGE) continue;
      const closest = origin.clone().addScaledVector(dir, along);
      const d = closest.distanceTo(c);
      if (d < 2.4 && along < bestD) {
        bestD = along;
        best = { kind: 'car', target: car };
        bestPoint = closest;
      }
    }

    if (best) {
      if (best.kind === 'ped') best.target.health = 0;
      else best.target.health = Math.max(0, best.target.health - PLAYER.PISTOL_DAMAGE);
    }

    // Tracer + flash.
    tracerGeo.setFromPoints([origin.clone(), bestPoint]);
    tracer.visible = true;
    tracerT = 0.07;
    flash.position.copy(origin);
    flash.intensity = 24;
    return { hit: best, end: bestPoint };
  }

  function update(dt) {
    if (tracerT > 0) {
      tracerT -= dt;
      tracerMat.opacity = Math.max(0, tracerT / 0.07) * 0.9;
      if (tracerT <= 0) {
        tracer.visible = false;
        flash.intensity = 0;
      }
    }
  }

  return { shoot, update };
}
