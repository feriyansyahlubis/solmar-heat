// Procedural canvas textures: ground map, building facades, signs, ocean, sky.

import { WORLD, PITCH, HALF_CITY, ROAD_LINES } from './config.js';

export const FACADE_COLORS = [
  '#e8a87c', '#d98e6a', '#f0c297', '#c97b5e', '#e5b567',
  '#d9a05b', '#eab676', '#c68a6b', '#f2d3a0', '#b5765a',
  '#7fb5a3', '#e07856', '#f5f0e6', '#8fb8d8', '#c9a0c9', '#a8c686',
];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// One 2048px canvas for the whole ground. World [-300, 420]^2 maps onto it;
// the plane is 720x720 at (60, 0, 60) with default flipY, so canvas top is
// north (-Z) and the beach sits at south (+Z).
export function makeGroundTexture(rng) {
  const S = 2048;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const W0 = -300;
  const SPAN = 720;
  const px = (v) => ((v - W0) / SPAN) * S;

  // Base: warm sand.
  g.fillStyle = '#cbb28a';
  g.fillRect(0, 0, S, S);

  // City blocks: slightly varied pavement tints.
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const x0 = -HALF_CITY + i * PITCH + WORLD.ROAD / 2;
      const z0 = -HALF_CITY + j * PITCH + WORLD.ROAD / 2;
      const shade = 0.9 + rng.next() * 0.18;
      const base = [196, 178, 150];
      g.fillStyle = `rgb(${Math.floor(base[0] * shade)},${Math.floor(base[1] * shade)},${Math.floor(base[2] * shade)})`;
      g.fillRect(px(x0), px(z0), px(WORLD.BLOCK) - px(0), px(WORLD.BLOCK) - px(0));
      // Park green tint on some blocks.
      if (rng.chance(0.12)) {
        g.fillStyle = 'rgba(96, 140, 82, 0.55)';
        g.fillRect(px(x0), px(z0), px(WORLD.BLOCK) - px(0), px(WORLD.BLOCK) - px(0));
      }
    }
  }

  // Roads: dark asphalt bands along every road line.
  g.fillStyle = '#3d4148';
  for (const line of ROAD_LINES) {
    g.fillRect(px(line - WORLD.ROAD / 2), px(-HALF_CITY - WORLD.ROAD / 2), px(WORLD.ROAD) - px(0), px(2 * HALF_CITY + WORLD.ROAD) - px(0));
    g.fillRect(px(-HALF_CITY - WORLD.ROAD / 2), px(line - WORLD.ROAD / 2), px(2 * HALF_CITY + WORLD.ROAD) - px(0), px(WORLD.ROAD) - px(0));
  }

  // Centre dashes + edge lines.
  g.strokeStyle = '#e8d44d';
  g.lineWidth = 2;
  g.setLineDash([14, 18]);
  for (const line of ROAD_LINES) {
    g.beginPath();
    g.moveTo(px(line), px(-HALF_CITY));
    g.lineTo(px(line), px(HALF_CITY));
    g.stroke();
    g.beginPath();
    g.moveTo(px(-HALF_CITY), px(line));
    g.lineTo(px(HALF_CITY), px(line));
    g.stroke();
  }
  g.setLineDash([]);
  g.strokeStyle = 'rgba(240,240,240,0.7)';
  g.lineWidth = 2;
  for (const line of ROAD_LINES) {
    for (const off of [-WORLD.ROAD / 2 + 1, WORLD.ROAD / 2 - 1]) {
      g.beginPath();
      g.moveTo(px(line + off), px(-HALF_CITY));
      g.lineTo(px(line + off), px(HALF_CITY));
      g.stroke();
      g.beginPath();
      g.moveTo(px(-HALF_CITY), px(line + off));
      g.lineTo(px(HALF_CITY), px(line + off));
      g.stroke();
    }
  }

  // Zebra crossings at a few intersections.
  g.fillStyle = 'rgba(240,240,240,0.85)';
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      if (rng.chance(0.35)) continue;
      for (let s = -3; s <= 3; s++) {
        g.fillRect(px(lx + s * 1.8 - 0.7), px(lz - WORLD.ROAD / 2 + 1), px(1.4) - px(0), px(3) - px(0));
      }
    }
  }

  // Beach strip and waterline (south, z >= BEACH_Z).
  g.fillStyle = '#e8d9a8';
  g.fillRect(px(-300), px(WORLD.BEACH_Z), px(720) - px(0), px(420 - WORLD.BEACH_Z) - px(0));
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(px(-300), px(WORLD.BEACH_Z), px(720) - px(0), px(6) - px(0));

  return c;
}

// 128x256 facade: 6 columns x 12 rows of windows, ~28% lit warm.
export function makeFacadeTexture(rng, baseColor) {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = baseColor;
  g.fillRect(0, 0, 128, 256);
  // Subtle vertical shading.
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 8 + col * 20;
      const y = 8 + row * 20;
      if (rng.chance(0.28)) {
        g.fillStyle = '#ffd98a';
      } else {
        g.fillStyle = '#2c3542';
      }
      g.fillRect(x, y, 12, 14);
    }
  }
  return c;
}

// Simple flat sign with centred bold text.
export function makeSignTexture(text, bg, fg) {
  const c = makeCanvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = fg;
  g.font = 'bold 52px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 66);
  return c;
}

// Tiled ocean: deep blue with lighter wave strokes.
export function makeOceanTexture(rng) {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#1d6f9e';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, 256);
    const y = rng.range(0, 256);
    const len = rng.range(14, 42);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len / 2, y + rng.range(-6, 6), x + len, y + rng.range(-4, 4));
    g.stroke();
  }
  return c;
}

// Vertical sunset gradient for the sky dome.
export function makeSkyTexture() {
  const c = makeCanvas(16, 512);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#2e4a7a');
  grad.addColorStop(0.45, '#e8905a');
  grad.addColorStop(0.7, '#f7c873');
  grad.addColorStop(1, '#ffe9b0');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  return c;
}
