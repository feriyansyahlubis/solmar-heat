// Solmar City: the ground, the buildings, the palms, the beach and the pier.
// Everything is procedural; the same seed always builds the same city.
import * as THREE from 'three';
import { WORLD, PITCH, HALF_CITY } from './config.js';
import { FACADE_COLORS, makeGroundTexture, makeFacadeTexture, makeSignTexture, makeOceanTexture, makeSkyTexture } from './textures.js';

// Road centre lines, both directions (10 lines, 58 m apart).
export const ROAD_LINES = [];
for (let k = 0; k <= WORLD.GRID; k += 1) ROAD_LINES.push((k - 4.5) * PITCH);

const facadeCache = new Map();
function facadeMaterial(rng, color, height) {
  const rows = height < 12 ? 8 : height < 25 ? 14 : 22;
  const key = `${color}-${rows}`;
  if (!facadeCache.has(key)) {
    facadeCache.set(key, new THREE.MeshLambertMaterial({ map: makeFacadeTexture(rng, color, rows) }));
  }
  return facadeCache.get(key);
}

function makePalm(rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 6.5, 6), trunkMat);
  trunk.position.y = 3.25;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  palm.add(trunk);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  for (let i = 0; i < 7; i += 1) {
    const frond = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 0.5), frondMat);
    const angle = (i / 7) * Math.PI * 2;
    frond.position.set(Math.cos(angle) * 1.25, 6.6, Math.sin(angle) * 1.25);
    frond.rotation.y = -angle;
    frond.rotation.z = 0.85;
    palm.add(frond);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
  nut.position.y = 6.5;
  palm.add(nut);
  palm.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  return palm;
}

function makeStreetlight() {
  const light = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2c3138 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 7, 6), mat);
  pole.position.y = 3.5;
  light.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), mat);
  arm.position.set(1, 6.9, 0);
  light.add(arm);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffdf80, emissiveIntensity: 0.7 }));
  lamp.position.set(2, 6.8, 0);
  light.add(lamp);
  light.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return light;
}

function makeTree(rng) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 2.6, 6), new THREE.MeshLambertMaterial({ color: 0x7a5a38 }));
  trunk.position.y = 1.3;
  tree.add(trunk);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(rng.range(1.6, 2.4), 8, 6), new THREE.MeshLambertMaterial({ color: 0x4e9e4e }));
  canopy.position.y = 3.4;
  tree.add(canopy);
  tree.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return tree;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  const colliders = [];
  const landmarks = {};
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  const concreteMat = new THREE.MeshLambertMaterial({ color: 0x9a8f7a });

  // Sky dome: a big sphere with the sunset gradient, sun included.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);

  // Ground: one textured plane for the whole city, beach and waterline.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 720),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(60, 0, 60);
  ground.receiveShadow = true;
  group.add(ground);

  // Ocean: a gently animated plane over the waterline.
  const oceanTex = makeOceanTexture(rng);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 140),
    new THREE.MeshLambertMaterial({ map: oceanTex }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(60, 0.15, 390);
  group.add(ocean);

  // Sun: warm directional light with shadows that follow the player.
  const sun = new THREE.DirectionalLight(0xffe3b3, 3.1);
  const sunDir = new THREE.Vector3(Math.sin(WORLD.SUN_AZIMUTH), WORLD.SUN_ELEVATION, Math.cos(WORLD.SUN_AZIMUTH)).normalize();
  sun.position.copy(sunDir).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  group.add(sun);
  group.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.15));
  scene.add(group);

  // Buildings, one block at a time. The centre blocks grow taller (downtown).
  // Blocks that host a landmark stay clear for it.
  const landmarkBlocks = new Set(['4,4', '1,3', '5,5', '3,8']);
  const downtown = (i, j) => 1 - (Math.abs(i - 4) + Math.abs(j - 4)) / 8;
  for (let i = 0; i < WORLD.GRID; i += 1) {
    for (let j = 0; j < WORLD.GRID; j += 1) {
      if (landmarkBlocks.has(`${i},${j}`)) continue;
      const cx = (i - 4) * PITCH;
      const cz = (j - 4) * PITCH;
      const isPark = rng.chance(0.12);
      if (isPark) {
        for (let t = 0; t < 5; t += 1) {
          const tree = makeTree(rng);
          tree.position.set(cx + rng.range(-16, 16), 0, cz + rng.range(-16, 16));
          group.add(tree);
        }
        continue;
      }
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(10, 20);
        const d = rng.range(10, 20);
        const h = Math.max(6, rng.range(7, 16) + downtown(i, j) * rng.range(6, 30));
        const x = cx + rng.range(-14, 14) * (count > 1 ? 0.55 : 0);
        const z = cz + rng.range(-14, 14) * (count > 1 ? 0.55 : 0);
        const color = rng.pick(FACADE_COLORS);
        const facade = facadeMaterial(rng, color, h);
        const building = new THREE.Mesh(boxGeo, [facade, facade, roofMat, roofMat, facade, facade]);
        building.scale.set(w, h, d);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        // Roof slab + AC boxes.
        const slab = new THREE.Mesh(boxGeo, concreteMat);
        slab.scale.set(w + 0.8, 0.5, d + 0.8);
        slab.position.set(x, h + 0.25, z);
        group.add(slab);
        for (let a = 0; a < 2; a += 1) {
          const ac = new THREE.Mesh(boxGeo, concreteMat);
          ac.scale.set(1.6, 0.9, 1.6);
          ac.position.set(x + rng.range(-w / 4, w / 4), h + 0.9, z + rng.range(-d / 4, d / 4));
          group.add(ac);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Solmar Tower: the tallest building, downtown, with an antenna and beacon.
  const towerX = 0;
  const towerZ = 0;
  const tower = new THREE.Mesh(boxGeo, [facadeMaterial(rng, '#d8e8f8', 22), facadeMaterial(rng, '#d8e8f8', 22), roofMat, roofMat, facadeMaterial(rng, '#d8e8f8', 22), facadeMaterial(rng, '#d8e8f8', 22)]);
  tower.scale.set(22, 62, 22);
  tower.position.set(towerX, 31, towerZ);
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 14, 6), new THREE.MeshLambertMaterial({ color: 0x888888 }));
  antenna.position.set(towerX, 69, towerZ);
  group.add(antenna);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  beacon.position.set(towerX, 76.5, towerZ);
  group.add(beacon);
  colliders.push({ minX: towerX - 11, maxX: towerX + 11, minZ: towerZ - 11, maxZ: towerZ + 11 });
  landmarks.tower = new THREE.Vector3(towerX, 0, towerZ);

  // Dante's Garage: the mission hub, west side, with a big sign.
  const garage = new THREE.Group();
  const garageBox = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xb8452e }));
  garageBox.scale.set(20, 8, 14);
  garageBox.position.y = 4;
  garageBox.castShadow = true;
  garage.add(garageBox);
  const garageSign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.MeshBasicMaterial({ map: makeSignTexture("DANTE'S GARAGE", '#1c2b4a', '#ffd23a') }));
  garageSign.position.set(0, 6.5, 7.1);
  garage.add(garageSign);
  garage.position.set(-174, 0, -58);
  group.add(garage);
  colliders.push({ minX: -184, maxX: -164, minZ: -65, maxZ: -51 });
  landmarks.garage = new THREE.Vector3(-174, 0, -44);

  // Solmar Bank: the big-score target, downtown.
  const bank = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd8cfae }));
  bank.scale.set(24, 14, 18);
  bank.position.set(58, 7, 58);
  bank.castShadow = true;
  bank.receiveShadow = true;
  group.add(bank);
  const bankSign = new THREE.Mesh(new THREE.PlaneGeometry(20, 4), new THREE.MeshBasicMaterial({ map: makeSignTexture('SOLMAR BANK', '#1c4a2e', '#ffffff') }));
  bankSign.position.set(58, 11, 67.1);
  group.add(bankSign);
  colliders.push({ minX: 46, maxX: 70, minZ: 49, maxZ: 67 });
  landmarks.bank = new THREE.Vector3(58, 0, 73);

  // Hotel Palma on the beachfront.
  const hotel = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf2c9a0 }));
  hotel.scale.set(26, 26, 16);
  hotel.position.set(-58, 13, 246);
  hotel.castShadow = true;
  group.add(hotel);
  const hotelSign = new THREE.Mesh(new THREE.PlaneGeometry(22, 4), new THREE.MeshBasicMaterial({ map: makeSignTexture('HOTEL PALMA', '#c22e8a', '#ffffff') }));
  hotelSign.position.set(-58, 20, 254.1);
  group.add(hotelSign);
  colliders.push({ minX: -71, maxX: -45, minZ: 238, maxZ: 254 });
  landmarks.hotel = new THREE.Vector3(-58, 0, 258);

  // Palms along the beachfront and the central avenue — on the sidewalks,
  // clear of the driving lanes.
  for (let x = -240; x <= 240; x += 24) {
    const palm = makePalm(rng);
    palm.position.set(x, 0, 272);
    group.add(palm);
  }
  for (let z = -240; z <= 240; z += 30) {
    const palmA = makePalm(rng);
    palmA.position.set(-40.5, 0, z);
    group.add(palmA);
    const palmB = makePalm(rng);
    palmB.position.set(40.5, 0, z);
    group.add(palmB);
  }

  // Streetlights at every second intersection.
  for (let a = 0; a <= WORLD.GRID; a += 2) {
    for (let b = 0; b <= WORLD.GRID; b += 2) {
      const light = makeStreetlight();
      light.position.set((a - 4.5) * PITCH + 8, 0, (b - 4.5) * PITCH + 8);
      light.rotation.y = rng.range(0, Math.PI * 2);
      group.add(light);
    }
  }

  // Beach umbrellas and the pier.
  for (let i = 0; i < 8; i += 1) {
    const umbrella = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), concreteMat);
    pole.position.y = 1.2;
    umbrella.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8), new THREE.MeshLambertMaterial({ color: rng.pick([0xff6b6b, 0xffd23a, 0x4ecdc4, 0xff8c42]) }));
    top.position.y = 2.6;
    umbrella.add(top);
    umbrella.position.set(rng.range(-220, 220), 0, rng.range(276, 310));
    group.add(umbrella);
  }
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  for (let z = 318; z <= 380; z += 4) {
    const plank = new THREE.Mesh(boxGeo, pierMat);
    plank.scale.set(10, 0.4, 3.6);
    plank.position.set(0, 1.2, z);
    group.add(plank);
  }
  landmarks.pier = new THREE.Vector3(0, 0, 380);

  return {
    group,
    colliders,
    landmarks,
    roads: { xLines: ROAD_LINES, zLines: ROAD_LINES },
    ocean,
    sun,
    playerSpawn: new THREE.Vector3(-174, 0, -44),
  };
}

// Push a circle (x, z, radius) out of every building it overlaps. Returns true
// when a collision happened; the position is corrected in place.
export function resolveCircleCollision(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      hit = true;
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        pos.x = cx + (dx / dist) * radius;
        pos.z = cz + (dz / dist) * radius;
      } else {
        pos.x = c.maxX + radius;
      }
    }
  }
  return hit;
}

export function insideCity(x, z) {
  return x > -HALF_CITY - 8 && x < HALF_CITY + 8 && z > -HALF_CITY - 8 && z < WORLD.BEACH_Z + 40;
}
