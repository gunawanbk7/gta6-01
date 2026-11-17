// player.js — Jax Marlowe on foot and behind the wheel: arcade car physics with
// drift, stealing, punching and shooting. The player object is the single source
// of truth for position, health, money and wanted level.
import { clamp, dist, angleDiff } from './util.js';
import { resolveCircle, isOnRoad } from './city.js';
import { VEHICLES, makeCar } from './entities.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    hp: 100, money: 250,
    wanted: 0, wantedT: 0, // seconds since last crime / police sighting
    car: null, // the car being driven
    onFootSpeed: 0,
    punchT: 0, shootT: 0, hasPistol: false,
    invulnT: 0, // brief grace after being busted/wasted
    moving: false,
    name: 'Jax Marlowe',
  };
}

const FOOT_R = 13;

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  p.punchT = Math.max(0, p.punchT - dt);
  p.shootT = Math.max(0, p.shootT - dt);
  p.invulnT = Math.max(0, p.invulnT - dt);
  p.wantedT += dt;

  if (p.car) {
    updateDriving(G, dt);
  } else {
    updateOnFoot(G, dt);
  }

  // Health regen when calm.
  if (p.wanted === 0 && p.hp > 0 && p.hp < 100) p.hp = Math.min(100, p.hp + 2.5 * dt);

  // Wanted decay: no police near and no recent crime for a while.
  if (p.wanted > 0 && p.wantedT > 14) {
    const near = G.police.cruisers.some((c) => dist(c.x, c.y, p.x, p.y) < 520) ||
      G.peds.list.some((pd) => pd.isCop && !pd.dead && dist(pd.x, pd.y, p.x, p.y) < 420);
    if (!near) {
      p.wantedT = 0;
      p.wanted = Math.max(0, p.wanted - 1);
      if (p.wanted === 0) G.police.clear();
    }
  }
}

function updateOnFoot(G, dt) {
  const p = G.player;
  const mv = G.input.moveVector();
  const run = G.input.down('Shift');
  const speed = run ? 265 : 165;
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    p.angle = Math.atan2(mv.y, mv.x);
    const nx = p.x + mv.x * speed * dt;
    const ny = p.y + mv.y * speed * dt;
    const oldX = p.x, oldY = p.y;
    p.x = nx; p.y = ny;
    if (resolveCircle(G.city, p, FOOT_R)) {
      // Try sliding along one axis.
      p.x = oldX; p.y = ny;
      if (resolveCircle(G.city, p, FOOT_R)) { p.x = nx; p.y = oldY; resolveCircle(G.city, p, FOOT_R); }
    }
  }
  // Aim at the mouse when the pistol is out.
  if (p.hasPistol && G.mouseWorld) {
    p.angle = Math.atan2(G.mouseWorld.y - p.y, G.mouseWorld.x - p.x);
  }
  // Enter a car.
  if (G.input.hit('e')) tryEnterCar(G);
  // Punch.
  if (G.input.hit(' ') || G.input.hit('f')) doPunch(G);
  // Shoot with the mouse.
  if (p.hasPistol && G.input.mouse.clicked && p.shootT <= 0) doShoot(G);
}

function updateDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  const input = G.input;
  const spec = car.spec;
  const fwd = input.down('w', 'ArrowUp') ? 1 : 0;
  const back = input.down('s', 'ArrowDown') ? 1 : 0;
  const hand = input.down(' ');
  if (fwd) car.speed += spec.accel * dt;
  if (back) car.speed -= (car.speed > 5 ? spec.accel * 1.4 : spec.accel * 0.55) * dt;
  if (!fwd && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  if (hand) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 500 * dt);
  car.speed = clamp(car.speed, -90, spec.top);
  const steer = (input.down('a', 'ArrowLeft') ? -1 : 0) + (input.down('d', 'ArrowRight') ? 1 : 0);
  const grip = spec.grip * (hand ? 1.9 : 1);
  if (Math.abs(car.speed) > 8) {
    car.angle += steer * grip * dt * Math.sign(car.speed) * clamp(Math.abs(car.speed) / 120, 0.35, 1);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx; car.y = ny;
  const hitWall = resolveCircle(G.city, car, 19);
  if (hitWall) {
    if (Math.abs(car.speed) > 120) {
      G.audio.crash(Math.abs(car.speed) / 300);
      G.addShake(Math.abs(car.speed) / 300);
      G.spawnParticles(car.x, car.y, 10, '#c9c9c9');
      p.hp -= Math.abs(car.speed) * 0.02;
    }
    car.speed *= 0.45;
  }
  // Skid marks + smoke when drifting hard.
  const lateral = Math.abs(steer) * Math.abs(car.speed);
  if ((hand && Math.abs(car.speed) > 60) || lateral > 260) {
    car.skid = 0.5;
    G.addSkid(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
    if (Math.random() < 0.4) G.spawnParticles(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 1, '#9a9a9a');
  }
  car.skid = Math.max(0, car.skid - dt);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  p.moving = Math.abs(car.speed) > 10;
  G.audio.setEngine(Math.abs(car.speed) / spec.top, true);
  // Run over pedestrians (a crime).
  for (const ped of G.peds.list) {
    if (ped.dead || ped.inCar || ped.isCop) continue;
    if (dist(ped.x, ped.y, car.x, car.y) < 26 && Math.abs(car.speed) > 40) {
      ped.dead = true; ped.deadT = 0;
      G.spawnParticles(ped.x, ped.y, 8, '#c23b4e');
      G.audio.punch();
      addWanted(G, 1);
      G.peds.scare(ped.x, ped.y, 300);
    }
  }
  // Bump traffic cars.
  for (const o of [...G.traffic.cars, ...G.police.cruisers]) {
    if (o === car || o === p.car) continue;
    const d = dist(o.x, o.y, car.x, car.y);
    if (d < 44 && d > 0.01) {
      const push = (44 - d) / 2;
      const nx2 = (o.x - car.x) / d, ny2 = (o.y - car.y) / d;
      o.x += nx2 * push; o.y += ny2 * push;
      car.x -= nx2 * push; car.y -= ny2 * push;
      if (Math.abs(car.speed) > 100) {
        G.audio.crash(0.6);
        car.speed *= 0.6;
        if (o.traffic) { o.traffic.speed = 0; }
      }
    }
  }
  // Exit the car.
  if (G.input.hit('e')) exitCar(G);
}

function tryEnterCar(G) {
  const p = G.player;
  const all = [...G.traffic.cars, ...G.police.cruisers, ...G.parkedCars];
  let best = null, bd = 64;
  for (const c of all) {
    const d = dist(c.x, c.y, p.x, p.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  // Stealing a traffic or police car is a crime; parked cars are fair game.
  if (best.traffic || best.isPolice) {
    addWanted(G, 1);
    if (best.traffic) {
      // The driver bails out and runs.
      const driver = G.peds.spawn(best.x + 30, best.y + 30);
      driver.flee = 3; driver.fleeX = best.x; driver.fleeY = best.y;
      best.traffic = null;
    }
  }
  if (best.isPolice) {
    // Cops notice their cruiser being taken.
    addWanted(G, 1);
  }
  p.car = best;
  best.isPlayer = true;
  G.parkedCars = G.parkedCars.filter((c) => c !== best);
  G.traffic.cars = G.traffic.cars.filter((c) => c !== best);
  G.police.cruisers = G.police.cruisers.filter((c) => c !== best);
  G.audio.blip(520, 0.08, 'square', 0.1);
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 30;
  p.y = car.y + Math.sin(side) * 30;
  resolveCircle(G.city, p, FOOT_R);
  car.isPlayer = false;
  car.speed = 0;
  G.parkedCars.push(car);
  p.car = null;
  G.audio.setEngine(0, false);
}

function doPunch(G) {
  const p = G.player;
  if (p.punchT > 0) return;
  p.punchT = 0.35;
  G.audio.punch();
  const reach = 40;
  for (const ped of G.peds.list) {
    if (ped.dead || ped.inCar) continue;
    const d = dist(ped.x, ped.y, p.x, p.y);
    if (d < reach) {
      ped.hp -= 20;
      G.spawnParticles(ped.x, ped.y, 6, '#ffd23c');
      if (ped.hp <= 0) {
        ped.dead = true; ped.deadT = 0;
        if (ped.isCop) addWanted(G, 2);
        else if (!ped.armed) addWanted(G, 1);
        G.peds.scare(ped.x, ped.y, 260);
      } else if (ped.isCop || ped.armed) {
        // They fight back.
        p.hp -= 6;
      }
    }
  }
}

function doShoot(G) {
  const p = G.player;
  p.shootT = 0.28;
  G.audio.shoot();
  const range = 460;
  const mx = G.mouseWorld.x, my = G.mouseWorld.y;
  const aim = Math.atan2(my - p.y, mx - p.x);
  // Muzzle flash + tracer.
  G.spawnParticles(p.x + Math.cos(aim) * 22, p.y + Math.sin(aim) * 22, 3, '#ffd23c');
  G.addTracer(p.x, p.y, p.x + Math.cos(aim) * range, p.y + Math.sin(aim) * range);
  // Find the nearest ped / cop along the shot line.
  let best = null, bd = range;
  for (const ped of G.peds.list) {
    if (ped.dead || ped.inCar) continue;
    const dx = ped.x - p.x, dy = ped.y - p.y;
    const along = dx * Math.cos(aim) + dy * Math.sin(aim);
    const side = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
    if (along > 0 && along < bd && side < 18) { bd = along; best = ped; }
  }
  if (best) {
    best.hp -= 34;
    G.spawnParticles(best.x, best.y, 8, '#c23b4e');
    if (best.hp <= 0) {
      best.dead = true; best.deadT = 0;
      if (best.isCop) addWanted(G, 2);
      else if (!best.armed) addWanted(G, 1);
      G.peds.scare(best.x, best.y, 300);
    }
    G.missionEvent('shot-hit', best);
  } else {
    G.missionEvent('shot-miss', null);
  }
  G.peds.scare(p.x, p.y, 200);
  if (Math.random() < 0.5) addWanted(G, 1);
}

export function addWanted(G, stars) {
  const p = G.player;
  if (p.wanted >= 5) return;
  p.wanted = Math.min(5, p.wanted + stars);
  p.wantedT = 0;
  G.police.maintain(p.wanted, p.x, p.y);
  G.audio.phone();
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.invulnT > 0 || p.hp <= 0) return;
  p.hp -= amount;
  if (p.hp <= 0) {
    p.hp = 0;
    G.gameOver('wasted');
  }
}
