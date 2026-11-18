// The wanted system: stars rise with crime, police cars hunt the player,
// and at three stars and up they shoot back.
import * as THREE from 'three';
import { WANTED, HALF_CITY } from './config.js';
import { ROAD_LINES } from './city.js';

export function createPolice(scene, vehicles, rng) {
  const chasers = [];
  let stars = 0;
  let unseenTimer = 0;
  let shootTimer = 0;
  let bustProgress = 0;
  let spawnCooldown = 0;

  function addWanted(n) {
    const before = stars;
    stars = Math.min(WANTED.MAX, stars + n);
    unseenTimer = 0;
    return stars > before;
  }

  function spawnChaser(playerPos) {
    // A police car appears on a road a little way from the player.
    const line = rng.pick(ROAD_LINES);
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const angle = rng.range(0, Math.PI * 2);
    const dist = rng.range(70, 110);
    let x = playerPos.x + Math.cos(angle) * dist;
    let z = playerPos.z + Math.sin(angle) * dist;
    if (axis === 'x') z = line + (rng.chance(0.5) ? 3.5 : -3.5);
    else x = line + (rng.chance(0.5) ? 3.5 : -3.5);
    x = Math.max(-HALF_CITY - 4, Math.min(HALF_CITY + 4, x));
    z = Math.max(-HALF_CITY - 4, Math.min(HALF_CITY + 4, z));
    const heading = Math.atan2(playerPos.x - x, playerPos.z - z);
    const car = vehicles.spawn('police', x, z, heading);
    car.parked = false;
    const chaser = { car, stuck: 0 };
    chasers.push(chaser);
    return chaser;
  }

  // Steer a chaser toward the player like a real pursuit driver: aim at the
  // player's position, full throttle, and ram when close.
  function update(dt, playerPos, playerCar, playerOnFoot, onBusted) {
    spawnCooldown -= dt;
    const want = WANTED.CHASERS[stars];
    // Cull chasers that got hopelessly lost, and top the hunt up.
    for (let i = chasers.length - 1; i >= 0; i -= 1) {
      const c = chasers[i];
      const d = Math.hypot(c.car.pos.x - playerPos.x, c.car.pos.z - playerPos.z);
      if (d > 260 || c.car.health <= 0) {
        vehicles.remove(c.car);
        chasers.splice(i, 1);
      }
    }
    while (chasers.length < want && spawnCooldown <= 0) {
      spawnChaser(playerPos);
      spawnCooldown = 0.8;
    }
    // Wanted decays only while no police can see the player.
    let nearest = Infinity;
    for (const c of chasers) {
      nearest = Math.min(nearest, Math.hypot(c.car.pos.x - playerPos.x, c.car.pos.z - playerPos.z));
    }
    if (stars > 0 && nearest > 90) {
      unseenTimer += dt;
      if (unseenTimer > WANTED.DECAY_SECONDS) {
        stars -= 1;
        unseenTimer = 0;
      }
    } else {
      unseenTimer = 0;
    }
    // The chase itself.
    for (const c of chasers) {
      const { car } = c;
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.6));
      const throttle = dist > 6 ? 1 : 0.6;
      vehicles.drive(car, throttle, steer, false, dt);
      // Rammed into a wall: back up and turn around.
      if (Math.abs(car.speed) < 1 && dist > 10) {
        c.stuck += dt;
        if (c.stuck > 1.2) {
          car.heading += Math.PI * 0.7;
          c.stuck = 0;
        }
      } else {
        c.stuck = 0;
      }
      // Busted: a police car sitting on the player on foot for two seconds.
      if (playerOnFoot && dist < 2.6) {
        bustProgress += dt;
        if (bustProgress > 2) {
          onBusted();
          bustProgress = 0;
        }
      }
    }
    if (playerOnFoot) {
      // Walking away from the nearest cruiser resets the bust clock slowly.
      if (nearest > 4) bustProgress = Math.max(0, bustProgress - dt * 0.5);
    } else {
      bustProgress = 0;
    }
    // At three stars the police shoot: a hit chance that falls with distance.
    if (stars >= WANTED.SHOOT_AT && chasers.length > 0) {
      shootTimer -= dt;
      if (shootTimer <= 0) {
        shootTimer = rng.range(0.9, 1.6);
        const shooter = rng.pick(chasers);
        const d = Math.hypot(shooter.car.pos.x - playerPos.x, shooter.car.pos.z - playerPos.z);
        const hitChance = Math.max(0.08, 0.5 - d * 0.004);
        if (Math.random() < hitChance) {
          return { shotPlayer: true, damage: 8, from: shooter.car.pos.clone() };
        }
        return { shotPlayer: false, from: shooter.car.pos.clone() };
      }
    }
    return null;
  }

  function clear() {
    for (const c of chasers) vehicles.remove(c.car);
    chasers.length = 0;
    stars = 0;
    bustProgress = 0;
  }

  function getStars() {
    return stars;
  }

  function setStars(n) {
    stars = Math.max(0, Math.min(WANTED.MAX, n));
  }

  return { chasers, addWanted, update, clear, getStars, setStars };
}
