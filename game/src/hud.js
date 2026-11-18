// The HUD: money, health, wanted stars, speed, the mission objective, the
// minimap and the mission list. Everything the player reads is drawn here.
import { WORLD, PITCH } from './config.js';
import { ROAD_LINES } from './city.js';

export function createHud() {
  const moneyEl = document.getElementById('money');
  const healthEl = document.getElementById('health').firstElementChild;
  const wantedEl = document.getElementById('wanted');
  const speedEl = document.getElementById('speed');
  const objectiveEl = document.getElementById('objective');
  const toastEl = document.getElementById('toast');
  const crosshairEl = document.getElementById('crosshair');
  const hintEl = document.getElementById('hint');
  const mapCanvas = document.getElementById('map');
  const mapCtx = mapCanvas.getContext('2d');
  const stars = [...wantedEl.children];
  let toastTimer = null;
  let lastMapTime = -1;

  const missionPanel = document.createElement('div');
  missionPanel.id = 'mission-panel';
  missionPanel.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9;background:rgba(5,12,20,.72);color:#fff;font-family:inherit;';
  missionPanel.innerHTML = '<div style="background:#101c2c;border:1px solid #ffd23a;border-radius:10px;padding:22px 30px;max-width:520px;"><h2 style="margin:0 0 4px;color:#ffd23a;font-style:italic;">DANTE’S JOBS</h2><p style="margin:0 0 14px;color:#9fb4cc;font-size:14px;">Clear the $10,000 debt. Finish the jobs in order.</p><div id="mission-list"></div><p style="margin:14px 0 0;color:#9fb4cc;font-size:13px;">Press M to close</p></div>';
  document.body.appendChild(missionPanel);

  function showToast(text, ms = 2600) {
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.style.opacity = '0'; }, ms);
  }

  function toggleMissionList(missions, completedCount) {
    const open = missionPanel.style.display === 'flex';
    if (open) {
      missionPanel.style.display = 'none';
      return;
    }
    const list = document.getElementById('mission-list');
    list.innerHTML = missions.map((m, i) => {
      const state = i < completedCount ? '✓ DONE' : i === completedCount ? '▶ CURRENT' : '🔒 LOCKED';
      const color = i < completedCount ? '#7dff8a' : i === completedCount ? '#ffd23a' : '#7a8a9a';
      return `<div data-mission="${i}" style="margin:10px 0;padding:10px 12px;border:1px solid rgba(255,255,255,.2);border-radius:6px;${i === completedCount ? 'cursor:pointer;' : ''}">
        <div style="display:flex;justify-content:space-between;"><b>${i + 1}. ${m.title}</b><span style="color:${color};font-weight:700;">${state}</span></div>
        <div style="color:#cfd9ea;font-size:14px;margin-top:4px;">${m.brief}</div>
        <div style="color:#7dff8a;font-size:13px;margin-top:2px;">Reward: $${m.reward.toLocaleString()}</div>
      </div>`;
    }).join('');
    missionPanel.style.display = 'flex';
  }

  function closeMissionList() {
    missionPanel.style.display = 'none';
  }

  function drawMinimap(state, time) {
    // The map is a 380x380 canvas redraw; 4 Hz is plenty for a minimap and
    // keeps the frame budget for the 3D scene.
    if (time - lastMapTime < 0.25) return;
    lastMapTime = time;
    const S = 380;
    const scale = 0.5;
    const cx = S / 2;
    const cy = S / 2;
    const X = (x) => cx + x * scale;
    const Y = (z) => cy + z * scale;
    mapCtx.fillStyle = '#0d1a24';
    mapCtx.fillRect(0, 0, S, S);
    // Ocean and beach at the bottom of the map.
    mapCtx.fillStyle = '#2e7fc2';
    mapCtx.fillRect(0, Y(320), S, S - Y(320));
    mapCtx.fillStyle = '#e8d29a';
    mapCtx.fillRect(0, Y(268), S, Y(320) - Y(268));
    // Blocks.
    mapCtx.fillStyle = '#2a4258';
    for (let i = 0; i < 9; i += 1) {
      for (let j = 0; j < 9; j += 1) {
        mapCtx.fillRect(X((i - 4) * PITCH - 22), Y((j - 4) * PITCH - 22), 44 * scale, 44 * scale);
      }
    }
    // Roads.
    mapCtx.strokeStyle = '#8a9aaa';
    mapCtx.lineWidth = 8;
    for (const line of ROAD_LINES) {
      mapCtx.beginPath();
      mapCtx.moveTo(X(-268), Y(line));
      mapCtx.lineTo(X(268), Y(line));
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(X(line), Y(-268));
      mapCtx.lineTo(X(line), Y(268));
      mapCtx.stroke();
    }
    // Mission target: a pulsing yellow diamond.
    if (state.target) {
      const pulse = 5 + Math.sin(time * 4) * 2;
      mapCtx.fillStyle = '#ffd23a';
      mapCtx.beginPath();
      mapCtx.moveTo(X(state.target.x), Y(state.target.z) - pulse);
      mapCtx.lineTo(X(state.target.x) + pulse, Y(state.target.z));
      mapCtx.lineTo(X(state.target.x), Y(state.target.z) + pulse);
      mapCtx.lineTo(X(state.target.x) - pulse, Y(state.target.z));
      mapCtx.closePath();
      mapCtx.fill();
    }
    // Traffic: white dots. Police: flashing red/blue.
    mapCtx.fillStyle = '#ffffff';
    for (const car of state.traffic || []) {
      mapCtx.fillRect(X(car.pos.x) - 1.5, Y(car.pos.z) - 1.5, 3, 3);
    }
    const flash = Math.floor(time * 3) % 2 === 0;
    for (const chaser of state.police || []) {
      mapCtx.fillStyle = flash ? '#ff3333' : '#3388ff';
      mapCtx.beginPath();
      mapCtx.arc(X(chaser.car.pos.x), Y(chaser.car.pos.z), 4, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // The player: a yellow arrow pointing the way they face.
    mapCtx.save();
    mapCtx.translate(X(state.player.x), Y(state.player.z));
    mapCtx.rotate(state.heading);
    mapCtx.fillStyle = '#ffd23a';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -10);
    mapCtx.lineTo(7, 7);
    mapCtx.lineTo(-7, 7);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    // North.
    mapCtx.fillStyle = '#ffffff';
    mapCtx.font = 'bold 13px sans-serif';
    mapCtx.fillText('N', cx - 4, 16);
  }

  function update(state, time) {
    moneyEl.textContent = `$${Math.floor(state.money).toLocaleString()}`;
    healthEl.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    stars.forEach((star, i) => {
      star.className = i < state.wanted ? '' : 'off';
    });
    if (state.driving) {
      speedEl.style.display = 'block';
      speedEl.innerHTML = `${Math.round(Math.abs(state.speed) * 3.6)}<small> km/h</small>`;
    } else {
      speedEl.style.display = 'none';
    }
    objectiveEl.style.display = state.objective ? 'block' : 'none';
    objectiveEl.innerHTML = state.objective || '';
    crosshairEl.style.display = (state.driving || document.body.dataset.shot) ? 'none' : 'block';
    hintEl.textContent = state.hint || '';
    drawMinimap(state, time);
  }

  return { update, showToast, toggleMissionList, closeMissionList };
}
