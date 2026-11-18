// Solmar Bay itself: a sun-soaked coastal city built from three.js boxes,
// canvas-painted facades, a grid of roads, a beach, a pier and the ocean.
// Everything is procedural; no image, font or model is loaded from disk.
import { mulberry32, pick, randRange } from './util.js';

export const CITY = {
  half: 180,          // city blocks run from -180 to +180
  roadGap: 40,        // distance between parallel roads
  roadWidth: 11,
  beachX: 168,        // sand starts here
  oceanX: 196,        // water starts here
  bound: 210,
};

function facadeTexture(rng, base, floors) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 0, 128, 10);
  const cols = 4, rows = Math.max(3, floors);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < 0.35;
      g.fillStyle = lit ? '#ffe9a8' : 'rgba(20,40,70,0.85)';
      g.fillRect(10 + x * 30, 22 + y * Math.floor(220 / rows), 18, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(4, 4, 248, 88);
  g.fillStyle = fg; g.font = 'bold 34px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const colliders = [];
  const roadLines = [];
  for (let v = -160; v <= 160; v += CITY.roadGap) roadLines.push(v);

  // Sun, sky and light.
  scene.background = new THREE.Color(0x87c5e8);
  scene.fog = new THREE.Fog(0x9fd0ea, 260, 620);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.1));
  const skyGeo = new THREE.SphereGeometry(700, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x8ec9ee, side: THREE.BackSide, fog: false });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Ground: pale concrete for the city, sand on the beach strip.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 440),
    new THREE.MeshLambertMaterial({ color: 0xb8b0a0 })
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0; ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 440),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a })
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(CITY.beachX + 22, 0.05, 0);
  group.add(sand);

  // Ocean: a big animated blue plane east of the sand.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 480),
    new THREE.MeshLambertMaterial({ color: 0x1e7fa8, transparent: true, opacity: 0.94 })
  );
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(CITY.oceanX + 150, 0.12, 0);
  group.add(ocean);

  // Roads: dark asphalt strips with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d2a0 });
  for (const v of roadLines) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, 380), roadMat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(v, 0.06, 0); group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(380, CITY.roadWidth), roadMat);
    ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.06, v); group.add(ew);
    for (let d = -170; d <= 170; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.4), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(v, 0.08, d); group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), dashMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(d, 0.08, v); group.add(dash2);
    }
  }

  // Buildings, one per block, skipping the central plaza, the pier road and the beach.
  const palette = ['#e8b48a', '#d98a7a', '#a8c8d8', '#e8d8a0', '#c8a8d8', '#f0e8d8', '#9ab8a0', '#e0a0a0'];
  const hotelColors = ['#f2c14e', '#e88a5a'];
  let hotel = 0;
  for (let bx = -160; bx <= 120; bx += CITY.roadGap) {
    for (let bz = -160; bz <= 160; bz += CITY.roadGap) {
      const cx = bx + 20, cz = bz + 20;
      if (Math.abs(cx) < 32 && Math.abs(cz) < 32) continue; // Solmar Plaza
      if (rng() < 0.12) continue; // empty lot / car park
      const w = randRange(rng, 16, 24), d = randRange(rng, 16, 24);
      const isHotel = hotel < 2 && cx > 100 && Math.abs(cz) < 60;
      const h = isHotel ? randRange(rng, 55, 75) : randRange(rng, 10, 42);
      if (isHotel) hotel++;
      const color = isHotel ? pick(rng, hotelColors) : pick(rng, palette);
      const tex = facadeTexture(rng, color, Math.floor(h / 6));
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx, h / 2, cz);
      group.add(b);
      // Roof trim.
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 1, 1, d + 1),
        new THREE.MeshLambertMaterial({ color: 0x5a5148 })
      );
      roof.position.set(cx, h + 0.5, cz); group.add(roof);
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    }
  }

  // Solmar Plaza at the centre: fountain, benches, palms.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 11, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x7fb8d8 })
  );
  plaza.position.set(0, 0.6, 0); group.add(plaza);
  const plazaDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 13, 0.3, 24),
    new THREE.MeshLambertMaterial({ color: 0xd8cfb8 })
  );
  plazaDisc.position.set(0, 0.15, 0); group.add(plazaDisc);
  colliders.push({ minX: -11, maxX: 11, minZ: -11, maxZ: 11 });

  // Palm trees along the beach and the plaza.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5a });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.y = 3.5; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
  }
  for (let z = -170; z <= 170; z += 24) palm(CITY.beachX + 4, z + randRange(rng, -4, 4));
  palm(-14, -14); palm(14, 14); palm(-14, 14); palm(14, -14);
  for (let i = 0; i < 8; i++) palm(randRange(rng, -150, 140), randRange(rng, -150, 150));

  // The pier: wooden boards reaching into the ocean at z = 0.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 12), pierMat);
  pier.position.set(CITY.oceanX + 28, 0.7, 0); group.add(pier);
  for (let x = CITY.oceanX; x < CITY.oceanX + 60; x += 10) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.4, 6), pierMat);
    post.position.set(x, 0, -5); group.add(post);
    const post2 = post.clone(); post2.position.z = 5; group.add(post2);
  }
  colliders.push({ minX: CITY.oceanX - 2, maxX: CITY.oceanX + 62, minZ: -6, maxZ: 6 });

  // Billboards with the city's own names.
  function billboard(x, z, ry, text, bg, fg) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 8),
      new THREE.MeshBasicMaterial({ map: signTexture(text, bg, fg) })
    );
    m.position.set(x, 16, z); m.rotation.y = ry; group.add(m);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 12, 6),
      new THREE.MeshLambertMaterial({ color: 0x666666 }));
    pole.position.set(x, 6, z); group.add(pole);
  }
  billboard(-60, -118, 0, 'SOLMAR BAY', '#123a5a', '#ffd94e');
  billboard(100, 118, Math.PI, 'MARINA HOTEL', '#7a2a3a', '#ffffff');
  billboard(140, -60, -Math.PI / 2, 'PIER 9', '#1a5a3a', '#ffffff');

  // Street lamps along every road.
  const lampPole = new THREE.MeshLambertMaterial({ color: 0x333a42 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const v of roadLines) {
    for (let d = -150; d <= 150; d += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 5), lampPole);
      pole.position.set(v + 6.5, 3.5, d); group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampGlow);
      bulb.position.set(v + 6.5, 7.2, d); group.add(bulb);
    }
  }

  // A few clouds drifting over the bay.
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(randRange(rng, 6, 11), 8, 6), cloudMat);
      s.position.set(j * 8 - 8, randRange(rng, 0, 2), randRange(rng, -3, 3));
      s.scale.y = 0.45; cl.add(s);
    }
    cl.position.set(randRange(rng, -220, 220), randRange(rng, 90, 130), randRange(rng, -220, 220));
    group.add(cl); clouds.push(cl);
  }

  scene.add(group);
  return {
    group, colliders, roadLines, ocean, clouds,
    update(dt, t) {
      ocean.position.y = 0.12 + Math.sin(t * 0.7) * 0.15;
      for (const c of clouds) { c.position.x += dt * 1.2; if (c.position.x > 260) c.position.x = -260; }
    },
  };
}
