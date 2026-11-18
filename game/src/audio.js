// Synthesised sound for Solmar Bay — WebAudio only, no audio files.
// Everything is built from oscillators and filtered noise, so the game stays
// fully offline and needs no assets.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;
  let muted = false;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(ctx.destination);
        engineOsc.start();
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenOsc.frequency.value = 720;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(ctx.destination);
        sirenOsc.start();
      } catch (e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function noiseBurst(duration, filterFreq, gainValue) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  function tone(freq, duration, type, gainValue, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
    },
    isMuted() {
      return muted;
    },
    // Continuous engine hum; speed01 is 0..1.
    engine(speed01, inCar) {
      if (!ctx || muted || !engineGain) return;
      const target = inCar ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.value += (target - engineGain.gain.value) * 0.15;
      if (engineOsc) engineOsc.frequency.value = 52 + speed01 * 130;
    },
    punch() {
      noiseBurst(0.12, 500, 0.5);
    },
    shot() {
      noiseBurst(0.18, 2400, 0.6);
      tone(180, 0.1, 'square', 0.25);
    },
    reload() {
      tone(700, 0.06, 'square', 0.15);
      tone(950, 0.06, 'square', 0.15, 0.12);
    },
    chime() {
      tone(660, 0.16, 'sine', 0.3);
      tone(880, 0.22, 'sine', 0.3, 0.14);
      tone(1320, 0.3, 'sine', 0.22, 0.28);
    },
    fail() {
      tone(220, 0.25, 'sawtooth', 0.2);
      tone(165, 0.35, 'sawtooth', 0.2, 0.2);
    },
    click() {
      tone(1200, 0.05, 'square', 0.12);
    },
    setSiren(on) {
      sirenOn = on;
    },
    update(dt) {
      if (!ctx || !sirenGain || !sirenOsc) return;
      if (!sirenOn || muted) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 880 : 660;
      }
      sirenGain.gain.value = 0.045;
    },
  };
}
