// Traffic cars and pedestrians. Traffic follows rectangular loops around
// city blocks on the road grid; pedestrians stroll the sidewalks and flee
// when the player gets violent near them.
import { CFG } from './config.js';
import { createCarRecord } from './vehicles.js';

const TRAFFIC_COLORS = [0x3a3a3a, 0xd8d8d8, 0x2e6db4, 0xe0b45c, 0x8a8a8a, 0x5a7d5a];

// Rectangular loops around blocks, on the road centrelines.
const LOOPS = [
  [[0, 0], [30, 0], [30, 30], [0, 30]],
  [[-30, -30], [0, -30], [0, 0], [-30, 0]],
  [[-60, 30], [-30, 30], [-30, 60], [-60, 60]],
  [[30, -60], [60, -60], [60, -30], [30, -30]],
  [[-30, -60], [-30, -30], [0, -30], [0, -60]],
  [[0, 30], [0, 60], [30, 60], [30, 30]],
  [[-60, -60], [-60, -30], [-30, -30], [-30, -60]],
  [[30, 0], [60, 0], [60, 30], [30, 30]],
];

export function createTraffic(scene) {
  const cars = [];
  for (let i = 0; i < CFG.trafficCount; i++) {
    const loop = LOOPS[i % LOOPS.length];
    const start = loop[i % loop.length];
    const color = TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
    const car = createCarRecord(scene, color, start[0], start[1], 0, { traffic: true });
    car.loop = loop;
    car.wp = (i % loop.length + 1) % loop.length;
    car.speed = CFG.trafficSpeed * (0.85 + (i % 3) * 0.1);
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(G, dt) {
  for (const car of G.traffic) {
    if (car.isPlayer) continue;
    const target = car.loop[car.wp];
    const dx = target[0] - car.pos.x;
    const dz = target[1] - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.2) {
      car.wp = (car.wp + 1) % car.loop.length;
      continue;
    }
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
    car.pos.x += Math.sin(car.yaw) * car.speed * dt;
    car.pos.z += Math.cos(car.yaw) * car.speed * dt;
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.yaw;
    for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
  }
}

function makePedMesh(shirtColor) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a077 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), skin);
  head.position.y = 1.75;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), pants);
  legL.position.set(-0.16, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);
  return { group, legL, legR };
}

export function createPedestrians(scene) {
  const colors = [0xc23b2e, 0x2e6db4, 0xe0b45c, 0x2e8b57, 0xd98a2b, 0x7a2e6d];
  const peds = [];
  for (let i = 0; i < CFG.pedCount; i++) {
    const road = CFG.roads[i % CFG.roads.length];
    const along = -80 + ((i * 37) % 160);
    const horizontal = i % 2 === 0;
    const { group, legL, legR } = makePedMesh(colors[i % colors.length]);
    const x = horizontal ? along : road + 6.5;
    const z = horizontal ? road + 6.5 : along;
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      group,
      legL,
      legR,
      pos: new THREE.Vector3(x, 0, z),
      yaw: horizontal ? (i % 4 < 2 ? Math.PI / 2 : -Math.PI / 2) : (i % 4 < 2 ? 0 : Math.PI),
      speed: 1.4 + (i % 3) * 0.35,
      horizontal,
      road,
      phase: i * 1.3,
      fleeing: 0,
    });
  }
  return peds;
}

export function updatePedestrians(G, dt) {
  const playerPos = G.player.pos;
  for (const ped of G.peds) {
    const dPlayer = Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
    if (dPlayer < 6 && G.combat && G.combat.violenceTimer > 0) ped.fleeing = 2.5;
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      // Run directly away from the player.
      const away = Math.atan2(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
      ped.yaw = away;
      ped.pos.x += Math.sin(away) * 4.5 * dt;
      ped.pos.z += Math.cos(away) * 4.5 * dt;
    } else {
      ped.pos.x += Math.sin(ped.yaw) * ped.speed * dt;
      ped.pos.z += Math.cos(ped.yaw) * ped.speed * dt;
      // Turn around at the map edges.
      if (ped.horizontal) {
        if (ped.pos.x > 88) ped.yaw = -Math.PI / 2;
        if (ped.pos.x < -88) ped.yaw = Math.PI / 2;
      } else {
        if (ped.pos.z > 88) ped.yaw = Math.PI;
        if (ped.pos.z < -88) ped.yaw = 0;
      }
    }
    ped.phase += dt * (ped.fleeing > 0 ? 9 : 5);
    const swing = Math.sin(ped.phase) * 0.5;
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
    ped.group.position.copy(ped.pos);
    ped.group.rotation.y = ped.yaw;
  }
}
