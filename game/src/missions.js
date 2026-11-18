// The story: five jobs for Vera Kosta's Marlin Crew, from stealing a coupe
// at the marina to the Kosta Score. A small state machine per mission with
// a glowing ground marker, dialogue through the feed, and cash on completion.
import { CFG } from './config.js';
import { setWanted } from './police.js';
import { spawnThugs, clearEnemies } from './combat.js';
import { saveGame } from './save.js';

const MISSIONS = [
  {
    title: '1 — Hot Wheels',
    intro: 'Vera: "First job, Rico. A red coupe is parked by the marina. Bring it to the Anchor."',
    objective: 'Steal the red coupe at the marina',
  },
  {
    title: '2 — Sunset Courier',
    intro: 'Vera: "Packages. Three drops along the beach road. Fast — the buyers hate waiting."',
    objective: 'Deliver to all 3 checkpoints before time runs out',
  },
  {
    title: '3 — Dockside Trouble',
    intro: 'Vera: "Some dock rats skimmed my cut. Go to the harbour and remind them who runs it."',
    objective: 'Go to the harbour and defeat the 3 thugs',
  },
  {
    title: '4 — Heat on the Strip',
    intro: 'Vera: "The cops got tipped off. Lose them and get to the safehouse on the beach road."',
    objective: 'Reach the safehouse while the police chase you',
  },
  {
    title: '5 — The Kosta Score',
    intro: 'Vera: "Last one. A gold sedan outside the casino. Bring it to the Anchor and we are square."',
    objective: 'Steal the gold sedan at the casino and bring it home',
  },
];

export function createMissions(scene) {
  // Ground marker: glowing ring + light beam at the current target.
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.25, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.75 }),
  );
  ring.position.y = 0.15;
  ring.visible = false;
  scene.add(ring);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 34, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  );
  beam.position.y = 17;
  beam.visible = false;
  scene.add(beam);
  return {
    index: 0,
    stage: 'steal',
    completed: [false, false, false, false, false],
    timer: 0,
    checkpoint: 0,
    target: null,
    ring,
    beam,
    won: false,
  };
}

export function setMarker(G, x, z) {
  G.missions.target = { x, z };
  G.missions.ring.position.set(x, 0.15, z);
  G.missions.beam.position.set(x, 17, z);
  G.missions.ring.visible = true;
  G.missions.beam.visible = true;
}

export function hideMarker(G) {
  G.missions.target = null;
  G.missions.ring.visible = false;
  G.missions.beam.visible = false;
}

export function missionTitle(G) {
  return MISSIONS[Math.min(G.missions.index, MISSIONS.length - 1)].title;
}

export function missionObjectiveText(G) {
  const m = G.missions;
  switch (m.index) {
    case 0:
      return m.stage === 'steal'
        ? 'Steal the red coupe at the marina (E near the car)'
        : 'Drive the coupe back to the Anchor hideout';
    case 1:
      return `Courier drop ${m.checkpoint + 1} of 3 — ${Math.max(0, Math.ceil(m.timer))}s left`;
    case 2:
      return m.stage === 'goto'
        ? 'Go to the harbour docks'
        : `Defeat the thugs (${3 - aliveThugs(G)} of 3 down)`;
    case 3:
      return 'Reach the safehouse on the beach road — lose the police';
    case 4:
      return m.stage === 'steal'
        ? 'Steal the gold sedan outside the casino'
        : 'Bring the gold sedan to the Anchor — the police are on you';
    default:
      return 'Solmar Bay is yours.';
  }
}

function aliveThugs(G) {
  return G.combat.enemies.filter((e) => !e.dead).length;
}

function startMission(G, i) {
  const m = G.missions;
  m.index = i;
  m.timer = 0;
  m.checkpoint = 0;
  clearEnemies(G);
  const def = MISSIONS[i];
  G.hud.feed(def.intro);
  G.hud.setObjective(def.title, missionObjectiveText(G));
  if (i === 0) {
    m.stage = 'steal';
    setMarker(G, CFG.marinaCoupe.x, CFG.marinaCoupe.z);
  } else if (i === 1) {
    m.stage = 'go';
    m.timer = CFG.courierTimeLimit;
    setMarker(G, CFG.courierPoints[0].x, CFG.courierPoints[0].z);
  } else if (i === 2) {
    m.stage = 'goto';
    setMarker(G, CFG.harbour.x, CFG.harbour.z);
  } else if (i === 3) {
    m.stage = 'escape';
    setWanted(G, 3);
    setMarker(G, CFG.safehouse.x, CFG.safehouse.z);
    G.hud.feed('Wanted level 3! The police are closing in.');
  } else if (i === 4) {
    m.stage = 'steal';
    setMarker(G, CFG.casinoSedan.x, CFG.casinoSedan.z);
  }
}

function completeMission(G) {
  const m = G.missions;
  const reward = CFG.missionRewards[m.index];
  G.cash += reward;
  m.completed[m.index] = true;
  G.audio.chime();
  G.hud.feed(`Mission complete! Vera paid you $${reward}.`);
  hideMarker(G);
  clearEnemies(G);
  saveGame(G);
  if (m.index >= MISSIONS.length - 1) {
    m.won = true;
    G.showWin();
    return;
  }
  startMission(G, m.index + 1);
}

function near(G, x, z, r) {
  return Math.hypot(G.player.pos.x - x, G.player.pos.z - z) < r;
}

export function resetMissionToStart(G) {
  startMission(G, G.missions.index);
}

export function updateMissions(G, dt) {
  const m = G.missions;
  if (m.won) return;
  // Animate the marker.
  if (m.ring.visible) {
    m.ring.rotation.y += dt;
    const s = 1 + Math.sin(performance.now() * 0.004) * 0.08;
    m.ring.scale.set(s, 1, s);
  }
  switch (m.index) {
    case 0: {
      if (m.stage === 'steal') {
        const coupe = G.parkedCars.find((c) => c.missionCar === 'coupe');
        if (G.player.inCar && G.player.car === coupe) {
          m.stage = 'deliver';
          setMarker(G, CFG.hideout.x, CFG.hideout.z);
          G.hud.feed('You stole the coupe! Get it to the Anchor — and mind the cops.');
        }
      } else if (G.player.inCar && near(G, CFG.hideout.x, CFG.hideout.z, 8)) {
        completeMission(G);
      }
      break;
    }
    case 1: {
      m.timer -= dt;
      if (m.timer <= 0) {
        G.hud.feed('Too slow — the buyers walked. Vera is giving you one more shot.');
        G.audio.fail();
        startMission(G, 1);
        break;
      }
      const cp = CFG.courierPoints[m.checkpoint];
      if (near(G, cp.x, cp.z, 7)) {
        m.checkpoint += 1;
        G.audio.click();
        if (m.checkpoint >= CFG.courierPoints.length) {
          completeMission(G);
        } else {
          const next = CFG.courierPoints[m.checkpoint];
          setMarker(G, next.x, next.z);
          G.hud.feed(`Drop ${m.checkpoint} done. Next one is marked.`);
        }
      }
      break;
    }
    case 2: {
      if (m.stage === 'goto') {
        if (near(G, CFG.harbour.x, CFG.harbour.z, 9)) {
          m.stage = 'fight';
          spawnThugs(G, [
            [CFG.harbour.x - 4, CFG.harbour.z - 4],
            [CFG.harbour.x + 3, CFG.harbour.z + 2],
            [CFG.harbour.x - 1, CFG.harbour.z + 7],
          ]);
          hideMarker(G);
          G.hud.feed('Three Marlin thugs — punch (F) or shoot (click). Watch your health!');
        }
      } else if (aliveThugs(G) === 0 && G.combat.enemies.length > 0) {
        completeMission(G);
      }
      break;
    }
    case 3: {
      if (near(G, CFG.safehouse.x, CFG.safehouse.z, 8)) {
        completeMission(G);
      }
      break;
    }
    case 4: {
      if (m.stage === 'steal') {
        const sedan = G.parkedCars.find((c) => c.missionCar === 'sedan');
        if (G.player.inCar && G.player.car === sedan) {
          m.stage = 'deliver';
          setWanted(G, 4);
          setMarker(G, CFG.hideout.x, CFG.hideout.z);
          G.hud.feed('The gold sedan is yours! Four stars — drive like your life depends on it.');
        }
      } else if (G.player.inCar && near(G, CFG.hideout.x, CFG.hideout.z, 8)) {
        completeMission(G);
      }
      break;
    }
    default:
      break;
  }
  // Keep the objective line fresh.
  if (!m.won) G.hud.setObjective(MISSIONS[m.index].title, missionObjectiveText(G));
}

// Used by scene presets to jump straight into a mission state.
export function jumpToMission(G, index, stage) {
  startMission(G, index);
  if (index === 2 && stage === 'fight') {
    G.missions.stage = 'fight';
    spawnThugs(G, [
      [CFG.harbour.x - 4, CFG.harbour.z - 4],
      [CFG.harbour.x + 3, CFG.harbour.z + 2],
      [CFG.harbour.x - 1, CFG.harbour.z + 7],
    ]);
    hideMarker(G);
  }
}
