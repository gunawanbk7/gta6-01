// The wanted system: stars 0-5, Solmar Bay Police Department cruisers that
// chase and ram the player, busted / escape rules, and slow wanted decay.
import { clamp, dist2D } from './util.js';
import { Vehicle } from './vehicles.js';

const POLICE_MODEL = { name: 'SBPD Cruiser', color: 0x1a1a22, top: 33, accel: 16 };

export class Police {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.wanted = 0;
    this.cars = [];
    this.heat = 0; // time since last crime, used for decay
    this.bustedTimer = 0;
    this.sirenOn = false;
  }
  addWanted(n, reason) {
    if (this.wanted >= 5) return;
    this.wanted = clamp(this.wanted + n, 0, 5);
    this.heat = 0;
    return reason;
  }
  wantedCars() { return this.wanted === 0 ? 0 : Math.min(4, 1 + Math.floor(this.wanted / 2)); }
  spawnPolice(x, z) {
    const car = new Vehicle(this.scene, POLICE_MODEL, x, z, 0, true);
    car.driver = 'police';
    this.cars.push(car);
    return car;
  }
  update(dt, player, game) {
    this.heat += dt;
    const want = this.wantedCars();
    // Spawn cruisers near the player until the wanted count is met.
    while (this.cars.length < want) {
      const a = Math.random() * Math.PI * 2;
      this.spawnPolice(player.x + Math.sin(a) * 55, player.z + Math.cos(a) * 55);
    }
    while (this.cars.length > want) {
      const c = this.cars.pop();
      c.remove(this.scene);
    }
    this.sirenOn = this.wanted > 0;
    const px = player.inVehicle ? player.inVehicle.x : player.x;
    const pz = player.inVehicle ? player.inVehicle.z : player.z;
    // Wanted decays only when no cruiser can see the player for a while.
    let nearest = 9999;
    for (const c of this.cars) nearest = Math.min(nearest, dist2D(c.x, c.z, px, pz));
    if (this.wanted > 0 && nearest > 70 && this.heat > 18) {
      this.wanted--;
      this.heat = 0;
      game.hud.feed(`You slipped away. Wanted level dropped to ${this.wanted}.`, '#7fd8ff');
      if (this.wanted === 0) game.hud.feed('You are clean. Stay out of trouble.', '#7fd8ff');
    }
    // Chase: steer toward the player, ram on foot, push the player's car.
    for (const car of this.cars) {
      const dx = px - car.x, dz = pz - car.z;
      const d = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += clamp(dh, -1.9 * dt, 1.9 * dt);
      const speedTarget = d > 14 ? 30 : 22;
      car.speed += clamp(speedTarget - car.speed, -14 * dt, 12 * dt);
      const f = car.forward();
      let nx = car.x + f.x * car.speed * dt;
      let nz = car.z + f.z * car.speed * dt;
      // Ram the player's car: shove it sideways and slow it.
      if (player.inVehicle && d < 5.5) {
        player.inVehicle.speed *= 0.94;
        player.inVehicle.mesh.position.x += f.x * 2.2 * dt * 10;
        player.inVehicle.mesh.position.z += f.z * 2.2 * dt * 10;
        car.speed *= 0.7;
        game.audio.noise(0.08, 0.2, 600);
      }
      car.mesh.position.x = clamp(nx, -200, 200);
      car.mesh.position.z = clamp(nz, -200, 200);
      car.mesh.rotation.y = car.heading;
      if (car.mesh.userData.lightBar) {
        car.mesh.userData.lightBar.material.color.setHex(Math.floor(game.time * 6) % 2 ? 0xff2233 : 0x2244ff);
      }
      // Busted: a cruiser sits on the player on foot.
      if (!player.inVehicle && player.alive && d < 3.2) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.6) game.busted();
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
      }
    }
    if (this.wanted === 0) this.bustedTimer = 0;
  }
  clearAll() {
    for (const c of this.cars) c.remove(this.scene);
    this.cars = [];
    this.wanted = 0;
    this.heat = 0;
    this.bustedTimer = 0;
  }
}
