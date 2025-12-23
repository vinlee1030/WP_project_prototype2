# 🎮 Zombie Arena v3 - Multiplayer Top-Down Shooter

A **beautiful**, **smooth**, and **engaging** multiplayer top-down shooter game built with React, TypeScript, and WebRTC P2P networking.

![Game Preview](https://img.shields.io/badge/Status-Prototype%203-brightgreen)

## 🆕 What's New in v3

### 🎛️ Developer Panel
- **ESC Key** - Opens developer panel with pause functionality
- **Wave Overview** - Current wave, zombies left, player stats
- **Zombie Browser** - See all zombie types with stats (HP, damage, speed)
- **Weapon Browser** - View all weapons and unlock status
- **Balance Settings** - See difficulty multipliers in action

### ⚖️ Major Balance Updates
- **Healer Zombie** - 1.5x healing rate (faster + stronger heals)
- **Tank/Boss** - JUMP ATTACK! Leaps on players with warning shadow
- **Boomer** - Slime now deals damage over time (3 seconds) + green blur
- **Ammo Bug Fixed** - No more millions of bullets! Capped at 2.5x scaling

### 🧱 Buildable Walls (Wave 10+)
- **Wall Kits** - Collect from crates after wave 10
- **Press E** - Build walls in front of you
- **Zombie Interaction** - Zombies attack walls when blocked!
- **Strategic Defense** - Create chokepoints and safe zones

### 💣 Landmine Improvements
- **FIFO Limit** - Max 12 mines on map (oldest explodes when 13th placed)
- **Performance** - Optimized rendering for better FPS
- **Unlocks Wave 7** - Previously wave 6

### 🔫 All Weapons Now Droppable
- Flamethrower, Rocket, Grenade, Laser, Minigun, Sniper all drop from crates!

## ✨ Features

### 🎯 Game Modes
- **🧟 Zombie Survival** - Survive waves of zombies with progressive difficulty
- **⚔️ Team Deathmatch** - Red vs Blue team battles
- **💎 Gem Grab** - Collect gems to win
- **⚽ Brawl Ball** - Score goals with soccer ball

### 🎨 Visual Features
- **Cute Pixel Art Style** - Brawl Stars inspired aesthetics
- **Smooth Animations** - Walking, shooting, death, jump attacks
- **Beautiful Maps** - Procedurally generated with bushes, water, swamps
- **Particle Effects** - Explosions, muzzle flashes, blood, slime
- **Dynamic Lighting** - Glowing effects and shadows

### 🔫 Weapons (13 Types)
| Weapon | Emoji | Description | Unlock |
|--------|-------|-------------|--------|
| Pistol | 🔫 | Basic, infinite ammo | Start |
| Shotgun | 💥 | Spread shot | Start |
| Rifle | 🎯 | Fast, accurate | Wave 2 |
| Machine Gun | ⚡ | Very fast fire rate | Wave 3 |
| Bat | 🏏 | Knockback melee | Wave 2 |
| Chainsaw | 🪚 | High damage melee | Wave 3 |
| Sniper | 🔭 | High damage, slow | Wave 4 |
| Flamethrower | 🔥 | Continuous flames | Wave 5 |
| Grenade | 💣 | Explosive arc | Wave 5 |
| Rocket | 🚀 | Explosive splash | Wave 6 |
| Landmine | 💣 | Trap (max 12) | Wave 7 |
| Laser | ⚡ | Instant hit | Wave 7 |
| Minigun | 🔥 | Extreme fire rate | Wave 8 |

### 🧟 Zombie Types (12 Types)
| Type | Color | Wave | Special |
|------|-------|------|---------|
| Walker | Green | 1 | Basic |
| Runner | Light Green | 2 | Fast |
| Tank (Brute) | Purple | 3 | Tanky, JUMP attack! |
| Boomer | Yellow-Green | 4 | Explodes, slimes players |
| Spitter | Purple | 5 | Ranged venom |
| Freezer | Cyan | 5 | Slows players |
| Healer | Bright Green | 5 | Heals other zombies (1.5x) |
| Charger | Red | 7 | Charges, stuns |
| Smoke | Gray | 8 | Smoke screen blur |
| Boss | Dark Red | 5 | JUMP attack, huge |
| Flame Boss | Orange | 8 | Fire trails |
| Witch | Purple | 10 | Spider jump, tongue grab! |

### 🎮 Controls

**Desktop:**
- `WASD` / Arrow Keys - Move
- Mouse - Aim
- Left Click / Space - Shoot
- `Q` - Switch weapon
- `E` - Build wall (wave 10+)
- `ESC` - Developer panel / Pause
- Enter - Chat

**Mobile:**
- Left Joystick - Move
- Right Joystick - Aim & Shoot

### 🌐 Multiplayer
- **P2P WebRTC** - No server required
- **Host/Client Model** - First player hosts
- **Real-time Sync** - Smooth gameplay
- **In-game Chat** - Talk with players
- **8 Player Max** - Support for teams

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm

### Installation

```bash
cd "final project prototype 3"
npm install
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## 🎮 How to Play

1. Enter your nickname
2. Select game mode & difficulty
3. Create/Join game
4. Share room ID with friends
5. Press ESC for developer panel
6. Survive and have fun!

## 🛠️ Tech Stack

- **React 19** + TypeScript
- **Vite** - Build Tool
- **TailwindCSS** - Styling
- **PeerJS** - WebRTC P2P
- **Canvas API** - Game Rendering
- **Web Audio API** - 8-bit Sounds

---

Made with ❤️ for Web Programming Final Project - Prototype 3
