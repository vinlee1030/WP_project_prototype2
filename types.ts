
// Weapon Types
export type WeaponType = 
  | 'PISTOL'
  | 'SHOTGUN'
  | 'RIFLE'
  | 'MACHINE_GUN'
  | 'SNIPER'
  | 'ROCKET'
  | 'FLAMETHROWER'
  | 'GRENADE'
  | 'LASER'
  | 'MINIGUN'
  | 'CHAINSAW'  // Melee - high damage, short range
  | 'BAT'       // Melee - knockback
  | 'LANDMINE'; // Place a trap on the ground

export interface Weapon {
  type: WeaponType;
  ammo: number;
  maxAmmo: number;
  fireRate: number;
  damage: number;
  speed: number;
  spread: number;
  lastShotTime: number;
  unlockWave: number;
}

// Game Modes
export type GameMode = 'ZOMBIE_SURVIVAL' | 'TEAM_DEATHMATCH' | 'GEM_GRAB' | 'BRAWL_BALL';

// Team colors for PvP modes
export type Team = 'RED' | 'BLUE' | 'NONE';

// Zombie Types (defined later with stats)

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  aimRotation: number;
  hp: number;
  maxHp: number;
  score: number;
  kills: number;
  deaths: number;
  color: string;
  team: Team;
  isBot: boolean;
  isZombie: boolean;
  dead: boolean;
  weapons: Weapon[]; // Array of weapons player has
  currentWeaponIndex: number;
  ping: number;
  animFrame: number;
  isMoving: boolean;
  lastMoveTime: number;
  speedBoostUntil: number;
  damageBoostUntil: number;
  slowedUntil: number; // Slowed by slow zombie
  blurredUntil: number; // Blurred by smoke zombie
  stunnedUntil: number; // Stunned by charger (can't move or shoot)
  slimeCoveredUntil: number; // Covered in slime by boomer (blurry sticky effect)
  tongueGrabbedBy: string | null; // ID of witch grabbing player with tongue
  waveSurvived: number;
  gems: number;
  hasBall: boolean;
  canPickBallAt: number; // Timestamp when can pick ball again
  respawnAt: number; // Respawn timestamp
  // Leveling stats
  level: number;
  damageMultiplier: number;
  fireRateMultiplier: number;
  ammoMultiplier: number;
  inBush: boolean; // Hidden in bush (for PvP modes)
  shield: number; // Shield HP (absorbs damage before health)
  maxShield: number;
  fireRateBoostUntil: number; // Fire rate boost timer
  wallKits: number; // Number of wall kits to build asylum walls
}

export interface Zombie {
  id: string;
  x: number;
  y: number;
  rotation: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: ZombieType;
  targetId: string | null;
  lastAttackTime: number;
  attackRange: number;
  attackDamage: number;
  animFrame: number;
  lastProjectileTime: number; // For spitter
  isBoss: boolean;
  chargeTarget?: { x: number; y: number }; // For charger zombie
  lastFireTrailTime?: number; // For boss fire trails (optimization)
  tongueTarget?: string; // ID of player grabbed by tongue (for witch)
  tongueState?: 'AIMING' | 'EXTENDING' | 'RETRACTING' | 'ATTACKING'; // Tongue attack state
  tongueProgress?: number; // 0-1 for tongue animation
  lastSmokeTime?: number; // For smoke zombie cloud spawning
}

export interface Bullet {
  id: string;
  ownerId: string;
  ownerTeam: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  weaponType: WeaponType;
  life: number;
  explosionRadius?: number;
  isZombieProjectile?: boolean;
  isVenom?: boolean; // Toxic projectile from spitter
}

export type ParticleType = 'CIRCLE' | 'TEXT' | 'BLOOD' | 'EXPLOSION' | 'MUZZLE_FLASH' | 'DUST' | 'SPARKLE' | 'SMOKE' | 'HEAL_AURA';

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  type: ParticleType;
  text?: string;
}

export type ItemType = 
  | 'HEALTH' 
  | 'AMMO' 
  | 'WEAPON_SHOTGUN'
  | 'WEAPON_RIFLE'
  | 'WEAPON_MACHINE_GUN'
  | 'WEAPON_SNIPER'
  | 'WEAPON_ROCKET'
  | 'WEAPON_FLAMETHROWER'
  | 'WEAPON_GRENADE'
  | 'WEAPON_LASER'
  | 'WEAPON_MINIGUN'
  | 'WEAPON_CHAINSAW'
  | 'WEAPON_BAT'
  | 'WEAPON_LANDMINE'
  | 'SPEED_BOOST'
  | 'DAMAGE_BOOST'
  | 'ARMOR'
  | 'SHIELD'          // Bulletproof vest - adds shield HP
  | 'FIRE_RATE_BOOST' // Temporarily increases fire rate
  | 'WALL_KIT'        // Build asylum wall (wave 10+)
  | 'GEM'
  | 'MINE'
  | 'VENOM_PUDDLE'
  | 'SMOKE_CLOUD';  // Smoke cloud from smoker zombie - lasts 25 seconds, blurs when touched

export interface Item {
  id: string;
  x: number;
  y: number;
  type: ItemType;
  rotation: number;
  value?: number;
  ownerId?: string; // For mines
  spawnTime?: number; // For timed items like venom puddles
}

// Destructible wall
export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'SOLID' | 'BUSH' | 'WATER' | 'DESTRUCTIBLE' | 'BARREL' | 'CRATE' | 'POND' | 'SWAMP' | 'ASYLUM_WALL';
  hp?: number;
  maxHp?: number;
  ownerId?: string; // For player-built walls
  dropType?: ItemType; // What the crate drops when destroyed
}

// Ball for Brawl Ball mode
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heldBy: string | null;
  rotation: number;
}

// Goal for Brawl Ball
export interface Goal {
  x: number;
  y: number;
  w: number;
  h: number;
  team: Team;
}

export interface GameSettings {
  gameMode: GameMode;
  zombieSpawnRate: number;
  maxZombies: number;
  waveDuration: number;
  difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'NIGHTMARE';
  scoreToWin: number;
  timeLimit: number;
}

export interface GameState {
  roomId: string;
  roomName?: string;
  isHost: boolean;
  settings: GameSettings;
  players: Player[];
  zombies: Zombie[];
  bullets: Bullet[];
  particles: Particle[];
  items: Item[];
  walls: Wall[];
  myId: string | null;
  gameTime: number;
  // Wave system
  wave: number;
  waveState: 'FIGHTING' | 'REST' | 'COMPLETE';
  waveRestStartTime: number;
  zombiesKilledThisWave: number;
  zombiesToSpawnThisWave: number;
  zombiesSpawnedThisWave: number;
  lastZombieSpawnTime: number;
  lastItemSpawnTime: number;
  // PvP mode
  teamScores: { RED: number; BLUE: number };
  matchStartTime: number;
  matchTimeRemaining: number;
  // Brawl Ball
  ball?: Ball;
  goals?: Goal[];
  lastGoalTime: number;
  goalCelebrationUntil: number; // Camera freezes on ball until this time
  lastGoalScorer?: string; // Player who scored
  // Announcements system
  announcements: Announcement[];
  // Game end
  gameOver: boolean;
  winnerTeam?: Team;
  survivalTime: number;
  showEndScreen: boolean;
  endScreenStartTime: number;
}

export interface Announcement {
  id: string;
  text: string;
  color: string;
  startTime: number;
  duration: number; // How long to display (ms)
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
  switchWeapon?: boolean; // Deprecated - use newWeaponIndex
  newWeaponIndex?: number; // Direct weapon index to switch to
  mouseX?: number;
  mouseY?: number;
  aimX?: number;
  aimY?: number;
  buildWall?: boolean; // Build asylum wall (wave 10+)
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  color: string;
  timestamp: number;
}

export interface LobbyRoomInfo {
  roomId: string;
  hostName: string;
  roomName: string;
  playerCount: number;
  gameMode: string;
  difficulty: string;
  wave?: number;
}

// Network Types
export type NetMessage = 
  | { type: 'JOIN'; name: string }
  | { type: 'WELCOME'; playerId: string; state: GameState }
  | { type: 'INPUT'; input: InputState }
  | { type: 'STATE_UPDATE'; state: GameState }
  | { type: 'ERROR'; message: string }
  | { type: 'CHAT'; message: ChatMessage }
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number }
  | { type: 'ROOM_INFO'; rooms: LobbyRoomInfo[] };

export const MAX_CONNECTIONS = 8;

// Game Constants
export const MAP_SIZE = 1120; // Reduced 20% for tighter gameplay
export const VIEWPORT_WIDTH = 800;
export const VIEWPORT_HEIGHT = 600;
export const PLAYER_RADIUS = 18; // Slightly smaller
export const ZOMBIE_RADIUS = 16; // Slightly smaller
export const BULLET_SPEED = 15;
export const PLAYER_SPEED = 4.2;
export const ITEM_RADIUS = 14; // Slightly smaller
export const BALL_RADIUS = 16; // Slightly smaller
export const WAVE_REST_TIME = 8000; // 8 seconds
export const MOBILE_ZOOM = 0.85; // Further reduced zoom for much bigger view

// Weapon Stats with unlock waves
export const WEAPON_STATS: Record<WeaponType, {
  maxAmmo: number;
  fireRate: number;
  damage: number;
  speed: number;
  spread: number;
  name: string;
  emoji: string;
  unlockWave: number;
  explosionRadius?: number;
}> = {
  PISTOL: { maxAmmo: -1, fireRate: 250, damage: 18, speed: 16, spread: 0.02, name: 'Pistol', emoji: '🔫', unlockWave: 1 },
  SHOTGUN: { maxAmmo: 24, fireRate: 700, damage: 12, speed: 14, spread: 0.5, name: 'Shotgun', emoji: '💥', unlockWave: 1 },
  RIFLE: { maxAmmo: 45, fireRate: 100, damage: 24, speed: 22, spread: 0.01, name: 'Rifle', emoji: '🎯', unlockWave: 2 },
  MACHINE_GUN: { maxAmmo: 120, fireRate: 70, damage: 16, speed: 18, spread: 0.06, name: 'M-Gun', emoji: '⚡', unlockWave: 3 },
  SNIPER: { maxAmmo: 12, fireRate: 900, damage: 100, speed: 30, spread: 0, name: 'Sniper', emoji: '🔭', unlockWave: 4 },
  ROCKET: { maxAmmo: 10, fireRate: 800, damage: 200, speed: 16, spread: 0, name: 'Rocket', emoji: '🚀', unlockWave: 5, explosionRadius: 160 },
  GRENADE: { maxAmmo: 12, fireRate: 500, damage: 120, speed: 10, spread: 0, name: 'Grenade', emoji: '💣', unlockWave: 4, explosionRadius: 150 },
  FLAMETHROWER: { maxAmmo: 80, fireRate: 30, damage: 8, speed: 12, spread: 0.35, name: 'Flame', emoji: '🔥', unlockWave: 6 },
  LASER: { maxAmmo: 30, fireRate: 150, damage: 45, speed: 40, spread: 0, name: 'Laser', emoji: '⚡', unlockWave: 7 },
  MINIGUN: { maxAmmo: 200, fireRate: 50, damage: 18, speed: 20, spread: 0.08, name: 'Minigun', emoji: '🔥', unlockWave: 8 },
  CHAINSAW: { maxAmmo: -1, fireRate: 150, damage: 30, speed: 0, spread: 0.4, name: 'Chainsaw', emoji: '🪚', unlockWave: 3 },
  BAT: { maxAmmo: -1, fireRate: 900, damage: 40, speed: 0, spread: 0, name: 'Bat', emoji: '🏏', unlockWave: 2 },
  LANDMINE: { maxAmmo: 6, fireRate: 800, damage: 150, speed: 0, spread: 0, name: 'Mine', emoji: '💣', unlockWave: 7, explosionRadius: 100 },
};

// Zombie Types with visuals
export type ZombieType = 'NORMAL' | 'FAST' | 'TANK' | 'BOOMER' | 'SPITTER' | 'SLOW' | 'BOSS' | 'HEALER' | 'CHARGER' | 'SMOKE' | 'FLAME_BOSS' | 'WITCH';

export const ZOMBIE_TYPES: Record<ZombieType, {
  hp: number;
  speed: number;
  color: string;
  attackRange: number;
  attackDamage: number;
  name: string;
  size: number;
  spawnWeight: number;
  minWave: number;
}> = {
  NORMAL: { hp: 60, speed: 2.0, color: '#5a7a5a', attackRange: 28, attackDamage: 12, name: 'Walker', size: 1, spawnWeight: 40, minWave: 1 },
  FAST: { hp: 35, speed: 3.2, color: '#7acc7a', attackRange: 35, attackDamage: 8, name: 'Runner', size: 0.85, spawnWeight: 20, minWave: 2 },
  TANK: { hp: 300, speed: 1.0, color: '#4a4a6a', attackRange: 35, attackDamage: 30, name: 'Brute', size: 1.5, spawnWeight: 7, minWave: 3 }, // Reduced 30% (10->7)
  BOOMER: { hp: 120, speed: 1.4, color: '#88cc44', attackRange: 35, attackDamage: 15, name: 'Boomer', size: 1.5, spawnWeight: 10, minWave: 4 },
  SPITTER: { hp: 50, speed: 1.2, color: '#8a6acc', attackRange: 225, attackDamage: 10, name: 'Spitter', size: 1, spawnWeight: 8, minWave: 5 },
  SLOW: { hp: 80, speed: 2.2, color: '#6acccc', attackRange: 120, attackDamage: 15, name: 'Freezer', size: 1.1, spawnWeight: 12, minWave: 5 },
  HEALER: { hp: 70, speed: 1.5, color: '#4aff4a', attackRange: 150, attackDamage: 5, name: 'Healer', size: 1.0, spawnWeight: 8, minWave: 6 },
  CHARGER: { hp: 200, speed: 2.2, color: '#ff6a4a', attackRange: 40, attackDamage: 40, name: 'Charger', size: 1.4, spawnWeight: 8, minWave: 7 }, // 20% faster (1.8->2.2)
  SMOKE: { hp: 60, speed: 2.2, color: '#666666', attackRange: 100, attackDamage: 10, name: 'Smoke', size: 1.1, spawnWeight: 6, minWave: 8 },
  BOSS: { hp: 1000, speed: 1.44, color: '#cc4a4a', attackRange: 45, attackDamage: 60, name: 'BOSS', size: 2.5, spawnWeight: 0, minWave: 5 }, // 20% faster (1.2->1.44)
  FLAME_BOSS: { hp: 1500, speed: 1.2, color: '#ff4400', attackRange: 200, attackDamage: 40, name: 'Inferno', size: 2.8, spawnWeight: 0, minWave: 8 }, // 20% faster (1.0->1.2)
  WITCH: { hp: 800, speed: 3.5, color: '#8844aa', attackRange: 250, attackDamage: 25, name: 'Witch', size: 1.8, spawnWeight: 0, minWave: 10 }, // Fast spider-like boss with tongue!
};

// Team Colors
export const TEAM_COLORS = {
  RED: '#ef4444',
  BLUE: '#3b82f6',
  NONE: '#888888',
};

// Player Colors
export const PLAYER_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

// Room list stored in memory (for simple lobby)
export const activeRooms: Map<string, LobbyRoomInfo> = new Map();
