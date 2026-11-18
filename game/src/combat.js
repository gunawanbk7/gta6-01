// Combat: fists and the pistol. Hitscan shots from the camera, muzzle flash,
// tracer lines, hit reactions on pedestrians and cruisers, and hostile guards
// for the final mission who shoot back.
import { dist2D } from './util.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffe9a0, 0, 18);
    this.scene.add(this.flash);
    this.flashTimer = 0;
  }
  // A short-lived line from the muzzle toward the hit point.
  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }
  update(dt) {
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    this.flash.intensity = this.flashTimer > 0 ? 60 : 0;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) { this.scene.remove(t.line); this.tracers.splice(i, 1); }
    }
  }
  // Punch: damage the nearest pedestrian in front of the player.
  punch(game) {
    const p = game.player;
    if (!p.punch()) return;
    game.audio.punch();
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    let best = null, bd = 2.4;
    for (const ped of game.traffic.peds) {
      if (!ped.alive) continue;
      const d = dist2D(p.x, p.z, p.x, p.z);
      const dx = ped.x - p.x, dz = ped.z - p.z;
      const dd = Math.hypot(dx, dz);
      if (dd < bd && (dx * fx + dz * fz) / (dd || 1) > 0.3) { bd = dd; best = ped; }
    }
    if (best) {
      best.hp -= 34;
      best.flee = 3;
      game.traffic.scarePeds(best.x, best.z, 14);
      if (best.hp <= 0) this.killPed(game, best);
      else game.hud.feed('You landed a punch. The crowd is staring.', '#ffd94e');
      game.police.addWanted(1, 'assault');
      game.hud.feed('WANTED: assault in public. The SBPD is coming.', '#ff6a5a');
    }
  }
  // Pistol: raycast from the camera through the crosshair against peds and cars.
  shoot(game) {
    const p = game.player;
    if (!p.shoot()) return;
    game.audio.gunshot();
    game.traffic.scarePeds(p.x, p.z, 30);
    game.police.addWanted(1, 'gunfire');
    game.hud.feed('Shots fired! Wanted level rising.', '#ff6a5a');
    const cam = game.camera;
    const origin = cam.position.clone();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const muzzle = { x: p.x, y: 1.5, z: p.z };
    this.flash.position.set(muzzle.x, muzzle.y, muzzle.z);
    this.flashTimer = 0.07;
    // Nearest hit along the ray, peds first, then cars.
    let bestT = 120, hitPoint = null, hitPed = null, hitCar = null;
    for (const ped of game.traffic.peds) {
      if (!ped.alive) continue;
      const to = new THREE.Vector3(ped.x - origin.x, 1.2 - origin.y, ped.z - origin.z);
      const t = to.dot(dir);
      if (t < 1 || t > bestT) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(new THREE.Vector3(ped.x, 1.2, ped.z)) < 1.1) {
        bestT = t; hitPed = ped; hitPoint = closest; hitCar = null;
      }
    }
    const allCars = [...game.traffic.cars, ...game.police.cars];
    for (const car of allCars) {
      if (car.dead) continue;
      const to = new THREE.Vector3(car.x - origin.x, 0.9 - origin.y, car.z - origin.z);
      const t = to.dot(dir);
      if (t < 1 || t > bestT) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(new THREE.Vector3(car.x, 0.9, car.z)) < 2.4) {
        bestT = t; hitCar = car; hitPoint = closest; hitPed = null;
      }
    }
    if (!hitPoint) hitPoint = origin.clone().addScaledVector(dir, 60);
    this.tracer(muzzle, hitPoint);
    if (hitPed) {
      hitPed.hp -= 50;
      hitPed.flee = 4;
      if (hitPed.hp <= 0) this.killPed(game, hitPed);
      else game.hud.feed('You hit a bystander. Bad idea, boss.', '#ffd94e');
    } else if (hitCar) {
      hitCar.health -= 25;
      if (hitCar.isPolice) {
        game.hud.feed('You shot an SBPD cruiser! They are not letting this go.', '#ff6a5a');
        game.police.addWanted(1, 'shooting police');
      } else {
        game.hud.feed('You shot a car. Its alarm is screaming.', '#ffd94e');
      }
      if (hitCar.health <= 0 && hitCar.driver === 'traffic') {
        hitCar.driver = null;
        game.hud.feed('That car is wrecked. Its driver ran for it.', '#ffd94e');
      }
    }
  }
  killPed(game, ped) {
    ped.alive = false;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.3;
    game.police.addWanted(1, 'homicide');
    game.hud.feed('A bystander is down. The SBPD wants you — badly.', '#ff6a5a');
    if (game.missions.onPedKilled) game.missions.onPedKilled(ped);
  }
  // Hostile guards (mission 4) shoot back at the player.
  guardShoot(game, guard) {
    const p = game.player;
    const d = dist2D(guard.x, guard.z, p.x, p.z);
    if (d > 45 || !p.alive) return;
    const from = { x: guard.x, y: 1.4, z: guard.z };
    const to = new THREE.Vector3(p.x, 1.2, p.z);
    this.tracer(from, to);
    this.flash.position.set(from.x, from.y, from.z);
    this.flashTimer = 0.06;
    game.audio.gunshot();
    if (Math.random() < 0.45) {
      p.damage(9);
      game.hud.flashDamage();
      game.hud.feed('A marina guard hit you!', '#ff6a5a');
      if (!p.alive) game.wasted();
    }
  }
}
