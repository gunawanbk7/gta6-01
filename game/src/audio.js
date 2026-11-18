// All sound in Solmar Bay is synthesised live with WebAudio: no audio files,
// no network. Engine hum, sirens, gunshots, punches, cash and mission jingles.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicOn = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    // Engine: two detuned saws through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineOsc2 = this.ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 28;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engineOsc.connect(lp); engineOsc2.connect(lp);
    lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start(); engineOsc2.start();
    this.engineOsc2 = engineOsc2;
    // Police siren: alternating two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }
  setEngine(speed01, on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(25 + speed01 * 65, t, 0.08);
  }
  setSiren(on, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, t, 0.2);
    if (on) {
      this.sirenTimer += dt;
      const hi = Math.floor(this.sirenTimer * 2.2) % 2 === 0;
      this.sirenOsc.frequency.setTargetAtTime(hi ? 880 : 620, t, 0.05);
    }
  }
  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  gunshot() { this.noise(0.16, 0.5, 2600); this.blip(140, 0.12, 'square', 0.25); }
  punch() { this.noise(0.1, 0.35, 500); this.blip(90, 0.1, 'sine', 0.3); }
  cash() { this.blip(880, 0.09, 'sine', 0.22); setTimeout(() => this.blip(1320, 0.14, 'sine', 0.22), 90); }
  click() { this.blip(660, 0.05, 'square', 0.12); }
  horn() { this.blip(370, 0.18, 'square', 0.15); setTimeout(() => this.blip(370, 0.18, 'square', 0.15), 200); }
  missionJingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.25), i * 130));
  }
  failBuzz() { this.blip(220, 0.3, 'sawtooth', 0.2); setTimeout(() => this.blip(165, 0.4, 'sawtooth', 0.2), 180); }
  // A lazy sunset-reggae-ish bass line while driving, built from oscillators.
  updateMusic(dt, driving) {
    if (!this.ctx) return;
    this.musicOn = driving;
    if (!driving) return;
    this.musicTimer += dt;
    if (this.musicTimer < 0.32) return;
    this.musicTimer = 0;
    const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
    const note = bass[this.musicStep % bass.length];
    this.musicStep++;
    if (note > 0) this.blip(note, 0.3, 'triangle', 0.12);
    if (this.musicStep % 4 === 1) this.blip(220, 0.12, 'sine', 0.05);
  }
}
