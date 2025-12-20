
import { 
  GameState, Player, Bullet, Particle, InputState, Item, ItemType, GameSettings,
  MAP_SIZE, PLAYER_RADIUS, PLAYER_SPEED, ITEM_RADIUS, ZOMBIE_RADIUS,
  Weapon, WeaponType, WEAPON_STATS, Zombie, ZOMBIE_TYPES, Team, GameMode,
  PLAYER_COLORS, Ball, BALL_RADIUS, Wall, ZombieType, WAVE_REST_TIME, Announcement
} from '../types';
import { audioService } from './audioService';

const uuid = () => Math.random().toString(36).substr(2, 9);
const MAX_ITEMS = 30;

// Helper to apply damage with shield absorption
const applyDamage = (player: Player, damage: number, now: number, respawnTime: number = 2500): boolean => {
  // Shield absorbs damage first
  if (player.shield > 0) {
    if (player.shield >= damage) {
      player.shield -= damage;
      return false; // Not dead
    } else {
      // Shield breaks, remaining damage goes to health
      const remainingDamage = damage - player.shield;
      player.shield = 0;
      player.hp -= remainingDamage;
    }
  } else {
    player.hp -= damage;
  }
  
  if (player.hp <= 0) {
    player.dead = true;
    player.deaths++;
    player.respawnAt = now + respawnTime;
    return true; // Dead
  }
  return false;
};

// Helper to add announcement
const addAnnouncement = (announcements: Announcement[], text: string, color: string = '#ffffff', duration: number = 3000): Announcement[] => {
  const newAnn: Announcement = { id: uuid(), text, color, startTime: Date.now(), duration };
  return [...announcements.slice(-4), newAnn]; // Keep only last 5 announcements
};

// Knockback values per weapon
const KNOCKBACK: Record<WeaponType, number> = {
  PISTOL: 3, SHOTGUN: 8, RIFLE: 4, MACHINE_GUN: 2, SNIPER: 12,
  ROCKET: 15, GRENADE: 20, FLAMETHROWER: 1, LASER: 6, MINIGUN: 3,
  CHAINSAW: 3, BAT: 45, // Bat has MASSIVE knockback!
  LANDMINE: 30 // Explosion knockback
};

// Difficulty multipliers: NIGHTMARE is now baseline (1.0), easier modes give bonuses
// EASY MODE: DOUBLE health and attack for beginners!
const getDifficultyMultipliers = (difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'NIGHTMARE') => {
  switch (difficulty) {
    case 'EASY':    return { playerHpMult: 2.0, playerDamageMult: 2.0, zombieCountMult: 0.60 }; // DOUBLE HP/dmg, -40% zombies!
    case 'NORMAL':  return { playerHpMult: 1.50, playerDamageMult: 1.50, zombieCountMult: 0.75 }; // +50% HP/dmg, -25% zombies
    case 'HARD':    return { playerHpMult: 1.25, playerDamageMult: 1.25, zombieCountMult: 0.90 }; // +25% HP/dmg, -10% zombies
    case 'NIGHTMARE': return { playerHpMult: 1.0, playerDamageMult: 1.0, zombieCountMult: 1.0 }; // Baseline - hardest
  }
};

// Wave progression bonuses: +10% max HP/ammo, +5% fire rate per wave
const getWaveBonus = (wave: number) => ({
  hpBonus: 1 + (wave - 1) * 0.10,        // +10% max HP per wave
  ammoBonus: 1 + (wave - 1) * 0.10,      // +10% max ammo per wave  
  fireRateBonus: 1 + (wave - 1) * 0.05   // +5% faster fire rate per wave (lower fireRate = faster)
});

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for(let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
  }
  return () => {
      h = Math.imul(h ^ h >>> 16, 2246822507);
      h = Math.imul(h ^ h >>> 13, 3266489909);
      return (h ^= h >>> 16) >>> 0;
  }
}

function mulberry32(a: number) {
  return () => {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const generateMap = (roomId: string, mode: GameMode): Wall[] => {
  const seed = xmur3(roomId);
  const rand = mulberry32(seed());
  const walls: Wall[] = [];
  
  walls.push({ x: -50, y: -50, w: MAP_SIZE + 100, h: 50, type: 'SOLID' });
  walls.push({ x: -50, y: MAP_SIZE, w: MAP_SIZE + 100, h: 50, type: 'SOLID' });
  walls.push({ x: -50, y: 0, w: 50, h: MAP_SIZE, type: 'SOLID' });
  walls.push({ x: MAP_SIZE, y: 0, w: 50, h: MAP_SIZE, type: 'SOLID' });
  
  if (mode === 'BRAWL_BALL') {
    const cx = MAP_SIZE / 2, cy = MAP_SIZE / 2;
    walls.push({ x: 0, y: 0, w: 50, h: cy - 100, type: 'SOLID' });
    walls.push({ x: 0, y: cy + 100, w: 50, h: cy - 100, type: 'SOLID' });
    walls.push({ x: MAP_SIZE - 50, y: 0, w: 50, h: cy - 100, type: 'SOLID' });
    walls.push({ x: MAP_SIZE - 50, y: cy + 100, w: 50, h: cy - 100, type: 'SOLID' });
    // Obstacles
    walls.push({ x: cx - 30, y: cy - 200, w: 60, h: 30, type: 'DESTRUCTIBLE', hp: 80, maxHp: 80 });
    walls.push({ x: cx - 30, y: cy + 170, w: 60, h: 30, type: 'DESTRUCTIBLE', hp: 80, maxHp: 80 });
    // Bushes for hiding
    walls.push({ x: cx - 180, y: cy - 40, w: 60, h: 80, type: 'BUSH' });
    walls.push({ x: cx + 120, y: cy - 40, w: 60, h: 80, type: 'BUSH' });
    // Crates with health/boosts
    const bbDrops: ItemType[] = ['HEALTH', 'SPEED_BOOST', 'HEALTH'];
    for (let i = 0; i < 3; i++) {
      walls.push({ x: rand() * (MAP_SIZE - 200) + 100, y: rand() * (MAP_SIZE - 200) + 100, w: 26, h: 26, type: 'CRATE', hp: 30, maxHp: 30, dropType: bbDrops[i] });
    }
  } else if (mode === 'GEM_GRAB') {
    const cx = MAP_SIZE / 2, cy = MAP_SIZE / 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const dist = 280;
      walls.push({ x: cx + Math.cos(angle) * dist - 35, y: cy + Math.sin(angle) * dist - 35, w: 70, h: 70, type: 'DESTRUCTIBLE', hp: 100, maxHp: 100 });
    }
    // Bushes for hiding
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.4;
      walls.push({ x: cx + Math.cos(angle) * 180 - 40, y: cy + Math.sin(angle) * 180 - 40, w: 80, h: 80, type: 'BUSH' });
    }
    // Crates with various drops
    const ggDrops: ItemType[] = ['HEALTH', 'AMMO', 'SPEED_BOOST', 'DAMAGE_BOOST'];
    for (let i = 0; i < 4; i++) {
      walls.push({ x: rand() * (MAP_SIZE - 200) + 100, y: rand() * (MAP_SIZE - 200) + 100, w: 26, h: 26, type: 'CRATE', hp: 30, maxHp: 30, dropType: ggDrops[i] });
    }
  } else if (mode === 'TEAM_DEATHMATCH') {
    // TDM gets crates for pickups and some cover
    const numWalls = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < numWalls; i++) {
      const x = rand() * (MAP_SIZE - 200) + 100;
      const y = rand() * (MAP_SIZE - 200) + 100;
      const w = rand() * 50 + 30;
      const h = rand() * 50 + 30;
      walls.push({ x, y, w, h, type: rand() < 0.2 ? 'DESTRUCTIBLE' : 'SOLID', hp: 100, maxHp: 100 });
    }
    // Lots of crates with weapons and items
    const dropTypes: ItemType[] = ['HEALTH', 'HEALTH', 'AMMO', 'AMMO', 'WEAPON_SHOTGUN', 'WEAPON_RIFLE', 'WEAPON_MACHINE_GUN', 'WEAPON_BAT', 'SPEED_BOOST', 'DAMAGE_BOOST'];
    for (let i = 0; i < 10; i++) {
    walls.push({
        x: rand() * (MAP_SIZE - 80) + 40, 
        y: rand() * (MAP_SIZE - 80) + 40, 
        w: 28, h: 28, 
        type: 'CRATE', 
        hp: 35, maxHp: 35,
        dropType: dropTypes[Math.floor(rand() * dropTypes.length)]
      });
    }
    // Bushes for hiding (crucial for TDM)
    for (let i = 0; i < 6; i++) {
      walls.push({ x: rand() * (MAP_SIZE - 100) + 40, y: rand() * (MAP_SIZE - 100) + 40, w: rand() * 60 + 50, h: rand() * 60 + 50, type: 'BUSH' });
    }
    // Big ponds (impassable water) - up to 4x bigger
    for (let i = 0; i < 2; i++) {
      walls.push({ x: rand() * (MAP_SIZE - 200) + 60, y: rand() * (MAP_SIZE - 200) + 60, w: rand() * 100 + 80, h: rand() * 100 + 80, type: 'POND' });
    }
    // Swamps (slow down players)
    for (let i = 0; i < 2; i++) {
      walls.push({ x: rand() * (MAP_SIZE - 120) + 40, y: rand() * (MAP_SIZE - 120) + 40, w: rand() * 60 + 50, h: rand() * 60 + 50, type: 'SWAMP' });
    }
  } else {
    // Zombie Survival - lots of obstacles and MANY crates
    // Helper to check if position overlaps with existing walls
    const overlapsExisting = (x: number, y: number, w: number, h: number, margin: number = 10): boolean => {
      return walls.some(wall => 
        x < wall.x + wall.w + margin && x + w + margin > wall.x &&
        y < wall.y + wall.h + margin && y + h + margin > wall.y
      );
    };
    
    const placeWall = (wType: Wall['type'], ww: number, wh: number, props: Partial<Wall> = {}): boolean => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = rand() * (MAP_SIZE - ww - 80) + 40;
        const y = rand() * (MAP_SIZE - wh - 80) + 40;
        if (!overlapsExisting(x, y, ww, wh)) {
          walls.push({ x, y, w: ww, h: wh, type: wType, ...props } as Wall);
          return true;
        }
      }
      return false;
    };
    
    // Maximum crates/items limit to avoid cluttering
    const MAX_CRATES = 35;
    let crateCount = 0;
    
    // Solid/destructible walls
    const numWalls = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < numWalls; i++) {
      const w = rand() * 60 + 30;
      const h = rand() * 60 + 30;
      placeWall(rand() < 0.3 ? 'DESTRUCTIBLE' : 'SOLID', w, h, { hp: 150, maxHp: 150 });
    }
    // Explosive barrels - DOUBLED (8 barrels)
    for (let i = 0; i < 8; i++) {
      placeWall('BARREL', 25, 25, { hp: 50, maxHp: 50 });
    }
    // Health crates (red tint) - 6 crates for more healing
    for (let i = 0; i < 6 && crateCount < MAX_CRATES; i++) {
      if (placeWall('CRATE', 28, 28, { hp: 30, maxHp: 30, dropType: 'HEALTH' })) crateCount++;
    }
    // Shield crates (blue tint) - 4 crates
    for (let i = 0; i < 4 && crateCount < MAX_CRATES; i++) {
      if (placeWall('CRATE', 28, 28, { hp: 30, maxHp: 30, dropType: 'SHIELD' })) crateCount++;
    }
    // Ammo crates - 6 crates
    for (let i = 0; i < 6 && crateCount < MAX_CRATES; i++) {
      if (placeWall('CRATE', 28, 28, { hp: 30, maxHp: 30, dropType: 'AMMO' })) crateCount++;
    }
    // Power-up crates - only 1 crate
    const boostDrops: ItemType[] = ['SPEED_BOOST', 'DAMAGE_BOOST'];
    if (crateCount < MAX_CRATES) {
      if (placeWall('CRATE', 28, 28, { hp: 30, maxHp: 30, dropType: boostDrops[Math.floor(rand() * boostDrops.length)] })) crateCount++;
    }
    // Weapon crates (purple tint) - 10 crates, but bat/chainsaw are RARE
    // Ranged weapons are more common (85%), melee is rare (15%)
    const rangedWeapons: ItemType[] = ['WEAPON_SHOTGUN', 'WEAPON_RIFLE', 'WEAPON_MACHINE_GUN', 'WEAPON_SHOTGUN', 'WEAPON_RIFLE', 'WEAPON_LANDMINE'];
    const meleeWeapons: ItemType[] = ['WEAPON_BAT', 'WEAPON_CHAINSAW'];
    for (let i = 0; i < 10 && crateCount < MAX_CRATES; i++) {
      const isMelee = rand() < 0.12; // Only 12% chance for melee weapons
      const weaponDrop = isMelee 
        ? meleeWeapons[Math.floor(rand() * meleeWeapons.length)]
        : rangedWeapons[Math.floor(rand() * rangedWeapons.length)];
      if (placeWall('CRATE', 28, 28, { hp: 40, maxHp: 40, dropType: weaponDrop })) crateCount++;
    }
    // Bushes (hide in all modes)
    for (let i = 0; i < 4; i++) {
      const bw = rand() * 60 + 50, bh = rand() * 60 + 50;
      placeWall('BUSH', bw, bh);
    }
    // HUGE Ponds (impassable) - up to 4x the original size
    for (let i = 0; i < 2; i++) {
      const pw = rand() * 120 + 100, ph = rand() * 120 + 100;
      placeWall('POND', pw, ph);
    }
    // Swamps (slow down players and zombies) - up to 2x BIGGER by chance!
    for (let i = 0; i < 4; i++) {
      const isBig = rand() < 0.4; // 40% chance for double size
      const sw = (rand() * 60 + 50) * (isBig ? 2 : 1);
      const sh = (rand() * 60 + 50) * (isBig ? 2 : 1);
      placeWall('SWAMP', sw, sh);
    }
  }
  return walls;
};

const checkCollision = (r1: {x:number,y:number,w:number,h:number}, r2: {x:number,y:number,w:number,h:number}) => 
  r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;

const checkCircleCollision = (c1: {x:number,y:number,r:number}, c2: {x:number,y:number,r:number}) => 
  Math.sqrt((c1.x - c2.x) ** 2 + (c1.y - c2.y) ** 2) < c1.r + c2.r;

// Improved collision with sliding (reduced friction)
const resolveWallCollision = (x: number, y: number, radius: number, walls: Wall[]): { x: number; y: number } => {
  let newX = x, newY = y;
  for (const w of walls) {
    // BUSH, WATER, and SWAMP are passable (can walk through), everything else blocks
    if (w.type === 'BUSH' || w.type === 'WATER' || w.type === 'SWAMP') continue;
    const closestX = Math.max(w.x, Math.min(newX, w.x + w.w));
    const closestY = Math.max(w.y, Math.min(newY, w.y + w.h));
    const distX = newX - closestX;
    const distY = newY - closestY;
    const dist = Math.sqrt(distX * distX + distY * distY);
    if (dist < radius && dist > 0) {
      const overlap = radius - dist + 0.5; // Small extra push
      newX += (distX / dist) * overlap;
      newY += (distY / dist) * overlap;
    }
  }
  return { x: Math.max(radius, Math.min(MAP_SIZE - radius, newX)), y: Math.max(radius, Math.min(MAP_SIZE - radius, newY)) };
};

// Ball collision with walls - bounce physics
const resolveBallWallCollision = (ball: Ball, walls: Wall[]): void => {
  for (const w of walls) {
    if (w.type === 'BUSH' || w.type === 'WATER') continue;
    const closestX = Math.max(w.x, Math.min(ball.x, w.x + w.w));
    const closestY = Math.max(w.y, Math.min(ball.y, w.y + w.h));
    const distX = ball.x - closestX;
    const distY = ball.y - closestY;
    const dist = Math.sqrt(distX * distX + distY * distY);
    if (dist < BALL_RADIUS) {
      // Push out
      if (dist > 0) {
        const overlap = BALL_RADIUS - dist + 1;
        ball.x += (distX / dist) * overlap;
        ball.y += (distY / dist) * overlap;
        // Bounce
        if (Math.abs(distX) > Math.abs(distY)) ball.vx *= -0.6;
        else ball.vy *= -0.6;
      } else {
        // Stuck inside - push out strongly
        ball.x = w.x + w.w / 2 > ball.x ? w.x - BALL_RADIUS - 5 : w.x + w.w + BALL_RADIUS + 5;
        ball.vx *= -0.5;
      }
    }
  }
  // Border bounce
  if (ball.x < BALL_RADIUS) { ball.x = BALL_RADIUS; ball.vx = Math.abs(ball.vx) * 0.7; }
  if (ball.x > MAP_SIZE - BALL_RADIUS) { ball.x = MAP_SIZE - BALL_RADIUS; ball.vx = -Math.abs(ball.vx) * 0.7; }
  if (ball.y < BALL_RADIUS) { ball.y = BALL_RADIUS; ball.vy = Math.abs(ball.vy) * 0.7; }
  if (ball.y > MAP_SIZE - BALL_RADIUS) { ball.y = MAP_SIZE - BALL_RADIUS; ball.vy = -Math.abs(ball.vy) * 0.7; }
};

const getSafePosition = (walls: Wall[], team?: Team): { x: number; y: number } => {
  for (let attempts = 0; attempts < 50; attempts++) {
    let x, y;
    if (team === 'RED') { x = Math.random() * 200 + 100; y = Math.random() * (MAP_SIZE - 200) + 100; }
    else if (team === 'BLUE') { x = MAP_SIZE - Math.random() * 200 - 100; y = Math.random() * (MAP_SIZE - 200) + 100; }
    else { x = Math.random() * (MAP_SIZE - 200) + 100; y = Math.random() * (MAP_SIZE - 200) + 100; }
    const rect = { x: x - PLAYER_RADIUS * 2, y: y - PLAYER_RADIUS * 2, w: PLAYER_RADIUS * 4, h: PLAYER_RADIUS * 4 };
    if (!walls.filter(w => w.type !== 'BUSH' && w.type !== 'WATER').some(w => checkCollision(rect, w))) return { x, y };
  }
  return { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
};

const createWeapon = (type: WeaponType): Weapon => {
  const s = WEAPON_STATS[type];
  return { type, ammo: type === 'PISTOL' ? -1 : s.maxAmmo, maxAmmo: s.maxAmmo, fireRate: s.fireRate, damage: s.damage, speed: s.speed, spread: s.spread, lastShotTime: 0, unlockWave: s.unlockWave };
};

const createPlayer = (id: string, name: string, walls: Wall[], team: Team = 'NONE', colorIndex: number = 0, isBot: boolean = false, difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'NIGHTMARE' = 'NIGHTMARE'): Player => {
  const pos = getSafePosition(walls, team);
  const diffMult = getDifficultyMultipliers(difficulty);
  const baseHp = Math.round(100 * diffMult.playerHpMult);
  return {
    id, name, x: pos.x, y: pos.y, rotation: 0, aimRotation: 0, hp: baseHp, maxHp: baseHp, score: 0, kills: 0, deaths: 0,
    color: PLAYER_COLORS[colorIndex % PLAYER_COLORS.length], team, isBot, isZombie: false, dead: false,
    weapons: [createWeapon('PISTOL')], currentWeaponIndex: 0, ping: 0, animFrame: 0, isMoving: false, lastMoveTime: 0,
    speedBoostUntil: 0, damageBoostUntil: 0, slowedUntil: 0, blurredUntil: 0, stunnedUntil: 0, slimeCoveredUntil: 0, tongueGrabbedBy: null,
    waveSurvived: 0, gems: 0, hasBall: false, canPickBallAt: 0, respawnAt: 0,
    level: 1, damageMultiplier: diffMult.playerDamageMult, fireRateMultiplier: 1.0, ammoMultiplier: 1.0, inBush: false,
    shield: 0, maxShield: 50, fireRateBoostUntil: 0, wallKits: 0,
  };
};

export const initGame = (hostName: string, roomId: string, roomName: string, settings: GameSettings): GameState => {
  const walls = generateMap(roomId, settings.gameMode);
  const hostPlayer = createPlayer('host', hostName, walls, settings.gameMode === 'BRAWL_BALL' ? 'RED' : 'NONE', 0, false, settings.difficulty);
  
  // Apply difficulty to zombie count
  const diffMult = getDifficultyMultipliers(settings.difficulty);
  const baseZombiesToSpawn = Math.round(8 * diffMult.zombieCountMult);
  
  const state: GameState = {
    roomId, roomName, isHost: true, settings, players: [hostPlayer], zombies: [], bullets: [], particles: [], items: [], walls,
    myId: 'host', gameTime: 0, wave: 1, waveState: 'FIGHTING', waveRestStartTime: 0, zombiesKilledThisWave: 0,
    zombiesToSpawnThisWave: baseZombiesToSpawn, zombiesSpawnedThisWave: 0, lastZombieSpawnTime: 0, lastItemSpawnTime: 0,
    teamScores: { RED: 0, BLUE: 0 }, matchStartTime: Date.now(), matchTimeRemaining: settings.timeLimit,
    lastGoalTime: 0, goalCelebrationUntil: 0, announcements: [], gameOver: false, survivalTime: 0, showEndScreen: false, endScreenStartTime: 0,
  };

  if (settings.gameMode === 'BRAWL_BALL') {
    state.ball = { x: MAP_SIZE / 2, y: MAP_SIZE / 2, vx: 0, vy: 0, heldBy: null, rotation: 0 };
    // Goals: team color = team that defends this goal
    // RED spawns left, so RED defends left goal
    // BLUE spawns right, so BLUE defends right goal
    state.goals = [
      { x: 0, y: MAP_SIZE / 2 - 100, w: 50, h: 200, team: 'RED' },      // RED's goal (left)
      { x: MAP_SIZE - 50, y: MAP_SIZE / 2 - 100, w: 50, h: 200, team: 'BLUE' },  // BLUE's goal (right)
    ];
    // Add bots for 3v3
    for (let i = 0; i < 2; i++) state.players.push(createPlayer(`bot-red-${i}`, `RedBot${i+1}`, walls, 'RED', i + 1, true, settings.difficulty));
    for (let i = 0; i < 3; i++) state.players.push(createPlayer(`bot-blue-${i}`, `BlueBot${i+1}`, walls, 'BLUE', i + 4, true, settings.difficulty));
  } else if (settings.gameMode === 'GEM_GRAB') {
    for (let i = 0; i < 12; i++) {
      const pos = getSafePosition(walls);
      state.items.push({ id: uuid(), x: pos.x, y: pos.y, type: 'GEM', rotation: 0, value: 1 });
    }
  }
  return state;
};

export const addPlayer = (state: GameState, playerId: string, name: string): GameState => {
  let team: Team = 'NONE';
  if (state.settings.gameMode === 'BRAWL_BALL' || state.settings.gameMode === 'TEAM_DEATHMATCH') {
    const redCount = state.players.filter(p => p.team === 'RED' && !p.isBot).length;
    const blueCount = state.players.filter(p => p.team === 'BLUE' && !p.isBot).length;
    team = redCount <= blueCount ? 'RED' : 'BLUE';
    const botToRemove = state.players.find(p => p.isBot && p.team === team);
    if (botToRemove) state.players = state.players.filter(p => p.id !== botToRemove.id);
  }
  return { ...state, players: [...state.players, createPlayer(playerId, name, state.walls, team, state.players.length, false, state.settings.difficulty)] };
};

export const removePlayer = (state: GameState, playerId: string): GameState => ({ ...state, players: state.players.filter(p => p.id !== playerId) });

const getZombiesForWave = (wave: number, difficulty: 'EASY' | 'NORMAL' | 'HARD' | 'NIGHTMARE'): number => {
  const base = 6 + wave * 3;
  const diffMult = getDifficultyMultipliers(difficulty);
  // NIGHTMARE is now baseline (1.0), easier modes have fewer zombies
  return Math.floor(base * diffMult.zombieCountMult);
};

const spawnZombie = (state: GameState): Zombie | null => {
  const wave = state.wave;
  const types = (Object.entries(ZOMBIE_TYPES) as [ZombieType, typeof ZOMBIE_TYPES[ZombieType]][]).filter(([_, t]) => wave >= t.minWave && t.spawnWeight > 0);
  const totalWeight = types.reduce((s, [_, t]) => s + t.spawnWeight, 0);
  let rand = Math.random() * totalWeight;
  let chosenType: ZombieType = 'NORMAL';
  for (const [type, t] of types) { rand -= t.spawnWeight; if (rand <= 0) { chosenType = type; break; } }
  
  // Boss logic - spawn boss every 5 waves, with more bosses at higher waves
  const bossCount = Math.floor(wave / 5); // Number of bosses this wave should have
  const isBoss = wave % 5 === 0 && state.zombiesSpawnedThisWave < bossCount;
  // Also spawn mini-bosses (tanks) more frequently at higher waves
  const isMiniBoss = !isBoss && wave >= 8 && Math.random() < 0.05;
  
  // Boss types - rotate between boss types at higher waves
  if (isBoss) {
    const bossIndex = state.zombiesSpawnedThisWave % 3; // Rotate through 3 boss types
    if (wave >= 10) {
      if (bossIndex === 0) chosenType = 'BOSS';
      else if (bossIndex === 1) chosenType = 'FLAME_BOSS';
      else chosenType = 'WITCH'; // WITCH boss spawns at wave 10+!
    } else if (wave >= 8) {
      chosenType = state.zombiesSpawnedThisWave % 2 === 0 ? 'BOSS' : 'FLAME_BOSS';
    } else {
      chosenType = 'BOSS';
    }
  }
  else if (isMiniBoss) chosenType = 'TANK';
  
  const zType = ZOMBIE_TYPES[chosenType];
  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (edge === 0) { x = 60; y = Math.random() * MAP_SIZE; }
  else if (edge === 1) { x = MAP_SIZE - 60; y = Math.random() * MAP_SIZE; }
  else if (edge === 2) { x = Math.random() * MAP_SIZE; y = 60; }
  else { x = Math.random() * MAP_SIZE; y = MAP_SIZE - 60; }
  
  // Scale boss stats with wave number
  const waveMultiplier = 1 + wave * 0.1;
  const bossMultiplier = isBoss ? (1 + Math.floor(wave / 5) * 0.3) : 1; // Bosses get stronger each time
  
    return {
    id: `zombie-${uuid()}`, x, y, rotation: 0, 
    hp: zType.hp * waveMultiplier * bossMultiplier, 
    maxHp: zType.hp * waveMultiplier * bossMultiplier,
    speed: zType.speed * (isBoss && wave >= 10 ? 1.2 : 1), // Faster bosses at wave 10+
    type: chosenType, targetId: null, lastAttackTime: 0, 
    attackRange: zType.attackRange,
    attackDamage: (zType.attackDamage + Math.floor(wave * 1.5)) * bossMultiplier,
    animFrame: 0, lastProjectileTime: 0, isBoss 
  };
};

const lerpAngle = (from: number, to: number, t: number): number => {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
};

// Smarter AI for Brawl Ball
const updateBotInput = (bot: Player, state: GameState): InputState => {
  const input: InputState = { up: false, down: false, left: false, right: false, fire: false, switchWeapon: false };
  const ball = state.ball;
  const walls = state.walls;
  
  // Helper to move toward a point while avoiding walls
  const moveToward = (targetX: number, targetY: number, speed: number = 1) => {
    let dx = targetX - bot.x;
    let dy = targetY - bot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) return;
    
    // Check if direct path is blocked
    const testX = bot.x + (dx / dist) * 30;
    const testY = bot.y + (dy / dist) * 30;
    const blocked = walls.some(w => w.type !== 'BUSH' && w.type !== 'WATER' &&
      testX > w.x - PLAYER_RADIUS && testX < w.x + w.w + PLAYER_RADIUS &&
      testY > w.y - PLAYER_RADIUS && testY < w.y + w.h + PLAYER_RADIUS);
    
    if (blocked) {
      // Try to go around - pick perpendicular direction
      const perpX = -dy / dist;
      const perpY = dx / dist;
      dx = perpX * 50 + dx * 0.3;
      dy = perpY * 50 + dy * 0.3;
    }
    
    if (dx > 15 * speed) input.right = true;
    if (dx < -15 * speed) input.left = true;
    if (dy > 15 * speed) input.down = true;
    if (dy < -15 * speed) input.up = true;
  };

  if (state.settings.gameMode === 'BRAWL_BALL' && ball) {
    const teammates = state.players.filter(p => p.team === bot.team && p.id !== bot.id && !p.dead);
    const enemies = state.players.filter(p => p.team !== bot.team && p.team !== 'NONE' && !p.dead);
    const goalX = bot.team === 'RED' ? MAP_SIZE - 25 : 25;
    const ownGoalX = bot.team === 'RED' ? 25 : MAP_SIZE - 25;
    
    // Determine role based on position
    const myDistToBall = Math.sqrt((ball.x - bot.x) ** 2 + (ball.y - bot.y) ** 2);
    const teammatesCloserToBall = teammates.filter(t => Math.sqrt((ball.x - t.x) ** 2 + (ball.y - t.y) ** 2) < myDistToBall).length;
    
    if (bot.hasBall) {
      // Has ball - SHOOT AT GOAL if close enough or clear shot!
      const distToGoal = Math.abs(bot.x - goalX);
      const goalCenterY = MAP_SIZE / 2;
      
      // Check for enemies blocking path to goal
      const enemiesBlocking = enemies.filter(e => {
        const ex = e.x, ey = e.y;
        // Is enemy between bot and goal?
        const toGoalX = goalX - bot.x;
        const toEnemyX = ex - bot.x;
        if (Math.sign(toGoalX) !== Math.sign(toEnemyX)) return false;
        if (Math.abs(toEnemyX) > Math.abs(toGoalX)) return false;
        // Check if enemy is in the shooting lane
        const pathY = bot.y + (ey - bot.y) * (toEnemyX / toGoalX);
        return Math.abs(pathY - goalCenterY) < 80;
      });
      
      const hasClearShot = enemiesBlocking.length === 0;
      
      // PRIORITY 1: Shoot if close to goal OR have clear shot
      if (distToGoal < 350 || (distToGoal < 500 && hasClearShot)) {
        input.fire = true;
        input.mouseX = goalX;
        input.mouseY = goalCenterY + (Math.random() - 0.5) * 100; // Slight variation
        // Still move toward goal while shooting
        moveToward(goalX, goalCenterY, 0.7);
      } else {
        // Check if teammate is in better position to pass
        const nearestEnemy = enemies.reduce((closest, e) => {
          const d = Math.sqrt((e.x - bot.x) ** 2 + (e.y - bot.y) ** 2);
          return d < closest.dist ? { p: e, dist: d } : closest;
        }, { p: null as Player | null, dist: Infinity });
        
        const betterTeammate = teammates.find(t => {
          const tDistToGoal = Math.abs(goalX - t.x);
          const myDistToGoal = distToGoal;
          return tDistToGoal < myDistToGoal - 150 && Math.sqrt((t.x - bot.x) ** 2 + (t.y - bot.y) ** 2) < 350;
        });
        
        if (betterTeammate && nearestEnemy.dist < 120) {
          // Pass to teammate who is closer to goal
          input.fire = true;
          input.mouseX = betterTeammate.x + (goalX > bot.x ? 30 : -30); // Lead the pass
          input.mouseY = betterTeammate.y;
        } else {
          // Move toward goal
          moveToward(goalX, goalCenterY, 0.85);
        }
      }
    } else if (!ball.heldBy) {
      // Ball is free
      if (teammatesCloserToBall === 0) {
        // I'm closest - go for ball
        moveToward(ball.x, ball.y, 1);
      } else if (teammatesCloserToBall === 1) {
        // Support - stay between ball and goal
        moveToward((ball.x + goalX) / 2, ball.y, 0.6);
      } else {
        // Stay back near own goal
        moveToward(ownGoalX + (bot.team === 'RED' ? 200 : -200), MAP_SIZE / 2 + (Math.random() - 0.5) * 200, 0.5);
      }
    } else {
      // Someone has the ball
      const holder = state.players.find(p => p.id === ball.heldBy);
      if (holder) {
        if (holder.team === bot.team) {
          // Teammate has ball - get open for pass
          moveToward(goalX - (bot.team === 'RED' ? 200 : -200), holder.y + (Math.random() - 0.5) * 300, 0.6);
        } else {
          // Enemy has ball - defend
          const distToHolder = Math.sqrt((holder.x - bot.x) ** 2 + (holder.y - bot.y) ** 2);
          if (distToHolder < 200 || Math.abs(holder.x - ownGoalX) < 300) {
            // Chase and attack
            moveToward(holder.x, holder.y, 0.9);
            if (distToHolder < 150) {
              input.fire = true;
              input.mouseX = holder.x;
              input.mouseY = holder.y;
            }
          } else {
            // Position between holder and goal
            moveToward((holder.x + ownGoalX) / 2, holder.y, 0.7);
          }
        }
      }
    }
  } else {
    // Default combat AI
    let nearestEnemy: Player | Zombie | null = null;
    let minDist = Infinity;
    for (const p of state.players) {
      if (p.id === bot.id || p.dead || (state.settings.gameMode !== 'ZOMBIE_SURVIVAL' && p.team === bot.team)) continue;
      const d = Math.sqrt((p.x - bot.x) ** 2 + (p.y - bot.y) ** 2);
      if (d < minDist) { minDist = d; nearestEnemy = p; }
    }
    for (const z of state.zombies) {
      const d = Math.sqrt((z.x - bot.x) ** 2 + (z.y - bot.y) ** 2);
      if (d < minDist) { minDist = d; nearestEnemy = z; }
    }
    if (nearestEnemy) {
      if (minDist > 180) moveToward(nearestEnemy.x, nearestEnemy.y, 0.8);
      else if (minDist < 80) moveToward(bot.x * 2 - nearestEnemy.x, bot.y * 2 - nearestEnemy.y, 0.6); // Back away
      input.fire = minDist < 350;
      input.mouseX = nearestEnemy.x;
      input.mouseY = nearestEnemy.y;
    }
  }
  return input;
};

export const updateGame = (state: GameState, inputs: Record<string, InputState>, dt: number): GameState => {
  if (state.gameOver) return state;

  const now = Date.now();
  let nextPlayers = state.players.map(p => ({ ...p }));
  let nextZombies = state.zombies.map(z => ({ ...z }));
  let nextBullets = state.bullets.map(b => ({ ...b }));
  let nextParticles = state.particles.map(p => ({ ...p }));
  let nextItems = state.items.map(i => ({ ...i }));
  let nextWalls = state.walls.map(w => ({ ...w }));
  let nextBall = state.ball ? { ...state.ball } : undefined;
  
  let nextWave = state.wave;
  let nextWaveState = state.waveState;
  let nextWaveRestStartTime = state.waveRestStartTime;
  let nextZombiesKilledThisWave = state.zombiesKilledThisWave;
  let nextZombiesToSpawnThisWave = state.zombiesToSpawnThisWave;
  let nextZombiesSpawnedThisWave = state.zombiesSpawnedThisWave;
  let nextLastZombieSpawnTime = state.lastZombieSpawnTime;
  let nextLastItemSpawnTime = state.lastItemSpawnTime;
  let nextTeamScores = { ...state.teamScores };
  let nextMatchTimeRemaining = state.matchTimeRemaining;
  // Filter expired announcements
  let nextAnnouncements = state.announcements.filter(a => now - a.startTime < a.duration);
  let gameOver = false;
  let winnerTeam: Team | undefined = state.winnerTeam; // Preserve winner from previous state!
  let showEndScreen = state.showEndScreen;
  let endScreenStartTime = state.endScreenStartTime;

  const alivePlayers = nextPlayers.filter(p => !p.dead);
  
  // Time-based modes
  if (state.settings.gameMode === 'GEM_GRAB' || state.settings.gameMode === 'BRAWL_BALL') {
    nextMatchTimeRemaining = state.settings.timeLimit - (now - state.matchStartTime) / 1000;
    if (nextMatchTimeRemaining <= 0 && !showEndScreen) {
      showEndScreen = true;
      endScreenStartTime = now;
      if (state.settings.gameMode === 'GEM_GRAB') {
        // Find player with most gems
        let maxGems = -1;
        let winningPlayer: Player | null = null;
        nextPlayers.forEach(p => {
          if (p.gems > maxGems) {
            maxGems = p.gems;
            winningPlayer = p;
          }
        });
        // Only tie if EXACTLY equal gems (including 0 vs 0)
        const playersWithMaxGems = nextPlayers.filter(p => p.gems === maxGems);
        if (playersWithMaxGems.length > 1 && maxGems > 0) {
          // Check if different teams
          const teams = new Set(playersWithMaxGems.map(p => p.team));
          if (teams.size > 1) winnerTeam = undefined; // True tie between teams
          else winnerTeam = playersWithMaxGems[0].team;
        } else if (winningPlayer) {
          winnerTeam = winningPlayer.team !== 'NONE' ? winningPlayer.team : 'RED'; // Default winner
        }
      } else {
        // Brawl Ball - compare team scores directly
        if (nextTeamScores.RED > nextTeamScores.BLUE) winnerTeam = 'RED';
        else if (nextTeamScores.BLUE > nextTeamScores.RED) winnerTeam = 'BLUE';
        else winnerTeam = undefined; // Only tie if scores are exactly equal
      }
    }
  }
  
  // Brawl Ball win
  if (state.settings.gameMode === 'BRAWL_BALL' && !showEndScreen) {
    if (nextTeamScores.RED >= 2 || nextTeamScores.BLUE >= 2) {
      showEndScreen = true;
      endScreenStartTime = now;
      winnerTeam = nextTeamScores.RED >= 2 ? 'RED' : 'BLUE';
    }
  }

  // Zombie survival
  if (state.settings.gameMode === 'ZOMBIE_SURVIVAL') {
    if (alivePlayers.filter(p => !p.isBot).length === 0 && !showEndScreen) {
      showEndScreen = true;
      endScreenStartTime = now;
    }
    if (nextWaveState === 'FIGHTING') {
  if (nextZombiesKilledThisWave >= nextZombiesToSpawnThisWave && nextZombies.length === 0) {
        nextWaveState = 'REST';
        nextWaveRestStartTime = now;
        audioService.playWaveComplete();
        nextAnnouncements = addAnnouncement(nextAnnouncements, `🎉 Wave ${nextWave} Complete!`, '#44ff44', 3000);
        const newWave = nextWave + 1;
        for (const [type, stats] of Object.entries(WEAPON_STATS)) {
          if (stats.unlockWave === newWave) {
            nextAnnouncements = addAnnouncement(nextAnnouncements, `🔓 ${stats.name} Unlocked!`, '#ffdd00', 4000);
          }
        }
      }
      const spawnInterval = 700 / state.settings.zombieSpawnRate;
      if (nextZombiesSpawnedThisWave < nextZombiesToSpawnThisWave && nextZombies.length < state.settings.maxZombies && now - nextLastZombieSpawnTime > spawnInterval) {
        const zombie = spawnZombie(state);
        if (zombie) { nextZombies.push(zombie); nextZombiesSpawnedThisWave++; nextLastZombieSpawnTime = now; }
      }
    } else if (nextWaveState === 'REST' && now - nextWaveRestStartTime >= WAVE_REST_TIME) {
    nextWave++;
      nextWaveState = 'FIGHTING';
    nextZombiesKilledThisWave = 0;
      nextZombiesToSpawnThisWave = getZombiesForWave(nextWave, state.settings.difficulty);
      nextZombiesSpawnedThisWave = 0;
      
      // Spawn new crates each wave!
      const crateTypes: ItemType[] = ['HEALTH', 'HEALTH', 'AMMO', 'AMMO', 'SHIELD', 'SPEED_BOOST', 'DAMAGE_BOOST'];
      const weaponDrops: ItemType[] = ['WEAPON_SHOTGUN', 'WEAPON_RIFLE', 'WEAPON_BAT', 'WEAPON_MACHINE_GUN'];
      const numCrates = 3 + Math.floor(nextWave / 2); // More crates at higher waves
      for (let ci = 0; ci < numCrates; ci++) {
        const pos = getSafePosition(nextWalls);
        const isWeaponCrate = Math.random() < 0.3;
        const dropType = isWeaponCrate ? weaponDrops[Math.floor(Math.random() * weaponDrops.length)] : crateTypes[Math.floor(Math.random() * crateTypes.length)];
        nextWalls.push({ x: pos.x - 14, y: pos.y - 14, w: 28, h: 28, type: 'CRATE', hp: 35, maxHp: 35, dropType });
      }
      
      // Wave 10+: Add wall kit crates for building asylum walls
      if (nextWave >= 10) {
        const numWallKitCrates = 1 + Math.floor((nextWave - 10) / 3);
        for (let wki = 0; wki < numWallKitCrates; wki++) {
          const pos = getSafePosition(nextWalls);
          nextWalls.push({ x: pos.x - 14, y: pos.y - 14, w: 28, h: 28, type: 'CRATE', hp: 35, maxHp: 35, dropType: 'WALL_KIT' });
        }
        nextAnnouncements = addAnnouncement(nextAnnouncements, `🧱 Wall Kit Crates Available!`, '#8866aa', 2500);
      }
      
      nextAnnouncements = addAnnouncement(nextAnnouncements, `🎁 ${numCrates} Supply Crates Dropped!`, '#88aaff', 2500);
      
      // Level up players each wave! Using wave progression bonuses
      const waveBonus = getWaveBonus(nextWave);
    nextPlayers.forEach(p => {
        if (!p.dead) {
          p.waveSurvived = nextWave - 1;
          p.level = nextWave;
          
          // Apply wave bonuses: +10% HP/ammo, +5% fire rate per wave
          const diffMult = getDifficultyMultipliers(state.settings.difficulty);
          const baseHp = Math.round(100 * diffMult.playerHpMult);
          p.maxHp = Math.round(baseHp * waveBonus.hpBonus);
          p.hp = Math.min(p.hp + 20, p.maxHp); // Heal 20 HP on wave up, cap at new max
          
          p.damageMultiplier = diffMult.playerDamageMult * (1 + (nextWave - 1) * 0.05); // +5% damage per wave on top of difficulty
          p.fireRateMultiplier = 1 / waveBonus.fireRateBonus; // Lower = faster (5% faster per wave)
          p.ammoMultiplier = waveBonus.ammoBonus; // +10% ammo per wave
          
          // Refill some ammo on level up
          p.weapons.forEach(w => { if (w.ammo !== -1) w.ammo = Math.min(Math.round(w.maxAmmo * p.ammoMultiplier), w.ammo + 15); });
          
          // Announce level up
          nextParticles.push({ id: uuid(), x: p.x, y: p.y - 30, vx: 0, vy: -1, life: 1.5, color: '#ffff00', size: 14, type: 'TEXT', text: `⬆️ LVL ${nextWave}!` });
        }
      });
      nextAnnouncements = addAnnouncement(nextAnnouncements, `📈 Level Up! HP+10%, Ammo+10%, Fire Rate+5%`, '#ffff00', 3000);
    }
  }

  // Item spawning - mostly from crates, minimal ground spawns
  // SCALE with wave: more items spawn in higher waves!
  const waveMultiplier = state.settings.gameMode === 'ZOMBIE_SURVIVAL' ? Math.max(1, 1 + (state.wave - 1) * 0.1) : 1; // +10% per wave
  const baseInterval = state.settings.gameMode === 'GEM_GRAB' ? 4000 : 10000;
  const spawnInterval = Math.max(4000, baseInterval / waveMultiplier); // Faster spawns at higher waves
  const baseMaxItems = state.settings.gameMode === 'GEM_GRAB' ? 15 : 6;
  const maxItems = Math.floor(baseMaxItems * waveMultiplier); // More items at higher waves
  
  // EMERGENCY HEALTH: Check if any player is low on health for a while and no health pickups nearby
  let forceHealthSpawn = false;
  if (state.settings.gameMode === 'ZOMBIE_SURVIVAL') {
    for (const p of nextPlayers) {
      if (p.dead) continue;
      const healthRatio = p.hp / p.maxHp;
      if (healthRatio < 0.25) {
        // Check if player has been low health (use lastDamageTime approximation)
        const nearbyHealth = nextItems.filter(i => 
          (i.type === 'HEALTH' || i.type === 'SHIELD') && 
          Math.sqrt((i.x - p.x) ** 2 + (i.y - p.y) ** 2) < 300
        ).length;
        if (nearbyHealth === 0) {
          forceHealthSpawn = true;
          break;
        }
      }
    }
  }
  
  if ((now - nextLastItemSpawnTime > spawnInterval || forceHealthSpawn) && 
      nextItems.filter(i => i.type !== 'VENOM_PUDDLE' && i.type !== 'MINE').length < maxItems) {
    const pos = getSafePosition(state.walls);
    let type: ItemType = 'HEALTH';
    const rand = Math.random();
    if (state.settings.gameMode === 'GEM_GRAB') {
      type = 'GEM';
    } else if (state.settings.gameMode === 'ZOMBIE_SURVIVAL') {
      // Zombie mode: more health, especially when forced spawn
      if (forceHealthSpawn || rand < 0.65) type = 'HEALTH';
      else if (rand < 0.85) type = 'AMMO';
      else type = 'SHIELD';
    } else {
      // PvP modes: health and ammo
      if (rand < 0.6) type = 'HEALTH';
      else type = 'AMMO';
    }
    nextItems.push({ id: uuid(), x: pos.x, y: pos.y, type, rotation: 0, value: type === 'GEM' ? 1 : undefined });
    nextLastItemSpawnTime = now;
    
    // If emergency spawn, add another health nearby
    if (forceHealthSpawn && Math.random() < 0.5) {
      const pos2 = { x: pos.x + (Math.random() - 0.5) * 100, y: pos.y + (Math.random() - 0.5) * 100 };
      nextItems.push({ id: uuid(), x: pos2.x, y: pos2.y, type: 'HEALTH', rotation: 0 });
    }
  }

  nextItems.forEach(item => { item.rotation += 0.05; });

  // Player updates
  nextPlayers.forEach(p => {
    if (p.dead && p.respawnAt && now >= p.respawnAt) {
      p.dead = false; p.hp = p.maxHp;
      const pos = getSafePosition(state.walls, p.team);
      p.x = pos.x; p.y = pos.y; p.gems = 0; p.hasBall = false;
    }
    if (p.dead) return;
    
    const input = p.isBot ? updateBotInput(p, state) : inputs[p.id];
    if (!input) return;

    // Weapon switch - use direct index if provided
    if (input.newWeaponIndex !== undefined && p.weapons.length > 1) {
      p.currentWeaponIndex = input.newWeaponIndex % p.weapons.length;
    }
    
    // Build asylum wall (wave 10+ zombie survival)
    if (input.buildWall && p.wallKits > 0 && state.settings.gameMode === 'ZOMBIE_SURVIVAL' && state.wave >= 10) {
      const wallX = p.x + Math.cos(p.aimRotation) * 50;
      const wallY = p.y + Math.sin(p.aimRotation) * 50;
      // Check if position is clear
      const canBuild = !nextWalls.some(w => 
        wallX > w.x - 30 && wallX < w.x + w.w + 30 &&
        wallY > w.y - 30 && wallY < w.y + w.h + 30
      );
      if (canBuild) {
        p.wallKits--;
        nextWalls.push({ x: wallX - 20, y: wallY - 20, w: 40, h: 40, type: 'ASYLUM_WALL', hp: 200, maxHp: 200, ownerId: p.id });
        nextParticles.push({ id: uuid(), x: wallX, y: wallY, vx: 0, vy: -1, life: 1, color: '#8866aa', size: 16, type: 'TEXT', text: '🧱 Built!' });
        audioService.playPickup();
      }
    }
    
    const weapon = p.weapons[p.currentWeaponIndex];
    const isSlowed = p.slowedUntil > now;
    const isStunned = p.stunnedUntil > now; // STUNNED = can't move or shoot!
    
    // Check if in swamp (slows down by 40%)
    const inSwamp = nextWalls.some(w => 
      w.type === 'SWAMP' && 
      p.x > w.x - PLAYER_RADIUS && p.x < w.x + w.w + PLAYER_RADIUS &&
      p.y > w.y - PLAYER_RADIUS && p.y < w.y + w.h + PLAYER_RADIUS
    );
    // Speed boost reduced from 1.5x to 1.2x, slow effect reduced from 0.5x to 0.6x (less punishing)
    const speedMult = (p.speedBoostUntil > now ? 1.2 : 1) * (isSlowed ? 0.6 : 1) * (inSwamp ? 0.6 : 1) * (p.isBot && state.settings.gameMode === 'BRAWL_BALL' ? 0.85 : 1);
    const currentSpeed = PLAYER_SPEED * speedMult;

    // STUNNED players can't move!
    let dx = 0, dy = 0;
    if (!isStunned) {
    if (input.up) dy = -1;
    if (input.down) dy = 1;
    if (input.left) dx = -1;
    if (input.right) dx = 1;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;
      const newPos = resolveWallCollision(p.x + dx * currentSpeed, p.y + dy * currentSpeed, PLAYER_RADIUS, nextWalls);
      p.x = newPos.x; p.y = newPos.y;
      p.rotation = lerpAngle(p.rotation, Math.atan2(dy, dx), 0.15);
      p.isMoving = true;
      p.animFrame = (p.animFrame + 0.2) % 4;
    } else p.isMoving = false;

    // Check if player is in bush (for PvP modes - hidden from enemies)
    p.inBush = nextWalls.some(w => 
      w.type === 'BUSH' && 
      p.x > w.x - PLAYER_RADIUS && p.x < w.x + w.w + PLAYER_RADIUS &&
      p.y > w.y - PLAYER_RADIUS && p.y < w.y + w.h + PLAYER_RADIUS
    );

      if (input.mouseX !== undefined && input.mouseY !== undefined) {
      p.aimRotation = lerpAngle(p.aimRotation, Math.atan2(input.mouseY - p.y, input.mouseX - p.x), 0.25);
    } else if (input.aimX !== undefined && input.aimY !== undefined && (Math.abs(input.aimX) > 10 || Math.abs(input.aimY) > 10)) {
      p.aimRotation = Math.atan2(input.aimY, input.aimX);
    }

    // Ball handling
    if (nextBall && state.settings.gameMode === 'BRAWL_BALL') {
      if (!nextBall.heldBy && now >= p.canPickBallAt) {
        const dist = Math.sqrt((nextBall.x - p.x) ** 2 + (nextBall.y - p.y) ** 2);
        if (dist < PLAYER_RADIUS + BALL_RADIUS + 5) {
          nextBall.heldBy = p.id; p.hasBall = true; nextBall.vx = 0; nextBall.vy = 0;
        }
      }
      if (nextBall.heldBy === p.id) {
        nextBall.x = p.x + Math.cos(p.aimRotation) * (PLAYER_RADIUS + BALL_RADIUS + 3);
        nextBall.y = p.y + Math.sin(p.aimRotation) * (PLAYER_RADIUS + BALL_RADIUS + 3);
        nextBall.rotation += 0.15;
      }
    }

    // Shooting - STUNNED players can't shoot!
    if (input.fire && now - weapon.lastShotTime > weapon.fireRate && !isStunned) {
      if (nextBall && nextBall.heldBy === p.id) {
        nextBall.vx = Math.cos(p.aimRotation) * 18;
        nextBall.vy = Math.sin(p.aimRotation) * 18;
        nextBall.heldBy = null; p.hasBall = false; p.canPickBallAt = now + 400;
        audioService.playShoot();
      } else if (weapon.ammo === -1 || weapon.ammo > 0) {
        if (weapon.ammo > 0) weapon.ammo--;
        weapon.lastShotTime = now;
        audioService.playShoot(weapon.type);
        const damage = p.damageBoostUntil > now ? weapon.damage * 1.5 : weapon.damage;
        
        // MELEE WEAPONS - damage enemies in short range arc
        if (weapon.type === 'CHAINSAW' || weapon.type === 'BAT') {
          const meleeRange = weapon.type === 'CHAINSAW' ? 45 : 55;
          const meleeArc = weapon.type === 'CHAINSAW' ? 0.8 : 0.5; // radians
          const knockback = KNOCKBACK[weapon.type];
          
          // Visual swing effect
          nextParticles.push({ id: uuid(), x: p.x + Math.cos(p.aimRotation) * (PLAYER_RADIUS + 15), y: p.y + Math.sin(p.aimRotation) * (PLAYER_RADIUS + 15), vx: Math.cos(p.aimRotation + 0.5) * 4, vy: Math.sin(p.aimRotation + 0.5) * 4, life: 0.15, color: weapon.type === 'CHAINSAW' ? '#ff6600' : '#8B4513', size: 15, type: 'DUST' });
          nextParticles.push({ id: uuid(), x: p.x + Math.cos(p.aimRotation) * (PLAYER_RADIUS + 15), y: p.y + Math.sin(p.aimRotation) * (PLAYER_RADIUS + 15), vx: Math.cos(p.aimRotation - 0.5) * 4, vy: Math.sin(p.aimRotation - 0.5) * 4, life: 0.15, color: weapon.type === 'CHAINSAW' ? '#ff6600' : '#8B4513', size: 15, type: 'DUST' });
          
          // Hit zombies in melee range - with proper kill handling
          for (let zi = nextZombies.length - 1; zi >= 0; zi--) {
            const z = nextZombies[zi];
            const dx = z.x - p.x, dy = z.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < meleeRange + ZOMBIE_RADIUS * ZOMBIE_TYPES[z.type].size) {
              const angleToZombie = Math.atan2(dy, dx);
              let angleDiff = Math.abs(angleToZombie - p.aimRotation);
              if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
              if (angleDiff < meleeArc) {
                z.hp -= damage;
                // Knockback
                z.x += Math.cos(angleToZombie) * knockback;
                z.y += Math.sin(angleToZombie) * knockback;
                nextParticles.push({ id: uuid(), x: z.x, y: z.y, vx: 0, vy: 0, life: 0.3, color: '#550000', size: 8, type: 'BLOOD' });
                
                // Check if zombie died
                if (z.hp <= 0) {
                  p.kills++; p.score += z.isBoss ? 100 : 15;
                  nextZombiesKilledThisWave++;
                  for (let k = 0; k < 10; k++) nextParticles.push({ id: uuid(), x: z.x, y: z.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 0.7, color: '#330000', size: 4, type: 'BLOOD' });
                  // Zombie drops
                  const zSize = ZOMBIE_TYPES[z.type].size;
                  const dropChance = z.isBoss ? 1.0 : (zSize > 1.2 ? 0.5 : (zSize > 1 ? 0.35 : 0.25));
                  if (Math.random() < dropChance) {
                    const dropRand = Math.random();
                    let dropType: ItemType = dropRand < 0.35 ? 'HEALTH' : dropRand < 0.55 ? 'AMMO' : dropRand < 0.7 ? 'SPEED_BOOST' : 'DAMAGE_BOOST';
                    nextItems.push({ id: uuid(), x: z.x, y: z.y, type: dropType, rotation: 0 });
                  }
                  nextZombies.splice(zi, 1);
                  audioService.playZombieDeath();
                } else {
                  audioService.playZombieHit();
                }
              }
            }
          }
          
          // Hit crates in melee range
          for (let wi = nextWalls.length - 1; wi >= 0; wi--) {
            const w = nextWalls[wi];
            if (w.type !== 'CRATE' || !w.hp || w.hp <= 0) continue;
            const cx = w.x + w.w/2, cy = w.y + w.h/2;
            const wdx = cx - p.x, wdy = cy - p.y;
            const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
            if (wdist < meleeRange + w.w/2) {
              const angleToWall = Math.atan2(wdy, wdx);
              let angleDiff = Math.abs(angleToWall - p.aimRotation);
              if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
              if (angleDiff < meleeArc) {
                w.hp -= damage;
                nextParticles.push({ id: uuid(), x: cx, y: cy, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, life: 0.3, color: '#8B4513', size: 5, type: 'DUST' });
                if (w.hp <= 0) {
                  // Crate destroyed - drop item and REMOVE crate completely
                  if (w.dropType) {
                    nextItems.push({ id: uuid(), x: cx, y: cy, type: w.dropType, rotation: 0 });
                  }
                  for (let di = 0; di < 8; di++) nextParticles.push({ id: uuid(), x: cx, y: cy, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 0.6, color: '#8B4513', size: 4, type: 'DUST' });
                  nextWalls.splice(wi, 1); // Actually remove the crate!
                  audioService.playPickup();
                }
              }
            }
          }
          
          // Hit barrels in melee range - NOW WITH EXPLOSION!
          for (let wi = nextWalls.length - 1; wi >= 0; wi--) {
            const w = nextWalls[wi];
            if (w.type !== 'BARREL' || !w.hp || w.hp <= 0) continue;
            const bx = w.x + w.w/2, by = w.y + w.h/2;
            const bdx = bx - p.x, bdy = by - p.y;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
            if (bdist < meleeRange + w.w/2) {
              const angleToWall = Math.atan2(bdy, bdx);
              let angleDiff = Math.abs(angleToWall - p.aimRotation);
              if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
              if (angleDiff < meleeArc) {
                w.hp -= damage;
                nextParticles.push({ id: uuid(), x: bx, y: by, vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, life: 0.2, color: '#ff6600', size: 4, type: 'SPARKLE' });
                // BARREL EXPLOSION when hp <= 0!
                if (w.hp <= 0) {
                  for (let i = 0; i < 25; i++) {
                    nextParticles.push({ id: uuid(), x: bx, y: by, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, life: 0.9, color: '#ff4400', size: 5, type: 'EXPLOSION' });
                  }
                  // Damage nearby players
                  nextPlayers.forEach(pl => { 
                    if (pl.dead) return;
                    const pDist = Math.sqrt((pl.x - bx) ** 2 + (pl.y - by) ** 2); 
                    if (pDist < 100) {
                      const dmg = 50 * (1 - pDist / 100);
                      pl.hp -= dmg;
                      if (pl.hp <= 0) { pl.dead = true; pl.deaths++; pl.respawnAt = now + 2500; }
                    }
                  });
                  // Damage nearby zombies
                  nextZombies.forEach(z => { 
                    const zDist = Math.sqrt((z.x - bx) ** 2 + (z.y - by) ** 2); 
                    if (zDist < 100) z.hp -= 60 * (1 - zDist / 100); 
                  });
                  audioService.playExplosion();
                  nextWalls.splice(wi, 1); // Remove the barrel
                }
              }
            }
          }
          
          // Hit players in melee range (PvP)
          nextPlayers.forEach(enemy => {
            if (enemy.id === p.id || enemy.dead || (enemy.team === p.team && p.team !== 'NONE')) return;
            const dx = enemy.x - p.x, dy = enemy.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < meleeRange + PLAYER_RADIUS) {
              const angleToEnemy = Math.atan2(dy, dx);
              let angleDiff = Math.abs(angleToEnemy - p.aimRotation);
              if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
              if (angleDiff < meleeArc) {
                enemy.hp -= damage;
                enemy.x += Math.cos(angleToEnemy) * knockback * 0.7;
                enemy.y += Math.sin(angleToEnemy) * knockback * 0.7;
                audioService.playPlayerHurt();
                const respawnTime = state.settings.gameMode === 'BRAWL_BALL' ? 4000 : 2500;
                if (enemy.hp <= 0) { enemy.dead = true; enemy.deaths++; p.kills++; p.score += 50; enemy.respawnAt = now + respawnTime; }
              }
            }
          });
        } else if (weapon.type === 'LANDMINE') {
          // LANDMINE - place a mine on the ground in front of the player
          const mineX = p.x + Math.cos(p.aimRotation) * (PLAYER_RADIUS + 20);
          const mineY = p.y + Math.sin(p.aimRotation) * (PLAYER_RADIUS + 20);
          nextItems.push({ 
          id: uuid(),
            x: mineX, 
            y: mineY, 
            type: 'MINE', 
            rotation: 0, 
            ownerId: p.id,
            spawnTime: now, // Arms after 2 seconds
            value: damage // Store damage in value
          });
          nextParticles.push({ id: uuid(), x: mineX, y: mineY, vx: 0, vy: -1, life: 0.8, color: '#ff4444', size: 12, type: 'TEXT', text: '💣 MINE!' });
          audioService.playPickup();
        } else {
          // Ranged weapons - fire bullets
          const shots = weapon.type === 'SHOTGUN' ? 6 : weapon.type === 'FLAMETHROWER' ? 3 : 1;
          for (let i = 0; i < shots; i++) {
            const spread = (Math.random() - 0.5) * weapon.spread;
            const angle = p.aimRotation + spread;
            nextBullets.push({
              id: uuid(), ownerId: p.id, ownerTeam: p.team,
              x: p.x + Math.cos(p.aimRotation) * (PLAYER_RADIUS + 8), y: p.y + Math.sin(p.aimRotation) * (PLAYER_RADIUS + 8),
              vx: Math.cos(angle) * weapon.speed, vy: Math.sin(angle) * weapon.speed,
              damage, weaponType: weapon.type, life: weapon.type === 'ROCKET' || weapon.type === 'GRENADE' ? 1.5 : 0.7,
              explosionRadius: WEAPON_STATS[weapon.type].explosionRadius,
            });
          }
          nextParticles.push({ id: uuid(), x: p.x + Math.cos(p.aimRotation) * (PLAYER_RADIUS + 12), y: p.y + Math.sin(p.aimRotation) * (PLAYER_RADIUS + 12), vx: 0, vy: 0, life: 0.1, color: '#ffcc00', size: 10, type: 'MUZZLE_FLASH' });
        }
      }
    }
  });

  // Zombie AI
  nextZombies.forEach(zombie => {
    let nearestPlayer: Player | null = null;
    let minDist = Infinity;
    alivePlayers.forEach(p => {
      const dist = Math.sqrt((p.x - zombie.x) ** 2 + (p.y - zombie.y) ** 2);
      if (dist < minDist) { minDist = dist; nearestPlayer = p; }
    });
    if (nearestPlayer) {
      zombie.targetId = nearestPlayer.id;
      const dx = nearestPlayer.x - zombie.x;
      const dy = nearestPlayer.y - zombie.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      zombie.animFrame = (zombie.animFrame + 0.1) % 4;
      
      // Spitter ranged attack - VERY VISIBLE projectiles that DON'T penetrate walls
      // MUST CHECK LINE OF SIGHT - don't shoot through walls!
      if (zombie.type === 'SPITTER' && dist < 225 && dist > 80 && now - zombie.lastProjectileTime > 4000) {
        // LINE OF SIGHT CHECK - Don't shoot through walls!
        const angle = Math.atan2(dy, dx);
        let hasLineOfSight = true;
        const checkSteps = 10;
        for (let step = 1; step <= checkSteps; step++) {
          const checkX = zombie.x + (dx / dist) * (dist * step / checkSteps);
          const checkY = zombie.y + (dy / dist) * (dist * step / checkSteps);
          for (const w of nextWalls) {
            if (w.type === 'BUSH' || w.type === 'WATER' || w.type === 'POND' || w.type === 'SWAMP') continue;
            if (checkX > w.x && checkX < w.x + w.w && checkY > w.y && checkY < w.y + w.h) {
              hasLineOfSight = false;
              break;
            }
          }
          if (!hasLineOfSight) break;
        }
        
        if (hasLineOfSight) {
          zombie.lastProjectileTime = now;
          // BIG VISIBLE PURPLE PROJECTILE - slow and easy to see!
          nextBullets.push({ 
            id: uuid(), ownerId: zombie.id, ownerTeam: 'NONE', 
            x: zombie.x, y: zombie.y, 
            vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3, // SLOW speed - easy to dodge!
            damage: 6, // Low damage
            weaponType: 'ROCKET', // Use ROCKET for bigger, visible rendering
            life: 3.0, 
            isZombieProjectile: true,
            isVenom: true // Mark as venom for special purple rendering
          });
          // Big warning particles
          for (let vi = 0; vi < 12; vi++) {
            nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y, vx: Math.cos(angle + (Math.random()-0.5)*0.8) * (4 + Math.random()*4), vy: Math.sin(angle + (Math.random()-0.5)*0.8) * (4 + Math.random()*4), life: 0.8, color: '#cc44ff', size: 10, type: 'SPARKLE' });
          }
          // Warning text
          nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y - 25, vx: 0, vy: -1, life: 0.7, color: '#cc44ff', size: 14, type: 'TEXT', text: '☠️ SPIT!' });
        }
      }
      
      // Healer zombie - heals nearby zombies
      if (zombie.type === 'HEALER' && now - zombie.lastProjectileTime > 2000) {
        zombie.lastProjectileTime = now;
        nextZombies.forEach(z => {
          if (z.id !== zombie.id) {
            const healDist = Math.sqrt((z.x - zombie.x) ** 2 + (z.y - zombie.y) ** 2);
            if (healDist < 150) {
              z.hp = Math.min(z.maxHp, z.hp + 15);
              nextParticles.push({ id: uuid(), x: z.x, y: z.y - 10, vx: 0, vy: -1, life: 0.8, color: '#44ff44', size: 12, type: 'TEXT', text: '+15' });
            }
          }
        });
        nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y, vx: 0, vy: 0, life: 0.5, color: '#44ff44', size: 60, type: 'HEAL_AURA' });
      }
      
      // Charger zombie (BIG RED DEVIL) - improved charging behavior
      if (zombie.type === 'CHARGER') {
        const chargeRange = 350; // LONGER charge range
        const chargeSpeed = 7; // 20% faster (was ~5.8)
        const normalSpeed = zombie.speed * 1.2; // Also 20% faster when walking
        const timeSinceCharge = now - zombie.lastProjectileTime;
        const chargeDuration = 2000; // Longer charge duration
        
        // ALWAYS move toward player when not charging - don't just stand there!
        if (!zombie.chargeTarget && dist > 50) {
          zombie.rotation = lerpAngle(zombie.rotation, Math.atan2(dy, dx), 0.1);
          const zombieInSwamp = nextWalls.some(w => w.type === 'SWAMP' && zombie.x > w.x && zombie.x < w.x + w.w && zombie.y > w.y && zombie.y < w.y + w.h);
          const walkSpeed = normalSpeed * (zombieInSwamp ? 0.5 : 1);
          const newPos = resolveWallCollision(zombie.x + Math.cos(zombie.rotation) * walkSpeed, zombie.y + Math.sin(zombie.rotation) * walkSpeed, ZOMBIE_RADIUS * 1.4, nextWalls);
          zombie.x = newPos.x; zombie.y = newPos.y;
        }
        
        // Start new charge - don't wait for player to move!
        if (dist < chargeRange && dist > 50 && (!zombie.chargeTarget || timeSinceCharge > 2500)) {
          const chargeAngle = Math.atan2(nearestPlayer.y - zombie.y, nearestPlayer.x - zombie.x);
          zombie.chargeTarget = { x: Math.cos(chargeAngle), y: Math.sin(chargeAngle) };
          zombie.lastProjectileTime = now;
          // Big warning!
          nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y - 30, vx: 0, vy: -2, life: 1.0, color: '#ff4444', size: 18, type: 'TEXT', text: '🐗 CHARGE!' });
          for (let pi = 0; pi < 8; pi++) {
            nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y, vx: Math.cos(pi * Math.PI / 4) * 5, vy: Math.sin(pi * Math.PI / 4) * 5, life: 0.5, color: '#ff6644', size: 10, type: 'SMOKE' });
          }
        }
        
        // Charge phase - longer duration, stops when hitting player
        if (zombie.chargeTarget && timeSinceCharge > 400 && timeSinceCharge < chargeDuration) {
          const dirX = zombie.chargeTarget.x;
          const dirY = zombie.chargeTarget.y;
          
          zombie.x += dirX * chargeSpeed;
          zombie.y += dirY * chargeSpeed;
          zombie.rotation = Math.atan2(dirY, dirX);
          zombie.x = Math.max(30, Math.min(MAP_SIZE - 30, zombie.x));
          zombie.y = Math.max(30, Math.min(MAP_SIZE - 30, zombie.y));
          
          // Fire trail
          nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 0.4, color: '#ff4400', size: 12, type: 'SMOKE' });
          
          // Check for collision with players
          let hitPlayer = false;
          nextPlayers.forEach(p => {
            if (p.dead || p.stunnedUntil > now) return;
            const actualDist = Math.sqrt((p.x - zombie.x) ** 2 + (p.y - zombie.y) ** 2);
            const hitRadius = PLAYER_RADIUS + ZOMBIE_RADIUS * 1.4 + 5;
            
            if (actualDist < hitRadius && now - zombie.lastAttackTime > 300) {
              applyDamage(p, zombie.attackDamage, now, 2500);
          zombie.lastAttackTime = now;
              audioService.playPlayerHurt();
              
              // STUN player for 1.5 seconds (dizzy - no moving or shooting)
              p.stunnedUntil = now + 1500;
              
              nextParticles.push({ id: uuid(), x: p.x, y: p.y - 20, vx: 0, vy: -2, life: 1.5, color: '#ffff00', size: 16, type: 'TEXT', text: '💫 STUNNED!' });
              
              // BIG knockback
              const knockAngle = Math.atan2(p.y - zombie.y, p.x - zombie.x);
              p.x += Math.cos(knockAngle) * 80;
              p.y += Math.sin(knockAngle) * 80;
              const knockedPos = resolveWallCollision(p.x, p.y, PLAYER_RADIUS, nextWalls);
              p.x = knockedPos.x; p.y = knockedPos.y;
              
              hitPlayer = true;
            }
          });
          
          // Stop charging if hit player or bumped into wall
          const hitWall = nextWalls.some(w => (w.type === 'SOLID' || w.type === 'DESTRUCTIBLE') && 
            zombie.x > w.x - 20 && zombie.x < w.x + w.w + 20 && zombie.y > w.y - 20 && zombie.y < w.y + w.h + 20);
          if (hitPlayer || hitWall) {
            zombie.chargeTarget = undefined;
          }
        } else if (zombie.chargeTarget && timeSinceCharge >= chargeDuration) {
          zombie.chargeTarget = undefined;
        }
      }
      
      // Smoke zombie - creates SMOKE CLOUDS that stay for 25 seconds!
      // Blur only triggers when player TOUCHES the smoke cloud
      const lastSmokeTime = (zombie as any).lastSmokeTime || 0;
      if (zombie.type === 'SMOKE' && dist < 200 && now - lastSmokeTime > 6000) { // Every 6 seconds
        (zombie as any).lastSmokeTime = now;
        
        // Spawn a BIG SMOKE CLOUD item that lasts 25 seconds!
        const cloudX = zombie.x + (Math.random() - 0.5) * 60;
        const cloudY = zombie.y + (Math.random() - 0.5) * 60;
        nextItems.push({ 
          id: uuid(), 
          x: cloudX, 
          y: cloudY, 
          type: 'SMOKE_CLOUD', 
          rotation: 0, 
          spawnTime: now,
          value: 25000 // 25 seconds duration
        });
        
        // Puff effect when spawning smoke
        for (let i = 0; i < 20; i++) {
          nextParticles.push({ id: uuid(), x: cloudX + (Math.random() - 0.5) * 80, y: cloudY + (Math.random() - 0.5) * 80, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3, life: 2, color: '#555555', size: 35 + Math.random() * 30, type: 'SMOKE' });
        }
        nextParticles.push({ id: uuid(), x: cloudX, y: cloudY - 30, vx: 0, vy: -1, life: 1.5, color: '#888888', size: 14, type: 'TEXT', text: '💨 SMOKE!' });
      }
      
      // FLAME BOSS - shoots fire spread and leaves fire trails!
      if (zombie.type === 'FLAME_BOSS' && dist < zombie.attackRange && now - zombie.lastProjectileTime > 2000) {
        zombie.lastProjectileTime = now;
        const angle = Math.atan2(dy, dx);
        // Fire 5 flame projectiles in a spread
        for (let i = -2; i <= 2; i++) {
          const spreadAngle = angle + i * 0.25;
          nextBullets.push({ 
            id: uuid(), ownerId: zombie.id, ownerTeam: 'NONE', 
            x: zombie.x, y: zombie.y, 
            vx: Math.cos(spreadAngle) * 10, vy: Math.sin(spreadAngle) * 10, 
            damage: zombie.attackDamage, weaponType: 'FLAMETHROWER', life: 1.5, 
            isZombieProjectile: true 
          });
        }
        // Fire particles
        for (let i = 0; i < 12; i++) {
          nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y, vx: Math.cos(angle) * (8 + Math.random() * 4), vy: Math.sin(angle) * (8 + Math.random() * 4), life: 0.6, color: Math.random() > 0.5 ? '#ff4400' : '#ff8800', size: 8, type: 'EXPLOSION' });
        }
        audioService.playExplosion();
      }
      
      // Flame boss AND regular BOSS leave DAMAGING fire trails - OPTIMIZED to reduce lag!
      // Only spawn fire trails every ~1 second, and limit total puddles
      const firePuddleCount = nextItems.filter(i => i.type === 'VENOM_PUDDLE' && i.value && i.value > 100).length;
      const lastTrailTime = (zombie as any).lastFireTrailTime || 0;
      if ((zombie.type === 'FLAME_BOSS' || zombie.type === 'BOSS') && zombie.targetId && 
          now - lastTrailTime > 800 && firePuddleCount < 8) { // Max 8 fire puddles at once
        (zombie as any).lastFireTrailTime = now;
        
        // One simple fire particle (not every frame!)
        nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y, vx: 0, vy: 0, life: 1.0, color: '#ff4400', size: 15, type: 'SMOKE' });
        
        // Leave a FIRE PUDDLE - only 6 second duration to reduce clutter
        nextItems.push({ 
          id: uuid(), 
          x: zombie.x, 
          y: zombie.y, 
          type: 'VENOM_PUDDLE', 
          rotation: 0, 
          spawnTime: now, 
          value: 6000 // 6 seconds duration (shorter to reduce lag)
        });
      }
      
      // WITCH BOSS - Fast spider-like movement, tongue attack like fishing!
      if (zombie.type === 'WITCH') {
        const tongueRange = 250;
        const tongueState = zombie.tongueState || 'AIMING';
        const tongueProgress = zombie.tongueProgress || 0;
        const tongueTarget = zombie.tongueTarget;
        
        // Spider-like jumping movement when not attacking
        if (tongueState === 'AIMING') {
          if (dist < tongueRange && dist > 80 && now - zombie.lastProjectileTime > 3000) {
            // Stop and aim at player
            zombie.tongueState = 'EXTENDING';
            zombie.tongueProgress = 0;
            zombie.tongueTarget = nearestPlayer.id;
            zombie.lastProjectileTime = now;
            // Warning!
            nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y - 40, vx: 0, vy: -1, life: 1.2, color: '#8844aa', size: 18, type: 'TEXT', text: '👅 TONGUE!' });
      } else {
            // Spider jump movement - fast and erratic
            const jumpTimer = (now % 800) / 800;
            if (jumpTimer < 0.15 && Math.random() < 0.3) {
              // Jump toward player
              const jumpDir = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
              const jumpDist = 40 + Math.random() * 30;
              zombie.x += Math.cos(jumpDir) * jumpDist;
              zombie.y += Math.sin(jumpDir) * jumpDist;
              // Spider particles
              for (let j = 0; j < 4; j++) {
                nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 0.3, color: '#aa66cc', size: 5, type: 'DUST' });
              }
            }
          }
        } else if (tongueState === 'EXTENDING') {
          // Tongue shooting out!
          zombie.tongueProgress = Math.min(1, (zombie.tongueProgress || 0) + 0.08);
          const target = nextPlayers.find(p => p.id === tongueTarget);
          if (target && !target.dead) {
            const tdx = target.x - zombie.x, tdy = target.y - zombie.y;
            const tDist = Math.sqrt(tdx * tdx + tdy * tdy);
            const tongueReachDist = tongueRange * zombie.tongueProgress!;
            
            // Check if tongue reached player
            if (tDist < tongueReachDist + PLAYER_RADIUS && !target.tongueGrabbedBy) {
              target.tongueGrabbedBy = zombie.id;
              zombie.tongueState = 'RETRACTING';
              nextParticles.push({ id: uuid(), x: target.x, y: target.y - 20, vx: 0, vy: -1, life: 1, color: '#ff4444', size: 14, type: 'TEXT', text: '🎣 CAUGHT!' });
            }
          }
          if (zombie.tongueProgress >= 1) {
            zombie.tongueState = target?.tongueGrabbedBy === zombie.id ? 'RETRACTING' : 'AIMING';
            zombie.tongueProgress = 1;
          }
        } else if (tongueState === 'RETRACTING') {
          // Pull player back!
          zombie.tongueProgress = Math.max(0, (zombie.tongueProgress || 1) - 0.06);
          const target = nextPlayers.find(p => p.tongueGrabbedBy === zombie.id);
          if (target && !target.dead) {
            // Pull player toward witch
            const pdx = zombie.x - target.x, pdy = zombie.y - target.y;
            const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pDist > 40) {
              target.x += (pdx / pDist) * 12;
              target.y += (pdy / pDist) * 12;
              // Struggle effect
              if (Math.random() < 0.3) {
                nextParticles.push({ id: uuid(), x: target.x, y: target.y, vx: (Math.random()-0.5)*4, vy: -2, life: 0.4, color: '#ffaa00', size: 8, type: 'SPARKLE' });
              }
            }
          }
          if (zombie.tongueProgress <= 0) {
            zombie.tongueState = 'ATTACKING';
            zombie.tongueProgress = 0;
          }
        } else if (tongueState === 'ATTACKING') {
          // Fierce attack once player is pulled!
          const target = nextPlayers.find(p => p.tongueGrabbedBy === zombie.id);
          if (target && !target.dead) {
            // Release and ATTACK!
            target.tongueGrabbedBy = null;
            
            // Rapid fierce attacks
            for (let atk = 0; atk < 3; atk++) {
              applyDamage(target, zombie.attackDamage * 0.6, now, 2500);
            }
            audioService.playPlayerHurt();
            
            // Big slash effect
            for (let k = 0; k < 15; k++) {
              nextParticles.push({ id: uuid(), x: target.x + (Math.random()-0.5)*40, y: target.y + (Math.random()-0.5)*40, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8, life: 0.5, color: '#ff4444', size: 6, type: 'BLOOD' });
            }
            nextParticles.push({ id: uuid(), x: target.x, y: target.y - 25, vx: 0, vy: -2, life: 1, color: '#ff4444', size: 18, type: 'TEXT', text: '💀 SLASH!' });
            
            // Knock player away
            const knockAngle = Math.atan2(target.y - zombie.y, target.x - zombie.x);
            target.x += Math.cos(knockAngle) * 60;
            target.y += Math.sin(knockAngle) * 60;
          }
          zombie.tongueState = 'AIMING';
          zombie.tongueTarget = undefined;
          zombie.lastProjectileTime = now;
        }
        
        // Boundary check
        zombie.x = Math.max(50, Math.min(MAP_SIZE - 50, zombie.x));
        zombie.y = Math.max(50, Math.min(MAP_SIZE - 50, zombie.y));
      }
      
      // FREEZER zombie - shoots ice at distance to slow players!
      if (zombie.type === 'SLOW' && dist < 120 && dist > 40 && now - zombie.lastProjectileTime > 2000) {
        zombie.lastProjectileTime = now;
        // Ice blast effect
        const angle = Math.atan2(dy, dx);
        for (let i = 0; i < 8; i++) {
          nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y, vx: Math.cos(angle + (Math.random() - 0.5) * 0.5) * (6 + Math.random() * 3), vy: Math.sin(angle + (Math.random() - 0.5) * 0.5) * (6 + Math.random() * 3), life: 0.6, color: '#88ddff', size: 8, type: 'SPARKLE' });
        }
        nextParticles.push({ id: uuid(), x: zombie.x, y: zombie.y - 20, vx: 0, vy: -1, life: 0.8, color: '#88ddff', size: 14, type: 'TEXT', text: '❄️ FREEZE!' });
        // Slow the nearest player!
        nearestPlayer.slowedUntil = Math.max(nearestPlayer.slowedUntil, now + 3000);
        nextParticles.push({ id: uuid(), x: nearestPlayer.x, y: nearestPlayer.y - 15, vx: 0, vy: -1, life: 0.8, color: '#88ddff', size: 12, type: 'TEXT', text: '🐌 FROZEN!' });
        // Small damage
        applyDamage(nearestPlayer, 5, now, 2500);
      }
      
      if (dist > zombie.attackRange && zombie.type !== 'CHARGER') {
        zombie.rotation = lerpAngle(zombie.rotation, Math.atan2(dy, dx), 0.08);
        // Zombies also slow down in swamps
        const zombieInSwamp = nextWalls.some(w => 
          w.type === 'SWAMP' && 
          zombie.x > w.x - ZOMBIE_RADIUS && zombie.x < w.x + w.w + ZOMBIE_RADIUS &&
          zombie.y > w.y - ZOMBIE_RADIUS && zombie.y < w.y + w.h + ZOMBIE_RADIUS
        );
        const zombieSpeed = zombie.speed * (zombieInSwamp ? 0.5 : 1);
        const newPos = resolveWallCollision(zombie.x + Math.cos(zombie.rotation) * zombieSpeed, zombie.y + Math.sin(zombie.rotation) * zombieSpeed, ZOMBIE_RADIUS * ZOMBIE_TYPES[zombie.type].size, nextWalls);
        zombie.x = newPos.x; zombie.y = newPos.y;
      } else if (now - zombie.lastAttackTime > (zombie.isBoss ? 1200 : 900) && zombie.type !== 'HEALER' && zombie.type !== 'CHARGER') {
        // Healer zombies DON'T attack - they only heal other zombies!
        // Charger zombies only deal damage during charge, not melee!
          const died = applyDamage(nearestPlayer, zombie.attackDamage, now, 2500);
          zombie.lastAttackTime = now;
        if (zombie.type === 'SLOW') nearestPlayer.slowedUntil = now + 2500;
        audioService.playPlayerHurt();
          if (died) {
          if (state.settings.gameMode === 'GEM_GRAB' && nearestPlayer.gems > 0) {
            for (let i = 0; i < nearestPlayer.gems; i++) nextItems.push({ id: uuid(), x: nearestPlayer.x + (Math.random() - 0.5) * 40, y: nearestPlayer.y + (Math.random() - 0.5) * 40, type: 'GEM', rotation: 0, value: 1 });
            nearestPlayer.gems = 0;
          }
          if (nextBall && nextBall.heldBy === nearestPlayer.id) { nextBall.heldBy = null; nearestPlayer.hasBall = false; nextBall.vx = (Math.random() - 0.5) * 8; nextBall.vy = (Math.random() - 0.5) * 8; }
        }
      }
    }
  });

  // Zombies trigger landmines!
  for (let mi = nextItems.length - 1; mi >= 0; mi--) {
    const mine = nextItems[mi];
    if (mine.type !== 'MINE') continue;
    const isArmed = mine.spawnTime && (now - mine.spawnTime > 2000);
    if (!isArmed) continue;
    
    for (const z of nextZombies) {
      const zDist = Math.sqrt((z.x - mine.x) ** 2 + (z.y - mine.y) ** 2);
      if (zDist < ZOMBIE_RADIUS * ZOMBIE_TYPES[z.type].size + ITEM_RADIUS) {
        // MINE TRIGGERED BY ZOMBIE!
        const explosionRadius = 100;
        const mineDamage = mine.value || 150;
        
        // Damage ALL nearby zombies - and KILL them if HP <= 0!
        for (let zi = nextZombies.length - 1; zi >= 0; zi--) {
          const zTarget = nextZombies[zi];
          const targetDist = Math.sqrt((zTarget.x - mine.x) ** 2 + (zTarget.y - mine.y) ** 2);
          if (targetDist < explosionRadius) {
            const dmgMult = 1 - (targetDist / explosionRadius) * 0.5;
            zTarget.hp -= mineDamage * dmgMult;
            // Knockback
            const knockAngle = Math.atan2(zTarget.y - mine.y, zTarget.x - mine.x);
            zTarget.x += Math.cos(knockAngle) * 25 * dmgMult;
            zTarget.y += Math.sin(knockAngle) * 25 * dmgMult;
            
            // KILL zombie if HP <= 0!
            if (zTarget.hp <= 0) {
              nextZombiesKilledThisWave++;
              for (let k = 0; k < 10; k++) nextParticles.push({ id: uuid(), x: zTarget.x, y: zTarget.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 0.7, color: '#330000', size: 4, type: 'BLOOD' });
              // Find mine owner for kills credit
              const mineOwner = nextPlayers.find(p => p.id === mine.ownerId);
              if (mineOwner) { mineOwner.kills++; mineOwner.score += zTarget.isBoss ? 100 : 15; }
              audioService.playZombieDeath();
              nextZombies.splice(zi, 1);
            }
          }
        }
        
        // Damage nearby players - QUARTER damage to players (self-damage halved again)
        nextPlayers.forEach(p => {
          if (p.dead) return;
          const pDist = Math.sqrt((p.x - mine.x) ** 2 + (p.y - mine.y) ** 2);
          if (pDist < explosionRadius) {
            const dmgMult = 1 - (pDist / explosionRadius) * 0.5;
            p.hp -= mineDamage * 0.25 * dmgMult; // Quarter damage to players (was half)
            if (p.hp <= 0) { p.dead = true; p.deaths++; p.respawnAt = now + 2500; }
          }
        });
        
        // Explosion effect
        for (let k = 0; k < 30; k++) {
          nextParticles.push({ id: uuid(), x: mine.x, y: mine.y, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, life: 1, color: k % 2 === 0 ? '#ff4400' : '#ffaa00', size: 6, type: 'EXPLOSION' });
        }
        nextParticles.push({ id: uuid(), x: mine.x, y: mine.y - 20, vx: 0, vy: -1, life: 0.8, color: '#ff4444', size: 16, type: 'TEXT', text: '💥 BOOM!' });
        audioService.playExplosion();
        nextItems.splice(mi, 1);
        break;
      }
    }
  }

  // Ball physics
  if (nextBall && !nextBall.heldBy) {
    nextBall.x += nextBall.vx;
    nextBall.y += nextBall.vy;
    nextBall.vx *= 0.97;
    nextBall.vy *= 0.97;
    nextBall.rotation += Math.sqrt(nextBall.vx ** 2 + nextBall.vy ** 2) * 0.04;
    resolveBallWallCollision(nextBall, nextWalls);
    
    // Goal check (only if not celebrating)
    if (state.goals && state.goalCelebrationUntil < now) {
      for (const goal of state.goals) {
        if (nextBall.x > goal.x && nextBall.x < goal.x + goal.w && nextBall.y > goal.y && nextBall.y < goal.y + goal.h) {
          const scoringTeam = goal.team === 'RED' ? 'BLUE' : 'RED';
          nextTeamScores[scoringTeam]++;
          
          // Find who last touched the ball
          const scorer = state.lastGoalScorer;
          const scorerName = nextPlayers.find(p => p.team === scoringTeam && !p.isBot)?.name || scoringTeam + ' Team';
          
          // Set up celebration (3 seconds freeze)
          const goalCelebrationUntil = now + 3000;
          
          // Keep ball at goal position during celebration, then reset
          nextParticles.push({ id: uuid(), x: goal.x + goal.w/2, y: goal.y + goal.h/2, vx: 0, vy: -1, life: 3, color: scoringTeam === 'RED' ? '#ff4444' : '#4444ff', size: 32, type: 'TEXT', text: '⚽ GOAL!' });
          nextParticles.push({ id: uuid(), x: goal.x + goal.w/2, y: goal.y + goal.h/2 + 40, vx: 0, vy: -0.5, life: 3, color: '#fff', size: 16, type: 'TEXT', text: scorerName });
          
          // Confetti!
          for (let i = 0; i < 30; i++) {
            nextParticles.push({ id: uuid(), x: goal.x + goal.w/2, y: goal.y + goal.h/2, 
              vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, 
              life: 2, color: scoringTeam === 'RED' ? '#ff4444' : '#4444ff', size: 4, type: 'SPARKLE' });
          }
          
          audioService.playGoal();
          
          // Reset ball to center after celebration
          nextBall.vx = 0; nextBall.vy = 0; nextBall.heldBy = null;
          nextBall.x = goal.x + goal.w/2; nextBall.y = goal.y + goal.h/2; // Stay at goal during celebration
          
          // Reset player positions after goal
          nextPlayers.forEach(p => {
            const pos = getSafePosition(nextWalls, p.team);
            p.x = pos.x; p.y = pos.y; p.hasBall = false; p.canPickBallAt = now + 4000;
          });
          
          return { ...state, players: nextPlayers, zombies: nextZombies, bullets: nextBullets, particles: nextParticles, 
                   items: nextItems, walls: nextWalls, ball: nextBall, teamScores: nextTeamScores,
                   goalCelebrationUntil, lastGoalScorer: scorer, matchTimeRemaining: nextMatchTimeRemaining,
                   wave: nextWave, waveState: nextWaveState, waveRestStartTime: nextWaveRestStartTime,
                   zombiesKilledThisWave: nextZombiesKilledThisWave, zombiesToSpawnThisWave: nextZombiesToSpawnThisWave,
                   zombiesSpawnedThisWave: nextZombiesSpawnedThisWave, lastZombieSpawnTime: nextLastZombieSpawnTime,
                   lastItemSpawnTime: nextLastItemSpawnTime, gameOver, winnerTeam, showEndScreen, endScreenStartTime };
        }
      }
    }
    
    // During goal celebration, reset ball to center after 2.5s
    if (state.goalCelebrationUntil > 0 && now > state.goalCelebrationUntil - 500 && nextBall.x !== MAP_SIZE/2) {
      nextBall.x = MAP_SIZE / 2; nextBall.y = MAP_SIZE / 2;
    }
  }

  // Clean up old venom/fire puddles and smoke clouds
  nextItems = nextItems.filter(item => {
    if (item.type === 'VENOM_PUDDLE' && item.spawnTime) {
      const duration = item.value && item.value > 100 ? item.value : 5000; // Fire puddles use value for duration
      if (now - item.spawnTime > duration) return false;
    }
    // Smoke clouds last 25 seconds (stored in value)
    if (item.type === 'SMOKE_CLOUD' && item.spawnTime) {
      const duration = item.value || 25000;
      if (now - item.spawnTime > duration) return false;
    }
    return true;
  });

  // Item collection and effects
  nextPlayers.forEach(p => {
    if (p.dead) return;
    for (let i = nextItems.length - 1; i >= 0; i--) {
      const item = nextItems[i];
      // Venom puddle damages players walking on it but doesn't disappear
      if (item.type === 'VENOM_PUDDLE') {
        const dist = Math.sqrt((p.x - item.x) ** 2 + (p.y - item.y) ** 2);
        const puddleRadius = ITEM_RADIUS * 2; // Puddles are bigger visually
        if (dist < puddleRadius + PLAYER_RADIUS) {
          if (!p.isBot || Math.random() < 0.15) { // Bots usually dodge
            // Damage shield first, then health - VERY reduced damage (0.08 per tick)
            const venomDamage = 0.08;
            if (p.shield > 0) {
              p.shield = Math.max(0, p.shield - venomDamage);
            } else {
              p.hp -= venomDamage;
            }
            p.slowedUntil = Math.max(p.slowedUntil, now + 200);
            // Visual feedback when taking damage!
            if (Math.random() < 0.08) {
              nextParticles.push({ id: uuid(), x: p.x, y: p.y - 10, vx: 0, vy: -1.5, life: 0.6, color: '#88ff44', size: 12, type: 'TEXT', text: '☠️ Venom!' });
              nextParticles.push({ id: uuid(), x: p.x + (Math.random()-0.5)*20, y: p.y + (Math.random()-0.5)*20, vx: 0, vy: -1, life: 0.4, color: '#88ff88', size: 6, type: 'SPARKLE' });
            }
            if (p.hp <= 0) { p.dead = true; p.deaths++; p.respawnAt = now + 2500; }
          }
        }
        continue; // Don't remove venom puddles on contact
      }
      
      // SMOKE CLOUD - only blurs when player TOUCHES it, lasts 25 seconds!
      if (item.type === 'SMOKE_CLOUD') {
        const cloudRadius = ITEM_RADIUS * 5; // BIG smoke cloud radius
        const dist = Math.sqrt((p.x - item.x) ** 2 + (p.y - item.y) ** 2);
        if (dist < cloudRadius + PLAYER_RADIUS) {
          // Apply blur when touching smoke!
          p.blurredUntil = Math.max(p.blurredUntil, now + 2000);
          // Visual feedback
          if (Math.random() < 0.03) {
            nextParticles.push({ id: uuid(), x: p.x, y: p.y - 15, vx: 0, vy: -1, life: 0.6, color: '#666666', size: 12, type: 'TEXT', text: '💨 SMOKE!' });
          }
        }
        continue; // Don't remove smoke clouds on contact
      }
      if (checkCircleCollision({x: p.x, y: p.y, r: PLAYER_RADIUS}, {x: item.x, y: item.y, r: ITEM_RADIUS})) {
        // LANDMINE - only triggers after 2 second arming time, deals area damage!
        if (item.type === 'MINE') {
          const isArmed = item.spawnTime && (now - item.spawnTime > 2000);
          const canTrigger = item.ownerId !== p.id || (item.spawnTime && now - item.spawnTime > 3000); // Owner can trigger after 3s
          
          if (isArmed && canTrigger) {
            // EXPLOSION with area damage!
            const explosionRadius = 100;
            const mineDamage = item.value || 150;
            
            // Damage ALL nearby players - QUARTER damage (self-damage very low)
            nextPlayers.forEach(target => {
              if (target.dead) return;
              const targetDist = Math.sqrt((target.x - item.x) ** 2 + (target.y - item.y) ** 2);
              if (targetDist < explosionRadius) {
                const dmgMult = 1 - (targetDist / explosionRadius) * 0.5;
                const isSelf = target.id === item.ownerId;
                target.hp -= mineDamage * (isSelf ? 0.25 : 0.5) * dmgMult; // Self damage quartered
                // Knockback
                const knockAngle = Math.atan2(target.y - item.y, target.x - item.x);
                target.x += Math.cos(knockAngle) * 30 * dmgMult;
                target.y += Math.sin(knockAngle) * 30 * dmgMult;
                if (target.hp <= 0) { target.dead = true; target.deaths++; target.respawnAt = now + 2500; }
              }
            });
            
            // Damage ALL nearby zombies - and KILL them!
            for (let zi = nextZombies.length - 1; zi >= 0; zi--) {
              const z = nextZombies[zi];
              const zDist = Math.sqrt((z.x - item.x) ** 2 + (z.y - item.y) ** 2);
              if (zDist < explosionRadius) {
                const dmgMult = 1 - (zDist / explosionRadius) * 0.5;
                z.hp -= mineDamage * dmgMult;
                // Knockback
                const knockAngle = Math.atan2(z.y - item.y, z.x - item.x);
                z.x += Math.cos(knockAngle) * 25 * dmgMult;
                z.y += Math.sin(knockAngle) * 25 * dmgMult;
                
                // KILL zombie if HP <= 0!
                if (z.hp <= 0) {
                  nextZombiesKilledThisWave++;
                  for (let k = 0; k < 10; k++) nextParticles.push({ id: uuid(), x: z.x, y: z.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 0.7, color: '#330000', size: 4, type: 'BLOOD' });
                  // Mine owner gets kill credit
                  const mineOwner = nextPlayers.find(pl => pl.id === item.ownerId);
                  if (mineOwner) { mineOwner.kills++; mineOwner.score += z.isBoss ? 100 : 15; }
                  audioService.playZombieDeath();
                  nextZombies.splice(zi, 1);
                }
              }
            }
            
            // BIG explosion effect
            for (let k = 0; k < 30; k++) {
              nextParticles.push({ id: uuid(), x: item.x, y: item.y, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, life: 1, color: k % 2 === 0 ? '#ff4400' : '#ffaa00', size: 6, type: 'EXPLOSION' });
            }
            nextParticles.push({ id: uuid(), x: item.x, y: item.y - 20, vx: 0, vy: -1, life: 0.8, color: '#ff4444', size: 16, type: 'TEXT', text: '💥 BOOM!' });
            audioService.playExplosion();
            nextItems.splice(i, 1);
            continue;
          } else if (!isArmed) {
            continue; // Mine not armed yet, don't pick up or trigger
          }
        } else {
          audioService.playPickup();
          // SCALE pickups with wave progression!
        if (item.type === 'HEALTH') {
            // Heal 50% of max HP (scales with waves!)
            const healAmount = Math.round(p.maxHp * 0.5);
            const actualHeal = Math.min(p.maxHp - p.hp, healAmount);
            p.hp = Math.min(p.maxHp, p.hp + healAmount);
            nextParticles.push({ id: uuid(), x: p.x, y: p.y - 15, vx: 0, vy: -1, life: 0.8, color: '#44ff44', size: 14, type: 'TEXT', text: `❤️+${actualHeal}` });
          }
          else if (item.type === 'AMMO') {
            // Refill 60% of max ammo for all weapons (scales with waves!)
            p.weapons.forEach(w => { 
              if (w.ammo !== -1) {
                const scaledMaxAmmo = Math.round(w.maxAmmo * (p.ammoMultiplier || 1));
                const ammoGain = Math.round(scaledMaxAmmo * 0.6);
                w.ammo = Math.min(scaledMaxAmmo, w.ammo + ammoGain);
                // Also update maxAmmo to scaled value
                w.maxAmmo = scaledMaxAmmo;
              }
            });
            nextParticles.push({ id: uuid(), x: p.x, y: p.y - 15, vx: 0, vy: -1, life: 0.8, color: '#ffaa00', size: 14, type: 'TEXT', text: '🔫 AMMO!' });
          }
          else if (item.type === 'GEM') { p.gems += item.value || 1; p.score += 10; }
          else if (item.type === 'SPEED_BOOST') p.speedBoostUntil = now + 10000;
          else if (item.type === 'DAMAGE_BOOST') p.damageBoostUntil = now + 10000;
          else if (item.type === 'ARMOR') { p.maxHp += 20; p.hp += 20; }
          else if (item.type === 'SHIELD') { 
            // Shield also scales - give 40% of max shield
            const shieldGain = Math.round(p.maxShield * 0.4);
            p.shield = Math.min(p.maxShield, p.shield + shieldGain); 
            nextParticles.push({ id: uuid(), x: p.x, y: p.y - 15, vx: 0, vy: -1, life: 0.8, color: '#4488ff', size: 14, type: 'TEXT', text: `🛡️+${shieldGain}` }); 
          }
          else if (item.type === 'FIRE_RATE_BOOST') { p.fireRateBoostUntil = now + 8000; nextParticles.push({ id: uuid(), x: p.x, y: p.y - 15, vx: 0, vy: -1, life: 0.8, color: '#ff8800', size: 14, type: 'TEXT', text: '⚡FAST!' }); }
          else if (item.type === 'WALL_KIT') { p.wallKits = Math.min(5, p.wallKits + 1); nextParticles.push({ id: uuid(), x: p.x, y: p.y - 15, vx: 0, vy: -1, life: 0.8, color: '#8866aa', size: 14, type: 'TEXT', text: '🧱+1' }); }
          else if (item.type.startsWith('WEAPON_')) {
            const wType = item.type.replace('WEAPON_', '') as WeaponType;
            const scaledMaxAmmo = Math.round(WEAPON_STATS[wType].maxAmmo * (p.ammoMultiplier || 1));
            if (!p.weapons.find(w => w.type === wType)) {
              // New weapon - give FULL scaled ammo!
              const newWeapon = createWeapon(wType);
              newWeapon.maxAmmo = scaledMaxAmmo;
              newWeapon.ammo = scaledMaxAmmo;
              p.weapons.push(newWeapon);
              nextParticles.push({ id: uuid(), x: p.x, y: p.y - 15, vx: 0, vy: -1, life: 1, color: '#ff66ff', size: 16, type: 'TEXT', text: `🔫 ${WEAPON_STATS[wType].name}!` });
            } else { 
              // Already have weapon - refill to SCALED max!
              const existing = p.weapons.find(w => w.type === wType); 
              if (existing && existing.ammo !== -1) {
                existing.maxAmmo = scaledMaxAmmo;
                existing.ammo = scaledMaxAmmo; // Full refill!
              }
            }
          }
        }
        nextItems.splice(i, 1);
      }
    }
  });

  // Bullet physics
  const survivingBullets: Bullet[] = [];
  nextBullets.forEach(b => {
    b.x += b.vx; b.y += b.vy; b.life -= 0.016;
    
    // Grenade bouncing off walls (no gravity - top-down view)
    if (b.weaponType === 'GRENADE') {
      // Slow down over time (rolling friction)
      b.vx *= 0.98;
      b.vy *= 0.98;
      // Bounce off map edges
      if (b.x < 20) { b.x = 20; b.vx = Math.abs(b.vx) * 0.7; }
      if (b.x > MAP_SIZE - 20) { b.x = MAP_SIZE - 20; b.vx = -Math.abs(b.vx) * 0.7; }
      if (b.y < 20) { b.y = 20; b.vy = Math.abs(b.vy) * 0.7; }
      if (b.y > MAP_SIZE - 20) { b.y = MAP_SIZE - 20; b.vy = -Math.abs(b.vy) * 0.7; }
      // Bounce off walls (skip passable terrain: bush, water, swamp, pond)
      for (const w of nextWalls) {
        if (w.type === 'BUSH' || w.type === 'WATER' || w.type === 'SWAMP' || w.type === 'POND') continue;
        if (b.x > w.x - 10 && b.x < w.x + w.w + 10 && b.y > w.y - 10 && b.y < w.y + w.h + 10) {
          const fromLeft = b.x - b.vx < w.x;
          const fromRight = b.x - b.vx > w.x + w.w;
          const fromTop = b.y - b.vy < w.y;
          const fromBottom = b.y - b.vy > w.y + w.h;
          if (fromLeft || fromRight) b.vx *= -0.7;
          if (fromTop || fromBottom) b.vy *= -0.7;
          break;
        }
      }
    }
    
    if (b.life <= 0 || b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
      if (b.explosionRadius) {
        // Explosion damage with knockback
        const applyExplosion = (entity: { x: number; y: number; hp?: number }, radius: number) => {
          const dist = Math.sqrt((entity.x - b.x) ** 2 + (entity.y - b.y) ** 2);
          if (dist < b.explosionRadius!) {
            const dmgMult = 1 - dist / b.explosionRadius!;
            const angle = Math.atan2(entity.y - b.y, entity.x - b.x);
            return { damage: b.damage * dmgMult, knockX: Math.cos(angle) * 15 * dmgMult, knockY: Math.sin(angle) * 15 * dmgMult };
          }
          return null;
        };
        nextZombies.forEach(z => { const r = applyExplosion(z, ZOMBIE_RADIUS); if (r) { z.hp -= r.damage; z.x += r.knockX; z.y += r.knockY; } });
        nextPlayers.forEach(p => { if (p.dead) return; const r = applyExplosion(p, PLAYER_RADIUS); if (r) { p.hp -= r.damage; p.x += r.knockX; p.y += r.knockY; if (p.hp <= 0) { p.dead = true; p.deaths++; p.respawnAt = now + 2500; } } });
        nextWalls.forEach(w => { if ((w.type === 'DESTRUCTIBLE' || w.type === 'BARREL') && w.hp) { const cx = w.x + w.w / 2, cy = w.y + w.h / 2; if (Math.sqrt((cx - b.x) ** 2 + (cy - b.y) ** 2) < b.explosionRadius!) w.hp -= b.damage * 0.5; } });
        for (let i = 0; i < 20; i++) nextParticles.push({ id: uuid(), x: b.x, y: b.y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 0.7, color: Math.random() < 0.5 ? '#ff6600' : '#ffaa00', size: Math.random() * 5 + 3, type: 'EXPLOSION' });
        audioService.playExplosion();
      }
      return;
    }

    // Wall collision - bullets pass through bushes, water, swamps, ponds
    let hitWall = false;
    for (let wi = 0; wi < nextWalls.length; wi++) {
      const w = nextWalls[wi];
      if (w.type === 'BUSH' || w.type === 'WATER' || w.type === 'POND' || w.type === 'SWAMP') continue;
      if (b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h) {
        hitWall = true;
        if ((w.type === 'DESTRUCTIBLE' || w.type === 'BARREL' || w.type === 'CRATE') && w.hp !== undefined) {
          w.hp -= b.damage;
          
          // Crate destroyed - drop item!
          if (w.type === 'CRATE' && w.hp <= 0 && w.hp > -9000) { // Only once
            const cx = w.x + w.w/2, cy = w.y + w.h/2;
            for (let i = 0; i < 8; i++) {
              nextParticles.push({ id: uuid(), x: cx, y: cy, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 0.6, color: '#8B4513', size: 4, type: 'DUST' });
            }
            // Drop the item
            if (w.dropType) {
              nextItems.push({ id: uuid(), x: cx, y: cy, type: w.dropType, rotation: 0 });
              w.dropType = undefined; // Clear so it doesn't drop again!
            }
            audioService.playPickup();
            w.hp = -9999;
          }
          
          if (w.type === 'BARREL' && w.hp <= 0 && w.hp > -9000) { // Only explode once
            // Barrel explosion!
            const bx = w.x + w.w/2, by = w.y + w.h/2;
            for (let i = 0; i < 25; i++) {
              nextParticles.push({ id: uuid(), x: bx, y: by, vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14, life: 0.9, color: '#ff4400', size: 5, type: 'EXPLOSION' });
            }
            // Damage and potentially kill players
            nextPlayers.forEach(p => { 
              if (p.dead) return;
              const dist = Math.sqrt((p.x - bx) ** 2 + (p.y - by) ** 2); 
              if (dist < 100) {
                const dmg = 50 * (1 - dist / 100);
                p.hp -= dmg;
                if (p.hp <= 0) {
                  p.dead = true;
                  p.deaths++;
                  p.respawnAt = now + 2500;
                }
              }
            });
            // Damage zombies
            nextZombies.forEach(z => { 
              const dist = Math.sqrt((z.x - bx) ** 2 + (z.y - by) ** 2); 
              if (dist < 100) z.hp -= 60 * (1 - dist / 100); 
            });
            audioService.playExplosion();
            // Mark barrel for removal (will be filtered out)
            w.hp = -9999;
          }
        }
        break;
      }
    }
    if (hitWall) {
      // Immediately filter out destroyed walls after hit
      nextWalls = nextWalls.filter(w => w.hp === undefined || w.hp > 0);
      return;
    }

    // Zombie collision with knockback (rockets/grenades explode on impact!)
    let hit = false;
    if (!b.isZombieProjectile) {
      // Check for explosive weapons - they explode on zombie contact
      if ((b.weaponType === 'ROCKET' || b.weaponType === 'GRENADE') && b.explosionRadius) {
        for (const z of nextZombies) {
      const dist = Math.sqrt((z.x - b.x) ** 2 + (z.y - b.y) ** 2);
          if (dist < ZOMBIE_RADIUS * ZOMBIE_TYPES[z.type].size + 10) {
            // EXPLOSION! Area damage to all zombies and players nearby
            hit = true;
            const explosionX = b.x, explosionY = b.y;
            const radius = b.explosionRadius;
            
            // Visual explosion
            for (let k = 0; k < 30; k++) {
              nextParticles.push({ id: uuid(), x: explosionX, y: explosionY, vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, life: 0.8, color: b.weaponType === 'ROCKET' ? '#ff4400' : '#ffaa00', size: 6, type: 'EXPLOSION' });
            }
            audioService.playExplosion();
            
            // Damage all zombies in radius
            for (let zi = nextZombies.length - 1; zi >= 0; zi--) {
              const zTarget = nextZombies[zi];
              const zDist = Math.sqrt((zTarget.x - explosionX) ** 2 + (zTarget.y - explosionY) ** 2);
              if (zDist < radius) {
                const dmgMult = 1 - (zDist / radius) * 0.5; // More damage closer
                zTarget.hp -= b.damage * dmgMult;
                // Knockback from explosion center
                const kbAngle = Math.atan2(zTarget.y - explosionY, zTarget.x - explosionX);
                zTarget.x += Math.cos(kbAngle) * 20 * dmgMult;
                zTarget.y += Math.sin(kbAngle) * 20 * dmgMult;
                
                if (zTarget.hp <= 0) {
          const killer = nextPlayers.find(p => p.id === b.ownerId);
                  if (killer) { killer.kills++; killer.score += zTarget.isBoss ? 100 : 15; }
          nextZombiesKilledThisWave++;
                  for (let k = 0; k < 10; k++) nextParticles.push({ id: uuid(), x: zTarget.x, y: zTarget.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 0.7, color: '#330000', size: 4, type: 'BLOOD' });
                  // Zombie drop
                  if (Math.random() < (zTarget.isBoss ? 0.8 : 0.15)) {
                    const dropRand = Math.random();
                    let dropType: ItemType = dropRand < 0.4 ? 'HEALTH' : dropRand < 0.6 ? 'AMMO' : dropRand < 0.75 ? 'SPEED_BOOST' : 'DAMAGE_BOOST';
                    nextItems.push({ id: uuid(), x: zTarget.x, y: zTarget.y, type: dropType, rotation: 0 });
                  }
                  nextZombies.splice(zi, 1);
                }
              }
            }
            
            // Damage players in radius (including self!)
            nextPlayers.forEach(p => {
              if (p.dead) return;
              const pDist = Math.sqrt((p.x - explosionX) ** 2 + (p.y - explosionY) ** 2);
              if (pDist < radius) {
                const dmgMult = 1 - (pDist / radius) * 0.5;
                p.hp -= b.damage * 0.5 * dmgMult; // Half damage to players
                const respawnTime = state.settings.gameMode === 'BRAWL_BALL' ? 4000 : 2500;
                if (p.hp <= 0) { p.dead = true; p.deaths++; p.respawnAt = now + respawnTime; }
              }
            });
            break;
          }
        }
      }
      
      // Regular bullet collision
      if (!hit) {
        for (let i = nextZombies.length - 1; i >= 0; i--) {
          const z = nextZombies[i];
          const dist = Math.sqrt((z.x - b.x) ** 2 + (z.y - b.y) ** 2);
          if (dist < ZOMBIE_RADIUS * ZOMBIE_TYPES[z.type].size) {
            hit = true;
            z.hp -= b.damage;
            const knockback = KNOCKBACK[b.weaponType] || 3;
            const angle = Math.atan2(b.vy, b.vx);
            z.x += Math.cos(angle) * knockback;
            z.y += Math.sin(angle) * knockback;
            for (let k = 0; k < 3; k++) nextParticles.push({ id: uuid(), x: b.x, y: b.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 0.4, color: '#550000', size: 3, type: 'BLOOD' });
        if (z.hp <= 0) {
          const killer = nextPlayers.find(p => p.id === b.ownerId);
              if (killer) { killer.kills++; killer.score += z.isBoss ? 100 : 15; }
          nextZombiesKilledThisWave++;
              for (let k = 0; k < 10; k++) nextParticles.push({ id: uuid(), x: z.x, y: z.y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7, life: 0.7, color: '#330000', size: 4, type: 'BLOOD' });
              
              // BOOMER explosion on death - spawns slimes and slows players!
              if (z.type === 'BOOMER') {
                const boomX = z.x, boomY = z.y;
                const boomRadius = 240; // DOUBLED explosion range for bigger impact
                
                // Slime explosion particles
                for (let k = 0; k < 40; k++) {
                  nextParticles.push({ id: uuid(), x: boomX, y: boomY, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 1.2, color: '#88ff44', size: 8, type: 'EXPLOSION' });
                }
                nextParticles.push({ id: uuid(), x: boomX, y: boomY - 20, vx: 0, vy: -1, life: 1, color: '#88ff44', size: 16, type: 'TEXT', text: '💥 SPLAT!' });
                
                // Damage, SLOW, and SLIME (blurry sticky effect) all players in radius!
                nextPlayers.forEach(p => {
                  if (p.dead) return;
                  const pDist = Math.sqrt((p.x - boomX) ** 2 + (p.y - boomY) ** 2);
                  if (pDist < boomRadius) {
                    const dmgMult = 1 - (pDist / boomRadius) * 0.7;
                    p.hp -= 15 * dmgMult; // Small damage
                    p.slowedUntil = Math.max(p.slowedUntil, now + 2500); // 2.5s slow!
                    p.slimeCoveredUntil = Math.max(p.slimeCoveredUntil, now + 4000); // 4s slime blur!
                    nextParticles.push({ id: uuid(), x: p.x, y: p.y - 15, vx: 0, vy: -1, life: 0.8, color: '#88ff44', size: 12, type: 'TEXT', text: '🐌 SLIMED!' });
                    if (p.hp <= 0) { p.dead = true; p.deaths++; p.respawnAt = now + 2500; }
                  }
                });
                
                // Leave a slime puddle that slows
                nextItems.push({ id: uuid(), x: boomX, y: boomY, type: 'VENOM_PUDDLE', rotation: 0, spawnTime: now, value: 5 });
                audioService.playExplosion();
              }
              
              // Zombie drops - bigger zombies drop more
              const zSize = ZOMBIE_TYPES[z.type].size;
              const dropChance = z.isBoss ? 1.0 : (zSize > 1.2 ? 0.5 : (zSize > 1 ? 0.35 : 0.25)); // More drops!
              if (Math.random() < dropChance) {
                const dropRand = Math.random();
                let dropType: ItemType = 'HEALTH';
                if (z.isBoss) {
                  // Bosses drop great loot - weapons and wall kits at high waves
                  if (dropRand < 0.2) dropType = 'HEALTH';
                  else if (dropRand < 0.35) dropType = 'SHIELD';
                  else if (state.wave >= 10 && dropRand < 0.5) dropType = 'WALL_KIT';
                  else {
                    const available = (Object.entries(WEAPON_STATS) as [WeaponType, typeof WEAPON_STATS[WeaponType]][])
                      .filter(([t, s]) => s.unlockWave <= state.wave + 2 && t !== 'PISTOL');
                    if (available.length > 0) {
                      const [wType] = available[Math.floor(Math.random() * available.length)];
                      dropType = `WEAPON_${wType}` as ItemType;
                    }
                  }
                  // Bosses drop multiple items!
                  nextItems.push({ id: uuid(), x: z.x + 20, y: z.y, type: Math.random() < 0.5 ? 'HEALTH' : 'AMMO', rotation: 0 });
                } else if (dropRand < 0.40) dropType = 'HEALTH';
                else if (dropRand < 0.65) dropType = 'AMMO';
                else if (dropRand < 0.75) dropType = 'SPEED_BOOST'; // Halved speed boost drops
                else if (dropRand < 0.90) dropType = 'DAMAGE_BOOST';
                else dropType = 'SHIELD';
                nextItems.push({ id: uuid(), x: z.x, y: z.y, type: dropType, rotation: 0 });
              }
          nextZombies.splice(i, 1);
              audioService.playZombieDeath();
            } else {
              audioService.playZombieHit();
        }
        break;
          }
        }
      }
    }
    
    // Player collision
    if (!hit) {
      for (const p of nextPlayers) {
        if (p.dead) continue;
        if (b.isZombieProjectile || (p.id !== b.ownerId && (p.team !== b.ownerTeam || b.ownerTeam === 'NONE'))) {
          const dist = Math.sqrt((p.x - b.x) ** 2 + (p.y - b.y) ** 2);
          if (dist < PLAYER_RADIUS) {
            hit = true;
            const respawnTime = state.settings.gameMode === 'BRAWL_BALL' ? 4000 : 2500;
            const died = applyDamage(p, b.damage, now, respawnTime);
            audioService.playPlayerHurt();
            // Knockback
            const knockback = KNOCKBACK[b.weaponType] || 3;
            const angle = Math.atan2(b.vy, b.vx);
            p.x += Math.cos(angle) * knockback * 0.7;
            p.y += Math.sin(angle) * knockback * 0.7;
            // Drop ball
            if (nextBall && nextBall.heldBy === p.id) {
              nextBall.heldBy = null; p.hasBall = false; p.canPickBallAt = now + 800;
              nextBall.vx = (Math.random() - 0.5) * 6; nextBall.vy = (Math.random() - 0.5) * 6;
            }
            if (died) {
              const killer = nextPlayers.find(k => k.id === b.ownerId);
              if (killer && killer.id !== p.id) { killer.kills++; killer.score += 50; if (killer.team !== 'NONE' && state.settings.gameMode === 'TEAM_DEATHMATCH') nextTeamScores[killer.team]++; }
              if (state.settings.gameMode === 'GEM_GRAB' && p.gems > 0) {
                for (let i = 0; i < p.gems; i++) nextItems.push({ id: uuid(), x: p.x + (Math.random() - 0.5) * 35, y: p.y + (Math.random() - 0.5) * 35, type: 'GEM', rotation: 0, value: 1 });
                p.gems = 0;
              }
              audioService.playExplosion();
            }
            break;
          }
        }
      }
    }
    if (!hit) survivingBullets.push(b);
  });

  // Particles
  const survivingParticles: Particle[] = [];
  nextParticles.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy *= 0.95; p.life -= 0.02;
    if (p.life > 0) survivingParticles.push(p);
  });

  // Clean up destroyed walls (barrels, crates with hp <= 0)
  const cleanedWalls = nextWalls.filter(w => w.hp === undefined || w.hp > 0);

  return {
    ...state, players: nextPlayers, zombies: nextZombies, bullets: survivingBullets, particles: survivingParticles,
    items: nextItems, walls: cleanedWalls, ball: nextBall, teamScores: nextTeamScores, gameTime: state.gameTime + dt,
    wave: nextWave, waveState: nextWaveState, waveRestStartTime: nextWaveRestStartTime,
    zombiesKilledThisWave: nextZombiesKilledThisWave, zombiesToSpawnThisWave: nextZombiesToSpawnThisWave,
    zombiesSpawnedThisWave: nextZombiesSpawnedThisWave, lastZombieSpawnTime: nextLastZombieSpawnTime,
    lastItemSpawnTime: nextLastItemSpawnTime, matchTimeRemaining: nextMatchTimeRemaining, announcements: nextAnnouncements,
    gameOver, winnerTeam, showEndScreen, endScreenStartTime, survivalTime: state.survivalTime + dt / 60,
  };
};
