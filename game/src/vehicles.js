// Cars: building them, parking them, stealing them and driving them.
// One arcade physics model serves the player's car, traffic uses its own
// path following in traffic.js, and police steering lives in police.js.
import { CFG } from './config.js';
import { resolveCollision } from './city.js';

const CAR_COLORS = [0xc23b2e, 0x2e6db4, 0xe0b45c, 0x3a3a3a, 0xd8d8d8, 0x2e8b57, 0x7a2e6d, 0xd98a2b];

export function makeCarMesh(color, isPoliceCar) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPoliceCar ? 0x1a1a1a : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: isPoliceCar ? 0xf2f2f2 : 0x222831 }),
  );
  cabin.position.set(0, 1.15, -0.2);
  group.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  if (isPoliceCar) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.55, -0.2);
    bar.name = 'lightbar';
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.22, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  head.position.set(0, 0.6, 2.21);
  group.add(head);
  return { group, wheels };
}

export function createCarRecord(scene, color, x, z, yaw, opts = {}) {
  const { group, wheels } = makeCarMesh(color, !!opts.police);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  scene.add(group);
  return {
    group,
    wheels,
    pos: new THREE.Vector3(x, 0, z),
    yaw,
    speed: 0,
    color,
    isPlayer: false,
    isPolice: !!opts.police,
    isTraffic: !!opts.traffic,
    parked: !!opts.parked,
    missionCar: opts.missionCar || null, // 'coupe' | 'sedan' | null
    sirenPhase: 0,
  };
}

// Parked cars the player can steal, placed on road edges (never inside a
// block), plus the two mission cars.
export function createParkedCars(scene) {
  const spots = [
    { x: 4, z: -15, c: 0x2e6db4 },
    { x: -34, z: 4, c: 0xd8d8d8 },
    { x: 34, z: -4, c: 0x3a3a3a },
    { x: -4, z: 34, c: 0x2e8b57 },
    { x: 64, z: -34, c: 0xd98a2b },
    { x: -64, z: 34, c: 0x7a2e6d },
    { x: 24, z: 64, c: 0xe0b45c },
    { x: -24, z: -64, c: 0xc23b2e },
  ];
  const cars = spots.map((s) => createCarRecord(scene, s.c, s.x, s.z, Math.PI / 2, { parked: true }));
  const coupe = createCarRecord(scene, 0xc23b2e, CFG.marinaCoupe.x, CFG.marinaCoupe.z, -Math.PI / 2,
    { parked: true, missionCar: 'coupe' });
  const sedan = createCarRecord(scene, 0xffd23e, CFG.casinoSedan.x, CFG.casinoSedan.z, Math.PI,
    { parked: true, missionCar: 'sedan' });
  cars.push(coupe, sedan);
  return cars;
}

export function nearestStealableCar(G, maxDist) {
  const p = G.player.pos;
  let best = null;
  let bestD = maxDist;
  for (const car of G.parkedCars) {
    if (car.isPlayer) continue;
    const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.inCar = true;
  p.car = car;
  car.isPlayer = true;
  car.parked = false;
  p.group.visible = false;
  G.audio.ensure();
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.isPlayer = false;
  car.speed = 0;
  // Step out to the car's left side.
  p.pos.set(car.pos.x - Math.cos(car.yaw) * 2.2, 0, car.pos.z + Math.sin(car.yaw) * 2.2);
  resolveCollision(p.pos, CFG.playerRadius, G.city.colliders);
  p.inCar = false;
  p.car = null;
  p.group.visible = true;
  p.group.position.copy(p.pos);
}

// Arcade driving for the player's car.
export function updatePlayerCar(G, dt) {
  const car = G.player.car;
  if (!car) return;
  const input = G.input;
  const fwd = input.isDown('KeyW') || input.isDown('ArrowUp') || G.autoDrive;
  const back = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  const brake = input.isDown('Space');

  if (fwd) car.speed += CFG.carAccel * dt;
  if (back) car.speed -= CFG.carAccel * 0.7 * dt;
  if (brake) car.speed -= Math.sign(car.speed) * CFG.carBrake * dt;
  // Scene presets can cruise at a set speed so a chase stays in frame.
  if (G.autoDrive && G.autoDriveSpeed && car.speed > G.autoDriveSpeed) {
    car.speed = G.autoDriveSpeed;
  }
  // Drag + rolling resistance.
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 0.15 && !fwd && !back) car.speed = 0;
  car.speed = Math.max(-CFG.carReverseMax, Math.min(CFG.carMaxSpeed, car.speed));

  const steerDir = car.speed >= 0 ? 1 : -1;
  if (left) car.yaw += CFG.carSteer * dt * steerDir * Math.min(1, Math.abs(car.speed) / 6);
  if (right) car.yaw -= CFG.carSteer * dt * steerDir * Math.min(1, Math.abs(car.speed) / 6);

  car.pos.x += Math.sin(car.yaw) * car.speed * dt;
  car.pos.z += Math.cos(car.yaw) * car.speed * dt;
  resolveCollision(car.pos, CFG.carRadius, G.city.colliders);
  // Bumping a building kills speed.
  if (Math.abs(car.speed) > 3) {
    const before = car.speed;
    // resolveCollision clamps position; detect a hard stop by re-checking
    // proximity to a collider is complex, so only damp on wall contact via
    // position clamp at world bounds.
    if (car.pos.x <= CFG.worldMin + 0.01 || car.pos.x >= CFG.worldMax - 0.01 ||
        car.pos.z <= CFG.worldMin + 0.01 || car.pos.z >= CFG.worldMax - 0.01) {
      car.speed = before * 0.2;
    }
  }
  car.group.position.copy(car.pos);
  car.group.rotation.y = car.yaw;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 2;
  G.player.pos.copy(car.pos);
  G.player.yaw = car.yaw;
}
