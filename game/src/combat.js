// Combat: Rico's fists and pistol, and the Marlin Crew thugs who fight back
// on the docks. Punching and shooting in public raises the wanted level.
import { CFG } from './config.js';
import { addWanted } from './police.js';

export function createCombat() {
  return {
    punchTimer: 0,
    shootTimer: 0,
    ammo: CFG.magSize,
    reloading: 0,
    violenceTimer: 0,
    enemies: [],
    punched: false,
    shot: false,
  };
}

function makeThugMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xb98a68 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x5a2e2e });
  const pants = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.05, 0.55), jacket);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), skin);
  head.position.y = 1.98;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.38), pants);
  legL.position.set(-0.24, 0.45, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.24;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 0.32), jacket);
  armL.position.set(-0.65, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.65;
  group.add(armR);
  // Health bar above the head.
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x330000 }));
  barBg.position.y = 2.55;
  group.add(barBg);
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  barFg.position.set(0, 2.55, 0.01);
  barFg.name = 'hpbar';
  group.add(barFg);
  return group;
}

export function spawnThugs(G, positions) {
  const list = [];
  for (const [x, z] of positions) {
    const group = makeThugMesh();
    group.position.set(x, 0, z);
    G.scene.add(group);
    list.push({
      group,
      pos: new THREE.Vector3(x, 0, z),
      yaw: 0,
      health: CFG.thugHealth,
      attackTimer: 0,
      dead: false,
    });
  }
  G.combat.enemies = list;
  return list;
}

export function clearEnemies(G) {
  for (const e of G.combat.enemies) G.scene.remove(e.group);
  G.combat.enemies = [];
}

function nearestEnemy(G, maxDist) {
  const p = G.player.pos;
  let best = null;
  let bestD = maxDist;
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

export function doPunch(G) {
  const c = G.combat;
  if (c.punchTimer > 0) return false;
  c.punchTimer = CFG.punchCooldown;
  G.player.punchAnim = 0.3;
  G.audio.punch();
  c.violenceTimer = 4;
  const target = nearestEnemy(G, CFG.punchRange + 1.2);
  if (target) {
    damageEnemy(G, target, CFG.punchDamage);
  } else {
    // Punching a pedestrian in range counts as assault.
    for (const ped of G.peds) {
      if (Math.hypot(ped.pos.x - G.player.pos.x, ped.pos.z - G.player.pos.z) < CFG.punchRange) {
        ped.fleeing = 3;
        addWanted(G, 1);
        G.hud.feed('You assaulted a pedestrian! The police are coming.');
        break;
      }
    }
  }
  c.punched = true;
  return true;
}

export function doShoot(G) {
  const c = G.combat;
  if (c.shootTimer > 0 || c.reloading > 0) return false;
  if (c.ammo <= 0) {
    startReload(G);
    return false;
  }
  c.shootTimer = CFG.gunCooldown;
  c.ammo -= 1;
  G.audio.shot();
  c.violenceTimer = 4;
  // Aim from the camera through the screen centre.
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  const origin = G.camera.position.clone();
  let best = null;
  let bestT = CFG.gunRange;
  for (const e of G.combat.enemies) {
    if (e.dead) continue;
    const to = new THREE.Vector3(e.pos.x, 1.2, e.pos.z).sub(origin);
    const t = to.dot(dir);
    if (t < 1 || t > CFG.gunRange) continue;
    const perp = to.clone().addScaledVector(dir, -t).length();
    if (perp < 1.6 && t < bestT) {
      bestT = t;
      best = e;
    }
  }
  if (best) {
    damageEnemy(G, best, CFG.gunDamage);
  } else {
    addWanted(G, 1);
    G.hud.feed('Shots fired! The police are coming.');
  }
  c.shot = true;
  return true;
}

export function startReload(G) {
  const c = G.combat;
  if (c.reloading > 0 || c.ammo === CFG.magSize) return;
  c.reloading = CFG.reloadTime;
  G.audio.reload();
}

function damageEnemy(G, enemy, dmg) {
  enemy.health -= dmg;
  const bar = enemy.group.getObjectByName('hpbar');
  if (bar) {
    bar.scale.x = Math.max(0.01, enemy.health / CFG.thugHealth);
    bar.position.x = -(1.16 * (1 - enemy.health / CFG.thugHealth)) / 2;
  }
  if (enemy.health <= 0 && !enemy.dead) {
    enemy.dead = true;
    enemy.group.visible = false;
    G.hud.feed('A Marlin thug is down.');
  }
}

export function updateCombat(G, dt) {
  const c = G.combat;
  c.punchTimer = Math.max(0, c.punchTimer - dt);
  c.shootTimer = Math.max(0, c.shootTimer - dt);
  c.violenceTimer = Math.max(0, c.violenceTimer - dt);
  if (c.reloading > 0) {
    c.reloading -= dt;
    if (c.reloading <= 0) {
      c.ammo = CFG.magSize;
      G.hud.feed('Pistol reloaded.');
    }
  }
  // Thugs chase Rico and swing when close.
  for (const e of c.enemies) {
    if (e.dead) continue;
    const dx = G.player.pos.x - e.pos.x;
    const dz = G.player.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    e.yaw = Math.atan2(dx, dz);
    e.group.rotation.y = e.yaw;
    e.attackTimer -= dt;
    if (dist > 1.8) {
      const speed = 4.2;
      e.pos.x += (dx / dist) * speed * dt;
      e.pos.z += (dz / dist) * speed * dt;
    } else if (e.attackTimer <= 0) {
      e.attackTimer = 1.6 + Math.random() * 0.7;
      G.player.health = Math.max(0, G.player.health - CFG.thugDamage);
      G.hud.feed('A thug hit you!');
      if (G.player.health <= 0) G.onWasted();
    }
    e.group.position.copy(e.pos);
    // Health bars always face the camera.
    for (const child of e.group.children) {
      if (child.name === 'hpbar' || child.material?.color?.getHex?.() === 0x330000) {
        child.lookAt(G.camera.position);
      }
    }
  }
}
