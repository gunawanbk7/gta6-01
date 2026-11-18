// Shared tuning and world constants for Solmar Bay.
export const CFG = {
  // City grid: roads run along x and z at these coordinates; road width 10.
  roads: [-60, -30, 0, 30, 60],
  roadWidth: 10,
  worldMin: -95,
  worldMax: 110,
  // Beach strip and ocean live south of the city (large +z).
  beachZ0: 76,
  beachZ1: 102,
  oceanZ0: 102,
  // Player
  walkSpeed: 7,
  runSpeed: 11,
  playerRadius: 0.9,
  playerHealth: 100,
  // Cars
  carAccel: 26,
  carBrake: 40,
  carMaxSpeed: 24,
  carReverseMax: 9,
  carSteer: 1.9,
  carRadius: 2.2,
  // Traffic
  trafficSpeed: 8,
  trafficCount: 10,
  pedCount: 14,
  // Wanted / police
  wantedMax: 5,
  wantedDecayDelay: 18, // seconds with no crime and no police near before a star drops
  wantedDecayEvery: 8,
  policeTopSpeed: 19,
  policeCountMax: 4,
  // Combat
  punchDamage: 25,
  punchRange: 2.6,
  punchCooldown: 0.45,
  gunDamage: 34,
  gunRange: 60,
  gunCooldown: 0.28,
  magSize: 12,
  reloadTime: 1.6,
  thugHealth: 100,
  thugDamage: 5,
  // Missions
  missionRewards: [250, 400, 600, 900, 1500],
  courierTimeLimit: 95,
  // Places (x, z)
  hideout: { x: -45, z: -45 },
  hospital: { x: -70, z: -40 },
  marinaCoupe: { x: 58, z: 64 },
  casinoSedan: { x: 45, z: -68 },
  harbour: { x: 82, z: 10 },
  safehouse: { x: -58, z: 58 },
  courierPoints: [
    { x: 60, z: 60 },
    { x: -60, z: 60 },
    { x: -60, z: -60 },
  ],
  // Look
  skyColor: 0x8ec9ee,
  fogColor: 0x9fd0e8,
  sunColor: 0xfff2cf,
  roadColor: 0x2e3138,
  sidewalkColor: 0x8d9299,
  sandColor: 0xe8d29a,
  oceanColor: 0x1d7fb8,
};
