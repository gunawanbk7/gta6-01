// Solmar Bay — the story mission chain. Five jobs for Rico "Rook" Marlin,
// each with a briefing, a marker in the world, an objective and a cash
// reward. The game loop drives this state machine every frame.
const THREE = window.THREE;

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: '1 — First Wheels',
    reward: 250,
    briefing: [
      ['ROOK', 'Fresh out of the yard, broke, and Solmar Bay owes me.'],
      ['MARCO', 'Rook! My garage needs a driver. Grab any car on the street — keys are for honest men — and bring it to me.'],
    ],
    steps: [
      { type: 'enterCar', text: 'Steal a car (walk up to one and press E)' },
      { type: 'reach', place: 'garage', radius: 10, inCar: true, text: 'Drive the car to Marco\'s Garage' },
    ],
  },
  {
    id: 'beach-drop',
    title: '2 — Beach Drop',
    reward: 400,
    briefing: [
      ['MARCO', 'Good wheels. Now a package needs to reach Pier 7 before the tide comes in. No questions, no stops.'],
      ['ROOK', 'Pier 7. Got it. Sun, sand and a payday.'],
    ],
    steps: [
      { type: 'reach', place: 'pier', radius: 9, text: 'Deliver the package to Pier 7' },
    ],
  },
  {
    id: 'heat',
    title: '3 — Heat on the Strip',
    reward: 500,
    briefing: [
      ['MARCO', 'The Bay PD clocked your plate at the pier. Two stars, Rook. Lose them — duck the cruisers till the heat dies.'],
      ['ROOK', 'They\'ll have to catch me first.'],
    ],
    steps: [
      { type: 'loseWanted', text: 'Lose the wanted level (stay out of sight of the police)' },
    ],
    wantedOnStart: 2,
  },
  {
    id: 'big-score',
    title: '4 — The Big Score',
    reward: 1200,
    briefing: [
      ['ROOK', 'The Solmar Bank vault. One night, one crew: me.'],
      ['MARCO', 'Get in, hold the door, grab the cash and run. The whole Bay will be on you — bring it home to the Safehouse.'],
    ],
    steps: [
      { type: 'reach', place: 'bank', radius: 8, text: 'Get to Solmar Bank' },
      { type: 'channel', place: 'bank', radius: 8, seconds: 3, text: 'Hold E at the bank door to crack the vault' },
      { type: 'reach', place: 'safehouse', radius: 10, text: 'Escape to the Safehouse with the cash' },
    ],
    wantedAfterChannel: 3,
  },
  {
    id: 'payday',
    title: '5 — Payday',
    reward: 800,
    briefing: [
      ['MARCO', 'One last run, Rook. Bring a car to the garage and we split the take. After this, Solmar Bay is yours.'],
      ['ROOK', 'Last run. Then I own this town.'],
    ],
    steps: [
      { type: 'reach', place: 'garage', radius: 10, inCar: true, text: 'Deliver a car to Marco\'s Garage' },
    ],
  },
];

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.index = 0; // current mission
    this.step = 0;
    this.active = false;
    this.done = false; // whole chain finished
    this.channelProgress = 0;
    this.channelDone = false;
    // The beacon: a glowing pillar + ring that marks the objective.
    this.beacon = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    );
    pillar.position.y = 15;
    this.beacon.add(pillar);
    // A floating diamond above the marker so it reads from any angle.
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0x39ff88 }),
    );
    diamond.position.y = 9;
    this.beacon.add(diamond);
    this.diamond = diamond;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.2, 24),
      new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.beacon.add(ring);
    this.ring = ring;
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.markerPos = null;
  }

  get current() { return MISSIONS[this.index] || null; }
  get currentStep() {
    const m = this.current;
    return m ? m.steps[this.step] : null;
  }

  start(ctx) {
    const m = this.current;
    if (!m) return;
    this.active = true;
    this.step = 0;
    this.channelProgress = 0;
    this.channelDone = false;
    ctx.showDialogue(m.title, m.briefing);
    ctx.say(`Mission started: ${m.title}`);
    if (m.wantedOnStart) ctx.setWanted(m.wantedOnStart);
    this.refreshMarker(ctx.landmarks);
  }

  refreshMarker(landmarks) {
    const s = this.currentStep;
    if (!s || !s.place) {
      this.markerPos = null;
      this.beacon.visible = false;
      return;
    }
    const p = landmarks[s.place];
    this.markerPos = { x: p.x, z: p.z };
    this.beacon.position.set(p.x, 0, p.z);
    this.beacon.visible = true;
  }

  objectiveText() {
    if (this.done) return 'All missions complete — Solmar Bay is yours!';
    const m = this.current;
    if (!m) return '';
    const s = this.currentStep;
    if (!s) return m.title;
    let text = s.text;
    if (s.type === 'channel' && this.channelProgress > 0) {
      text += ` — ${Math.floor((this.channelProgress / s.seconds) * 100)}%`;
    }
    return `${m.title}: ${text}`;
  }

  // Advance one step, or finish the mission and pay out.
  advance(ctx) {
    const m = this.current;
    this.step += 1;
    this.channelProgress = 0;
    if (this.step >= m.steps.length) {
      ctx.addCash(m.reward);
      ctx.say(`Mission complete: ${m.title} — +$${m.reward}`);
      ctx.audio?.missionDone();
      this.index += 1;
      this.step = 0;
      if (this.index >= MISSIONS.length) {
        this.done = true;
        this.active = false;
        this.beacon.visible = false;
        this.markerPos = null;
        ctx.onAllMissionsDone?.();
        return;
      }
      this.start(ctx);
    } else {
      this.refreshMarker(ctx.landmarks);
    }
  }

  // ctx: {pos, inCar, wanted, holdingE, dt, landmarks, setWanted, addCash, say, audio, showDialogue, onAllMissionsDone}
  update(dt, ctx) {
    if (!this.active || this.done) return;
    const m = this.current;
    const s = this.currentStep;
    if (!s) return;
    const t = (this.beacon.visible ? (performance.now() / 1000) : 0);
    this.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.15);
    this.diamond.position.y = 9 + Math.sin(t * 2.2) * 0.8;
    this.diamond.rotation.y = t * 1.5;

    if (s.type === 'enterCar') {
      if (ctx.inCar) this.advance(ctx);
    } else if (s.type === 'reach') {
      const p = ctx.landmarks[s.place];
      const d = Math.hypot(ctx.pos.x - p.x, ctx.pos.z - p.z);
      if (d <= s.radius && (!s.inCar || ctx.inCar)) this.advance(ctx);
    } else if (s.type === 'loseWanted') {
      if (ctx.wanted === 0) this.advance(ctx);
    } else if (s.type === 'channel') {
      const p = ctx.landmarks[s.place];
      const d = Math.hypot(ctx.pos.x - p.x, ctx.pos.z - p.z);
      if (d <= s.radius && ctx.holdingE) {
        this.channelProgress += dt;
        if (this.channelProgress >= s.seconds) {
          this.channelProgress = 0;
          ctx.say('Vault cracked! The cash is yours — RUN!');
          if (m.wantedAfterChannel) ctx.setWanted(m.wantedAfterChannel);
          this.advance(ctx);
        }
      } else {
        this.channelProgress = Math.max(0, this.channelProgress - dt * 0.5);
      }
    }
  }
}
