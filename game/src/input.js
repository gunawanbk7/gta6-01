// Input: keyboard + mouse state, shared by every system.
(function () {
  const keys = {};
  const pressed = {}; // edge-triggered, consumed by game loop
  let mouseDown = false, mouseClicked = false;
  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('mousedown', (e) => { if (e.button === 0) { mouseDown = true; mouseClicked = true; } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  window.SB.Input = {
    keys, pressed, isDown: (c) => !!keys[c],
    consume: (c) => { const v = !!pressed[c]; pressed[c] = false; return v; },
    mouseClicked: () => { const v = mouseClicked; mouseClicked = false; return v; },
    mouseDown: () => mouseDown,
    clearPressed: () => { for (const k in pressed) pressed[k] = false; mouseClicked = false; },
  };
})();
