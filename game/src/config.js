// Tuning and world constants for Solmar Heat. One place for every number the
// systems share, so the city, the cars and the police all agree on the scale.
export const WORLD = {
  // City grid: BLOCK metres of buildings, ROAD metres of asphalt, repeated.
  BLOCK: 44,
  ROAD: 14,
  GRID: 9,
  // South edge of the city is the beach; the ocean starts here (z beyond).
  BEACH_Z: 268,
  OCEAN_Z: 420,
  // Sea level and the height of the sun.
  SUN_ELEVATION: 0.9,
  SUN_AZIMUTH: -0.7,
};

export const PITCH = WORLD.BLOCK + WORLD.ROAD; // 58 m from one block centre to the next
export const HALF_CITY = (WORLD.GRID * PITCH) / 2; // 261 m

export const PLAYER = {
  WALK_SPEED: 4.2,
  RUN_SPEED: 7.4,
  JUMP_SPEED: 8.5,
  ACCEL: 34,
  RADIUS: 0.55,
  HEIGHT: 1.8,
  PUNCH_RANGE: 1.6,
  PUNCH_DAMAGE: 34,
  PISTOL_DAMAGE: 34,
  PISTOL_RANGE: 60,
};

export const CAR = {
  LENGTH: 4.6,
  WIDTH: 2.0,
  ENGINE_FORCE: 26,
  BRAKE_FORCE: 42,
  MAX_SPEED: 42, // ~150 km/h
  MAX_REVERSE: 12,
  STEER_MAX: 0.55,
  GRIP: 7.5,
  DRAG: 0.35,
};

export const WANTED = {
  MAX: 5,
  // Stars fall one at a time after this many seconds unseen by any police.
  DECAY_SECONDS: 18,
  STEAL_CAR: 1,
  HIT_PEDESTRIAN: 1,
  RAM_POLICE: 1,
  SHOOT: 2,
  // Police cars on the hunt, by wanted level.
  CHASERS: [0, 1, 2, 3, 4, 5],
  // At this wanted level the police start shooting.
  SHOOT_AT: 3,
};

export const MISSIONS = {
  DEBT_GOAL: 10000,
};

export const SAVE_KEY = 'solmar-heat-save-v1';
export const STEP = 1 / 60;
