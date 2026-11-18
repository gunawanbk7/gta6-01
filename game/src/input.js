// Keyboard + mouse input for Solmar Bay. WASD/arrows move, mouse drag orbits
// the camera, click shoots / punches. Tracks pressed edges for one-shot actions.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {};
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.lastX = 0;
    this.lastY = 0;
    this.escapeHandler = null; // called synchronously on Esc / P, any state
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      // Timestamped so a quick tap still lands even at very low frame rates.
      this.pressed[e.code] = performance.now();
      if (e.code === 'Escape' || e.code === 'KeyP') this.escapeHandler?.();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true; this.mouseDown = true; this.mouseClicked = true;
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { this.dragging = false; this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.clientX - this.lastX;
      this.mouseDY += e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(code) { return !!this.keys[code]; }
  // One-shot: returns true once per physical press, then consumes it.
  hit(code) {
    const t = this.pressed[code];
    if (t === undefined || performance.now() - t >= 1000) return false;
    delete this.pressed[code];
    return true;
  }
  axis(neg, pos) { return (this.keys[pos] ? 1 : 0) - (this.keys[neg] ? 1 : 0); }
  // Forward / strafe in camera space, from WASD or arrows.
  moveVector() {
    const f = this.axis('KeyS', 'KeyW') + this.axis('ArrowDown', 'ArrowUp');
    const s = this.axis('KeyA', 'KeyD') + this.axis('ArrowLeft', 'ArrowRight');
    return { f: Math.max(-1, Math.min(1, f)), s: Math.max(-1, Math.min(1, s)) };
  }
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }
  endFrame() {
    const now = performance.now();
    for (const code of Object.keys(this.pressed)) {
      if (now - this.pressed[code] >= 1000) delete this.pressed[code];
    }
    this.mouseClicked = false;
  }
}
