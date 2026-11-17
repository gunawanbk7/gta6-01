// city.js — builds Solmar Bay, a fictional coastal city, from a fixed seed so the
// layout is identical every run. Roads on a grid, blocks full of buildings, parks,
// a beach and harbour water on the east and south edges. Also answers collision
// queries for the player, cars and pedestrians.
import { mulberry32, randRange, pick, circleHitsRect, rectsOverlap } from './util.js';

export const WORLD = 2800;
export const ROAD_W = 64;

// Vertical and horizontal road centre lines.
export const V_ROADS = [140, 400, 660, 920, 1180, 1440, 1700, 1960, 2220];
export const H_ROADS = [140, 400, 660, 920, 1180, 1440, 1700, 1960, 2220];

const DISTRICT_COLORS = {
  downtown: ['#7d8aa0', '#6b7a92', '#8b93a5', '#5d6b82', '#97a0b2'],
  oldtown: ['#b08d6a', '#a08060', '#c09a72', '#96714f'],
  marina: ['#e8dcc0', '#dccfae', '#cdbf9c', '#efe3c2'],
  harbour: ['#8a7f72', '#7a6f62', '#96887a'],
  industrial: ['#7a7568', '#6b655a', '#857c6e'],
  suburbs: ['#c9a68a', '#bfae90', '#d4b89a', '#a8b39a'],
};

export function districtAt(x, y) {
  if (x > 2050 && y < 2000) return 'marina';
  if (y > 2050) return 'harbour';
  if (x < 700 && y < 700) return 'oldtown';
  if (x > 1900 && y < 800) return 'suburbs';
  if (x < 700 && y > 1900) return 'industrial';
  if (x > 850 && x < 1800 && y > 600 && y < 1500) return 'downtown';
  return 'mixed';
}

export function buildCity(seed = 20261117) {
  const rng = mulberry32(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const containers = [];
  const parkedSpots = [];

  // Water: the bay along the east edge and the harbour basin at the south-east.
  const water = [
    { x: 2500, y: 0, w: 300, h: 2800 },          // open bay, east
    { x: 2050, y: 2380, w: 450, h: 420 },        // harbour basin, south-east
  ];
  const beach = { x: 2400, y: 0, w: 100, h: 2380 };

  // Buildings fill every block between roads (skipping the beach / water strip).
  for (let ix = 0; ix < V_ROADS.length - 1; ix++) {
    for (let iy = 0; iy < H_ROADS.length - 1; iy++) {
      const bx0 = V_ROADS[ix] + ROAD_W / 2 + 14;
      const by0 = H_ROADS[iy] + ROAD_W / 2 + 14;
      const bx1 = V_ROADS[ix + 1] - ROAD_W / 2 - 14;
      const by1 = H_ROADS[iy + 1] - ROAD_W / 2 - 14;
      if (bx0 >= 2380) continue; // beach strip
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const district = districtAt(cx, cy);
      const roll = rng();
      if (roll < 0.14 && district !== 'downtown') {
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        const n = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < n; i++) {
          trees.push({ x: randRange(rng, bx0 + 14, bx1 - 14), y: randRange(rng, by0 + 14, by1 - 14), r: 9 + rng() * 7 });
        }
        continue;
      }
      const cols = district === 'downtown' ? 2 : (rng() < 0.5 ? 2 : 1);
      const rows = district === 'downtown' ? 2 : (rng() < 0.5 ? 2 : 1);
      const cw = (bx1 - bx0) / cols, ch = (by1 - by0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < 0.12) continue; // empty lot / car park
          const pad = 8 + rng() * 8;
          const w = cw - pad * 2, h = ch - pad * 2;
          const x = bx0 + c * cw + pad, y = by0 + r * ch + pad;
          const palette = DISTRICT_COLORS[district] || DISTRICT_COLORS.downtown;
          const tall = district === 'downtown' ? 26 + Math.floor(rng() * 40) : 6 + Math.floor(rng() * 10);
          buildings.push({
            x, y, w, h,
            color: pick(rng, palette),
            roof: pick(rng, ['#4a4f58', '#5a5148', '#3f4a55', '#6b5d4f']),
            height: tall,
            district,
            windows: district === 'downtown' || district === 'harbour',
          });
          if (district === 'suburbs' && rng() < 0.7) {
            trees.push({ x: x + w + 12, y: y + h / 2, r: 8 + rng() * 5 });
          }
        }
      }
      // Parked cars along the block edge.
      if (rng() < 0.7) {
        parkedSpots.push({
          x: bx0 + 10 + rng() * (bx1 - bx0 - 20),
          y: by1 - 6, angle: 0, vertical: false,
        });
      }
    }
  }

  // Harbour containers, stacked in rows on the docks.
  for (let i = 0; i < 26; i++) {
    const row = Math.floor(i / 9), col = i % 9;
    containers.push({
      x: 2100 + col * 62, y: 2140 + row * 34,
      w: 54, h: 26,
      color: pick(rng, ['#b3543f', '#3f7ab3', '#c2a23f', '#4f8a4f', '#8a5f9e']),
    });
  }
  // Marina palm trees along the beach.
  for (let y = 120; y < 2300; y += 130) {
    trees.push({ x: 2435 + randRange(rng, -8, 8), y: y + randRange(rng, -20, 20), r: 10, palm: true });
  }
  for (let i = 0; i < 40; i++) {
    trees.push({ x: randRange(rng, 80, 2320), y: randRange(rng, 80, 2320), r: 8 + rng() * 6 });
  }

  // Named landmarks the missions and HUD refer to.
  const landmarks = {
    safehouse: { x: 1180, y: 1990, label: 'Safehouse' },
    hospital: { x: 660, y: 1180, label: 'Solmar General' },
    policeHQ: { x: 1440, y: 920, label: 'Police HQ' },
    club: { x: 1180, y: 920, label: 'Neon Palms Club' },
    bank: { x: 1440, y: 1180, label: 'Solmar Central Bank' },
    garage: { x: 920, y: 1700, label: 'Chop Shop' },
    warehouse: { x: 2050, y: 2150, label: 'Harbour Warehouse' },
    penthouse: { x: 2220, y: 400, label: 'Marina Penthouse' },
    docks: { x: 2220, y: 2220, label: 'The Docks' },
    impound: { x: 1560, y: 860, label: 'Impound Lot' },
  };

  return { buildings, parks, trees, containers, parkedSpots, water, beach, landmarks, seed };
}

export function pointInWater(city, x, y) {
  return city.water.some((w) => x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h);
}

export function pointBlocked(city, x, y, r) {
  if (x < r || y < r || x > WORLD - r || y > WORLD - r) return true;
  if (pointInWater(city, x, y)) return true;
  for (const b of city.buildings) {
    if (circleHitsRect(x, y, r, b)) return true;
  }
  for (const c of city.containers) {
    if (circleHitsRect(x, y, r, c)) return true;
  }
  return false;
}

// Push a circle out of buildings/water; returns true if a collision happened.
export function resolveCircle(city, p, r) {
  let hit = false;
  if (p.x < r) { p.x = r; hit = true; }
  if (p.y < r) { p.y = r; hit = true; }
  if (p.x > WORLD - r) { p.x = WORLD - r; hit = true; }
  if (p.y > WORLD - r) { p.y = WORLD - r; hit = true; }
  const solids = city.buildings;
  for (const b of solids) {
    if (circleHitsRect(p.x, p.y, r, b)) {
      const nx = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(p.y, b.y + b.h));
      let dx = p.x - nx, dy = p.y - ny;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.001) { dx = 0; dy = -1; d = 1; }
      p.x = nx + (dx / d) * r; p.y = ny + (dy / d) * r;
      hit = true;
    }
  }
  for (const c of city.containers) {
    if (circleHitsRect(p.x, p.y, r, c)) {
      const nx = Math.max(c.x, Math.min(p.x, c.x + c.w));
      const ny = Math.max(c.y, Math.min(p.y, c.y + c.h));
      let dx = p.x - nx, dy = p.y - ny;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.001) { dx = 0; dy = -1; d = 1; }
      p.x = nx + (dx / d) * r; p.y = ny + (dy / d) * r;
      hit = true;
    }
  }
  if (pointInWater(city, p.x, p.y)) {
    // Shove back toward the beach line (west) or north of the basin.
    if (p.x > 2440) p.x = 2440;
    if (p.y > 2370 && p.x > 2040) p.y = 2370;
    hit = true;
  }
  return hit;
}

export function isOnRoad(x, y) {
  const onV = V_ROADS.some((rx) => Math.abs(x - rx) < ROAD_W / 2);
  const onH = H_ROADS.some((ry) => Math.abs(y - ry) < ROAD_W / 2);
  return onV || onH;
}

export function nearestRoadPoint(x, y) {
  let best = null, bd = 1e9;
  for (const rx of V_ROADS) {
    const d = Math.abs(x - rx);
    if (d < bd) { bd = d; best = { x: rx, y, axis: 'v' }; }
  }
  for (const ry of H_ROADS) {
    const d = Math.abs(y - ry);
    if (d < bd) { bd = d; best = { x, y: ry, axis: 'h' }; }
  }
  return best;
}

// A random point on a road, at least `minDist` from (fx, fy).
export function randomRoadPoint(rng, fx, fy, minDist = 500) {
  for (let tries = 0; tries < 40; tries++) {
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? V_ROADS : H_ROADS);
    const along = randRange(rng, 120, WORLD - 120);
    const x = vertical ? road : along;
    const y = vertical ? along : road;
    if (Math.hypot(x - fx, y - fy) >= minDist) return { x, y };
  }
  return { x: 400, y: 400 };
}

export function roadNameAt(x, y) {
  const v = V_ROADS.reduce((a, b) => (Math.abs(x - b) < Math.abs(x - a) ? b : a), V_ROADS[0]);
  const h = H_ROADS.reduce((a, b) => (Math.abs(y - b) < Math.abs(y - a) ? b : a), H_ROADS[0]);
  const streets = ['Palm Row', 'Coral Ave', 'Sunset Blvd', 'Harbour Rd', 'Bay St', 'Marina Way', 'Cactus Ln', 'Pier St', 'Solmar Ave'];
  const vi = V_ROADS.indexOf(v), hi = H_ROADS.indexOf(h);
  return streets[vi % streets.length] + ' & ' + streets[(hi + 4) % streets.length];
}
