
import React, { useState, useEffect, useRef } from 'react';
import { GameSettings, GameMode } from '../types';
import { audioService } from '../services/audioService';

interface LoginScreenProps {
  onJoin: (name: string, roomId: string, roomName: string, settings: GameSettings) => void;
}

interface ActiveRoom {
  id: string;
  name: string;
  host: string;
  mode: GameMode;
  players: number;
  maxPlayers: number;
  timestamp: number;
}

const ROOMS_STORAGE_KEY = 'zombie-arena-rooms-v2';
const BROADCAST_CHANNEL = 'zombie-arena-rooms';

const LoginScreen: React.FC<LoginScreenProps> = ({ onJoin }) => {
  const [name, setName] = useState(() => localStorage.getItem('playerName') || '');
  const [roomId, setRoomId] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('ZOMBIE_SURVIVAL');
  const [difficulty, setDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD' | 'NIGHTMARE'>('NORMAL');
  const [maxZombies, setMaxZombies] = useState(25);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [musicStarted, setMusicStarted] = useState(false);
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Setup BroadcastChannel for cross-tab communication
  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL);
      channelRef.current.onmessage = (event) => {
        if (event.data.type === 'ROOM_UPDATE') {
          loadRooms();
        }
      };
    } catch (e) {
      // BroadcastChannel not supported, fall back to localStorage only
    }
    
    return () => {
      channelRef.current?.close();
    };
  }, []);

  const loadRooms = () => {
    try {
      const stored = localStorage.getItem(ROOMS_STORAGE_KEY);
      if (stored) {
        const rooms: ActiveRoom[] = JSON.parse(stored);
        const now = Date.now();
        // Filter rooms older than 15 seconds (more aggressive cleanup)
        const active = rooms.filter(r => now - r.timestamp < 15000);
        setActiveRooms(active);
      }
    } catch {}
  };

  // Load and refresh active rooms frequently
  useEffect(() => {
    loadRooms();
    // Poll more frequently
    const interval = setInterval(loadRooms, 1000);
    
    // Listen for storage changes from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === ROOMS_STORAGE_KEY) loadRooms();
    };
    window.addEventListener('storage', handleStorage);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const startMusic = () => {
    if (!musicStarted) {
      audioService.init();
      audioService.startMenuMusic();
      setMusicStarted(true);
    }
  };

  useEffect(() => {
    const handleInteraction = () => startMusic();
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('touchstart', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent, overrideRoomId?: string, overrideMode?: GameMode, isJoining: boolean = false) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter your name!');
    
    localStorage.setItem('playerName', name.trim());
    
    const finalRoomId = overrideRoomId || roomId.trim() || Math.random().toString(36).substring(2, 8);
    const finalMode = overrideMode || gameMode;
    
    const settings: GameSettings = {
      gameMode: finalMode,
      zombieSpawnRate: difficulty === 'EASY' ? 0.7 : difficulty === 'NORMAL' ? 1.0 : difficulty === 'HARD' ? 1.5 : 2.0,
      maxZombies,
      waveDuration: 60,
      difficulty,
      scoreToWin: finalMode === 'BRAWL_BALL' ? 2 : 10,
      timeLimit: 120,
    };
    
    audioService.stopMenuMusic();
    onJoin(name, finalRoomId, `${name}'s Room`, settings);
  };

  const handleJoinRoom = (room: ActiveRoom) => {
    if (!name.trim()) return alert('Please enter your name first!');
    localStorage.setItem('playerName', name.trim());
    
    const settings: GameSettings = {
      gameMode: room.mode,
      zombieSpawnRate: 1.0,
      maxZombies: 25,
      waveDuration: 60,
      difficulty: 'NORMAL',
      scoreToWin: room.mode === 'BRAWL_BALL' ? 2 : 10,
      timeLimit: 120,
    };
    
    audioService.stopMenuMusic();
    onJoin(name, room.id, room.name, settings);
  };

  const gameModeInfo: Record<GameMode, { name: string; desc: string; color: string; emoji: string }> = {
    'ZOMBIE_SURVIVAL': { name: '🧟 Zombie', desc: 'Survive waves!', color: 'from-green-600 to-emerald-800', emoji: '🧟' },
    'TEAM_DEATHMATCH': { name: '⚔️ TDM', desc: 'Team battle!', color: 'from-red-600 to-orange-700', emoji: '⚔️' },
    'GEM_GRAB': { name: '💎 Gems', desc: 'Grab gems!', color: 'from-cyan-600 to-blue-700', emoji: '💎' },
    'BRAWL_BALL': { name: '⚽ Ball', desc: 'Score goals!', color: 'from-purple-600 to-pink-700', emoji: '⚽' },
    'GUN_GAME': { name: '🔫 Gun Game', desc: 'Climb the ranks!', color: 'from-amber-600 to-yellow-700', emoji: '🔫' },
  };

  return (
    <div 
      ref={scrollRef}
      className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="absolute rounded-full bg-purple-500/10 animate-pulse"
            style={{ width: 40 + Math.random() * 60, height: 40 + Math.random() * 60, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 3}s`, animationDuration: `${3 + Math.random() * 4}s` }}
          />
        ))}
      </div>

      <div className="relative z-10 min-h-full flex flex-col items-center py-4 px-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-red-500">
            🎮 ZOMBIE ARENA
          </h1>
          <p className="text-slate-400 text-xs">P2P Multiplayer • Click for music</p>
        </div>

        {/* Name Input */}
        <div className="w-full max-w-lg mb-4">
          <label className="block text-sm font-bold text-slate-300 mb-1">👤 Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter nickname..."
            className="w-full px-4 py-3 bg-slate-800/80 border-2 border-slate-600 rounded-xl text-white text-lg placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            maxLength={12}
          />
        </div>

        {/* Active Rooms List */}
        <div className="w-full max-w-lg mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-slate-300">🌐 Active Rooms (auto-refresh)</span>
            <span className="text-xs text-slate-500">{activeRooms.length} found</span>
          </div>
          
          {activeRooms.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleJoinRoom(room)}
                  className={`w-full p-3 rounded-xl border-2 transition-all text-left bg-gradient-to-r ${gameModeInfo[room.mode].color} border-white/20 hover:border-white/50 hover:scale-[1.01] active:scale-[0.99] shadow-lg`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white text-base flex items-center gap-2">
                        {gameModeInfo[room.mode].emoji} {room.name}
                      </div>
                      <div className="text-xs text-white/70">Host: {room.host} • ID: {room.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">👥 {room.players}/{room.maxPlayers}</div>
                      <div className="text-xs text-green-300 font-bold">▶ JOIN</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 text-center">
              <div className="text-slate-400 text-sm">No active rooms found</div>
              <div className="text-slate-500 text-xs mt-1">Create a room below - it will appear here for others!</div>
              <div className="text-amber-500 text-xs mt-2">💡 Rooms appear across browser tabs on the same computer</div>
            </div>
          )}
        </div>

        {/* Join by ID */}
        <div className="w-full max-w-lg mb-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700">
          <label className="block text-xs font-bold text-slate-400 mb-1">🔗 Join by Room ID (for remote players)</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={roomId} 
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter Room ID..."
              className="flex-1 px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              maxLength={12}
            />
            <button
              onClick={(e) => handleSubmit(e, roomId, gameMode, true)}
              disabled={!roomId.trim()}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all"
            >
              JOIN
            </button>
          </div>
        </div>

        {/* Create Room Section */}
        <div className="w-full max-w-lg bg-slate-800/90 backdrop-blur rounded-xl p-4 shadow-xl border border-slate-700/50">
          <h3 className="text-base font-bold text-slate-200 mb-3">➕ Create New Room</h3>
          
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Game Mode */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">Game Mode</label>
              <div className="grid grid-cols-5 gap-1">
                {(Object.keys(gameModeInfo) as GameMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setGameMode(mode)}
                    className={`p-1.5 rounded-lg border-2 transition-all text-center ${
                      gameMode === mode 
                        ? `bg-gradient-to-r ${gameModeInfo[mode].color} border-white/30 shadow-md` 
                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-lg">{gameModeInfo[mode].emoji}</div>
                    <div className="font-bold text-white text-[10px] leading-tight">{gameModeInfo[mode].name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty for Zombie mode */}
            {gameMode === 'ZOMBIE_SURVIVAL' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Difficulty</label>
                <div className="flex gap-1">
                  {(['EASY', 'NORMAL', 'HARD', 'NIGHTMARE'] as const).map((diff) => (
                    <button key={diff} type="button" onClick={() => setDifficulty(diff)}
                      className={`flex-1 py-1.5 px-1 rounded text-xs font-bold transition-all ${
                        difficulty === diff
                          ? diff === 'EASY' ? 'bg-green-600 text-white' : diff === 'NORMAL' ? 'bg-yellow-600 text-white' : diff === 'HARD' ? 'bg-orange-600 text-white' : 'bg-red-600 text-white'
                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced */}
            {gameMode === 'ZOMBIE_SURVIVAL' && (
              <div>
                <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1"
                >
                  {showAdvanced ? '▼' : '▶'} Advanced
                </button>
                {showAdvanced && (
                  <div className="mt-2 p-2 bg-slate-900/50 rounded-lg border border-slate-700">
                    <label className="block text-xs text-slate-400 mb-1">Max Zombies: {maxZombies}</label>
                    <input type="range" min="10" max="50" value={maxZombies} onChange={(e) => setMaxZombies(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Create Button */}
            <button type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-black text-lg rounded-xl hover:from-amber-400 hover:via-orange-400 hover:to-red-400 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              🚀 CREATE ROOM
            </button>
          </form>
        </div>

        {/* Controls */}
        <div className="w-full max-w-lg mt-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700/50">
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div>
              <div className="text-slate-300 font-bold mb-1">🖥️ Desktop</div>
              <div>WASD - Move</div>
              <div>Mouse - Aim</div>
              <div>Click/Space - Shoot</div>
              <div className="text-amber-400">Q - Switch Weapon</div>
            </div>
            <div>
              <div className="text-slate-300 font-bold mb-1">📱 Mobile</div>
              <div>Left stick - Move</div>
              <div>Right stick - Aim & Shoot</div>
              <div className="text-amber-400">Q button - Switch</div>
            </div>
          </div>
        </div>

        <div className="mt-2 text-center text-xs text-slate-600">P2P WebRTC • Room ID shown in top-right</div>
      </div>
    </div>
  );
};

export default LoginScreen;

// Export for use in App.tsx
export const ROOMS_STORAGE_KEY_EXPORT = ROOMS_STORAGE_KEY;
export const BROADCAST_CHANNEL_NAME = BROADCAST_CHANNEL;
