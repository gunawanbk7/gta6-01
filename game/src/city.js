// Solmar Bay — the city itself: ground, road grid, buildings with lit
// windows, beach, ocean, palms, lamps and mission landmarks. Exports the
// collision boxes and the named places the missions use.
// three.min.js is the UMD build: index.html loads it as a classic script
// and it lands on window.THREE. Modules read it from there.
const THREE = window.THREE;
import { WORLD, COLORS } from './config.js';
import { mulberry32, pick, range, intRange } from './random.js';

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = rng() < 0.35;
      g.fillStyle = lit ? '#ffe9a8' : '#2e4a5e';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = 'bold 56px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture(horizontal) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3d42';
  g.fillRect(0, 0, 64, 512);
  g.fillStyle = '#d8d3a0';
  if (horizontal) {
    g.fillRect(0, 4, 64, 3);
    g.fillRect(0, 57, 64, 3);
    for (let y = 0; y < 512; y += 64) g.fillRect(8, 30, 32, 4);
  } else {
    g.fillRect(4, 0, 3, 512);
    g.fillRect(57, 0, 3, 512);
    for (let y = 0; y < 512; y += 64) g.fillRect(30, y + 8, 4, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Tile along the road's length: 6 repeats of the dash pattern.
  tex.repeat.set(horizontal ? 6 : 1, horizontal ? 1 : 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, mat = null) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat || new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildCity(scene, seed = 7) {
  const rng = mulberry32(seed);
  const colliders = [];
  const parkedSpots = [];
  const landmarks = {};

  // --- sky, sun, fog -------------------------------------------------------
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.sky, 220, 520);
  const sun = new THREE.DirectionalLight(COLORS.sun, 1.6);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9));

  // --- ground, sand, ocean --------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, WORLD.half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: COLORS.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -10);
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2 + 80, 40),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, WORLD.beachZ + 8);
  scene.add(sand);

  const oceanGeo = new THREE.PlaneGeometry(560, 220, 48, 16);
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshPhongMaterial({ color: COLORS.ocean, shininess: 90, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.05, WORLD.oceanZ + 108);
  scene.add(ocean);

  // --- road grid (asphalt texture carries the dashes and edge lines) ---------
  const roadMatNS = new THREE.MeshLambertMaterial({ map: roadTexture(false) });
  const roadMatEW = new THREE.MeshLambertMaterial({ map: roadTexture(true) });
  const roadCoords = [];
  for (let c = -180; c <= 180; c += WORLD.roadGap) roadCoords.push(c);
  for (const c of roadCoords) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.half * 2), roadMatNS);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.03, 0);
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.half * 2, WORLD.roadWidth), roadMatEW);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.03, c);
    scene.add(ew);
  }

  // --- buildings ------------------------------------------------------------
  const winTex = windowTexture(rng);
  const winTex2 = windowTexture(rng);
  const blockCenters = [];
  for (let x = -150; x <= 150; x += 60) {
    for (let z = -150; z <= 120; z += 60) blockCenters.push([x, z]);
  }
  for (const [bx, bz] of blockCenters) {
    const downtown = Math.abs(bx) < 70 && Math.abs(bz) < 70;
    const count = downtown ? 2 : intRange(rng, 1, 2);
    for (let i = 0; i < count; i++) {
      const w = range(rng, 14, 26);
      const d = range(rng, 14, 26);
      const h = downtown ? range(rng, 18, 46) : range(rng, 8, 22);
      const ox = count === 1 ? 0 : (i === 0 ? -11 : 11);
      const oz = count === 1 ? 0 : (i === 0 ? 9 : -9);
      const x = bx + ox;
      const z = bz + oz;
      const color = pick(rng, COLORS.building);
      const mat = new THREE.MeshLambertMaterial({
        color,
        map: rng() < 0.8 ? (rng() < 0.5 ? winTex : winTex2) : null,
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, h / 2, z);
      scene.add(b);
      // rooftop box
      const roof = box(w * 0.3, 1.6, d * 0.3, 0x555555, x, h + 0.8, z);
      scene.add(roof);
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
  }

  // --- landmarks (mission places, with signs) --------------------------------
  function landmark(name, x, z, w, h, d, color, sign, signBg, signFg) {
    const mat = new THREE.MeshLambertMaterial({ color });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    scene.add(b);
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w * 0.9, 18), 4.5),
      new THREE.MeshBasicMaterial({ map: signTexture(sign, signBg, signFg) }),
    );
    signMesh.position.set(x, h - 2.5, z + d / 2 + 0.15);
    scene.add(signMesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    landmarks[name] = { x, z, h };
    return { x, z };
  }
  landmark('bank', -30, -90, 30, 26, 24, 0xe8e0c8, 'SOLMAR BANK', '#20344d', '#ffd76a');
  landmark('garage', 90, 30, 26, 12, 20, 0xb84a3a, "MARCO'S GARAGE", '#3a1512', '#ffd76a');
  landmark('safehouse', -90, 90, 20, 14, 18, 0x4a7a5a, 'SAFEHOUSE', '#14291c', '#a8e8b0');
  landmark('pier', 30, 160, 10, 6, 8, 0x8a6a45, 'PIER 7', '#2a1f14', '#ffe9a8');
  landmarks.beach = { x: 60, z: 165, h: 0 };
  landmarks.plaza = { x: 0, z: 0, h: 0 };

  // --- pier deck into the ocean ----------------------------------------------
  const pierDeck = box(8, 0.6, 34, 0x9a7a52, 30, 0.3, 186);
  scene.add(pierDeck);

  // --- palms along the beach and avenues --------------------------------------
  const palmTrunk = new THREE.MeshLambertMaterial({ color: COLORS.trunk });
  const palmLeaf = new THREE.MeshLambertMaterial({ color: COLORS.palm });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), palmTrunk);
    trunk.position.y = 3.5;
    g.add(trunk);
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), palmLeaf);
      const a = (i / 4) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.4, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }
  for (let x = -170; x <= 170; x += 30) palm(x + range(rng, -4, 4), WORLD.beachZ + 2);
  for (let x = -150; x <= 150; x += 120) {
    palm(x + 8, -58);
    palm(x - 8, 62);
  }

  // --- beach umbrellas ---------------------------------------------------------
  const umbrellaColors = [0xff6a5e, 0xffd76a, 0x6ac8ff, 0xff8ac8];
  for (let i = 0; i < 10; i++) {
    const x = range(rng, -150, 150);
    const z = range(rng, WORLD.beachZ + 3, WORLD.beachZ + 22);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    pole.position.set(x, 1.3, z);
    scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.1, 8),
      new THREE.MeshLambertMaterial({ color: pick(rng, umbrellaColors) }));
    top.position.set(x, 3, z);
    scene.add(top);
  }

  // --- street lamps ------------------------------------------------------------
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const c of roadCoords) {
    for (let t = -150; t <= 150; t += 120) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 5), lampMat);
      pole.position.set(c + WORLD.roadWidth / 2 + 1, 3, t);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
      bulb.position.set(c + WORLD.roadWidth / 2 + 1, 6.1, t);
      scene.add(bulb);
    }
  }

  // --- parked cars along the roads ----------------------------------------------
  for (let i = 0; i < 14; i++) {
    const along = pick(rng, roadCoords);
    const cross = pick(rng, roadCoords);
    const vertical = rng() < 0.5;
    const x = vertical ? along + WORLD.roadWidth / 2 + 2.2 : cross + range(rng, -40, 40);
    const z = vertical ? cross + range(rng, -40, 40) : along + WORLD.roadWidth / 2 + 2.2;
    if (Math.abs(z) > WORLD.beachZ - 6) continue;
    parkedSpots.push({ x, z, angle: vertical ? Math.PI / 2 : 0 });
  }
  // The mission-1 getaway car, parked right by the plaza.
  parkedSpots.push({ x: 8, z: 14, angle: Math.PI / 2, mission: 1 });

  return {
    colliders,
    parkedSpots,
    landmarks,
    ocean,
    oceanGeo,
    update(t) {
      // Gentle swell on the ocean surface.
      const pos = oceanGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        pos.setZ(i, Math.sin(px * 0.08 + t * 1.2) * 0.5 + Math.cos(py * 0.1 + t * 0.8) * 0.4);
      }
      pos.needsUpdate = true;
      oceanGeo.computeVertexNormals();
    },
  };
}
