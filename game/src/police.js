// Wanted system: stars, police chasers, bust, decay, shooting.

import * as THREE from 'three';
import { WANTED, ROAD_LINES } from './config.js';

export function createPolice(scene, vehicles, rng) {
  const chasers = [];
  let stars = 0;
  let spawnCooldown = 0;
  let decayTimer = 0;
  let shootTimer = 1;
  let bustProgress = 0;

  function getStars() {
    return stars;
  }

  function setStars(n) {
    stars = Math.max(0, Math.min(WANTED.MAX, n));
    if (stars === 0) clear();
    decayTimer = 0;
    bustProgress = 0;
  }

  function addWanted(n) {
    const before = stars;
    stars = Math.max(0, Math.min(WANTED.MAX, stars + n));
    if (stars === 0) clear();
    decayTimer = 0;
    return stars > before;
  }

  function clear() {
    for (const c of chasers) vehicles.remove(c);
    chasers.length = 0;
    stars = 0;
    bustProgress = 0;
  }

  function spawnChaser(playerPos) {
    // Spawn on a road line 70-110 m from the player.
    const line = ROAD_LINES[Math.floor(rng.next() * ROAD_LINES.length)];
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(70, 110);
    const x = playerPos.x + Math.sin(angle) * dist;
    const z = playerPos.z + Math.cos(angle) * dist;
    const onX = rng.chance(0.5);
    const px = onX ? line : Math.max(-250, Math.min(250, x));
    const pz = onX ? Math.max(-250, Math.min(250, z)) : line;
    const heading = Math.atan2(playerPos.x - px, playerPos.z - pz);
    const car = vehicles.spawn('police', px, pz, heading, 0x1a1a1a);
    car.isPolice = true;
    car.stuckT = 0;
    car.lastPos = new THREE.Vector3(px, 0, pz);
    chasers.push(car);
    return car;
  }

  function update(dt, playerPos, playerCar, playerOnFoot, onBusted) {
    spawnCooldown -= dt;
    const wanted = WANTED.CHASERS[Math.min(stars, WANTED.CHASERS.length - 1)];
    while (chasers.length < wanted && spawnCooldown <= 0) {
      spawnChaser(playerPos);
      spawnCooldown = 0.8;
    }
    while (chasers.length > wanted) {
      vehicles.remove(chasers.pop());
    }

    let nearest = Infinity;
    let shotPlayer = false;
    let damage = 0;
    let from = null;

    for (let i = chasers.length - 1; i >= 0; i--) {
      const car = chasers[i];
      const d = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (d < nearest) nearest = d;
      // Cull far away or wrecked chasers.
      if (d > 260 || car.health <= 0) {
        vehicles.remove(car);
        chasers.splice(i, 1);
        continue;
      }
      // Pursuit: steer toward the player, full throttle.
      const desired = Math.atan2(playerPos.x - car.pos.x, playerPos.z - car.pos.z);
      let dh = desired - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-0.55, Math.min(0.55, dh * 1.5));
      vehicles.drive(car, 1, steer, false, dt);
      // Stuck detection: barely moved in 1.2 s -> turn around.
      car.stuckT = (car.stuckT || 0) + dt;
      if (car.stuckT > 1.2) {
        const moved = Math.hypot(car.pos.x - car.lastPos.x, car.pos.z - car.lastPos.z);
        if (moved < 3) car.heading += Math.PI * 0.7;
        car.lastPos.copy(car.pos);
        car.stuckT = 0;
      }
      // Bust: chaser within 2.6 m of an on-foot player for 2 s.
      if (playerOnFoot && d < 2.6) {
        bustProgress += dt;
        if (bustProgress >= 2) {
          bustProgress = 0;
          if (onBusted) onBusted();
        }
      } else {
        bustProgress = Math.max(0, bustProgress - dt);
      }
    }

    // Shooting at >= 3 stars.
    if (stars >= WANTED.SHOOT_AT && chasers.length > 0) {
      shootTimer -= dt;
      if (shootTimer <= 0) {
        shootTimer = rng.range(0.9, 1.6);
        const d = nearest;
        const hitChance = Math.max(0.08, 0.5 - d * 0.004);
        if (rng.next() < hitChance) {
          shotPlayer = true;
          damage = 8;
          from = chasers[0] ? chasers[0].pos.clone() : null;
        }
      }
    }

    // Decay: -1 star after 18 s with the nearest chaser > 90 m.
    if (stars > 0) {
      if (nearest > 90) {
        decayTimer += dt;
        if (decayTimer >= WANTED.DECAY_SECONDS) {
          stars -= 1;
          decayTimer = 0;
          if (stars === 0) clear();
        }
      } else {
        decayTimer = 0;
      }
    }

    return { shotPlayer, damage, from };
  }

  return { chasers, addWanted, update, clear, getStars, setStars };
}
