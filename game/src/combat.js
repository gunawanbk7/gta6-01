// Solmar Bay — combat: punch up close, pistol shots with a raycast, ammo,
// and the damage numbers the HUD and the police system read.
const THREE = window.THREE;
import { PLAYER } from './config.js';

export class Combat {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.ammo = PLAYER.magSize;
    this.reserve = 48;
    this.cooldown = 0;
    this.punchCooldown = 0;
    this.raycaster = new THREE.Raycaster();
    this.tracer = null;
    this.tracerTimer = 0;
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (this.tracer) {
      this.tracerTimer -= dt;
      if (this.tracerTimer <= 0) {
        this.scene.remove(this.tracer);
        this.tracer.geometry.dispose();
        this.tracer = null;
      }
    }
  }

  reload() {
    if (this.ammo >= PLAYER.magSize || this.reserve <= 0) return false;
    const need = PLAYER.magSize - this.ammo;
    const take = Math.min(need, this.reserve);
    this.ammo += take;
    this.reserve -= take;
    return true;
  }

  // Fire the pistol from the camera through the crosshair. `targets` is a
  // list of {mesh, onHit(damage)} objects (peds, police cars, traffic).
  // Returns 'hit' | 'miss' | 'empty' | 'cooldown'.
  shoot(targets) {
    if (this.cooldown > 0) return 'cooldown';
    if (this.ammo <= 0) return 'empty';
    this.ammo -= 1;
    this.cooldown = 0.28;
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this.raycaster.far = PLAYER.pistolRange;
    const meshes = targets.map((t) => t.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    const from = this.camera.position.clone();
    let end;
    if (hits.length > 0) {
      end = hits[0].point.clone();
      // Find which target owns the hit mesh.
      let obj = hits[0].object;
      while (obj && !targets.some((t) => t.mesh === obj)) obj = obj.parent;
      const target = targets.find((t) => t.mesh === obj);
      if (target) target.onHit(PLAYER.pistolDamage, hits[0].point);
      this.showTracer(from, end);
      return 'hit';
    }
    end = from.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(PLAYER.pistolRange));
    this.showTracer(from, end);
    return 'miss';
  }

  showTracer(from, to) {
    if (this.tracer) {
      this.scene.remove(this.tracer);
      this.tracer.geometry.dispose();
    }
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this.scene.add(this.tracer);
    this.tracerTimer = 0.07;
  }

  // Punch: hits the nearest pedestrian or police officer within range in
  // front of the player. Returns the target hit, or null.
  punch(playerPos, playerAngle, targets) {
    if (this.punchCooldown > 0) return null;
    this.punchCooldown = 0.45;
    const fx = Math.sin(playerAngle);
    const fz = Math.cos(playerAngle);
    let best = null;
    let bestScore = Infinity;
    for (const t of targets) {
      const dx = t.x - playerPos.x;
      const dz = t.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > PLAYER.punchRange) continue;
      const facing = (dx * fx + dz * fz) / (d || 1);
      if (facing < 0.3) continue;
      const score = d - facing;
      if (score < bestScore) { bestScore = score; best = t; }
    }
    if (best) best.onHit(PLAYER.punchDamage);
    return best;
  }
}
