// audio.js — all sound is synthesized with WebAudio. No audio files, no network.
var SB = SB || {};
SB.audio = (function () {
  var ctx = null, master = null, engineOsc = null, engineGain = null, sirenOn = false, sirenNodes = null;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.22; master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }
  function noiseBurst(dur, vol) {
    if (!ensure()) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var g = ctx.createGain(); g.gain.value = vol || 0.5;
    src.connect(g); g.connect(master); src.start();
  }
  return {
    unlock: ensure,
    click: function () { blip(660, 0.07, 'square', 0.18); },
    chime: function () { blip(523, 0.12, 'sine', 0.4); setTimeout(function () { blip(784, 0.2, 'sine', 0.4); }, 110); },
    cash: function () { blip(880, 0.1, 'triangle', 0.45); setTimeout(function () { blip(1174, 0.16, 'triangle', 0.45); }, 90); setTimeout(function () { blip(1568, 0.22, 'triangle', 0.4); }, 190); },
    gunshot: function () { noiseBurst(0.14, 0.7); blip(160, 0.1, 'square', 0.35, 60); },
    punch: function () { noiseBurst(0.08, 0.45); },
    thud: function () { blip(90, 0.15, 'sine', 0.5, 45); },
    alarm: function () { blip(440, 0.25, 'sawtooth', 0.25, 880); },
    engine: function (speed01) {
      if (!ensure()) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
        var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 130;
      engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0.0;
    },
    siren: function (on) {
      if (on === sirenOn) return; sirenOn = on;
      if (!on) { if (sirenNodes) { try { sirenNodes.o.stop(); } catch (e) {} sirenNodes = null; } return; }
      if (!ensure()) return;
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; g.gain.value = 0.05;
      var t = ctx.currentTime;
      o.frequency.setValueAtTime(700, t);
      o.frequency.linearRampToValueAtTime(1050, t + 0.45);
      o.frequency.linearRampToValueAtTime(700, t + 0.9);
      o.connect(g); g.connect(master); o.start();
      sirenNodes = { o: o };
      var loop = setInterval(function () {
        if (!sirenOn || !sirenNodes) { clearInterval(loop); return; }
        var tt = ctx.currentTime;
        o.frequency.setValueAtTime(700, tt);
        o.frequency.linearRampToValueAtTime(1050, tt + 0.45);
        o.frequency.linearRampToValueAtTime(700, tt + 0.9);
      }, 900);
    }
  };
})();
