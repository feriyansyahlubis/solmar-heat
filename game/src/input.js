// Keyboard + mouse input. Drag to look, click to shoot.

export const ACTION = {
  ENTER_CAR: 1,
  PUNCH: 2,
  PAUSE: 4,
  MISSIONS: 8,
  RADIO: 16,
  JUMP: 32,
};

const KEY_ACTION = {
  KeyE: ACTION.ENTER_CAR,
  KeyF: ACTION.PUNCH,
  Escape: ACTION.PAUSE,
  KeyP: ACTION.PAUSE,
  KeyM: ACTION.MISSIONS,
  KeyR: ACTION.RADIO,
  Space: ACTION.JUMP,
};

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let lookDX = 0;
  let lookDY = 0;
  let clickQueued = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    const a = KEY_ACTION[e.code];
    if (a) queued |= a;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.focus();
  });
  window.addEventListener('mouseup', (e) => {
    if (dragging && Math.abs(e.clientX - lastX) < 6 && Math.abs(e.clientY - lastY) < 6) {
      clickQueued = true;
    }
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    lookDX += e.clientX - lastX;
    lookDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  function isDown(code) {
    return keys.has(code);
  }

  return {
    // Movement axis: x = strafe right, z = forward. -1..1.
    axis() {
      let x = 0;
      let z = 0;
      if (isDown('KeyW') || isDown('ArrowUp')) z += 1;
      if (isDown('KeyS') || isDown('ArrowDown')) z -= 1;
      if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
      if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
      return { x, z };
    },
    run() {
      return isDown('ShiftLeft') || isDown('ShiftRight');
    },
    handbrake() {
      return isDown('Space');
    },
    takeActions() {
      const a = queued;
      queued = 0;
      return a;
    },
    takeLook() {
      const d = { dx: lookDX, dy: lookDY };
      lookDX = 0;
      lookDY = 0;
      return d;
    },
    clicked() {
      const c = clickQueued;
      clickQueued = false;
      return c;
    },
    isDown,
  };
}
