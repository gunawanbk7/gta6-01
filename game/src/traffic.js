// Traffic and pedestrians: cars cruising the road grid, and locals strolling
// the sidewalks who flee when shots are fired or a car comes at them.
import { mulberry32, pick, randRange, dist2D, clamp } from './util.js';
import { Vehicle, CAR_MODELS } from './vehicles.js';

function buildPedMesh(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, [0xc98a5a, 0x8a5a3a, 0xe8b88a, 0x6a4a2a]) });
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, [0x3a9ad8, 0xe84a7a, 0x4aa86a, 0xf2c14e, 0xd8d8d8, 0x8a4ad8]) });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3),
    new THREE.MeshLambertMaterial({ color: pick(rng, [0x2a2a3a, 0x4a3a2a, 0x5a6a7a]) }));
  legs.position.y = 0.38; g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.36), shirt);
  torso.position.y = 1.1; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.7; g.add(head);
  g.userData.torso = torso;
  return g;
}

export class Traffic {
  constructor(scene, city, seed) {
    this.scene = scene;
    this.city = city;
    this.rng = mulberry32(seed + 11);
    this.cars = [];
    this.peds = [];
    this.spawnCars(14);
    this.spawnPeds(24);
  }
  randomRoadPoint() {
    const roads = this.city.roadLines;
    const v = pick(this.rng, roads);
    const along = randRange(this.rng, -170, 170);
    if (this.rng() < 0.5) return { x: v, z: along, along: 'z' };
    return { x: along, z: v, along: 'x' };
  }
  spawnCars(n) {
    for (let i = 0; i < n; i++) {
      const p = this.randomRoadPoint();
      const heading = p.along === 'z' ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const car = new Vehicle(this.scene, pick(this.rng, CAR_MODELS), p.x, p.z, heading, false);
      car.driver = 'traffic';
      car.cruiseSpeed = randRange(this.rng, 9, 14);
      car.lane = (this.rng() < 0.5 ? 1 : -1) * 2.6;
      this.cars.push(car);
    }
  }
  spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const p = this.randomRoadPoint();
      const mesh = buildPedMesh(this.rng);
      const x = p.x + randRange(this.rng, -8, 8);
      const z = p.z + randRange(this.rng, -8, 8);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.peds.push({
        mesh, x, z, heading: randRange(this.rng, 0, Math.PI * 2),
        speed: randRange(this.rng, 1.2, 2.2), phase: randRange(this.rng, 0, 6),
        flee: 0, alive: true, hostile: false, hp: 30,
      });
    }
  }
  nearestCar(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const c of this.cars) {
      if (c.dead) continue;
      const d = dist2D(x, z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  nearestPed(x, z, maxDist, includeDead) {
    let best = null, bd = maxDist;
    for (const p of this.peds) {
      if (!p.alive && !includeDead) continue;
      const d = dist2D(x, z, p.x, p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  scarePeds(x, z, radius) {
    for (const p of this.peds) {
      if (!p.alive) continue;
      if (dist2D(x, z, p.x, p.z) < radius) p.flee = 4;
    }
  }
  update(dt, player, colliders) {
    // Traffic cars: follow their road, turn at intersections, stop for the car ahead.
    for (const car of this.cars) {
      if (car.dead || car.driver !== 'traffic') continue;
      const f = car.forward();
      // Find the nearest car ahead; brake if too close.
      let blocked = false;
      for (const other of this.cars) {
        if (other === car || other.dead) continue;
        const dx = other.x - car.x, dz = other.z - car.z;
        const ahead = dx * f.x + dz * f.z;
        if (ahead > 0 && ahead < 9 && Math.abs(dx * f.z - dz * f.x) < 3) { blocked = true; break; }
      }
      const playerCar = player.inVehicle;
      if (playerCar && playerCar !== car) {
        const dx = playerCar.x - car.x, dz = playerCar.z - car.z;
        const ahead = dx * f.x + dz * f.z;
        if (ahead > 0 && ahead < 10 && Math.abs(dx * f.z - dz * f.x) < 3.5) blocked = true;
      }
      const speed = blocked ? 0 : car.cruiseSpeed;
      car.speed += clamp(speed - car.speed, -10 * dt, 6 * dt);
      car.heading += 0; // straight until an intersection
      const nx = car.x + f.x * car.speed * dt;
      const nz = car.z + f.z * car.speed * dt;
      // At an intersection (near a crossing road line), sometimes turn.
      const nearCrossX = this.city.roadLines.some((v) => Math.abs(nx - v) < 1.2 && Math.abs(car.z - v) > 4);
      const nearCrossZ = this.city.roadLines.some((v) => Math.abs(nz - v) < 1.2 && Math.abs(car.x - v) > 4);
      if ((nearCrossX || nearCrossZ) && this.rng() < 0.012) {
        car.heading += (this.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      car.mesh.position.x = clamp(nx, -178, 178);
      car.mesh.position.z = clamp(nz, -178, 178);
      car.mesh.rotation.y = car.heading;
      // Wrap around the far edge so traffic never runs out.
      if (Math.abs(car.x) > 176 || Math.abs(car.z) > 176) {
        const p = this.randomRoadPoint();
        car.mesh.position.set(p.x, 0, p.z);
        car.heading = p.along === 'z' ? 0 : Math.PI / 2;
      }
    }
    // Pedestrians: wander the sidewalks, flee danger.
    for (const p of this.peds) {
      if (!p.alive) continue;
      if (p.guard) continue; // guards hold their ground; missions.js aims them
      p.flee = Math.max(0, p.flee - dt);
      const px = player.inVehicle ? player.inVehicle.x : player.x;
      const pz = player.inVehicle ? player.inVehicle.z : player.z;
      if (p.flee > 0) {
        const d = dist2D(p.x, p.z, px, pz) || 1;
        const awayX = (p.x - px) / d, awayZ = (p.z - pz) / d;
        p.x += awayX * 5.5 * dt; p.z += awayZ * 5.5 * dt;
        p.heading = Math.atan2(awayX, awayZ);
      } else {
        if (this.rng() < 0.004) p.heading += randRange(this.rng, -1.4, 1.4);
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        if (Math.abs(p.x) > 175 || Math.abs(p.z) > 175) p.heading += Math.PI;
      }
      p.phase += dt * (p.flee > 0 ? 11 : 5);
      p.mesh.position.set(p.x, Math.abs(Math.sin(p.phase)) * 0.04, p.z);
      p.mesh.rotation.y = p.heading;
      p.mesh.userData.torso.rotation.x = Math.sin(p.phase) * 0.15;
    }
  }
}
