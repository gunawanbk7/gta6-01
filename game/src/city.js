// city.js — builds Solmar Bay: street grid, buildings, beach, ocean, palms,
// street props and lighting. Registers building AABBs in SB.colliders.
var SB = SB || {};
SB.colliders = [];   // {x0,z0,x1,z1}
SB.city = (function () {
  var ROAD_AT = [-80, -40, 0, 40, 80];
  var CITY = 120;    // half-extent of the built-up area

  function canvasTexture(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    return t;
  }
  function buildingTexture(base, lit) {
    return canvasTexture(128, 256, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (var y = 14; y < h - 10; y += 26) {
        for (var x = 10; x < w - 10; x += 22) {
          g.fillStyle = Math.random() < 0.55 ? lit : '#1d2b38';
          g.fillRect(x, y, 13, 16);
        }
      }
    });
  }
  function roadTexture() {
    return canvasTexture(128, 128, function (g, w, h) {
      g.fillStyle = '#2b2f36'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f5d76e'; g.fillRect(w / 2 - 2, 0, 4, h);
      g.fillStyle = '#e8e8e8'; g.fillRect(6, 0, 2, h); g.fillRect(w - 8, 0, 2, h);
    });
  }

  function addBox(scene, mat, w, h, d, x, y, z, collide) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); scene.add(m);
    if (collide) SB.colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    return m;
  }

  function build(scene) {
    SB.colliders.length = 0;
    // Sky, sun, fog
    scene.background = new THREE.Color(0x87c5e8);
    scene.fog = new THREE.Fog(0x9fd0ea, 180, 420);
    var sun = new THREE.DirectionalLight(0xfff2d0, 1.25);
    sun.position.set(90, 140, 60); scene.add(sun);
    scene.add(new THREE.AmbientLight(0xbfd9ee, 0.75));
    var hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3d5a3a, 0.5);
    scene.add(hemi);

    // Ground slab (grass/concrete) and the beach + ocean to the south (+z)
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560),
      new THREE.MeshLambertMaterial({ color: 0x5d8a4a }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, -40); scene.add(ground);
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(560, 70),
      new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0, 135); scene.add(sand);
    var ocean = new THREE.Mesh(new THREE.PlaneGeometry(560, 220),
      new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }));
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -0.4, 280); scene.add(ocean);
    var pier = addBox(scene, new THREE.MeshLambertMaterial({ color: 0x8a6a42 }), 10, 1, 60, -60, 0.4, 185, false);

    // Roads: dark strips along every grid line, with a lighter centre line texture
    var roadMat = new THREE.MeshLambertMaterial({ map: roadTexture() });
    roadMat.map.wrapS = roadMat.map.wrapT = THREE.RepeatWrapping;
    ROAD_AT.forEach(function (c) {
      var ns = new THREE.Mesh(new THREE.PlaneGeometry(10, 260), roadMat.clone());
      ns.material.map = roadTexture(); ns.material.map.repeat.set(1, 20);
      ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0.02, 0); scene.add(ns);
      var ew = new THREE.Mesh(new THREE.PlaneGeometry(260, 10), roadMat.clone());
      ew.material.map = roadTexture(); ew.material.map.repeat.set(20, 1);
      ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.02, c); scene.add(ew);
    });

    // Buildings inside each block, with varied heights and colours
    var palette = ['#c96f4a', '#d9a441', '#7fa3b8', '#b8576a', '#8fae7a', '#a98fc7', '#e0d6c2', '#5f7f9e'];
    var lit = ['#ffe9a8', '#cfe8ff', '#ffd9a0'];
    var rng = 7;
    function rnd() { rng = (rng * 16807) % 2147483647; return rng / 2147483647; }
    for (var bx = 0; bx < 4; bx++) {
      for (var bz = 0; bz < 4; bz++) {
        var cx = -60 + bx * 40, cz = -60 + bz * 40;
        var n = 1 + Math.floor(rnd() * 2);
        for (var k = 0; k < n; k++) {
          var w = 12 + rnd() * 10, d = 12 + rnd() * 10, h = 8 + rnd() * 30;
          var ox = (k === 0 ? -6 : 7) + (rnd() - 0.5) * 4;
          var oz = (k === 0 ? -6 : 7) + (rnd() - 0.5) * 4;
          var tex = buildingTexture(palette[Math.floor(rnd() * palette.length)],
            lit[Math.floor(rnd() * lit.length)]);
          addBox(scene, new THREE.MeshLambertMaterial({ map: tex }), w, h, d,
            cx + ox, h / 2, cz + oz, true);
        }
      }
    }
    // Landmark: the Solmar Tower at the plaza centre, and the Bay Bank
    var tower = addBox(scene, new THREE.MeshLambertMaterial({ map: buildingTexture('#4a6f8f', '#ffe9a8') }),
      22, 62, 22, 20, 31, -20, true);
    tower.name = 'Solmar Tower';
    addBox(scene, new THREE.MeshLambertMaterial({ color: 0xd8c98f }), 20, 12, 16, -60, 6, 60, true).name = 'Bay Bank';

    // Palm trees along the beachfront and the marina road
    var trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a33 });
    var leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
    function palm(x, z) {
      var g = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
      trunk.position.y = 3.5; g.add(trunk);
      for (var i = 0; i < 5; i++) {
        var leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 4), leafMat);
        var a = i / 5 * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.1, 7.2, Math.sin(a) * 1.1);
        leaf.rotation.z = Math.cos(a) * 0.9; leaf.rotation.x = -Math.sin(a) * 0.9;
        g.add(leaf);
      }
      g.position.set(x, 0, z); scene.add(g);
    }
    for (var px = -100; px <= 100; px += 25) { palm(px, 108); palm(px + 12, 96); }
    for (var pz = -80; pz <= 80; pz += 40) palm(-96, pz);

    // Street lamps along the main avenue
    var lampMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
    var bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    ROAD_AT.forEach(function (c) {
      [-100, -60, -20, 20, 60, 100].forEach(function (t) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
        pole.position.set(c + 5.6, 3, t); scene.add(pole);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
        bulb.position.set(c + 5.6, 6.1, t); scene.add(bulb);
      });
    });

    // Boardwalk benches and crates as small props near the marina
    for (var i = 0; i < 8; i++) {
      addBox(scene, new THREE.MeshLambertMaterial({ color: 0x9a7b4f }), 2.4, 0.5, 0.8,
        -70 + i * 5, 0.5, 112, true);
    }
    return { cityHalf: CITY, roads: ROAD_AT };
  }

  // Circle (radius r) vs building AABB push-out. Returns corrected x/z.
  function collide(x, z, r) {
    for (var i = 0; i < SB.colliders.length; i++) {
      var b = SB.colliders[i];
      var nx = Math.max(b.x0, Math.min(x, b.x1));
      var nz = Math.max(b.z0, Math.min(z, b.z1));
      var dx = x - nx, dz = z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 1e-6) { x = b.x1 + r; continue; }
        var d = Math.sqrt(d2);
        x = nx + dx / d * r; z = nz + dz / d * r;
      }
    }
    x = Math.max(-170, Math.min(170, x));
    z = Math.max(-170, Math.min(165, z));
    return { x: x, z: z };
  }

  return { build: build, collide: collide, roads: ROAD_AT };
})();
