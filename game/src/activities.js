// Solmar Coins: a side activity — gold coins scattered around the city.
// Walk or drive over one to pocket $25. The count shows in the HUD and on
// the minimap, and collected coins stay collected in the save file.

import * as THREE from 'three';

const COIN_VALUE = 25;

// Twelve spots on roads and sidewalks, near landmarks and across town.
const COIN_SPOTS = [
  [-174, -30],
  [-120, -87],
  [58, 87],
  [0, 14],
  [-70, 258],
  [0, 330],
  [145, 203],
  [-203, 87],
  [87, -145],
  [-145, -203],
  [203, -29],
  [29, 261],
];

export function createActivities(scene, events) {
  const group = new THREE.Group();
  const discMat = new THREE.MeshStandardMaterial({
    color: 0xffd24d,
    emissive: 0xa67c00,
    emissiveIntensity: 0.7,
    metalness: 0.7,
    roughness: 0.25,
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd24d,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });

  const coins = COIN_SPOTS.map(([x, z], i) => {
    const holder = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20), discMat);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    holder.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.05;
    holder.add(ring);
    holder.position.set(x, 1.15, z);
    group.add(holder);
    return { index: i, x, z, holder, taken: false, phase: i * 0.7 };
  });
  scene.add(group);

  let collected = 0;

  // Spin + bob every frame; collect only while the player is really playing.
  function update(dt, focus, time, canCollect) {
    for (const c of coins) {
      if (c.taken) continue;
      c.holder.rotation.y += dt * 2.2;
      c.holder.position.y = 1.15 + Math.sin(time * 2 + c.phase) * 0.15;
      if (!canCollect) continue;
      const d = Math.hypot(focus.x - c.x, focus.z - c.z);
      if (d < 2.6) {
        c.taken = true;
        c.holder.visible = false;
        collected++;
        events.onCoin(c.index, collected, COIN_VALUE);
      }
    }
  }

  function takenIndices() {
    return coins.filter((c) => c.taken).map((c) => c.index);
  }

  function restore(indices) {
    for (const i of indices || []) {
      const c = coins[i];
      if (c && !c.taken) {
        c.taken = true;
        c.holder.visible = false;
        collected++;
      }
    }
  }

  function reset() {
    for (const c of coins) {
      c.taken = false;
      c.holder.visible = true;
    }
    collected = 0;
  }

  return {
    update,
    takenIndices,
    restore,
    reset,
    get positions() {
      return coins;
    },
    get collected() {
      return collected;
    },
    get total() {
      return coins.length;
    },
    get value() {
      return COIN_VALUE;
    },
  };
}
