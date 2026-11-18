// Solmar Heat — world and gameplay constants.
// All distances in metres, speeds in m/s, times in seconds.

export const WORLD = {
  BLOCK: 44,
  ROAD: 14,
  GRID: 9,
  BEACH_Z: 268,
  OCEAN_Z: 420,
  SUN_ELEVATION: 0.9,
  SUN_AZIMUTH: -0.7,
};

export const PITCH = 58; // BLOCK + ROAD
export const HALF_CITY = 261; // (GRID * PITCH) / 2
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

export const PLAYER = {
  WALK: 4.2,
  RUN: 7.4,
  JUMP: 8.5,
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
  MAX_SPEED: 42,
  MAX_REVERSE: 12,
  STEER_MAX: 0.55,
  GRIP: 7.5,
  DRAG: 0.35,
};

export const WANTED = {
  MAX: 5,
  DECAY_SECONDS: 18,
  STEAL_CAR: 1,
  HIT_PEDESTRIAN: 1,
  RAM_POLICE: 1,
  SHOOT: 2,
  CHASERS: [0, 1, 2, 3, 4, 5],
  SHOOT_AT: 3,
};

export const MISSIONS = {
  DEBT_GOAL: 10000,
};

export const SAVE_KEY = 'solmar-heat-save-v1';

// Road centre lines: (k - 4.5) * PITCH for k = 0..9
export const ROAD_LINES = [];
for (let k = 0; k <= 9; k++) ROAD_LINES.push((k - 4.5) * PITCH);
