// City: sun-soaked coastal grid — roads, buildings, beach, ocean, palms, lamps.
(function () {
  const S = window.SB;
  function box(w, h, d, color, x, y, z, group) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
  }
  function buildCity(scene) {
    const group = new THREE.Group(); scene.add(group);
    const colliders = []; // {minX,maxX,minZ,maxZ}
    // Ground: grass-green city slab
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(460, 460), new THREE.MeshLambertMaterial({ color: 0x7fae62 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); ground.receiveShadow = true; group.add(ground);
    // Beach + ocean (south edge, +z)
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(460, 70), new THREE.MeshLambertMaterial({ color: 0xe8d49a }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, 195); sand.receiveShadow = true; group.add(sand);
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(460, 120), new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }));
    ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, 0.02, 265); group.add(ocean);
    const ocean2 = new THREE.Mesh(new THREE.PlaneGeometry(460, 120), new THREE.MeshLambertMaterial({ color: 0x2aa5cf, transparent: true, opacity: 0.55 }));
    ocean2.rotation.x = -Math.PI / 2; ocean2.position.set(0, 0.06, 265); group.add(ocean2);
    // Roads: grid every 44 units, asphalt strips with pale centre dashes
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    const dashMat = new THREE.MeshLambertMaterial({ color: 0xd8d8c8 });
    const R = S.CONFIG.roadEvery, half = 200;
    for (let c = -half; c <= half; c += R) {
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(460, 10), roadMat);
      rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.08, c); rx.receiveShadow = true; group.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(10, 460), roadMat);
      rz.rotation.x = -Math.PI / 2; rz.position.set(c, 0.08, 0); rz.receiveShadow = true; group.add(rz);
      for (let d = -200; d <= 200; d += 16) {
        const dx = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), dashMat);
        dx.rotation.x = -Math.PI / 2; dx.position.set(d, 0.12, c); group.add(dx);
        const dz = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 4), dashMat);
        dz.rotation.x = -Math.PI / 2; dz.position.set(c, 0.12, d); group.add(dz);
      }
    }
    // Buildings: one per block, varied heights/colours, windows as thin boxes
    const palette = [0xe8b48a, 0x9fc3e0, 0xf2e3c6, 0xd98a7a, 0xa8c8a0, 0xc9a8d8, 0xe0c090, 0x8ab8c8, 0xf0a0a0, 0xb8d0e8];
    const winMat = new THREE.MeshLambertMaterial({ color: 0x2a4a66 });
    let bi = 0;
    for (let gx = -176; gx <= 176; gx += R) {
      for (let gz = -176; gz <= 132; gz += R) {
        if (Math.abs(gx) < 8 || Math.abs(gz) < 8) continue;
        const h = 8 + ((bi * 37) % 26);
        const col = palette[bi % palette.length]; bi++;
        const cx = gx + 12, cz = gz + 12;
        const b = box(18, h, 18, col, cx, h / 2, cz, group);
        colliders.push({ minX: cx - 9, maxX: cx + 9, minZ: cz - 9, maxZ: cz + 9 });
        const floors = Math.max(1, Math.floor(h / 5));
        for (let f = 0; f < floors; f++) for (let w = -1; w <= 1; w++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.4), winMat);
          win.position.set(cx + w * 6, 3 + f * 5, cz + 9.1); group.add(win);
          const win2 = win.clone(); win2.rotation.y = Math.PI; win2.position.z = cz - 9.1; group.add(win2);
        }
        if (bi % 5 === 0) box(20, 1.2, 20, 0x5a6a72, cx, h + 0.6, cz, group); // roof slab
      }
    }
    // Landmark: Marina tower + lighthouse near the beach
    box(18, 52, 18, 0xf2e3c6, 150, 26, 150, group);
    colliders.push({ minX: 141, maxX: 159, minZ: 141, maxZ: 159 });
    const light = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 26, 10), new THREE.MeshLambertMaterial({ color: 0xf5f5f0 }));
    light.position.set(-180, 13, 185); group.add(light);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 3, 10), new THREE.MeshLambertMaterial({ color: 0xd84a3a }));
    cap.position.set(-180, 27, 185); group.add(cap);
    // Palms along the beach + scattered street trees
    function palm(x, z) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
      trunk.position.set(x, 4.5, z); group.add(trunk);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 4), new THREE.MeshLambertMaterial({ color: 0x2f9e44 }));
        leaf.position.set(x + Math.cos(i * 1.26) * 2, 9.5, z + Math.sin(i * 1.26) * 2);
        leaf.rotation.z = Math.cos(i * 1.26) * 1.1; leaf.rotation.x = -Math.sin(i * 1.26) * 1.1; group.add(leaf);
      }
    }
    for (let x = -200; x <= 200; x += 25) palm(x, 178);
    for (let x = -150; x <= 150; x += 60) palm(x, -170);
    // Street lamps
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x333a40 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    for (let gx = -176; gx <= 176; gx += 44) for (let gz = -176; gz <= 132; gz += 88) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), lampMat);
      pole.position.set(gx + 6, 3.5, gz + 6); group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), bulbMat);
      bulb.position.set(gx + 6, 7.1, gz + 6); group.add(bulb);
    }
    // Beach umbrellas
    for (let x = -160; x <= 160; x += 40) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), lampMat);
      pole.position.set(x, 1.5, 190); group.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(3, 1.4, 8), new THREE.MeshLambertMaterial({ color: (x % 80 === 0) ? 0xe84a5f : 0x2aa5cf }));
      top.position.set(x, 3.4, 190); group.add(top);
    }
    // Sun + sky handled in main; return colliders + ocean mesh for animation
    return { group, colliders, ocean, ocean2 };
  }
  S.City = { buildCity };
})();
