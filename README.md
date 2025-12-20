# 🎮 Zombie Arena - Multiplayer Top-Down Shooter

A **beautiful**, **smooth**, and **engaging** multiplayer top-down shooter game built with React, TypeScript, and WebRTC P2P networking.

![Game Preview](https://img.shields.io/badge/Status-In%20Development-brightgreen)

## ✨ Features

### 🎯 Game Modes
- **🧟 Zombie Survival** - Survive waves of increasingly difficult zombies
- **⚔️ Team Deathmatch** - Red vs Blue team battles
- **💎 Gem Grab** - Collect gems to win (coming soon)
- **⚽ Brawl Ball** - Score goals with the ball (coming soon)

### 🎨 Visual Features
- **Cute Pixel Art Style** - Brawl Stars inspired aesthetics
- **Smooth Animations** - Walking, shooting, and death animations
- **Beautiful Maps** - Procedurally generated with bushes, water, and walls
- **Particle Effects** - Explosions, muzzle flashes, blood, and sparkles
- **Dynamic Lighting** - Glowing effects and shadows

### 🔫 Weapons (7 Types)
| Weapon | Emoji | Description |
|--------|-------|-------------|
| Pistol | 🔫 | Basic, infinite ammo |
| Shotgun | 💥 | Spread shot, medium ammo |
| Rifle | 🎯 | Fast, accurate |
| Machine Gun | ⚡ | Very fast fire rate |
| Sniper | 🔭 | High damage, slow |
| Rocket | 🚀 | Explosive splash damage |
| Flamethrower | 🔥 | Continuous flames |

### 🧟 Zombie Types (4 Types)
- **Walker** - Standard zombie
- **Runner** - Fast but weak
- **Brute** - Slow but tanky
- **Spitter** - Ranged attacker

### 🎮 Controls

**Desktop:**
- `WASD` / Arrow Keys - Move
- Mouse - Aim (independent of movement!)
- Left Click / Space - Shoot
- Enter - Chat

**Mobile:**
- Left Joystick - Move
- Right Joystick - Aim & Shoot (touch to fire)

### 🌐 Multiplayer
- **P2P WebRTC** - No server required, direct connections
- **Host/Client Model** - First player hosts the game
- **Real-time Sync** - Smooth gameplay experience
- **In-game Chat** - Talk with other players
- **8 Player Max** - Support for up to 8 players

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Navigate to project
cd "final project prototype 2"

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
final project prototype 2/
├── index.html          # Entry HTML
├── index.tsx           # React entry point
├── App.tsx             # Main app with game loop & networking
├── types.ts            # TypeScript interfaces
├── components/
│   ├── GameCanvas.tsx  # Canvas rendering
│   ├── LoginScreen.tsx # Lobby/settings UI
│   └── UIOverlay.tsx   # In-game HUD
├── services/
│   ├── gameLogic.ts    # Core game mechanics
│   ├── audioService.ts # Sound effects
│   └── lobbyService.ts # Room listing
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 🎮 How to Play

1. Enter your nickname
2. Select a game mode
3. Choose difficulty
4. Click "CREATE / JOIN GAME"
5. Share the room ID with friends to join
6. Survive and have fun!

## 🔧 Key Improvements in v2

- ✅ **Independent Aiming** - Desktop players can aim with mouse while moving
- ✅ **Dual Joystick Mobile** - Left stick moves, right stick aims AND fires
- ✅ **Fixed Collision** - Smooth sliding along walls instead of getting stuck
- ✅ **Better Visuals** - Cute characters with eyes, unique weapon designs
- ✅ **UI Fixed** - Name and HP bar no longer overlap
- ✅ **Walking Animations** - Characters bounce when moving
- ✅ **New Game Modes** - Team Deathmatch with team scoring
- ✅ **Beautiful Maps** - Symmetric maps for PvP, decorated with bushes/water

## 🛠️ Tech Stack

- **React 19** - UI Framework
- **TypeScript** - Type Safety
- **Vite** - Build Tool
- **TailwindCSS** - Styling
- **PeerJS** - WebRTC P2P
- **Canvas API** - Game Rendering
- **Web Audio API** - Sound Effects

## 📱 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## 🤝 Contributing

Feel free to submit issues and pull requests!

## 📄 License

MIT License

---

Made with ❤️ for Web Programming Final Project
