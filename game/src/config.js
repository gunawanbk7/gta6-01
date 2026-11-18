// Solmar Bay — shared constants and mission story data. 100% original.
(function () {
  window.SB = window.SB || {};
  SB.CONFIG = {
    citySize: 420, roadEvery: 44, blockSize: 34,
    walkSpeed: 7, runSpeed: 12, carAccel: 26, carMaxSpeed: 42, carReverse: 14,
    playerHealth: 100, pistolDamage: 34, punchDamage: 12,
    saveKey: 'solmar-bay-save-v3',
    startCash: 50,
  };
  SB.MISSIONS = [
    { id: 1, title: 'First Wheels', reward: 250,
      intro: 'Mara: "You need wheels, kid. Take any car on Coral Avenue — nobody here locks theirs. Bring it to the Marina gate and we talk business."',
      stages: [
        { text: 'Steal a car (walk up to one and press E)', type: 'steal' },
        { text: 'Drive to the Marina gate marker', type: 'goto', target: [132, 132] },
      ] },
    { id: 2, title: 'The Pickup', reward: 400,
      intro: 'Mara: "A package is waiting at the old docks, east side. Grab it, then drop it at Cafe Lumen. No detours, no cops."',
      stages: [
        { text: 'Pick up the package at the docks', type: 'goto', target: [-160, 120] },
        { text: 'Deliver the package to Cafe Lumen', type: 'goto', target: [40, -140] },
      ] },
    { id: 3, title: 'Heat Run', reward: 600,
      intro: 'Dario: "The harbour patrol is on us. Shake the heat and get to the hideout on Palm Row — fast, and don\'t stop for anyone."',
      stages: [
        { text: 'Lose the heat — reach the hideout', type: 'goto', target: [-150, -150], wantedAtStart: 2 },
      ] },
    { id: 4, title: 'Bay Heist', reward: 1000,
      intro: 'Mara: "Last job. The corner store on Sunset Row keeps its till full on Fridays. Take it, then vanish to the Marina hideout. This is the big one."',
      stages: [
        { text: 'Rob the corner store on Sunset Row', type: 'goto', target: [110, -60] },
        { text: 'Escape to the Marina hideout', type: 'goto', target: [132, 132], wantedAtStart: 3 },
      ] },
  ];
  SB.NAMES = { player: 'Rico Vega', fixer: 'Mara Solis', driver: 'Dario Fenn', city: 'Solmar Bay' };
})();
