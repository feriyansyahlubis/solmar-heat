// Keyboard and mouse input. Keys are read as a held set; `pressed` reports an
// edge (down this frame only). Dragging the mouse orbits the camera.
export const ACTION = {
  ENTER_CAR: 1,
  PUNCH: 2,
  PAUSE: 4,
  MISSIONS: 8,
  RADIO: 16,
  JUMP: 32,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let mouseDown = false;

  const KEY_ACTIONS = {
    KeyE: ACTION.ENTER_CAR,
    KeyF: ACTION.PUNCH,
    KeyP: ACTION.PAUSE,
    Escape: ACTION.PAUSE,
    KeyM: ACTION.MISSIONS,
    KeyR: ACTION.RADIO,
    Space: ACTION.JUMP,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
    if (event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onMouseDown(event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    mouseDown = true;
    pressed.add('Mouse');
  }
  function onMouseMove(event) {
    if (!dragging) return;
    mouseDX += event.clientX - lastX;
    mouseDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onMouseUp() {
    dragging = false;
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    // -1/0/1 drive and strafe from WASD or the arrow keys.
    axis() {
      const x = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      const y = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    run() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    handbrake() {
      return held.has('Space');
    },
    // Bit mask of the actions pressed since the last takeActions call.
    takeActions() {
      let mask = 0;
      for (const code of pressed) {
        if (KEY_ACTIONS[code]) mask |= KEY_ACTIONS[code];
      }
      pressed.clear();
      return mask;
    },
    // Mouse drag since the last takeLook call, in pixels.
    takeLook() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    clicked() {
      const was = mouseDown;
      mouseDown = false;
      return was;
    },
    isDown(code) {
      return held.has(code);
    },
  };
}
