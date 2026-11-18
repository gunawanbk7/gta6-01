// input.js — keyboard + mouse state for Solmar Bay. One job: track what the
// player is pressing, and expose edge-triggered "just pressed" helpers.
var SB = SB || {};
SB.keys = {};
SB.pressed = {};          // keys pressed since last frame was consumed
SB.mouse = { dx: 0, dy: 0, down: false, clicked: false, dragging: false };
SB.camYaw = Math.PI;      // camera orbit angle around the player
SB.camPitch = 0.42;

(function () {
  var down = function (e) {
    if (e.repeat) return;
    SB.keys[e.code] = true;
    SB.pressed[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
  };
  var up = function (e) { SB.keys[e.code] = false; };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', function () { SB.keys = {}; });

  var scene = document.getElementById('scene');
  scene.addEventListener('mousedown', function (e) {
    SB.mouse.down = true; SB.mouse.clicked = true; SB.mouse.dragging = true;
    SB.mouse.lastX = e.clientX; SB.mouse.lastY = e.clientY;
  });
  window.addEventListener('mouseup', function () { SB.mouse.down = false; SB.mouse.dragging = false; });
  window.addEventListener('mousemove', function (e) {
    if (!SB.mouse.dragging) return;
    var dx = e.clientX - (SB.mouse.lastX || e.clientX);
    var dy = e.clientY - (SB.mouse.lastY || e.clientY);
    SB.mouse.lastX = e.clientX; SB.mouse.lastY = e.clientY;
    SB.camYaw -= dx * 0.005;
    SB.camPitch = Math.max(0.12, Math.min(1.1, SB.camPitch + dy * 0.003));
  });

  SB.isDown = function (code) { return !!SB.keys[code]; };
  SB.wasPressed = function (code) { return !!SB.pressed[code]; };
  SB.endFrame = function () { SB.pressed = {}; SB.mouse.clicked = false; };
})();
