// Vehicles: boxy low-poly cars built from three.js primitives, arcade driving
// physics (accelerate, steer, brake, handbrake), and enter / exit / steal.
// Colours, names and models are all invented for Solmar Bay.
import { clamp, damp, resolveCircleAABB } from './util.js';

export const CAR_MODELS = [
  { name: 'Coral Coupe', color: 0xe84a3a, top: 34, accel: 15 },
  { name: 'Bay Sedan', color: 0x3a6fd8, top: 30, accel: 13 },
  { name: 'Palm Taxi', color: 0xf2c14e, top: 28, accel: 12 },
  { name: 'Dune Pickup', color: 0x4aa86a, top: 29, accel: 13 },
  { name: 'Sunset Van', color: 0xd8d8d8, top: 25, accel: 10 },
  { name: 'Wave Roadster', color: 0x8a4ad8, top: 36, accel: 16 },
];
export const POLICE_COLOR = 0x1a1a22;

export function buildCarMesh(model, isPolice) {
  const g = new THREE.Group();
  const bodyColor = isPolice ? POLICE_COLOR : model.color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.75, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor })
  );
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.7, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0x222226 : 0x2a3542 })
  );
  cabin.position.set(0, 1.35, -0.25); g.add(cabin);
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2244ff })
    );
    bar.position.set(0, 1.85, -0.25); g.add(bar);
    g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.12, 0.3, 4.42),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    stripe.position.y = 0.62; g.add(stripe);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x161616 });
  const wheels = [];
  for (const [x, z] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w); wheels.push(w);
  }
  g.userData.wheels = wheels;
  // Headlights.
  const hl = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.18, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xfff6c0 })
  );
  hl.position.set(0, 0.7, 2.22); g.add(hl);
  return g;
}

export class Vehicle {
  constructor(scene, model, x, z, heading, isPolice) {
    this.model = model;
    this.isPolice = !!isPolice;
    this.mesh = buildCarMesh(model, isPolice);
    this.mesh.position.set(x, 0, z);
    this.heading = heading;
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.speed = 0;
    this.steer = 0;
    this.driver = null; // 'player' | 'traffic' | 'police' | null (parked)
    this.stolen = false;
    this.health = 100;
    this.radius = 2.2;
    this.dead = false;
  }
  get x() { return this.mesh.position.x; }
  get z() { return this.mesh.position.z; }
  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  // Arcade driving step. throttle -1..1, steerInput -1..1.
  drive(throttle, steerInput, dt, colliders) {
    const m = this.model;
    const maxSpeed = m.top * (throttle < 0 ? 0.45 : 1);
    const target = throttle * maxSpeed;
    const accelRate = throttle !== 0 ? m.accel : 8;
    this.speed += clamp(target - this.speed, -accelRate * dt, accelRate * dt);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    const steerTarget = steerInput * 0.55 * clamp(Math.abs(this.speed) / 8, 0, 1);
    this.steer = damp(this.steer, steerTarget, 8, dt);
    this.heading += (this.steer * this.speed * dt) / 3.2;
    const f = this.forward();
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    // Building collision: slide along the wall, lose a little speed.
    for (const box of colliders) {
      const fixed = resolveCircleAABB(nx, nz, this.radius, box);
      if (fixed) { nx = fixed.x; nz = fixed.z; this.speed *= 0.82; }
    }
    nx = clamp(nx, -205, 205); nz = clamp(nz, -205, 205);
    this.mesh.position.x = nx; this.mesh.position.z = nz;
    this.mesh.rotation.y = this.heading;
    // Body roll + wheel spin for feel.
    this.mesh.rotation.z = -this.steer * 0.06 * Math.sign(this.speed || 1);
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 1.4;
  }
  remove(scene) { scene.remove(this.mesh); this.dead = true; }
}
