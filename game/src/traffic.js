// Solmar Bay — ambient life: traffic cars cruising the road grid and
// pedestrians strolling the sidewalks. Both are simple, cheap and visible
// from anywhere in the city.
const THREE = window.THREE;
import { WORLD } from './config.js';
import { mulberry32, pick, range, intRange } from './random.js';
import { makeCarMesh, randomCarColor } from './vehicles.js';

const ROAD_COORDS = [];
for (let c = -180; c <= 180; c += WORLD.roadGap) ROAD_COORDS.push(c);

export class Traffic {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
    this.peds = [];
    this.pedMeshes = [];
  }

  spawnCars(count) {
    for (let i = 0; i < count; i++) {
      const vertical = this.rng() < 0.5;
      const road = pick(this.rng, ROAD_COORDS);
      const along = range(this.rng, -170, 170);
      const mesh = makeCarMesh(randomCarColor(this.rng));
      this.scene.add(mesh);
      const car = {
        mesh,
        vertical,
        road,
        along,
        dir: this.rng() < 0.5 ? 1 : -1,
        speed: range(this.rng, 7, 11),
        wait: 0,
      };
      mesh.position.set(vertical ? road : along, 0, vertical ? along : road);
      mesh.rotation.y = vertical ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.cars.push(car);
    }
  }

  spawnPeds(count) {
    const shirtColors = [0xe8e8e8, 0xffd76a, 0x6ac8ff, 0xff8ac8, 0x3aa655, 0xd83a2e];
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: pick(this.rng, shirtColors) });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshLambertMaterial({ color: pick(this.rng, [0xc98a5e, 0x8a5a3a, 0xe8b88a]) }));
      head.position.y = 1.55;
      g.add(head);
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.35), shirt);
      torso.position.y = 1.0;
      g.add(torso);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.25), legMat);
      legL.position.set(-0.15, 0.33, 0);
      g.add(legL);
      const legR = legL.clone();
      legR.position.x = 0.15;
      g.add(legR);
      const vertical = this.rng() < 0.5;
      const road = pick(this.rng, ROAD_COORDS);
      const along = range(this.rng, -170, 170);
      const side = this.rng() < 0.5 ? 1 : -1;
      const ped = {
        mesh: g,
        vertical,
        road,
        along,
        side,
        dir: this.rng() < 0.5 ? 1 : -1,
        speed: range(this.rng, 1.2, 2.2),
        phase: range(this.rng, 0, 6),
        fleeing: 0,
        fallen: 0,
      };
      g.position.set(vertical ? road + side * 8 : along, 0, vertical ? along : road + side * 8);
      this.scene.add(g);
      this.peds.push(ped);
    }
  }

  // One traffic step. playerPos is {x, z} or null; cars ahead slow down.
  update(dt, playerPos) {
    for (const car of this.cars) {
      if (car.wait > 0) {
        car.wait -= dt;
        continue;
      }
      // Slow down if another traffic car is right ahead.
      let blocked = false;
      for (const other of this.cars) {
        if (other === car || other.vertical !== car.vertical || other.road !== car.road) continue;
        const gap = (other.along - car.along) * car.dir;
        if (gap > 0 && gap < 9) { blocked = true; break; }
      }
      if (blocked) continue;
      car.along += car.dir * car.speed * dt;
      if (car.along > 185 || car.along < -185) {
        // Turn around at the map edge or pick a new road.
        if (this.rng() < 0.5) {
          car.dir *= -1;
          car.along = Math.max(-180, Math.min(180, car.along));
        } else {
          car.vertical = !car.vertical;
          car.road = pick(this.rng, ROAD_COORDS);
          car.along = Math.max(-180, Math.min(180, car.along));
        }
      }
      // Random turn at an intersection.
      if (this.rng() < dt * 0.05 && Math.abs(((car.along % 60) + 60) % 60) < 4) {
        car.vertical = !car.vertical;
        car.road = Math.round(car.along / 60) * 60;
        car.along = Math.round(car.road / 60) * 60;
      }
      car.mesh.position.set(car.vertical ? car.road : car.along, 0, car.vertical ? car.along : car.road);
      car.mesh.rotation.y = car.vertical ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }

    for (const ped of this.peds) {
      if (ped.fallen > 0) {
        ped.fallen -= dt;
        ped.mesh.rotation.x = -Math.PI / 2 + Math.max(0, ped.fallen) * 0.2;
        ped.mesh.position.y = 0.3;
        if (ped.fallen <= 0) {
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
          ped.fleeing = 2.5;
        }
        continue;
      }
      if (playerPos && ped.fleeing <= 0) {
        const dx = ped.mesh.position.x - playerPos.x;
        const dz = ped.mesh.position.z - playerPos.z;
        if (dx * dx + dz * dz < 30) ped.fleeing = 2;
      }
      let speed = ped.speed;
      if (ped.fleeing > 0) {
        ped.fleeing -= dt;
        speed = 5.5; // sprint away from the player
      }
      ped.along += ped.dir * speed * dt;
      if (ped.along > 182 || ped.along < -182) ped.dir *= -1;
      if (this.rng() < dt * 0.03 && Math.abs(((ped.along % 60) + 60) % 60) < 3) {
        ped.vertical = !ped.vertical;
        ped.road = Math.round(ped.along / 60) * 60;
        ped.along = Math.round(ped.road / 60) * 60;
      }
      ped.mesh.position.set(
        ped.vertical ? ped.road + ped.side * 8 : ped.along,
        0,
        ped.vertical ? ped.along : ped.road + ped.side * 8,
      );
      ped.mesh.rotation.y = ped.vertical ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      ped.phase += dt * speed * 2.4;
      const s = Math.sin(ped.phase) * 0.4;
      ped.mesh.children[2].rotation.x = s;
      ped.mesh.children[3].rotation.x = -s;
    }
  }

  // Nearest pedestrian to a point, within range. Used by combat.
  nearestPed(x, z, range_) {
    let best = null;
    let bestD = range_ * range_;
    for (const ped of this.peds) {
      if (ped.fallen > 0) continue;
      const dx = ped.mesh.position.x - x;
      const dz = ped.mesh.position.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = ped; }
    }
    return best;
  }

  knockDown(ped) {
    ped.fallen = 2.2;
    ped.fleeing = 0;
  }
}
