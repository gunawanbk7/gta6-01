// The story of Solmar Bay: four missions for Rico Vane, the fixer of the
// marina. Each mission has a marker, dialogue, objectives and a cash reward,
// and finishing one unlocks the next. Progress is saved with the game.
import { dist2D } from './util.js';

export const MISSIONS = [
  {
    id: 1, title: 'First Wheels', reward: 300,
    intro: 'RICO: "Mara, you are back in Solmar. No car, no cash, no crew. Fix the first one — borrow a ride and bring it to my garage."',
    steps: [
      { text: 'Get in a car (walk up to one and press E)', check: (g) => !!g.player.inVehicle },
      { text: 'Drive to Rico\'s Garage on Bay Street', target: { x: -40, z: -40, r: 9, label: 'RICO\'S GARAGE' } },
    ],
  },
  {
    id: 2, title: 'Sunset Courier', reward: 500, timer: 100,
    intro: 'RICO: "A package is waiting at the docks. The hotel buyer pays at sunset — do not keep him waiting."',
    steps: [
      { text: 'Pick up the package at the docks', target: { x: 150, z: 80, r: 8, label: 'DOCKS PACKAGE' } },
      { text: 'Deliver the package to the Marina Hotel', target: { x: 140, z: 40, r: 9, label: 'MARINA HOTEL' } },
    ],
  },
  {
    id: 3, title: 'Bayfront Heat', reward: 800,
    intro: 'RICO: "The SBPD is sniffing around the courier run. Make some noise, shake them, and get to the hideout clean."',
    steps: [
      { text: 'Raise your wanted level to 3 stars (steal a car or start a fight)', check: (g) => g.police.wanted >= 3 },
      { text: 'Lose the cops: drop back to 0 stars, then reach the hideout', check: (g) => g.police.wanted === 0, target: { x: -120, z: 120, r: 9, label: 'HIDEOUT' } },
    ],
  },
  {
    id: 4, title: 'The Marina Job', reward: 1500,
    intro: 'RICO: "Last one, Mara. A briefcase at the marina, three guards, one payday. Take it and bring it home."',
    steps: [
      { text: 'Reach the marina and deal with the guards', target: { x: 150, z: -80, r: 10, label: 'MARINA' }, spawnGuards: true },
      { text: 'Grab the briefcase', target: { x: 158, z: -80, r: 5, label: 'BRIEFCASE' }, needGuardsDown: true },
      { text: 'Bring the briefcase back to Rico\'s Garage', target: { x: -40, z: -40, r: 9, label: 'RICO\'S GARAGE' } },
    ],
  },
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.completed = 0; // number of missions finished
    this.active = null; // { def, step, timer, guards }
    this.marker = null; // THREE mesh for the beacon
    this.markerRing = null;
    this.beaconLight = null;
    this.guards = [];
  }
  currentDef() { return MISSIONS[this.completed] || null; }
  isDone() { return this.completed >= MISSIONS.length; }
  start() {
    const def = this.currentDef();
    if (!def || this.active) return;
    this.active = { def, step: 0, timer: def.timer || 0, guards: [] };
    this.game.hud.feed(`MISSION ${def.id}: ${def.title} — $${def.reward}`, '#ffd94e');
    this.game.hud.dialogue(def.intro);
    this.game.audio.missionJingle();
    this.showMarker();
  }
  showMarker() {
    this.hideMarker();
    if (!this.active) return;
    const step = this.active.def.steps[this.active.step];
    if (!step || !step.target) return;
    const t = step.target;
    const geo = new THREE.CylinderGeometry(3.2, 3.2, 26, 18, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd94e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    this.marker = new THREE.Mesh(geo, mat);
    this.marker.position.set(t.x, 13, t.z);
    this.game.scene.add(this.marker);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.5, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd94e, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(t.x, 0.15, t.z);
    this.game.scene.add(ring);
    this.markerRing = ring;
    this.beaconLight = new THREE.PointLight(0xffd94e, 30, 40);
    this.beaconLight.position.set(t.x, 8, t.z);
    this.game.scene.add(this.beaconLight);
    if (step.spawnGuards && this.guards.length === 0) this.spawnGuards(t);
  }
  hideMarker() {
    if (this.marker) { this.game.scene.remove(this.marker); this.marker = null; }
    if (this.markerRing) { this.game.scene.remove(this.markerRing); this.markerRing = null; }
    if (this.beaconLight) { this.game.scene.remove(this.beaconLight); this.beaconLight = null; }
  }
  spawnGuards(target) {
    const g = this.game;
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
      body.position.y = 1.1; mesh.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45),
        new THREE.MeshLambertMaterial({ color: 0x8a5a3a }));
      head.position.y = 1.8; mesh.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      gun.position.set(0.3, 1.2, 0.4); mesh.add(gun);
      const x = target.x + (i - 1) * 6, z = target.z + 6;
      mesh.position.set(x, 0, z);
      g.scene.add(mesh);
      const guard = { mesh, x, z, hp: 60, alive: true, shootTimer: 1 + i * 0.7 };
      this.guards.push(guard);
      // Guards are pedestrians too, so fists and the pistol can hit them.
      g.traffic.peds.push({
        mesh, x, z, heading: 0, speed: 0, phase: 0,
        flee: 0, alive: true, hostile: true, guard: true, hp: 60,
      });
    }
    g.hud.feed('Three marina guards are protecting the briefcase!', '#ff6a5a');
  }
  onPedKilled(ped) {
    for (const guard of this.guards) {
      if (guard.mesh === ped.mesh) { guard.alive = false; }
    }
  }
  // Guards are peds too: punch / shoot them through the normal combat path.
  guardAsPed(guard) {
    return { mesh: guard.mesh, x: guard.x, z: guard.z, hp: guard.hp, alive: guard.alive, flee: 0, hostile: true };
  }
  update(dt) {
    if (this.marker) {
      this.marker.rotation.y += dt * 1.5;
      this.marker.material.opacity = 0.28 + Math.sin(this.game.time * 3) * 0.12;
      if (this.markerRing) this.markerRing.scale.setScalar(1 + Math.sin(this.game.time * 3) * 0.08);
    }
    if (!this.active) return;
    const g = this.game;
    const a = this.active;
    const def = a.def;
    const step = def.steps[a.step];
    if (def.timer) {
      a.timer -= dt;
      if (a.timer <= 0) {
        this.fail('Too slow — the buyer walked away.');
        return;
      }
    }
    // Guards shoot back while alive.
    for (const guard of this.guards) {
      if (!guard.alive) continue;
      guard.shootTimer -= dt;
      const d = dist2D(guard.x, guard.z, g.player.x, g.player.z);
      if (d < 45) {
        guard.mesh.lookAt(g.player.x, 1.2, g.player.z);
        if (guard.shootTimer <= 0) {
          guard.shootTimer = 1.4;
          g.combat.guardShoot(g, guard);
        }
      }
    }
    if (!step) { this.complete(); return; }
    const px = g.player.inVehicle ? g.player.inVehicle.x : g.player.x;
    const pz = g.player.inVehicle ? g.player.inVehicle.z : g.player.z;
    // A step is done when its check (if any) AND its target (if any) are met.
    const checkOk = !step.check || step.check(g);
    let targetOk = !step.target || dist2D(px, pz, step.target.x, step.target.z) < step.target.r;
    if (step.needGuardsDown && this.guards.some((gd) => gd.alive)) targetOk = false;
    if (checkOk && targetOk) {
      if (step.spawnGuards) g.police.addWanted(2, 'marina job');
      this.advance();
    }
  }
  advance() {
    const a = this.active;
    a.step++;
    this.game.audio.cash();
    if (a.step >= a.def.steps.length) { this.complete(); return; }
    const step = a.def.steps[a.step];
    if (step.timer) a.timer = step.timer;
    this.game.hud.feed(`Objective: ${step.text}`, '#7fd8ff');
    this.showMarker();
  }
  complete() {
    const def = this.active.def;
    this.hideMarker();
    this.completed++;
    this.active = null;
    for (const guard of this.guards) this.game.scene.remove(guard.mesh);
    this.guards = [];
    const g = this.game;
    g.cash += def.reward;
    g.player.heal(25);
    g.hud.feed(`MISSION COMPLETE: ${def.title} — +$${def.reward}`, '#7dff8a');
    g.hud.dialogue(`RICO: "Clean work, Mara. $${def.reward} is yours${this.isDone() ? ' — Solmar Bay is ours now.' : '. Next job when you are ready.'}"`);
    g.audio.missionJingle();
    g.audio.cash();
    g.saveGame();
    if (this.isDone()) {
      g.hud.feed('STORY COMPLETE — you own Solmar Bay. Free roam continues!', '#ffd94e');
    } else {
      setTimeout(() => this.start(), 2500);
    }
  }
  fail(reason) {
    this.hideMarker();
    this.active = null;
    for (const guard of this.guards) this.game.scene.remove(guard.mesh);
    this.guards = [];
    this.game.hud.feed(`MISSION FAILED: ${reason} Talk to Rico to try again.`, '#ff6a5a');
    this.game.audio.failBuzz();
    const g = this.game;
    setTimeout(() => this.start(), 3000);
  }
  objectiveText() {
    if (this.isDone()) return 'Story complete — free roam. Explore Solmar Bay!';
    if (!this.active) return 'Press M to start the next mission.';
    const step = this.active.def.steps[this.active.step];
    if (!step) return '';
    let t = `${this.active.def.title}: ${step.text}`;
    if (this.active.def.timer) t += `  (${Math.ceil(this.active.timer)}s)`;
    return t;
  }
  markerTarget() {
    if (!this.active) return null;
    const step = this.active.def.steps[this.active.step];
    return step && step.target ? step.target : null;
  }
}
