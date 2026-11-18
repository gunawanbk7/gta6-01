// The player on foot: a low-poly Solmar local in a bright shirt, with walk /
// run, a punch, a pistol, and a third-person camera that orbits with the mouse.
import { clamp, damp, resolveCircleAABB, angleLerp } from './util.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff7a3c });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a4a6a });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.35), pants);
  legs.position.y = 0.4; g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.4), shirt);
  torso.position.y = 1.15; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
  head.position.y = 1.78; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xffd94e }));
  cap.position.y = 2.02; g.add(cap);
  const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
  const armL = new THREE.Mesh(armGeo, skin); armL.position.set(-0.48, 1.15, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, skin); armR.position.set(0.48, 1.15, 0); g.add(armR);
  g.userData.armL = armL; g.userData.armR = armR;
  g.userData.legs = legs;
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = buildPlayerMesh();
    this.mesh.position.set(0, 0, 24);
    scene.add(this.mesh);
    this.heading = Math.PI; // facing the plaza
    this.speed = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.ammo = 12;
    this.ammoMax = 12;
    this.weapon = 'fist'; // 'fist' | 'pistol'
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.punchAnim = 0;
    this.walkPhase = 0;
    this.radius = 0.6;
    this.inVehicle = null;
    this.alive = true;
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  setPosition(x, z) { this.mesh.position.x = x; this.mesh.position.z = z; }
  update(dt, move, camYaw, colliders, bounds) {
    if (!this.alive || this.inVehicle) return;
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchAnim = Math.max(0, this.punchAnim - dt * 3);
    const run = move.run ? 1 : 0;
    const targetSpeed = (move.f !== 0 || move.s !== 0) ? (run ? 9 : 5) : 0;
    this.speed = damp(this.speed, targetSpeed, 10, dt);
    if (this.speed > 0.2) {
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      // Camera-relative movement: forward is away from the camera.
      const fx = -sin, fz = -cos;
      const rx = -cos, rz = sin;
      let mx = fx * move.f + rx * move.s;
      let mz = fz * move.f + rz * move.s;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len; mz /= len;
      let nx = this.x + mx * this.speed * dt;
      let nz = this.z + mz * this.speed * dt;
      for (const box of colliders) {
        const fixed = resolveCircleAABB(nx, nz, this.radius, box);
        if (fixed) { nx = fixed.x; nz = fixed.z; }
      }
      nx = clamp(nx, -bounds, bounds); nz = clamp(nz, -bounds, bounds);
      this.mesh.position.x = nx; this.mesh.position.z = nz;
      const targetHeading = Math.atan2(mx, mz);
      this.heading = angleLerp(this.heading, targetHeading, Math.min(1, dt * 12));
      this.walkPhase += dt * this.speed * 1.6;
    }
    this.mesh.rotation.y = this.heading;
    // Walk swing + punch pose.
    const swing = Math.sin(this.walkPhase) * 0.5 * clamp(this.speed / 5, 0, 1);
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = this.punchAnim > 0 ? -1.6 * this.punchAnim : -swing;
    this.mesh.userData.legs.rotation.x = swing * 0.4;
    this.mesh.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.05 * clamp(this.speed / 5, 0, 1);
  }
  punch() {
    if (this.punchCooldown > 0 || this.inVehicle) return false;
    this.punchCooldown = 0.45; this.punchAnim = 1;
    return true;
  }
  shoot() {
    if (this.shootCooldown > 0 || this.inVehicle || this.weapon !== 'pistol') return false;
    if (this.ammo <= 0) return false;
    this.ammo--;
    this.shootCooldown = 0.28;
    this.punchAnim = 1;
    return true;
  }
  reload() {
    if (this.weapon === 'pistol' && this.ammo < this.ammoMax) this.ammo = this.ammoMax;
  }
  damage(amount) {
    if (!this.alive) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.alive = false;
  }
  heal(amount) { this.health = Math.min(this.maxHealth, this.health + amount); }
}
