// HUD: money, health, wanted stars, objective, toast, minimap, mission list.

import { WORLD, HALF_CITY, ROAD_LINES } from './config.js';

export function createHud() {
  const moneyEl = document.getElementById('money');
  const coinsEl = document.getElementById('coins');
  const healthEl = document.getElementById('health');
  const healthFill = healthEl ? healthEl.firstElementChild : null;
  const wantedEl = document.getElementById('wanted');
  const objectiveEl = document.getElementById('objective');
  const toastEl = document.getElementById('toast');
  const crosshairEl = document.getElementById('crosshair');
  const speedEl = document.getElementById('speed');
  const hintEl = document.getElementById('hint');
  const mapCanvas = document.getElementById('map');
  const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;

  let toastTimer = null;
  let missionPanel = null;
  let lastMapTime = 0;

  function showToast(text, ms = 2600) {
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.opacity = '0';
    }, ms);
  }

  function drawMinimap(state, time) {
    if (!mapCtx) return;
    const S = 380;
    const C = 190;
    const scale = 0.5; // px per metre
    const toX = (x) => C + x * scale;
    const toY = (z) => C + z * scale;
    mapCtx.clearRect(0, 0, S, S);
    // Ocean (south) + beach.
    mapCtx.fillStyle = '#1d6f9e';
    mapCtx.fillRect(0, toY(WORLD.BEACH_Z), S, S - toY(WORLD.BEACH_Z));
    mapCtx.fillStyle = '#e8d9a8';
    mapCtx.fillRect(0, toY(WORLD.BEACH_Z - 8), S, toY(WORLD.BEACH_Z) - toY(WORLD.BEACH_Z - 8));
    // City ground.
    mapCtx.fillStyle = '#22303f';
    mapCtx.fillRect(0, 0, S, toY(WORLD.BEACH_Z));
    // Blocks.
    mapCtx.fillStyle = '#2a4258';
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        const bx = -HALF_CITY + i * 58 + 7;
        const bz = -HALF_CITY + j * 58 + 7;
        mapCtx.fillRect(toX(bx), toY(bz), 44 * scale, 44 * scale);
      }
    }
    // Roads.
    mapCtx.strokeStyle = '#8a9aaa';
    mapCtx.lineWidth = 8;
    for (const line of ROAD_LINES) {
      mapCtx.beginPath();
      mapCtx.moveTo(toX(line), toY(-HALF_CITY));
      mapCtx.lineTo(toX(line), toY(HALF_CITY));
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(toX(-HALF_CITY), toY(line));
      mapCtx.lineTo(toX(HALF_CITY), toY(line));
      mapCtx.stroke();
    }
    // Mission target diamond (pulsing yellow).
    if (state.target) {
      const pulse = 5 + Math.sin(time * 4) * 2;
      mapCtx.fillStyle = '#ffd24d';
      const tx = toX(state.target.x);
      const ty = toY(state.target.z);
      mapCtx.beginPath();
      mapCtx.moveTo(tx, ty - pulse);
      mapCtx.lineTo(tx + pulse, ty);
      mapCtx.lineTo(tx, ty + pulse);
      mapCtx.lineTo(tx - pulse, ty);
      mapCtx.closePath();
      mapCtx.fill();
    }
    // Traffic dots (white).
    mapCtx.fillStyle = '#ffffff';
    for (const car of state.traffic || []) {
      mapCtx.beginPath();
      mapCtx.arc(toX(car.pos.x), toY(car.pos.z), 2.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Uncollected Solmar Coins (gold dots).
    if (state.coinsList) {
      mapCtx.fillStyle = '#ffd24d';
      for (const c of state.coinsList) {
        if (c.taken) continue;
        mapCtx.beginPath();
        mapCtx.arc(toX(c.x), toY(c.z), 3, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }
    // Police dots (flashing red/blue).
    const flash = Math.floor(time * 3) % 2 === 0;
    mapCtx.fillStyle = flash ? '#ff3333' : '#3388ff';
    for (const car of state.police || []) {
      mapCtx.beginPath();
      mapCtx.arc(toX(car.pos.x), toY(car.pos.z), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Player arrow (yellow).
    const px = toX(state.player.x);
    const py = toY(state.player.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(Math.atan2(Math.sin(state.heading), Math.cos(state.heading)) + Math.PI);
    mapCtx.fillStyle = '#ffd24d';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -10);
    mapCtx.lineTo(7, 7);
    mapCtx.lineTo(-7, 7);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    // North marker.
    mapCtx.fillStyle = '#ffffff';
    mapCtx.font = 'bold 13px Arial';
    mapCtx.fillText('N', C - 4, 16);
  }

  function update(state, time) {
    if (moneyEl) moneyEl.textContent = `$${Math.floor(state.money).toLocaleString('en-US')}`;
    if (coinsEl && state.coins) {
      coinsEl.textContent = `● Coins ${state.coins.collected}/${state.coins.total}`;
    }
    if (healthFill) {
      healthFill.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
      healthFill.style.background = state.health > 50 ? '#4ecdc4' : state.health > 25 ? '#f5a623' : '#e74c3c';
    }
    if (wantedEl) {
      const stars = Math.max(0, Math.min(5, state.wanted));
      wantedEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      wantedEl.style.color = stars >= 3 ? '#ff5252' : '#ffd24d';
    }
    if (objectiveEl) {
      if (state.objective) {
        objectiveEl.textContent = state.objective;
        objectiveEl.style.display = 'block';
      } else {
        objectiveEl.style.display = 'none';
      }
    }
    if (speedEl) {
      speedEl.textContent = state.driving ? `${Math.round(Math.abs(state.speed) * 3.6)} km/h` : '';
    }
    if (hintEl) hintEl.textContent = state.hint || '';
    if (crosshairEl) {
      const show = !state.driving && document.body.dataset.shot !== '1';
      crosshairEl.style.display = show ? 'block' : 'none';
    }
    // Minimap redraw throttled to 4 Hz.
    if (time - lastMapTime >= 0.25) {
      lastMapTime = time;
      drawMinimap(state, time);
    }
  }

  function toggleMissionList(missions, completedCount) {
    if (missionPanel) {
      closeMissionList();
      return;
    }
    missionPanel = document.createElement('div');
    missionPanel.id = 'mission-panel';
    const list = missions.MISSION_LIST.map((m, i) => {
      const done = i < completedCount;
      const current = i === completedCount;
      const status = done ? '✓ DONE' : current ? '▶ CURRENT' : '🔒 LOCKED';
      return `<div class="mission-row${current ? ' current' : ''}${done ? ' done' : ''}" data-mission="${i}">
        <span class="m-title">${i + 1}. ${m.title} — $${m.reward}</span>
        <span class="m-status">${status}</span>
        <span class="m-brief">${m.brief}</span>
      </div>`;
    }).join('');
    missionPanel.innerHTML = `<h2>Jobs — clear the $10,000 debt</h2>${list}
      <p class="m-hint">Click the current job to restart it. Press M to close.</p>`;
    document.body.appendChild(missionPanel);
  }

  function closeMissionList() {
    if (missionPanel) {
      missionPanel.remove();
      missionPanel = null;
    }
  }

  return { update, showToast, toggleMissionList, closeMissionList };
}
