// Audio: all sounds synthesized with WebAudio — no audio files, no network.
(function () {
  let ctx = null, master = null, musicTimer = null, muted = false;
  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, low) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime, len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
    const g = ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const NOTES = [262, 294, 330, 392, 440, 392, 330, 294]; // sunny coastal riff
  window.SB.Audio = {
    unlock() { ensure(); this.startMusic(); },
    startMusic() {
      if (!ensure() || musicTimer) return;
      let i = 0;
      musicTimer = setInterval(() => {
        if (muted || document.hidden) return;
        tone(NOTES[i % NOTES.length], 0.5, 'triangle', 0.05);
        if (i % 4 === 0) tone(NOTES[i % NOTES.length] / 2, 0.9, 'sine', 0.06);
        i++;
      }, 420);
    },
    toggleMute() { muted = !muted; return muted; },
    shoot() { noise(0.16, 0.5, 2600); tone(160, 0.1, 'square', 0.18, 50); },
    punch() { noise(0.1, 0.35, 500); },
    cash() { tone(880, 0.12, 'sine', 0.2); setTimeout(() => tone(1318, 0.18, 'sine', 0.2), 110); },
    horn() { tone(370, 0.25, 'square', 0.12); tone(466, 0.25, 'square', 0.1); },
    siren() { tone(700, 0.35, 'sine', 0.07, 950); },
    crash() { noise(0.3, 0.4, 800); },
    pickup() { tone(523, 0.1, 'sine', 0.18); setTimeout(() => tone(784, 0.14, 'sine', 0.18), 90); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.18), i * 120)); },
    engine(on) { if (on) tone(90, 0.4, 'sawtooth', 0.05, 140); },
  };
})();
