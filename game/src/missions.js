// missions.js — Marla Kade's job chain: four missions, each a list of steps
// with a map marker, dialogue and a cash reward. Completing a step advances
// the chain; finishing a mission pays out and autosaves.
var SB = SB || {};
SB.missions = (function () {
  var MISSIONS = [
    {
      name: '1 — First Wheels', reward: 300,
      intro: ['Marla Kade', 'Rico. You need wheels before you need anything. Steal a parked car and bring it to the marina drop-off. Don\'t get cute — get moving.'],
      steps: [
        { text: 'Steal a parked car (walk up, press E)', kind: 'steal' },
        { text: 'Drive to the marina drop-off', kind: 'goto', x: -60, z: 118 }
      ],
      outro: ['Marla Kade', 'Clean. The car is already halfway to a buyer. $300, Rico. There is more where that came from.']
    },
    {
      name: '2 — The Pickup', reward: 500,
      intro: ['Marla Kade', 'A friend left a package at the pier. Pick it up, then run it to the warehouse on the north side. Cops are jumpy tonight — keep it smooth.'],
      steps: [
        { text: 'Pick up the package at the pier', kind: 'goto', x: -60, z: 150 },
        { text: 'Deliver the package to the north warehouse', kind: 'goto', x: -60, z: -100 }
      ],
      outro: ['Marla Kade', 'Package delivered, no questions asked. $500. You are becoming useful, Rico.']
    },
    {
      name: '3 — Heat on the Strip', reward: 800,
      intro: ['Marla Kade', 'The strip crew is testing you. Hit all three checkpoints on the avenue while the cops are on you — then lose them at the hideout. Show me nerve.'],
      steps: [
        { text: 'Reach checkpoint 1 on the avenue', kind: 'goto', x: 0, z: -40, wanted: 2 },
        { text: 'Reach checkpoint 2 on the avenue', kind: 'goto', x: 40, z: 0 },
        { text: 'Reach checkpoint 3 on the avenue', kind: 'goto', x: 0, z: 40 },
        { text: 'Lose the heat — get to the hideout', kind: 'goto', x: 80, z: 80 }
      ],
      outro: ['Marla Kade', 'Three checkpoints, cops in the mirror, and you still made it home. $800. The Bay is starting to notice you.']
    },
    {
      name: '4 — The Big Score', reward: 1500,
      intro: ['Marla Kade', 'Last one, Rico. The Bay Bank vault run. Grab the cash, and get out before the whole department lands on you. This is the job that makes us.'],
      steps: [
        { text: 'Reach the Bay Bank', kind: 'goto', x: -60, z: 60, wanted: 3 },
        { text: 'Grab the cash — stay in the vault marker', kind: 'hold', x: -60, z: 60, hold: 3 },
        { text: 'Escape to the hideout with the money', kind: 'goto', x: 80, z: 80 }
      ],
      outro: ['Marla Kade', '$1,500, Rico. The Big Score is ours. Solmar Bay has a new king — and his name is Rico Vale.']
    }
  ];

  var state = { index: 0, step: 0, active: false, done: false, holdT: 0, marker: null, beacon: null };

  function init(scene) {
    var geo = new THREE.CylinderGeometry(2.6, 2.6, 0.25, 24);
    var mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55 });
    state.marker = new THREE.Mesh(geo, mat);
    state.marker.visible = false; scene.add(state.marker);
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35 }));
    beam.position.y = 15; state.marker.add(beam);
    state.beacon = state.marker;
  }

  function current() { return MISSIONS[state.index] || null; }
  function currentStep() {
    var m = current();
    return m ? m.steps[state.step] : null;
  }

  function say(who, text) { SB.hud.dialog(who, text); }

  function startMission(i) {
    state.index = i; state.step = 0; state.active = true; state.done = false; state.holdT = 0;
    var m = current();
    if (!m) { state.active = false; state.done = true; return; }
    say(m.intro[0], m.intro[1]);
    SB.hud.feed('Mission started: ' + m.name);
    SB.audio.chime();
    placeMarker();
  }

  function placeMarker() {
    var s = currentStep();
    if (!s || !state.marker) { if (state.marker) state.marker.visible = false; return; }
    if (s.kind === 'steal') { state.marker.visible = false; return; }
    state.marker.visible = true;
    state.marker.position.set(s.x, 0.15, s.z);
    if (s.wanted) SB.player.addWanted(s.wanted - SB.player.P.wanted > 0 ? s.wanted - SB.player.P.wanted : 0, 'The job drew police attention');
  }

  function completeStep() {
    var m = current();
    state.step++;
    SB.audio.cash();
    if (state.step >= m.steps.length) completeMission();
    else { placeMarker(); SB.hud.feed('Objective complete.'); }
  }

  function completeMission() {
    var m = current();
    SB.player.P.cash += m.reward;
    SB.hud.feed('Mission complete: ' + m.name + ' — $' + m.reward + ' earned!');
    say(m.outro[0], m.outro[1]);
    SB.audio.cash();
    state.active = false;
    if (state.marker) state.marker.visible = false;
    SB.main.saveProgress();
    setTimeout(function () {
      if (state.index + 1 < MISSIONS.length) startMission(state.index + 1);
      else { state.done = true; SB.hud.feed('All missions complete! Solmar Bay is yours, Rico.'); }
    }, 4500);
  }

  function update(dt) {
    if (!state.active) return;
    var s = currentStep();
    if (!s) return;
    var p = SB.player.P;
    if (s.kind === 'steal') {
      if (!p.onFoot) { SB.hud.feed('You have wheels. Now drive!'); completeStep(); }
      return;
    }
    var d = Math.hypot(p.x - s.x, p.z - s.z);
    if (s.kind === 'goto') {
      if (d < 6) completeStep();
    } else if (s.kind === 'hold') {
      if (d < 6) {
        state.holdT += dt;
        SB.hud.objective('Grabbing the cash… ' + Math.ceil(s.hold - state.holdT) + 's');
        if (state.holdT >= s.hold) { state.holdT = 0; completeStep(); }
      } else state.holdT = 0;
    }
    // pulse the marker
    if (state.marker && state.marker.visible) {
      state.marker.scale.setScalar(1 + Math.sin(performance.now() / 280) * 0.12);
    }
  }

  function objectiveText() {
    if (state.done) return { title: 'Solmar Bay is yours', text: 'All missions complete. Free roam — cause trouble, lose the cops, get rich.' };
    var m = current();
    if (!m) return { title: 'Free roam', text: 'Explore Solmar Bay.' };
    var s = currentStep();
    var dist = '';
    if (s && (s.kind === 'goto' || s.kind === 'hold')) {
      var p = SB.player.P;
      dist = ' — ' + Math.round(Math.hypot(p.x - s.x, p.z - s.z)) + 'm';
    }
    return { title: m.name + '  ($' + m.reward + ')', text: (s ? s.text : '') + dist };
  }

  return {
    init: init, startMission: startMission, update: update, objectiveText: objectiveText,
    state: state, current: current, currentStep: currentStep, MISSIONS: MISSIONS
  };
})();
