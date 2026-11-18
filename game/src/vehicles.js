// Solmar Bay — vehicles: the low-poly car mesh factory and the player's
// arcade driving model (accelerate, steer, brake, handbrake, collisions).
const THREE = window.THREE;
import { CAR, WORLD } from './config.js';
import { pick } from './random.js';

export const CAR_COLORS = [0xd83a2e, 0x2e6ad8, 0xf2c230, 0x3aa655, 0xe8e8e8, 0x222222, 0xff7a1a, 0x8a4ad8, 0x1ad8c8];

// A simple boxy car: body, cabin, wheels, headlights. `police` gets a
// white body, light bar and SOLMAR PD livery colour.
export function makeCarMesh(color, police = false) {
  const group = new THREE.Group();
  const bodyColor = police ? 0xf0f0f0 : color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.75, 4.4),
    new THREE.MeshLambertMaterial({ color: bodyColor }),
  );
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, 2.1),
    new THREE.MeshLambertMaterial({ color: police ? 0x18304a : 0x222831 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelPos = [[-0.95, 0.38, 1.45], [0.95, 0.38, 1.45], [-0.95, 0.38, -1.45], [0.95, 0.38, -1.45]];
  const wheels = [];
  for (const [x, y, z] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    light.position.set(x, 0.7, 2.21);
    group.add(light);
  }
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    bar.position.set(0, 1.75, -0.2);
    group.add(bar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.3, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x18304a }),
    );
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  group.userData.wheels = wheels;
  return group;
}

export class DriveCar {
  constructor(mesh, x, z, angle) {
    this.mesh = mesh;
    this.x = x;
    this.z = z;
    this.angle = angle; // heading, 0 = facing -z? forward is (sin, cos) below
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.police = false;
  }

  forward() {
    return { x: Math.sin(this.angle), z: Math.cos(this.angle) };
  }

  // Arcade driving step. input: {throttle -1..1, steer -1..1, handbrake}.
  // Returns distance travelled this frame (for camera / audio).
  step(dt, input, colliders) {
    const fwd = this.forward();
    if (input.throttle > 0) this.speed += CAR.accel * input.throttle * dt;
    if (input.throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed += CAR.reverseAccel * input.throttle * dt;
    }
    if (input.handbrake) this.speed *= Math.max(0, 1 - 3.5 * dt);
    // drag + rolling resistance
    this.speed -= this.speed * CAR.drag * dt;
    this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
    if (Math.abs(this.speed) < 0.05) this.speed = 0;

    const steerTarget = input.steer * CAR.steer * Math.min(1, Math.abs(this.speed) / 8);
    this.steer += (steerTarget - this.steer) * Math.min(1, CAR.grip * dt);
    // Turning follows the direction of travel: reversing flips the steering.
    this.angle += this.steer * Math.sign(this.speed || 0) * dt;
    // Recompute forward after turning; move, then resolve building collisions.
    const f2 = this.forward();
    const nx = this.x + f2.x * this.speed * dt;
    const nz = this.z + f2.z * this.speed * dt;
    const hit = resolveCircle(nx, nz, 1.6, colliders);
    this.x = hit.x;
    this.z = hit.z;
    if (hit.collided && Math.abs(this.speed) > 6) {
      this.speed *= 0.45; // crunch into the wall
      this.health = Math.max(0, this.health - 4);
    }
    // Keep inside the map; the ocean is not drivable.
    this.x = Math.max(-WORLD.half, Math.min(WORLD.half, this.x));
    this.z = Math.max(-WORLD.half, Math.min(WORLD.beachZ - 4, this.z));
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.angle;
    // Wheel spin + front-wheel steer for life.
    const wheels = this.mesh.userData.wheels || [];
    wheels.forEach((w, i) => {
      w.rotation.x += this.speed * dt * 2.2;
      if (i < 2) w.rotation.y = this.steer * 0.5; // front wheels steer
    });
    return Math.abs(this.speed) * dt;
  }
}

// Push a circle (x, z, radius) out of every AABB it overlaps.
export function resolveCircle(x, z, radius, colliders) {
  let collided = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      collided = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (radius - d) / d;
        x += dx * push;
        z += dz * push;
      } else {
        // Centre inside the box: push out along the smallest axis.
        const left = x - c.minX;
        const right = c.maxX - x;
        const top = z - c.minZ;
        const bottom = c.maxZ - z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = c.minX - radius;
        else if (m === right) x = c.maxX + radius;
        else if (m === top) z = c.minZ - radius;
        else z = c.maxZ + radius;
      }
    }
  }
  return { x, z, collided };
}

export function randomCarColor(rng) {
  return pick(rng, CAR_COLORS);
}
