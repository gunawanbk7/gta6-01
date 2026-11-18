// hud.js — DOM heads-up display: cash, health, wanted stars, speed, mission
// objective, message feed, dialogue box, hints, and the live minimap canvas.
var SB = SB || {};
SB.hud = (function () {
  var feedEl, dialogEl, dialogWho, dialogText, hintEl, hintTimer = null;
  var dialogTimer = null;

  function el(id) { return document.getElementById(id); }

  function init() {
    feedEl = el('feed'); dialogEl = el('dialog'); dialogWho = el('dialogWho');
    dialogText = el('dialogText'); hintEl = el('hint');
  }

  function feed(msg) {
    if (!feedEl) return;
    var d = document.createElement('div');
    d.textContent = msg;
    feedEl.appendChild(d);
    while (feedEl.children.length > 5) feedEl.removeChild(feedEl.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 9000);
  }

  function dialog(who, text) {
    if (!dialogEl) return;
    dialogWho.textContent = who + ':';
    dialogText.textContent = text;
    dialogEl.style.display = 'block';
    if (dialogTimer) clearTimeout(dialogTimer);
    dialogTimer = setTimeout(function () { dialogEl.style.display = 'none'; }, 7000);
  }

  function hint(text) {
    if (!hintEl) return;
    hintEl.textContent = text;
    hintEl.style.display = 'block';
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(function () { hintEl.style.display = 'none'; }, 3500);
  }

  function objective(title, text) {
    var t = el('objTitle'), x = el('objText');
    if (t) t.textContent = title;
    if (x) x.textContent = text;
  }

  function update() {
    var p = SB.player.P;
    el('cash').textContent = '$' + Math.round(p.cash).toLocaleString('en-US');
    el('healthFill').style.width = Math.max(0, p.health) + '%';
    el('healthFill').style.background = p.health > 50 ? '#37d67a' : (p.health > 25 ? '#e8a83a' : '#d23c2e');
    el('carState').textContent = p.onFoot ? 'On foot — press E near a car to steal it' : 'Driving — E to get out, Space to handbrake';
    var stars = '';
    for (var i = 0; i < 5; i++) stars += i < p.wanted ? '★' : '☆';
    el('stars').textContent = stars;
    el('stars').style.visibility = p.wanted > 0 ? 'visible' : 'hidden';
    var kmh = Math.round(Math.abs(p.speed || 0) * 3.6);
    el('speedo').innerHTML = kmh + ' <small>km/h</small>';
    el('crosshair').style.display = p.onFoot ? 'block' : 'none';
    var o = SB.missions.objectiveText();
    objective(o.title, o.text);
    drawMinimap();
  }

  function drawMinimap() {
    var c = el('minimap');
    if (!c) return;
    var g = c.getContext('2d');
    var W = c.width, H = c.height, S = W / 340; // world -170..170 -> canvas
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#0a2436'; g.fillRect(0, 0, W, H);
    // ocean + sand at the south edge
    g.fillStyle = '#1e7fa8'; g.fillRect(0, H - 26, W, 26);
    g.fillStyle = '#e8d29a'; g.fillRect(0, H - 34, W, 8);
    // roads
    g.strokeStyle = '#5a6a7a'; g.lineWidth = 4;
    SB.city.roads.forEach(function (r) {
      var v = (r + 170) * S;
      g.beginPath(); g.moveTo(v, 0); g.lineTo(v, H); g.stroke();
      g.beginPath(); g.moveTo(0, v); g.lineTo(W, v); g.stroke();
    });
    function dot(x, z, color, r) {
      g.fillStyle = color;
      g.beginPath(); g.arc((x + 170) * S, (z + 170) * S, r, 0, Math.PI * 2); g.fill();
    }
    var s = SB.missions.currentStep && SB.missions.state.active ? SB.missions.currentStep() : null;
    if (s && (s.kind === 'goto' || s.kind === 'hold')) dot(s.x, s.z, '#ffd23f', 6);
    SB.traffic.cars.forEach(function (car) { dot(car.x, car.z, '#9fb8cc', 2); });
    SB.police.units.forEach(function (u) { dot(u.x, u.z, '#ff4444', 3); });
    var p = SB.player.P;
    dot(p.x, p.z, '#ffffff', 4);
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.arc((p.x + 170) * S, (p.z + 170) * S, 2, 0, Math.PI * 2); g.fill();
  }

  return { init: init, feed: feed, dialog: dialog, hint: hint, objective: objective, update: update };
})();
