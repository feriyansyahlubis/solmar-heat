// Solmar City: procedural coastal city, landmarks, props, colliders.

import * as THREE from 'three';
import { WORLD, PITCH, HALF_CITY, ROAD_LINES } from './config.js';
import { createRandom } from './random.js';
import {
  FACADE_COLORS,
  makeGroundTexture,
  makeFacadeTexture,
  makeSignTexture,
  makeOceanTexture,
  makeSkyTexture,
} from './textures.js';

export { ROAD_LINES };

// Block (i, j) centre: -232 + i * 58, -232 + j * 58.
function blockCenter(i, j) {
  return { x: -232 + i * PITCH, z: -232 + j * PITCH };
}

const LANDMARK_BLOCKS = new Set(['4,4', '1,3', '5,5', '3,8']);

export function resolveCircleCollision(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pushL = pos.x - c.minX + radius;
        const pushR = c.maxX - pos.x + radius;
        const pushT = pos.z - c.minZ + radius;
        const pushB = c.maxZ - pos.z + radius;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) pos.x = c.minX - radius;
        else if (m === pushR) pos.x = c.maxX + radius;
        else if (m === pushT) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
}

export function insideCity(x, z) {
  return x >= -HALF_CITY - 7 && x <= HALF_CITY + 7 && z >= -HALF_CITY - 7 && z <= 400;
}

function makePalm(rng) {
  const palm = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 5.5, 6), trunkMat);
  trunk.position.y = 2.75;
  trunk.rotation.z = rng.range(-0.08, 0.08);
  trunk.castShadow = true;
  palm.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.5), leafMat);
    const a = (i / 7) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.1, 5.6, Math.sin(a) * 1.1);
    frond.rotation.y = -a + Math.PI / 2;
    frond.rotation.z = 0.85; // droop
    frond.castShadow = true;
    palm.add(frond);
  }
  return palm;
}

function makeTree(rng) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 }),
  );
  trunk.position.y = 0.8;
  trunk.castShadow = true;
  tree.add(trunk);
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x3f7d44, roughness: 0.85 }),
  );
  crown.position.y = 3.0;
  crown.castShadow = true;
  tree.add(crown);
  return tree;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  const colliders = [];

  // Sky dome.
  const skyTex = new THREE.CanvasTexture(makeSkyTexture());
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);

  // Ground.
  const groundTex = new THREE.CanvasTexture(makeGroundTexture(rng));
  groundTex.anisotropy = 4;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 720),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(60, 0, 60);
  ground.receiveShadow = true;
  group.add(ground);

  // Ocean (animated by offset in main.js).
  const oceanTex = new THREE.CanvasTexture(makeOceanTexture(rng));
  oceanTex.wrapS = THREE.RepeatWrapping;
  oceanTex.wrapT = THREE.RepeatWrapping;
  oceanTex.repeat.set(10, 3);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(720, 180),
    new THREE.MeshStandardMaterial({ map: oceanTex, roughness: 0.35, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(60, 0.08, 390);
  group.add(ocean);

  // Sun + sky light.
  const el = WORLD.SUN_ELEVATION;
  const az = WORLD.SUN_AZIMUTH;
  const sunDir = new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  );
  const sun = new THREE.DirectionalLight(0xffe3b3, 3.1);
  sun.position.copy(sunDir).multiplyScalar(420);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 1000;
  sun.shadow.bias = -0.0004;
  group.add(sun);
  group.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6b4a, 1.15);
  group.add(hemi);

  // Sun disc hanging in the sky, same direction as the light.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }),
  );
  sunDisc.position.copy(sunDir).multiplyScalar(820);
  sunDisc.lookAt(0, 0, 0);
  group.add(sunDisc);

  // Drifting clouds: soft white blobs high above the city.
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    fog: false,
  });
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rng.next() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = rng.range(6, 13);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.position.set(p * rng.range(7, 11) - puffs * 4, rng.range(-1.5, 1.5), rng.range(-4, 4));
      puff.scale.y = 0.45;
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-380, 380), rng.range(110, 170), rng.range(-320, 320));
    group.add(cloud);
    clouds.push(cloud);
  }

  // Facade material cache keyed by colour.
  const facadeCache = new Map();
  function facadeMat(color) {
    if (!facadeCache.has(color)) {
      const tex = new THREE.CanvasTexture(makeFacadeTexture(rng, color));
      facadeCache.set(color, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    }
    return facadeCache.get(color);
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.95 });
  const acMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.8, metalness: 0.3 });

  function addBuilding(x, z, w, h, d, color) {
    const mat = facadeMat(color);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // Roof slab + AC boxes.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), roofMat);
    roof.position.set(x, h + 0.2, z);
    group.add(roof);
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.6), acMat);
    ac.position.set(x + w / 4, h + 0.85, z - d / 4);
    ac.castShadow = true;
    group.add(ac);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  }

  function addSign(text, x, y, z, w, h, rotY, bg = '#1c2733', fg = '#ffd24d') {
    const tex = new THREE.CanvasTexture(makeSignTexture(text, bg, fg));
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
    return mesh;
  }

  // Procedural blocks (skip landmark blocks).
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (LANDMARK_BLOCKS.has(`${i},${j}`)) continue;
      const c = blockCenter(i, j);
      const dist = Math.hypot(c.x, c.z);
      const downtown = Math.max(0.2, 1 - dist / 370);
      if (rng.chance(0.12)) {
        // Park: 5 trees.
        for (let t = 0; t < 5; t++) {
          const tree = makeTree(rng);
          tree.position.set(c.x + rng.range(-16, 16), 0, c.z + rng.range(-16, 16));
          group.add(tree);
        }
        continue;
      }
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b++) {
        const w = rng.range(10, 18);
        const d = rng.range(10, 18);
        const h = 6 + rng.range(0, 40) * (0.35 + 0.65 * downtown);
        const x = c.x + rng.range(-(22 - w / 2 - 1), 22 - w / 2 - 1);
        const z = c.z + rng.range(-(22 - d / 2 - 1), 22 - d / 2 - 1);
        addBuilding(x, z, w, h, d, rng.pick(FACADE_COLORS));
      }
    }
  }

  // --- Landmarks ---
  // Solmar Tower (0, 0).
  const tower = addBuilding(0, 0, 22, 62, 22, '#d9a05b');
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 12, 6),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.6 }),
  );
  antenna.position.set(0, 68, 0);
  group.add(antenna);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
  );
  beacon.position.set(0, 74.5, 0);
  group.add(beacon);

  // Dante's Garage (-174, -58), front marker (-174, -44).
  const garage = addBuilding(-174, -58, 20, 8, 14, '#b23a2e');
  addSign("DANTE'S GARAGE", -174, 6.5, -50.9, 16, 4, 0, '#7a1f16', '#ffd24d');

  // Solmar Bank (58, 58), sign on south face z=67.1, front (58, 73).
  const bank = addBuilding(58, 58, 24, 14, 18, '#e5d9b8');
  addSign('SOLMAR BANK', 58, 11, 67.1, 20, 5, 0, '#1c2733', '#ffd24d');

  // Hotel Palma (-58, 246), sign on south face.
  const hotel = addBuilding(-58, 246, 26, 26, 16, '#f0c297');
  addSign('HOTEL PALMA', -58, 20, 254.1, 20, 5, 0, '#274b63', '#ffffff');

  // Streetlights at every 2nd intersection.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < ROAD_LINES.length; i += 2) {
    for (let j = 0; j < ROAD_LINES.length; j += 2) {
      const x = ROAD_LINES[i] + 8;
      const z = ROAD_LINES[j] + 8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
      pole.position.set(x, 3, z);
      pole.castShadow = true;
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampMat);
      lamp.position.set(x, 6.1, z);
      group.add(lamp);
    }
  }

  // Avenue palms (sidewalks at x = +/-40.5) and beachfront palms (z = 272).
  for (let z = -240; z <= 240; z += 48) {
    for (const x of [-40.5, 40.5]) {
      const palm = makePalm(rng);
      palm.position.set(x, 0, z + rng.range(-6, 6));
      group.add(palm);
    }
  }
  for (let x = -240; x <= 240; x += 60) {
    const palm = makePalm(rng);
    palm.position.set(x + rng.range(-8, 8), 0, 272);
    group.add(palm);
  }

  // Beach umbrellas.
  const umbColors = [0xff6b6b, 0x4ecdc4, 0xffd93d, 0x6bcBff, 0xff9f43, 0xee5253, 0x1dd1a1, 0x54a0ff];
  for (let u = 0; u < 8; u++) {
    const x = -210 + u * 60 + rng.range(-10, 10);
    const z = 285 + rng.range(0, 14);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xdddddd }),
    );
    pole.position.set(x, 1.3, z);
    group.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: umbColors[u], roughness: 0.7, side: THREE.DoubleSide }),
    );
    top.position.set(x, 3.0, z);
    top.castShadow = true;
    group.add(top);
  }

  // Benches along the central avenue sidewalks.
  const benchWood = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.85 });
  const benchIron = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.5 });
  for (const [bx, bz, rot] of [
    [-40.5, -120, 0],
    [40.5, -40, Math.PI],
    [-40.5, 60, 0],
    [40.5, 160, Math.PI],
    [-40.5, 200, 0],
    [40.5, -200, Math.PI],
  ]) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), benchWood);
    seat.position.y = 0.5;
    seat.castShadow = true;
    bench.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.1), benchWood);
    back.position.set(0, 0.85, -0.28);
    bench.add(back);
    for (const lx of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.55), benchIron);
      leg.position.set(lx, 0.25, 0);
      bench.add(leg);
    }
    bench.position.set(bx, 0, bz);
    bench.rotation.y = rot;
    group.add(bench);
  }

  // Beach balls on the sand.
  const ballColors = [0xff5252, 0xffd24d, 0x4ecdc4, 0xff9f43, 0x54a0ff];
  for (let i = 0; i < 5; i++) {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 10),
      new THREE.MeshStandardMaterial({ color: ballColors[i], roughness: 0.5 }),
    );
    ball.position.set(-180 + i * 85 + rng.range(-12, 12), 0.55, 292 + rng.range(0, 18));
    ball.castShadow = true;
    group.add(ball);
  }

  // Pier planks z 318-380 at x = 0.
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.9 });
  for (let z = 318; z <= 380; z += 4) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 3.6), plankMat);
    plank.position.set(0, 0.4, z);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }
  // Pier posts.
  for (const px of [-4.5, 4.5]) {
    for (const pz of [320, 350, 378]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), plankMat);
      post.position.set(px, 0.4, pz);
      group.add(post);
    }
  }

  scene.add(group);

  return {
    group,
    colliders,
    landmarks: {
      tower: new THREE.Vector3(0, 0, 0),
      garage: new THREE.Vector3(-174, 0, -44),
      bank: new THREE.Vector3(58, 0, 73),
      hotel: new THREE.Vector3(-58, 0, 246),
      pier: new THREE.Vector3(0, 0, 360),
    },
    roads: { xLines: ROAD_LINES, zLines: ROAD_LINES },
    ocean,
    sun,
    clouds,
    playerSpawn: new THREE.Vector3(-174, 0, -44),
  };
}
