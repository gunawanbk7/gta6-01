// The Solmar Bay police: interceptors that spawn when Rico is wanted,
// chase him, ram his car, and bust him if they corner him on foot.
import { CFG } from './config.js';
import { createCarRecord } from './vehicles.js';
import { resolveCollision } from './city.js';

export function createPolice(scene) {
  return { scene, cars: [], spawnTimer: 0, ramCooldown: 0, bustTimer: 0 };
}

function spawnPointNear(G) {
  const p = G.player.pos;
  const road = CFG.roads[Math.floor(Math.random() * CFG.roads.length)];
  // Pick a road point roughly 35 units from the player, on the grid.
  const candidates = [
    { x: p.x + 35, z: road },
    { x: p.x - 35, z: road },
    { x: road, z: p.z + 35 },
    { x: road, z: p.z - 35 },
  ];
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  pick.x = Math.max(CFG.worldMin + 5, Math.min(CFG.worldMax - 5, pick.x));
  pick.z = Math.max(CFG.worldMin + 5, Math.min(CFG.worldMax - 5, pick.z));
  return pick;
}

export function setWanted(G, stars) {
  G.wanted = Math.max(0, Math.min(CFG.wantedMax, stars));
  G.wantedTimer = 0;
  if (G.wanted === 0) {
    // Stand the police down.
    for (const car of G.police.cars) {
      G.scene.remove(car.group);
    }
    G.police.cars = [];
    G.audio.setSiren(false);
  } else {
    G.audio.setSiren(true);
  }
}

export function addWanted(G, stars) {
  setWanted(G, G.wanted + stars);
  G.wantedTimer = 0;
}

export function updatePolice(G, dt) {
  const police = G.police;
  if (G.wanted <= 0) return;
  police.spawnTimer -= dt;
  police.ramCooldown -= dt;
  const wantCount = Math.min(CFG.policeCountMax, G.wanted + 1);
  if (police.cars.length < wantCount && police.spawnTimer <= 0) {
    const at = spawnPointNear(G);
    const car = createCarRecord(G.scene, 0x1a1a1a, at.x, at.z, 0, { police: true });
    car.speed = 0;
    police.cars.push(car);
    police.spawnTimer = 2.5;
  }
  const target = G.player.pos;
  for (const car of police.cars) {
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += Math.max(-2.6 * dt, Math.min(2.6 * dt, dy));
    const top = CFG.policeTopSpeed * (0.85 + G.wanted * 0.05);
    car.speed = Math.min(top, car.speed + 14 * dt);
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    resolveCollision(car.pos, CFG.carRadius, G.city.colliders);
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.yaw;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
    // Flashing light bar.
    car.sirenPhase += dt * 8;
    const bar = car.group.getObjectByName('lightbar');
    if (bar) {
      bar.material.color.setHex(Math.sin(car.sirenPhase) > 0 ? 0xff2e2e : 0x2e6dff);
    }
    // Ram the player's car.
    if (dist < 4 && police.ramCooldown <= 0) {
      police.ramCooldown = 1.2;
      if (G.player.inCar && G.player.car) {
        G.player.car.speed *= 0.55;
        G.player.health = Math.max(0, G.player.health - 4);
        G.hud.feed('Police rammed your car!');
      } else if (!G.player.inCar) {
        G.player.health = Math.max(0, G.player.health - 6);
        G.hud.feed('An officer is on you — run!');
      }
    }
  }
  // Busted: cornered on foot by a police car for 3 seconds.
  if (!G.player.inCar && G.wanted > 0) {
    const near = police.cars.some((c) => Math.hypot(c.pos.x - target.x, c.pos.z - target.z) < 4);
    if (near) {
      police.bustTimer += dt;
      if (police.bustTimer > 3) {
        police.bustTimer = 0;
        G.onBusted('The Solmar Bay police cornered you.');
      }
    } else {
      police.bustTimer = 0;
    }
  } else {
    police.bustTimer = 0;
  }
  // Wanted decay: quiet for a while with no police close.
  const nearest = police.cars.reduce((m, c) => Math.min(m, Math.hypot(c.pos.x - target.x, c.pos.z - target.z)), 999);
  if (nearest > 45) {
    G.wantedTimer += dt;
    if (G.wantedTimer > CFG.wantedDecayDelay + CFG.wantedDecayEvery) {
      G.wantedTimer = CFG.wantedDecayDelay;
      setWanted(G, G.wanted - 1);
      if (G.wanted > 0) G.hud.feed(`Heat dropping — wanted level ${G.wanted}.`);
    }
  } else {
    G.wantedTimer = 0;
  }
}
