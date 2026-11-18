// Shared math and random helpers for Solmar Bay. No dependencies.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Deterministic seeded random (mulberry32) so the city looks the same every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function randRange(rng, a, b) { return a + rng() * (b - a); }
// Circle vs axis-aligned box (x/z) push-out. Returns corrected position.
export function resolveCircleAABB(px, pz, radius, box) {
  const cx = clamp(px, box.minX, box.maxX);
  const cz = clamp(pz, box.minZ, box.maxZ);
  const dx = px - cx, dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return null;
  if (d2 > 0.000001) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * radius, z: cz + (dz / d) * radius };
  }
  // Centre inside the box: push out along the smallest penetration axis.
  const pl = px - box.minX, pr = box.maxX - px, pt = pz - box.minZ, pb = box.maxZ - pz;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: box.minX - radius, z: pz };
  if (m === pr) return { x: box.maxX + radius, z: pz };
  if (m === pt) return { x: px, z: box.minZ - radius };
  return { x: px, z: box.maxZ + radius };
}
export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
