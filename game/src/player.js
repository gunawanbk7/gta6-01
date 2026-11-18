// Solmar Bay — the player on foot: a simple low-poly walker with a walk/run
// cycle, jump-less arcade movement and building collision.
const THREE = window.THREE;
import { PLAYER, WORLD } from './config.js';
import { resolveCircle } from './vehicles.js';

export function makePlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e6ad8 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x222831 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin);
  head.position.y = 1.62;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.34, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0xd83a2e }),
  );
  cap.position.y = 1.86;
  group.add(cap);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), pants);
  legL.position.set(-0.18, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), shirt);
  armL.position.set(-0.48, 1.05, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export class Player {
  constructor(mesh, x, z) {
    this.mesh = mesh;
    this.x = x;
    this.z = z;
    this.angle = Math.PI; // facing the plaza
    this.health = PLAYER.maxHealth;
    this.walkPhase = 0;
    this.moving = false;
  }

  step(dt, move, camYaw, colliders) {
    const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const mx = move.x;
    const mz = move.y;
    this.moving = mx !== 0 || mz !== 0;
    if (this.moving) {
      // Movement is relative to the camera yaw: W walks away from the
      // camera, D strafes to the camera's right.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const dx = (mx * cos - mz * sin) * speed * dt;
      const dz = (-mx * sin - mz * cos) * speed * dt;
      const hit = resolveCircle(this.x + dx, this.z + dz, PLAYER.radius, colliders);
      this.x = hit.x;
      this.z = hit.z;
      this.x = Math.max(-WORLD.half, Math.min(WORLD.half, this.x));
      this.z = Math.max(-WORLD.half, Math.min(WORLD.beachZ + 26, this.z));
      this.angle = Math.atan2(dx, dz);
      this.walkPhase += dt * speed * 1.6;
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
    const s = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = s;
    u.legR.rotation.x = -s;
    u.armL.rotation.x = -s * 0.8;
    u.armR.rotation.x = s * 0.8;
  }
}
