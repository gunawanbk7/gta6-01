// Solmar Bay — tuning constants and shared palette.
// One clear job: every number the rest of the game agrees on lives here.
export const WORLD = {
  half: 190,            // city extends from -190 to +190 on x and z
  roadGap: 60,          // distance between parallel streets
  roadWidth: 12,
  beachZ: 150,          // sand starts here
  oceanZ: 172,          // water starts here
  blockPad: 9,          // buildings stay this far from a road edge
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 12,
  radius: 0.9,
  maxHealth: 100,
  punchDamage: 25,
  punchRange: 2.4,
  pistolDamage: 34,
  pistolRange: 70,
  magSize: 12,
  startCash: 120,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 38,         // ~137 km/h at the HUD scale
  maxReverse: 10,
  steer: 0.55,          // radians per second at full lock, scaled by speed
  drag: 0.55,
  grip: 6,
};

export const WANTED = {
  max: 5,
  decaySeconds: 22,     // one star fades after this long unseen by police
  policePerStar: 1,     // police cars wanted per star (capped)
  maxPolice: 4,
  chaseSpeed: 34,
  ramDamage: 8,
};

export const COLORS = {
  sky: 0x8ec9e8,
  sun: 0xfff2d0,
  ground: 0x9aa08a,
  road: 0x3a3d42,
  roadLine: 0xd8d3a0,
  sidewalk: 0xb9b3a4,
  sand: 0xe8d29a,
  ocean: 0x1f7fb8,
  oceanDeep: 0x0e5f8f,
  building: [0xd8c9a8, 0xc9a06a, 0x9fb8c8, 0xe0a080, 0xb8c8a0, 0xd0b0c0, 0xa8b8d0, 0xe8d8b0],
  glass: 0x6fa8c8,
  palm: 0x3f8f4f,
  trunk: 0x8a6a45,
};

export const SAVE_KEY = 'solmar-bay-save-v1';
