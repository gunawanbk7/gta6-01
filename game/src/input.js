// Keyboard + mouse input for Solmar Bay.
// Tracks held keys, drag-look deltas and click events. Nothing here touches
// the game state; main.js polls it once per frame.
export function createInput(canvas) {
  const keys = new Set();
  let dragYaw = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let clickCount = 0;
  const clicks = [];

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onPointerDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onPointerMove(e) {
    if (!dragging) return;
    dragYaw += (e.clientX - lastX) * 0.005;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onPointerUp() {
    dragging = false;
  }
  function onClick(e) {
    // Only count clicks on the game canvas (not on HUD buttons).
    if (e.target === canvas) {
      clickCount += 1;
      clicks.push({ x: e.clientX, y: e.clientY });
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('click', onClick);

  return {
    isDown(code) {
      return keys.has(code);
    },
    // True once after the key goes down; the caller must clear it.
    pressed(code) {
      if (keys.has(code)) {
        keys.delete(code);
        return true;
      }
      return false;
    },
    // Accumulated horizontal drag since the last poll, in radians.
    takeDragYaw() {
      const d = dragYaw;
      dragYaw = 0;
      return d;
    },
    // Number of canvas clicks since the last poll.
    takeClicks() {
      const n = clickCount;
      clickCount = 0;
      clicks.length = 0;
      return n;
    },
    clear() {
      keys.clear();
      dragYaw = 0;
      clickCount = 0;
      clicks.length = 0;
    },
  };
}
