// The city of Solmar Bay: ground, roads, buildings, beach, ocean, palms,
// harbour crates and the casino. Builds the static scene and returns the
// collision boxes (AABBs) everything else uses to stay out of walls.
import { CFG } from './config.js';

const BUILDING_COLORS = [0xcf9a6a, 0xb8c4cc, 0xe0b45c, 0x9fb8a4, 0xd98a7a, 0x7a9cc4, 0xc4b49a, 0x8fb8c4];
const PALETTE = {
  roof: 0x5a4a3a,
  trunk: 0x6b4a2f,
  leaves: 0x2e8b57,
  crate: 0x8a6d3b,
  casino: 0x7a2e6d,
  dock: 0x6b5a44,
};

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

// Deterministic pseudo-random from two integers, so the city is identical
// on every load.
function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

export function buildCity(scene) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';

  // Ground slab for the whole map.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 260),
    new THREE.MeshLambertMaterial({ color: 0x6f7f5e }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  group.add(ground);

  // Roads: dark strips along every grid line, plus a beach-front road.
  const roadMat = new THREE.MeshLambertMaterial({ color: CFG.roadColor });
  for (const c of CFG.roads) {
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(190, CFG.roadWidth), roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0, c);
    group.add(alongX);
    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadWidth, 190), roadMat);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(c, 0, 0);
    group.add(alongZ);
  }
  // Centre dashes on the main roads.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (const c of CFG.roads) {
    for (let t = -85; t <= 85; t += 10) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.35), dashMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(t, 0.02, c);
      group.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 2.4), dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(c, 0.02, t);
      group.add(d2);
    }
  }

  // Beach sand and ocean, south of the city.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(260, CFG.beachZ1 - CFG.beachZ0),
    new THREE.MeshLambertMaterial({ color: CFG.sandColor }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, (CFG.beachZ0 + CFG.beachZ1) / 2);
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 70),
    new THREE.MeshLambertMaterial({ color: CFG.oceanColor }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.01, CFG.oceanZ0 + 35);
  ocean.name = 'ocean';
  group.add(ocean);

  // Buildings: one or two per block, skipping the beach row, the harbour
  // strip and the special plots (hideout, casino, hospital).
  const specials = [
    { x: -45, z: -45, r: 12 }, // hideout plot
    { x: 45, z: -75, r: 12 }, // casino plot
    { x: -75, z: -45, r: 12 }, // hospital plot
    { x: 82, z: 10, r: 18 }, // harbour
  ];
  const blockCenters = [-75, -45, -15, 15, 45, 75];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (bz >= 75) continue;
      if (specials.some((s) => Math.hypot(bx - s.x, bz - s.z) < s.r)) continue;
      const n = hash2(bx + 100, bz + 100) > 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const ox = i === 0 ? -5 : 6;
        const oz = i === 0 ? -4 : 5;
        const w = 9 + hash2(bx, bz + i) * 5;
        const d = 8 + hash2(bx + i, bz) * 5;
        const h = 7 + hash2(bx + i * 3, bz + i) * 20;
        const color = BUILDING_COLORS[Math.floor(hash2(bx + i, bz + 7) * BUILDING_COLORS.length)];
        const b = box(w, h, d, color, bx + ox, h / 2, bz + oz);
        group.add(b);
        const roof = box(w + 0.6, 0.6, d + 0.6, PALETTE.roof, bx + ox, h + 0.3, bz + oz);
        group.add(roof);
        // Windows: small bright planes on the front face.
        const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
        const rows = Math.max(1, Math.floor(h / 4));
        for (let r = 0; r < rows; r++) {
          for (let c2 = 0; c2 < 3; c2++) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), winMat);
            win.position.set(bx + ox - w / 2 + 1.8 + c2 * (w / 3), 2.5 + r * 3.6, bz + oz + d / 2 + 0.06);
            group.add(win);
          }
        }
        colliders.push({ minX: bx + ox - w / 2, maxX: bx + ox + w / 2, minZ: bz + oz - d / 2, maxZ: bz + oz + d / 2 });
      }
    }
  }

  // Casino — big purple block with a gold sign band.
  const casino = box(22, 14, 14, PALETTE.casino, 45, 7, -75);
  group.add(casino);
  const band = box(22.4, 2.2, 14.4, 0xffd23e, 45, 12, -75);
  group.add(band);
  colliders.push({ minX: 34, maxX: 56, minZ: -82, maxZ: -68 });

  // Hideout — "The Anchor" bar, small teal building with a sign board.
  const bar = box(12, 6, 9, 0x2e7d6b, -45, 3, -45);
  group.add(bar);
  const sign = box(12.4, 1.6, 0.4, 0xffd23e, -45, 5.2, -40.2);
  group.add(sign);
  colliders.push({ minX: -51, maxX: -39, minZ: -49.5, maxZ: -40.5 });

  // Hospital — white block with a red cross slab.
  const hosp = box(14, 9, 11, 0xe8e8e8, -75, 4.5, -45);
  group.add(hosp);
  const cross = box(4, 1, 0.5, 0xd23e3e, -75, 7, -39.2);
  group.add(cross);
  colliders.push({ minX: -82, maxX: -68, minZ: -50.5, maxZ: -39.5 });

  // Harbour: wooden dock platform and stacked crates on the east edge.
  const dock = box(24, 1, 34, PALETTE.dock, 88, 0.5, 10);
  group.add(dock);
  for (let i = 0; i < 8; i++) {
    const cx = 80 + (i % 4) * 4;
    const cz = -2 + Math.floor(i / 4) * 6 + (i % 2) * 2;
    const crate = box(3, 3, 3, PALETTE.crate, cx, 1.5 + (i % 3) * 0.4, cz);
    group.add(crate);
    colliders.push({ minX: cx - 1.5, maxX: cx + 1.5, minZ: cz - 1.5, maxZ: cz + 1.5 });
  }

  // Palm trees along the beach road and a few in the city.
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.trunk });
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.leaves });
  for (let i = 0; i < 16; i++) {
    const px = -85 + i * 11;
    const pz = 71 + (i % 2) * 2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 6, 6), trunkMat);
    trunk.position.set(px, 3, pz);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.2, 7), leafMat);
    leaves.position.set(px, 7.2, pz);
    group.add(leaves);
    colliders.push({ minX: px - 0.5, maxX: px + 0.5, minZ: pz - 0.5, maxZ: pz + 0.5 });
  }

  // Street lamps along the main roads (visual only).
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const c of CFG.roads) {
    for (let t = -75; t <= 75; t += 30) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 5),
        new THREE.MeshLambertMaterial({ color: 0x333333 }));
      pole.position.set(t, 2.5, c + 5.4);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), lampMat);
      lamp.position.set(t, 5.1, c + 5.4);
      group.add(lamp);
    }
  }

  scene.add(group);
  return { colliders, group };
}

// Push a circle (x, z, radius) out of every collider it overlaps.
// Mutates and returns the position object {x, z}.
export function resolveCollision(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest axis.
        const pushL = pos.x - c.minX + radius;
        const pushR = c.maxX - pos.x + radius;
        const pushT = pos.z - c.minZ + radius;
        const pushB = c.maxZ - pos.z + radius;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) pos.x = c.minX - radius;
        else if (m === pushR) pos.x = c.maxX + radius;
        else if (m === pushT) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  pos.x = Math.max(CFG.worldMin, Math.min(CFG.worldMax, pos.x));
  pos.z = Math.max(CFG.worldMin, Math.min(CFG.worldMax, pos.z));
  return pos;
}
