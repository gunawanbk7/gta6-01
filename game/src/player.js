// Rico Delmar on foot: a simple articulated figure, WASD movement relative
// to the camera, sprint, and a walk bob. Driving is handled by vehicles.js.
import { CFG } from './config.js';
import { resolveCollision } from './city.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  group.name = 'player';

  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e6db4 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2b33 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.5), shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), skin);
  head.position.y = 1.95;
  group.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), hair);
  hairM.position.y = 2.02;
  hairM.scale.set(1, 0.7, 1);
  group.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 0.36), pants);
  legL.position.set(-0.22, 0.45, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.22;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), shirt);
  armL.position.set(-0.6, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.6;
  group.add(armR);

  scene.add(group);
  return {
    group,
    legL,
    legR,
    armL,
    armR,
    pos: new THREE.Vector3(0, 0, 20),
    yaw: 0,
    health: CFG.playerHealth,
    inCar: false,
    car: null,
    walkPhase: 0,
    moving: false,
    punchAnim: 0,
  };
}

// Move on foot. camYaw is the camera's heading; movement is relative to it.
export function updatePlayerOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  let fx = 0;
  let fz = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) fz -= 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) fz += 1;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) fx -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) fx += 1;
  const len = Math.hypot(fx, fz);
  p.moving = len > 0;
  if (len > 0) {
    fx /= len;
    fz /= len;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = sprint ? CFG.runSpeed : CFG.walkSpeed;
    // Camera-relative: forward is -z rotated by camYaw.
    const sin = Math.sin(G.camYaw);
    const cos = Math.cos(G.camYaw);
    const mx = (fx * cos - fz * sin) * speed * dt;
    const mz = (fx * sin + fz * cos) * speed * dt;
    p.pos.x += mx;
    p.pos.z += mz;
    p.yaw = Math.atan2(mx, mz);
    p.walkPhase += dt * speed * 1.6;
  }
  resolveCollision(p.pos, CFG.playerRadius, G.city.colliders);
  p.group.position.copy(p.pos);
  p.group.rotation.y = p.yaw;
  const swing = p.moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.7;
  p.armR.rotation.x = swing * 0.7;
  if (p.punchAnim > 0) {
    p.punchAnim -= dt;
    p.armR.rotation.x = -1.6;
  }
  // Slow health regen when calm.
  if (G.wanted === 0 && p.health > 0 && p.health < CFG.playerHealth) {
    p.health = Math.min(CFG.playerHealth, p.health + dt * 2);
  }
}
