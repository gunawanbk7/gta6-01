// audio.js — every sound in Solmar Bay is synthesised with WebAudio: engine hum,
// two-tone police sirens, gunshots, punches, pickups and a lo-fi bassline loop.
// No audio files are loaded, so the game stays fully offline.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngineLoop();
      this.startSirenLoop();
      this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  startEngineLoop() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 40;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 320; filt.Q.value = 2;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineOsc) return;
    const target = driving ? 0.05 + speed01 * 0.11 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(42 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  startSirenLoop() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  setSiren(on, near) {
    if (!this.ctx || !this.sirenOsc) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.028 + near * 0.03 : 0, t, 0.2);
    if (on) {
      const phase = (t % 1.1) < 0.55 ? 715 : 960;
      this.sirenOsc.frequency.setTargetAtTime(phase, t, 0.05);
    }
  }

  blip(freq, dur, type = 'sine', vol = 0.15) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t);
  }

  shoot() { this.noise(0.14, 0.5, 2600); this.blip(180, 0.08, 'square', 0.12); }
  punch() { this.noise(0.09, 0.35, 500); this.blip(90, 0.1, 'sine', 0.2); }
  crash(strength = 1) { this.noise(0.22, 0.3 * strength, 800); this.blip(60, 0.2, 'sine', 0.25); }
  pickup() { this.blip(660, 0.09, 'sine', 0.16); setTimeout(() => this.blip(990, 0.14, 'sine', 0.16), 80); }
  cash() { this.blip(880, 0.08, 'triangle', 0.18); setTimeout(() => this.blip(1174, 0.12, 'triangle', 0.18), 70); setTimeout(() => this.blip(1568, 0.18, 'triangle', 0.16), 140); }
  missionOk() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.2), i * 110)); }
  missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'sawtooth', 0.12), i * 130)); }
  busted() { this.blip(220, 0.4, 'sawtooth', 0.15); setTimeout(() => this.blip(165, 0.5, 'sawtooth', 0.15), 300); }
  phone() { this.blip(1180, 0.12, 'square', 0.08); setTimeout(() => this.blip(1180, 0.12, 'square', 0.08), 220); }

  // A 16-step loop: A-minor bass, soft kick and hats, ~100 BPM.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted || !this.musicOn) return;
      const step = this.musicStep % 16;
      const t = this.ctx.currentTime;
      if (bass[step]) {
        const o = this.ctx.createOscillator(); o.type = 'triangle';
        o.frequency.value = bass[step];
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.26);
      }
      if (step % 4 === 0) this.blip(70, 0.12, 'sine', 0.22);
      if (step % 2 === 1) this.noise(0.03, 0.05, 6000);
      this.musicStep++;
    }, 150);
  }
}
