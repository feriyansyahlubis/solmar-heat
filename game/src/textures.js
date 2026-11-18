// Canvas-generated textures: every surface in Solmar City is painted in code,
// so the game ships no image files at all.
import * as THREE from 'three';
import { WORLD, PITCH, HALF_CITY } from './config.js';

// Warm sun-soaked palette for the building facades.
export const FACADE_COLORS = ['#f2c9a0', '#f7e3c3', '#e8a87c', '#a8c8d8', '#f5d76e', '#d8b4a0', '#b8d8b8', '#e8b4b8', '#c9b8e8', '#f0ead8'];

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// The whole ground in one 2048px canvas: roads, sidewalks, crosswalks, block
// tints, the beach and the waterline. World x/z in [-300, 420] maps onto it.
export function makeGroundTexture(rng) {
  const SIZE = 2048;
  const MIN = -300;
  const MAX = 420;
  const scale = SIZE / (MAX - MIN);
  const px = (v) => (v - MIN) * scale;
  return canvasTexture(SIZE, SIZE, (ctx) => {
    // Base: sun-bleached pavement.
    ctx.fillStyle = '#b8a88f';
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Beach sand (south edge) and the ocean beyond it.
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, px(WORLD.BEACH_Z), SIZE, px(WORLD.OCEAN_Z) - px(WORLD.BEACH_Z));
    ctx.fillStyle = '#2e7fc2';
    ctx.fillRect(0, px(WORLD.OCEAN_Z), SIZE, SIZE - px(WORLD.OCEAN_Z));
    ctx.fillStyle = '#3a8fd0';
    for (let i = 0; i < 40; i += 1) {
      const y = px(WORLD.OCEAN_Z) + rng.range(0, SIZE - px(WORLD.OCEAN_Z));
      ctx.fillRect(0, y, SIZE, 2);
    }
    // Blocks: slightly varied concrete, a few green parks.
    for (let i = 0; i < WORLD.GRID; i += 1) {
      for (let j = 0; j < WORLD.GRID; j += 1) {
        const cx = (i - 4) * PITCH;
        const cz = (j - 4) * PITCH;
        const isPark = rng.chance(0.12);
        ctx.fillStyle = isPark ? '#7fb069' : `hsl(${rng.range(28, 42)}, ${rng.range(18, 30)}%, ${rng.range(62, 72)}%)`;
        ctx.fillRect(px(cx - WORLD.BLOCK / 2), px(cz - WORLD.BLOCK / 2), WORLD.BLOCK * scale, WORLD.BLOCK * scale);
      }
    }
    // Roads: dark asphalt strips along every grid line, both directions.
    ctx.fillStyle = '#3a3a40';
    for (let k = 0; k <= WORLD.GRID; k += 1) {
      const c = (k - 4.5) * PITCH;
      ctx.fillRect(px(c - WORLD.ROAD / 2), px(-HALF_CITY - WORLD.ROAD / 2), WORLD.ROAD * scale, (2 * HALF_CITY + WORLD.ROAD) * scale);
      ctx.fillRect(px(-HALF_CITY - WORLD.ROAD / 2), px(c - WORLD.ROAD / 2), (2 * HALF_CITY + WORLD.ROAD) * scale, WORLD.ROAD * scale);
    }
    // Centre dashes (yellow) and edge lines (white) on every road.
    ctx.fillStyle = '#e8c33a';
    for (let k = 0; k <= WORLD.GRID; k += 1) {
      const c = (k - 4.5) * PITCH;
      for (let d = -HALF_CITY; d < HALF_CITY; d += 12) {
        ctx.fillRect(px(c - 0.4), px(d), 0.8 * scale, 5 * scale);
        ctx.fillRect(px(d), px(c - 0.4), 5 * scale, 0.8 * scale);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k <= WORLD.GRID; k += 1) {
      const c = (k - 4.5) * PITCH;
      ctx.fillRect(px(c - WORLD.ROAD / 2 + 0.6), px(-HALF_CITY - WORLD.ROAD / 2), 0.5 * scale, (2 * HALF_CITY + WORLD.ROAD) * scale);
      ctx.fillRect(px(c + WORLD.ROAD / 2 - 1.1), px(-HALF_CITY - WORLD.ROAD / 2), 0.5 * scale, (2 * HALF_CITY + WORLD.ROAD) * scale);
      ctx.fillRect(px(-HALF_CITY - WORLD.ROAD / 2), px(c - WORLD.ROAD / 2 + 0.6), (2 * HALF_CITY + WORLD.ROAD) * scale, 0.5 * scale);
      ctx.fillRect(px(-HALF_CITY - WORLD.ROAD / 2), px(c + WORLD.ROAD / 2 - 1.1), (2 * HALF_CITY + WORLD.ROAD) * scale, 0.5 * scale);
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let a = 0; a <= WORLD.GRID; a += 1) {
      for (let b = 0; b <= WORLD.GRID; b += 1) {
        const x = (a - 4.5) * PITCH;
        const z = (b - 4.5) * PITCH;
        for (let s = -5; s <= 5; s += 2) {
          ctx.fillRect(px(x + s - 0.7), px(z - WORLD.ROAD / 2 + 1), 1.4 * scale, 2.4 * scale);
          ctx.fillRect(px(x + s - 0.7), px(z + WORLD.ROAD / 2 - 3.4), 1.4 * scale, 2.4 * scale);
          ctx.fillRect(px(x - WORLD.ROAD / 2 + 1), px(z + s - 0.7), 2.4 * scale, 1.4 * scale);
          ctx.fillRect(px(x + WORLD.ROAD / 2 - 3.4), px(z + s - 0.7), 2.4 * scale, 1.4 * scale);
        }
      }
    }
  });
}

// A building facade: window grid, some windows lit warm, a darker ground floor.
export function makeFacadeTexture(rng, baseColor) {
  const cols = 6;
  const rows = 12;
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, h - 26, w, 26);
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = 8 + c * 19;
        const y = 8 + r * 19;
        const lit = rng.chance(0.28);
        ctx.fillStyle = lit ? '#ffd98a' : (rng.chance(0.5) ? '#2c3e55' : '#54708c');
        ctx.fillRect(x, y, 12, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x, y, 12, 2);
      }
    }
  });
}

// A shop sign or billboard with bold text.
export function makeSignTexture(text, bg = '#c22e2e', fg = '#ffe9a8') {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = fg;
    ctx.font = '900 56px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

// Gentle waves for the ocean plane.
export function makeOceanTexture(rng) {
  const tex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2e7fc2';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 26; i += 1) {
      const y = rng.range(0, h);
      ctx.beginPath();
      ctx.moveTo(rng.range(-20, 60), y);
      ctx.bezierCurveTo(80, y - 8, 160, y + 8, w + 20, y);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

// Vertical sky gradient for the sky dome.
export function makeSkyTexture() {
  return canvasTexture(64, 512, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2f6fb8');
    grad.addColorStop(0.45, '#7fb3e0');
    grad.addColorStop(0.72, '#ffd9a0');
    grad.addColorStop(1, '#ffb37a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}
