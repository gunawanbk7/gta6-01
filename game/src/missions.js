// missions.js — the story of Solmar Bay. Jax Marlowe, a getaway driver trying to
// go straight, takes jobs for Iris Delgado, a fixer with a long memory. Six jobs,
// each a chain of small steps (go somewhere, fetch something, survive, escape),
// plus taxi fares and hidden cash as side work. Every step is data, so the same
// engine runs the story, the screenshots and the self-test.
import { dist } from './util.js';

const L = (x, y) => ({ x, y });

export const MISSIONS = [
  {
    id: 'm1', title: 'First Pickup', reward: 150,
    intro: [
      ['IRIS', 'Jax. You still owe me for the Marina job. One pickup and we are square.'],
      ['JAX', 'One pickup. Then I am done driving for you, Iris.'],
      ['IRIS', 'Sure you are. I am at the Safehouse. Get a car, come get me, take me to the Neon Palms Club.'],
    ],
    outro: [['IRIS', 'Smooth. Maybe you are not as rusty as you look. I will call you.']],
    steps: [
      { kind: 'getCar', label: 'Get a car (press E near one)' },
      { kind: 'goto', at: L(1180, 1990), r: 70, label: 'Pick up Iris at the Safehouse' },
      { kind: 'goto', at: L(1180, 920), r: 70, label: 'Drive Iris to the Neon Palms Club', needCar: true },
    ],
  },
  {
    id: 'm2', title: 'The Drop', reward: 300,
    intro: [
      ['IRIS', 'A package is waiting at the Harbour Warehouse. No questions, no opening it.'],
      ['JAX', 'And the other end?'],
      ['IRIS', 'Marina Penthouse. Two minutes, Jax. The buyer does not wait.'],
    ],
    outro: [['IRIS', 'Delivered clean. Here is something for the trouble — a pistol. You will need it.']],
    steps: [
      { kind: 'goto', at: L(2050, 2150), r: 60, label: 'Collect the package at the Harbour Warehouse' },
      { kind: 'deliver', at: L(2220, 400), r: 60, time: 120, label: 'Deliver to the Marina Penthouse' },
    ],
    onComplete: (G) => { G.player.hasPistol = true; },
  },
  {
    id: 'm3', title: 'Hot Wheels', reward: 450,
    intro: [
      ['IRIS', 'A Comet GT is parked outside the Marina Penthouse. Red. Fast. Not theirs for long.'],
      ['JAX', 'Stealing a sports car in broad daylight. Great.'],
      ['IRIS', 'Bring it to the Chop Shop in the Industrial quarter. The cops will notice — drive like it.'],
    ],
    outro: [['IRIS', 'The Comet is ours. The Chop Shop paid well. You drive like you mean it, Jax.']],
    steps: [
      { kind: 'enterCarType', type: 'sports', at: L(2220, 400), r: 60, label: 'Steal the Comet GT at the Marina' },
      { kind: 'goto', at: L(920, 1700), r: 70, label: 'Deliver the Comet to the Chop Shop', needCar: true, wanted: 2 },
    ],
  },
  {
    id: 'm4', title: 'Bank Run', reward: 800,
    intro: [
      ['IRIS', 'The crew hits Solmar Central Bank at noon. You are the wheelman — and the muscle.'],
      ['JAX', 'I said no more bank jobs.'],
      ['IRIS', 'You said that last time too. Get the crew to the bank, hold the street, then run.'],
    ],
    outro: [['IRIS', 'The crew is clear and the money is split. You are officially back in the game, Jax.']],
    steps: [
      { kind: 'getCar', label: 'Get a getaway car' },
      { kind: 'goto', at: L(1440, 1180), r: 70, label: 'Take the crew to Solmar Central Bank', needCar: true },
      { kind: 'survive', time: 45, label: 'Hold the street — survive the police response!', wanted: 3, waves: true },
      { kind: 'goto', at: L(1180, 1990), r: 80, label: 'Lose the heat — escape to the Safehouse' },
    ],
  },
  {
    id: 'm5', title: 'Harbour Ambush', reward: 1000,
    intro: [
      ['IRIS', 'The Vipers set a trap for me at the Docks. Six of them, armed. I need my driver to be my gun.'],
      ['JAX', 'Six armed men. You really know how to pick friends.'],
      ['IRIS', 'End them, Jax. Then get me out of there.'],
    ],
    outro: [['IRIS', 'The Vipers will think twice now. You fight like a cornered animal, Jax. I like it.']],
    steps: [
      { kind: 'goto', at: L(2220, 2220), r: 70, label: 'Reach the Docks' },
      { kind: 'kill', count: 6, kind2: 'armed', label: 'Take out the 6 Vipers at the Docks', spawnArmed: 6 },
      { kind: 'goto', at: L(1180, 1990), r: 80, label: 'Drive Iris back to the Safehouse' },
    ],
  },
  {
    id: 'm6', title: 'The Big Score', reward: 5000,
    intro: [
      ['IRIS', 'Last job, Jax. A Vault Hauler sits in the Police Impound Lot. We take it, we crack the bank vault, we vanish.'],
      ['JAX', 'Stealing from the police to rob a bank. If this goes wrong, I am done.'],
      ['IRIS', 'It will not go wrong. You are the best wheelman in Solmar Bay. Prove it.'],
    ],
    outro: [
      ['IRIS', 'Five thousand. Clean. The vault, the van, the whole city — ours.'],
      ['JAX', 'Then I am done, Iris. For real this time. Solmar Bay is mine now.'],
    ],
    steps: [
      { kind: 'enterCarType', type: 'armored', at: L(1560, 860), r: 70, label: 'Steal the Vault Hauler from the Impound Lot' },
      { kind: 'goto', at: L(1440, 1180), r: 70, label: 'Drive the Hauler to Solmar Central Bank', needCar: true, wanted: 3 },
      { kind: 'wait', time: 20, at: L(1440, 1180), r: 90, label: 'Hold position while the vault is cracked', wanted: 4 },
      { kind: 'goto', at: L(1180, 1990), r: 80, label: 'Escape to the Safehouse — lose the heat!', wanted: 5 },
    ],
  },
];

export class MissionManager {
  constructor(G) {
    this.G = G;
    this.active = null; // { def, stepIdx, stepState }
    this.offered = null; // mission def waiting for the player to accept
    this.dialogue = null; // { speaker, lines, i, onDone }
    this.killCount = 0;
    this.waveT = 0;
  }

  nextMission() {
    const done = this.G.save.missionsDone || [];
    return MISSIONS.find((m) => !done.includes(m.id)) || null;
  }

  offerNext() {
    const next = this.nextMission();
    if (next && !this.active && !this.offered) {
      this.offered = next;
      this.G.audio.phone();
    }
  }

  startMission(def) {
    this.offered = null;
    this.active = { def, stepIdx: 0, state: {} };
    this.killCount = 0;
    this.showDialogue(def.intro, () => this.beginStep());
    this.G.log('Mission started: ' + def.title);
  }

  showDialogue(lines, onDone) {
    this.dialogue = { lines, i: 0, onDone };
  }

  advanceDialogue() {
    if (!this.dialogue) return;
    this.dialogue.i++;
    if (this.dialogue.i >= this.dialogue.lines.length) {
      const cb = this.dialogue.onDone;
      this.dialogue = null;
      if (cb) cb();
    }
  }

  beginStep() {
    const m = this.active;
    if (!m) return;
    const step = m.def.steps[m.stepIdx];
    m.state = { t: 0, done: false };
    if (step.wanted !== undefined) {
      this.G.player.wanted = Math.max(this.G.player.wanted, step.wanted);
      this.G.player.wantedT = 0;
      this.G.police.maintain(this.G.player.wanted, this.G.player.x, this.G.player.y);
    }
    if (step.spawnArmed) {
      for (let i = 0; i < step.spawnArmed; i++) {
        const a = (i / step.spawnArmed) * Math.PI * 2;
        const ped = this.G.peds.spawn(step.at.x + Math.cos(a) * 120, step.at.y + Math.sin(a) * 120, { armed: true });
        ped.shirt = '#8a2f3f'; ped.pants = '#222';
      }
    }
    if (step.kind === 'enterCarType') {
      this.G.spawnMissionCar(step.type, step.at.x, step.at.y);
    }
    this.waveT = 0;
  }

  currentStep() {
    return this.active ? this.active.def.steps[this.active.stepIdx] : null;
  }

  currentObjective() {
    if (this.dialogue) return '…';
    const step = this.currentStep();
    if (step) return step.label;
    if (this.offered) return 'New job from Iris — press ENTER';
    if (!this.nextMission()) return 'All jobs done — King of Solmar Bay!';
    return 'Free roam — Iris will call with work';
  }

  stepTarget() {
    const step = this.currentStep();
    if (!step || !step.at) return null;
    return step.at;
  }

  update(dt) {
    if (this.dialogue) return; // game is paused for dialogue
    const m = this.active;
    if (!m) return;
    const step = m.def.steps[m.stepIdx];
    const p = this.G.player;
    m.state.t += dt;

    // Police waves during survive steps.
    if (step.waves) {
      this.waveT += dt;
      if (this.waveT > 6) {
        this.waveT = 0;
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const cop = this.G.peds.spawn(p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420, { isCop: true });
          cop.shirt = '#24344d'; cop.pants = '#1a2436';
        }
      }
    }

    let done = false;
    switch (step.kind) {
      case 'getCar':
        done = !!p.car;
        break;
      case 'goto':
      case 'pickup':
        if (step.at && dist(p.x, p.y, step.at.x, step.at.y) < step.r) done = true;
        break;
      case 'deliver': {
        if (step.time !== undefined && m.state.t > step.time) { this.failMission('Too slow — the buyer walked away.'); return; }
        if (step.at && dist(p.x, p.y, step.at.x, step.at.y) < step.r) done = true;
        break;
      }
      case 'enterCarType':
        done = !!p.car && p.car.type === step.type;
        break;
      case 'survive':
        if (m.state.t >= step.time) done = true;
        break;
      case 'kill':
        done = this.killCount >= step.count;
        break;
      case 'wait':
        if (step.at && dist(p.x, p.y, step.at.x, step.at.y) < step.r) {
          m.state.holdT = (m.state.holdT || 0) + dt;
          if (m.state.holdT >= step.time) done = true;
        } else {
          m.state.holdT = 0;
        }
        break;
      default:
        break;
    }
    if (done) this.advanceStep();
  }

  advanceStep() {
    const m = this.active;
    m.stepIdx++;
    this.G.audio.pickup();
    if (m.stepIdx >= m.def.steps.length) {
      this.completeMission();
    } else {
      this.beginStep();
    }
  }

  completeMission() {
    const m = this.active;
    const G = this.G;
    G.player.money += m.def.reward;
    if (!G.save.missionsDone.includes(m.def.id)) G.save.missionsDone.push(m.def.id);
    if (m.def.onComplete) m.def.onComplete(G);
    G.saveGame();
    G.audio.missionOk();
    G.log('Mission complete: ' + m.def.title + ' +$' + m.def.reward);
    this.active = null;
    this.killCount = 0;
    // Clear the heat after a job well done.
    G.player.wanted = 0;
    G.police.clear();
    this.showDialogue(m.def.outro, () => this.offerNext());
  }

  failMission(reason) {
    const G = this.G;
    G.audio.missionFail();
    G.log('Mission failed: ' + reason);
    this.active = null;
    this.killCount = 0;
    G.gameOver('failed', reason);
  }

  onEvent(type, data) {
    if (!this.active) return;
    const step = this.currentStep();
    if (!step) return;
    if (type === 'shot-hit' && step.kind === 'kill' && data) {
      if (data.dead && (step.kind2 === 'armed' ? data.armed : data.isCop)) {
        this.killCount++;
      }
    }
    if (type === 'shot-hit' && step.kind === 'kill' && data && data.dead) {
      // Count any kill toward the total if kind2 is not specific.
      if (!step.kind2) this.killCount++;
    }
  }

  abort() {
    this.active = null;
    this.dialogue = null;
    this.offered = null;
  }
}
