// shots.js — stages the four screenshots from the game's own running code: it puts
// the player, the traffic, the police and a mission exactly where the shot needs
// them, then lets the normal render loop draw the frame. Nothing is composited
// or edited; each shot is a real render of the live game.
import { MISSIONS } from './missions.js';
import { makeCar } from './entities.js';

export function stageShot(G, name) {
  const p = G.player;
  G.state = 'playing';
  G.goldenHour = false;
  G.cam.zoom = 1;

  if (name === 'cover') {
    // A three-star chase downtown: Jax in the Comet GT, two interceptors on his
    // tail, traffic ahead, the Chop Shop job live on the HUD.
    const car = makeCar('sports', 1180, 1180, 0);
    G.parkedCars.push(car);
    p.car = car; car.isPlayer = true;
    car.speed = 210;
    p.x = car.x; p.y = car.y; p.angle = 0;
    p.wanted = 3; p.wantedT = 0;
    p.money = 1250;
    G.traffic.spawnInitial(10, p.x, p.y);
    G.police.maintain(3, p.x, p.y);
    // Put the cruisers right behind the player.
    G.police.cruisers.forEach((c, i) => {
      c.x = p.x - 90 - i * 70; c.y = p.y + (i === 0 ? -40 : 50); c.speed = 250;
      c.angle = 0;
    });
    G.missions.active = { def: MISSIONS[2], stepIdx: 1, state: { t: 0 } };
    G.missions.killCount = 0;
    G.cam.x = p.x + 60; G.cam.y = p.y;
  } else if (name === 'street') {
    // On foot in the Old Town with traffic, shoppers and a fare waiting.
    p.car = null;
    p.x = 400; p.y = 400; p.angle = Math.PI / 2;
    p.wanted = 0; p.money = 640;
    p.hasPistol = true;
    G.traffic.spawnInitial(12, p.x, p.y);
    G.peds.spawnInitial(18, p.x, p.y);
    G.zoomLock = 1.18; // closer framing so Jax reads on foot
    G.cam.x = p.x; G.cam.y = p.y;
  } else if (name === 'mission') {
    // The Harbour Ambush: the shootout at the Docks, mid-fight.
    p.car = null;
    p.x = 2160; p.y = 2140; p.angle = Math.PI / 4;
    p.wanted = 2; p.wantedT = 0; p.money = 2100;
    p.hasPistol = true;
    G.missions.active = { def: MISSIONS[4], stepIdx: 1, state: { t: 12 } };
    G.missions.killCount = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const ped = G.peds.spawn(2220 + Math.cos(a) * 130, 2220 + Math.sin(a) * 130, { armed: true });
      ped.shirt = '#8a2f3f';
    }
    G.police.maintain(2, p.x, p.y);
    G.peds.spawnInitial(8, p.x, p.y);
    G.zoomLock = 1.1;
    G.cam.x = p.x + 40; G.cam.y = p.y + 20;
  } else if (name === 'harbour') {
    // Golden hour on the Marina: cruising the beach road in a classic, calm sea.
    const car = makeCar('classic', 2330, 660, Math.PI / 2);
    G.parkedCars.push(car);
    p.car = car; car.isPlayer = true;
    car.speed = 150;
    p.x = car.x; p.y = car.y; p.angle = Math.PI / 2;
    p.wanted = 0; p.money = 4800;
    G.goldenHour = true;
    G.traffic.spawnInitial(6, p.x, p.y);
    G.peds.spawnInitial(10, p.x, p.y);
    G.cam.x = p.x; G.cam.y = p.y + 40;
  }
  // A few skid marks and a fresh trail so the cover reads as motion.
  if (name === 'cover' || name === 'harbour') {
    for (let i = 0; i < 6; i++) {
      G.addSkid(p.x - 60 - i * 24, p.y + (i % 2 === 0 ? -12 : 12), p.angle);
    }
  }
}
