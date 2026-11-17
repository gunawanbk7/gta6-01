// entities.js — the living city: traffic cars that follow the road grid, pedestrians
// on the sidewalks, and the police who respond to the wanted level. All movement is
// plain arithmetic on the city grid; no physics library.
import { mulberry32, randRange, pick, clamp, dist, angleDiff, circleHitsRect } from './util.js';
import { V_ROADS, H_ROADS, ROAD_W, isOnRoad, randomRoadPoint, resolveCircle } from './city.js';

export const VEHICLES = {
  sedan:   { name: 'Solano Sedan',   color: '#5b7fa6', top: 240, accel: 300, grip: 2.6, len: 46, wid: 22 },
  taxi:    { name: 'Bay Taxi',      color: '#e8b93c', top: 235, accel: 290, grip: 2.6, len: 46, wid: 22 },
  van:     { name: 'Cargo Van',     color: '#8a8f96', top: 200, accel: 230, grip: 2.2, len: 54, wid: 24 },
  sports:  { name: 'Comet GT',      color: '#c23b4e', top: 330, accel: 430, grip: 3.4, len: 48, wid: 22 },
  pickup:  { name: 'Dune Pickup',   color: '#4f8a5f', top: 225, accel: 280, grip: 2.4, len: 50, wid: 24 },
  classic: { name: 'Marina Classic',color: '#d97b3f', top: 205, accel: 250, grip: 2.3, len: 48, wid: 22 },
  police:  { name: 'Interceptor',   color: '#2b3a4d', top: 300, accel: 380, grip: 3.2, len: 48, wid: 22 },
  armored: { name: 'Vault Hauler',  color: '#6b6f75', top: 190, accel: 210, grip: 2.0, len: 58, wid: 26 },
};

const TRAFFIC_COLORS = ['#5b7fa6', '#a65b5b', '#5f8a6b', '#b3a05f', '#7a6ba6', '#8a8f96', '#c2c7cc', '#3f5a6b'];

export function makeCar(type, x, y, angle = 0) {
  const spec = VEHICLES[type] || VEHICLES.sedan;
  return {
    type, spec, x, y, angle, speed: 0,
    driver: null, // pedestrian driving it, if any
    isPlayer: false, isPolice: type === 'police',
    skid: 0, crashed: 0, id: Math.random().toString(36).slice(2, 8),
  };
}

export class Traffic {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cars = [];
  }

  spawnInitial(n, px, py) {
    for (let i = 0; i < n; i++) {
      const p = randomRoadPoint(this.rng, px, py, 250);
      this.spawnCar(p.x, p.y);
    }
  }

  spawnCar(x, y) {
    const vertical = this.rng() < 0.5;
    const type = pick(this.rng, ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'classic']);
    const car = makeCar(type, x, y, 0);
    car.traffic = {
      axis: vertical ? 'v' : 'h',
      dir: this.rng() < 0.5 ? 1 : -1,
      speed: randRange(this.rng, 90, 150),
      lane: (this.rng() < 0.5 ? -1 : 1) * 15,
    };
    // Snap onto the nearest road of the chosen axis.
    if (vertical) {
      const rx = V_ROADS.reduce((a, b) => (Math.abs(x - b) < Math.abs(x - a) ? b : a), V_ROADS[0]);
      car.x = rx + car.traffic.lane;
      car.angle = car.traffic.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ry = H_ROADS.reduce((a, b) => (Math.abs(y - b) < Math.abs(y - a) ? b : a), H_ROADS[0]);
      car.y = ry + car.traffic.lane;
      car.angle = car.traffic.dir > 0 ? 0 : Math.PI;
    }
    this.cars.push(car);
    return car;
  }

  // Keep traffic near the player: despawn far cars, spawn new ones on nearby roads.
  maintain(px, py, target = 14) {
    this.cars = this.cars.filter((c) => dist(c.x, c.y, px, py) < 1400);
    let guard = 0;
    while (this.cars.length < target && guard++ < 8) {
      const p = randomRoadPoint(this.rng, px, py, 500);
      this.spawnCar(p.x, p.y);
    }
  }

  update(dt, player, others) {
    for (const car of this.cars) {
      const t = car.traffic;
      if (!t) continue;
      // Stop for a car directly ahead.
      let blocked = false;
      for (const o of others) {
        if (o === car || o.traffic) continue;
        const dx = o.x - car.x, dy = o.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 70 && side < 26) { blocked = true; break; }
      }
      if (player.car === car) continue;
      const speed = blocked ? 0 : t.speed;
      const step = speed * dt;
      if (t.axis === 'v') car.y += t.dir * step;
      else car.x += t.dir * step;
      // At an intersection, sometimes turn onto the crossing road.
      const roads = t.axis === 'v' ? H_ROADS : V_ROADS;
      const along = t.axis === 'v' ? car.y : car.x;
      for (const r of roads) {
        if (Math.abs(along - r) < 3 && this.rng() < 0.35) {
          const cross = this.rng() < 0.5;
          if (t.axis === 'v') {
            car.y = r;
            if (cross) { t.axis = 'h'; t.dir = this.rng() < 0.5 ? 1 : -1; car.x = car.x; }
          } else {
            car.x = r;
            if (cross) { t.axis = 'v'; t.dir = this.rng() < 0.5 ? 1 : -1; }
          }
          car.angle = t.axis === 'v' ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
          const lane = (this.rng() < 0.5 ? -1 : 1) * 15;
          t.lane = lane;
          if (t.axis === 'v') car.x = (t.axis === 'v' ? nearestRoadCoord(car.x, V_ROADS) : car.x) + lane;
          else car.y = nearestRoadCoord(car.y, H_ROADS) + lane;
          break;
        }
      }
      // Keep inside the world; bounce back at the edges.
      if (car.x < 90 || car.x > 2410 || car.y < 90 || car.y > 2710) {
        t.dir *= -1;
        car.angle += Math.PI;
      }
    }
  }
}

function nearestRoadCoord(v, roads) {
  return roads.reduce((a, b) => (Math.abs(v - b) < Math.abs(v - a) ? b : a), roads[0]);
}

const PED_SHIRTS = ['#d95f4b', '#4b7fd9', '#e8c33c', '#7ab648', '#b45fd9', '#e8e8e8', '#3fb3a5', '#d97ba8'];
const PED_PANTS = ['#2b3242', '#4a3b2b', '#5b6b7a', '#333333'];

export class Pedestrians {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.list = [];
  }

  spawnInitial(n, px, py) {
    for (let i = 0; i < n; i++) {
      const p = randomRoadPoint(this.rng, px, py, 200);
      this.spawn(p.x + randRange(this.rng, -40, 40), p.y + randRange(this.rng, -40, 40));
    }
  }

  spawn(x, y, opts = {}) {
    const ped = {
      x, y,
      angle: randRange(this.rng, 0, Math.PI * 2),
      speed: randRange(this.rng, 28, 52),
      shirt: pick(this.rng, PED_SHIRTS),
      pants: pick(this.rng, PED_PANTS),
      hp: 30,
      flee: 0, fleeX: 0, fleeY: 0,
      fare: opts.fare || false, // waiting for a taxi ride
      fareDest: opts.fareDest || null,
      armed: opts.armed || false, // rival gang member
      isCop: opts.isCop || false,
      isCrew: opts.isCrew || false,
      inCar: null,
      dead: false, deadT: 0,
      wanderT: randRange(this.rng, 1, 4),
    };
    this.list.push(ped);
    return ped;
  }

  maintain(px, py, target = 22) {
    this.list = this.list.filter((p) => !p.dead && dist(p.x, p.y, px, py) < 1300);
    let guard = 0;
    while (this.list.filter((p) => !p.fare && !p.armed && !p.isCop).length < target && guard++ < 6) {
      const p = randomRoadPoint(this.rng, px, py, 300);
      this.spawn(p.x + randRange(this.rng, -46, 46), p.y + randRange(this.rng, -46, 46));
    }
  }

  scare(x, y, radius = 320) {
    for (const p of this.list) {
      if (p.dead || p.isCop || p.armed) continue;
      if (dist(p.x, p.y, x, y) < radius) {
        p.flee = 2.5;
        p.fleeX = x; p.fleeY = y;
      }
    }
  }

  update(dt, playerPos) {
    for (const p of this.list) {
      if (p.dead) { p.deadT += dt; continue; }
      if (p.inCar) continue;
      let mx = 0, my = 0, sp = p.speed;
      if (p.flee > 0) {
        p.flee -= dt;
        const a = Math.atan2(p.y - p.fleeY, p.x - p.fleeX);
        mx = Math.cos(a); my = Math.sin(a); sp = 150;
      } else if (p.isCop && playerPos) {
        // Officer runs at the player.
        const a = Math.atan2(playerPos.y - p.y, playerPos.x - p.x);
        mx = Math.cos(a); my = Math.sin(a); sp = 165;
        p.angle = a;
      } else if (p.armed && playerPos) {
        // Rival holds ground and strafes toward the player when close.
        const d = dist(p.x, p.y, playerPos.x, playerPos.y);
        if (d < 420 && d > 120) {
          const a = Math.atan2(playerPos.y - p.y, playerPos.x - p.x);
          mx = Math.cos(a); my = Math.sin(a); sp = 70;
        }
        p.angle = Math.atan2(playerPos.y - p.y, playerPos.x - p.x);
      } else {
        p.wanderT -= dt;
        if (p.wanderT <= 0) {
          p.wanderT = randRange(this.rng, 2, 6);
          p.angle = randRange(this.rng, 0, Math.PI * 2);
        }
        mx = Math.cos(p.angle); my = Math.sin(p.angle);
      }
      if (mx !== 0 || my !== 0) {
        const nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt;
        if (!this.city.buildings.some((b) => circleHitsRect(nx, ny, 10, b)) && !this.city.water.some((w) => nx > w.x && nx < w.x + w.w && ny > w.y && ny < w.y + w.h)) {
          p.x = nx; p.y = ny;
        } else {
          p.angle += Math.PI / 2;
        }
        p.x = clamp(p.x, 20, 2470); p.y = clamp(p.y, 20, 2770);
      }
    }
    // Remove long-dead bodies.
    this.list = this.list.filter((p) => !p.dead || p.deadT < 8);
  }
}

export class Police {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cruisers = [];
    this.arrestT = 0;
  }

  wantedCount(stars) {
    return Math.min(6, stars + Math.floor(stars / 2));
  }

  maintain(stars, px, py, traffic) {
    const want = this.wantedCount(stars);
    // Remove cruisers that are far away or no longer wanted.
    this.cruisers = this.cruisers.filter((c) => dist(c.x, c.y, px, py) < 1600);
    while (this.cruisers.length > want) this.cruisers.pop();
    let guard = 0;
    while (this.cruisers.length < want && guard++ < 6) {
      const p = randomRoadPoint(this.rng, px, py, 650);
      const car = makeCar('police', p.x, p.y, 0);
      car.isPolice = true;
      car.siren = 0;
      this.cruisers.push(car);
    }
  }

  clear() { this.cruisers = []; this.arrestT = 0; }

  update(dt, player, peds) {
    const target = player.car || player;
    for (const car of this.cruisers) {
      car.siren += dt;
      const d = dist(car.x, car.y, target.x, target.y);
      const wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
      const turn = clamp(angleDiff(car.angle, wantAngle), -2.4 * dt, 2.4 * dt);
      car.angle += turn;
      // Chase speed: a little faster than a sedan, slower than the Comet GT.
      const maxSpd = 285;
      const accel = d > 220 ? 260 : 120;
      car.speed = clamp(car.speed + accel * dt, 0, maxSpd);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const hit = resolveCircle(this.city, car, 20);
      if (hit) {
        car.speed *= 0.55;
        car.angle += (this.rng() - 0.5) * 0.9;
      }
      // Ram the player: if the cruiser touches the player's car, slow it hard.
      if (player.car) {
        const pd = dist(car.x, car.y, player.car.x, player.car.y);
        if (pd < 46) {
          player.car.speed *= 0.55;
          player.hp -= 12 * dt;
          car.speed *= 0.7;
        }
      } else if (d < 30) {
        // Officer contact on foot: arrest timer.
        this.arrestT += dt;
      }
    }
    if (this.cruisers.length === 0) this.arrestT = 0;
    // Foot officers at wanted 2+: spawn near the player, cap 4.
    if (player.wanted >= 2) {
      const cops = peds.list.filter((p) => p.isCop && !p.dead);
      let guard = 0;
      while (cops.length < Math.min(4, player.wanted) && guard++ < 3) {
        const p = randomRoadPoint(this.rng, player.x, player.y, 420);
        const cop = peds.spawn(p.x, p.y, { isCop: true });
        cop.shirt = '#24344d'; cop.pants = '#1a2436';
        cops.push(cop);
      }
    }
  }
}
