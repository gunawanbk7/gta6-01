// Solmar Bay — the wanted system: stars, police cars that spawn at the
// map edge, chase the player, ram them, and give up when the heat dies.
const THREE = window.THREE;
import { WANTED, WORLD } from './config.js';
import { makeCarMesh, DriveCar } from './vehicles.js';
import { mulberry32, range } from './random.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(99);
    this.cars = []; // DriveCar instances with police meshes
    this.unseenTimer = 0;
  }

  wantedCount(wanted) {
    return Math.min(WANTED.maxPolice, wanted * WANTED.policePerStar);
  }

  // Keep the number of police cars matched to the wanted level.
  sync(wanted, playerPos) {
    const want = this.wantedCount(wanted);
    while (this.cars.length < want) {
      const angle = this.rng() * Math.PI * 2;
      const dist = 95;
      const x = Math.max(-180, Math.min(180, playerPos.x + Math.cos(angle) * dist));
      const z = Math.max(-180, Math.min(140, playerPos.z + Math.sin(angle) * dist));
      const mesh = makeCarMesh(0, true);
      this.scene.add(mesh);
      const car = new DriveCar(mesh, x, z, 0);
      car.police = true;
      car.health = 100;
      this.cars.push(car);
    }
    while (this.cars.length > want) {
      const car = this.cars.pop();
      this.scene.remove(car.mesh);
    }
  }

  update(dt, playerPos, playerSpeed, colliders, onRam) {
    for (const car of this.cars) {
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantAngle = Math.atan2(dx, dz);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Steer toward the player, throttle harder when far away.
      const steer = Math.max(-1, Math.min(1, diff * 2.2));
      const throttle = dist > 6 ? 1 : 0.4;
      car.step(dt, { throttle, steer, handbrake: false }, colliders);
      // Ram: touching the player hurts and shoves.
      if (dist < 3.4) {
        onRam(car, dist);
      }
    }
  }

  nearestDist(playerPos) {
    let best = Infinity;
    for (const car of this.cars) {
      const d = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
      if (d < best) best = d;
    }
    return best;
  }

  clear() {
    for (const car of this.cars) this.scene.remove(car.mesh);
    this.cars = [];
  }
}

// Wanted-level bookkeeping, owned by the game loop.
export class Wanted {
  constructor() {
    this.stars = 0;
    this.decayTimer = 0;
  }

  add(n, reason) {
    this.stars = Math.min(WANTED.max, this.stars + n);
    this.decayTimer = 0;
    return reason;
  }

  // Called every frame: stars fade once police have lost sight of the player.
  update(dt, policeNear) {
    if (this.stars === 0) return;
    if (policeNear) {
      this.decayTimer = 0;
    } else {
      this.decayTimer += dt;
      if (this.decayTimer >= WANTED.decaySeconds) {
        this.stars -= 1;
        this.decayTimer = 0;
      }
    }
  }

  clear() {
    this.stars = 0;
    this.decayTimer = 0;
  }
}
