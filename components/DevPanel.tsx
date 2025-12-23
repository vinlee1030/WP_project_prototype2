import React, { useState } from 'react';
import { GameState, ZOMBIE_TYPES, WEAPON_STATS, ZombieType, WeaponType } from '../types';

interface DevPanelProps {
  gameState: GameState;
  isPaused: boolean;
  onTogglePause: () => void;
  onClose: () => void;
}

export const DevPanel: React.FC<DevPanelProps> = ({ gameState, isPaused, onTogglePause, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'zombies' | 'weapons' | 'balance'>('overview');
  const wave = gameState.wave || 1;
  const zombiesLeft = gameState.zombiesLeftInWave || 0;
  const difficulty = gameState.settings.difficulty || 'NIGHTMARE';
  
  // Get wave bonus multipliers
  const waveBonus = {
    hp: Math.min(2.5, 1 + (wave - 1) * 0.08),
    ammo: Math.min(2.5, 1 + (wave - 1) * 0.06),
    fireRate: Math.min(1.5, 1 + (wave - 1) * 0.03)
  };
  
  // Count zombies by type
  const zombieCounts: Partial<Record<ZombieType, number>> = {};
  gameState.zombies.forEach(z => {
    zombieCounts[z.type] = (zombieCounts[z.type] || 0) + 1;
  });
  
  // Get unlocked weapons for current wave
  const unlockedWeapons = (Object.entries(WEAPON_STATS) as [WeaponType, typeof WEAPON_STATS[WeaponType]][])
    .filter(([_, stats]) => !stats.unlockWave || stats.unlockWave <= wave)
    .map(([type, stats]) => ({ type, ...stats }));

  const tabStyle = (tab: string) => `
    px-3 py-1.5 rounded-t-lg text-sm font-medium transition-all
    ${activeTab === tab ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}
  `;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-900 rounded-xl border-2 border-purple-500/50 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎮</span>
            <h2 className="text-xl font-bold text-white">Developer Panel</h2>
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-xs rounded-full border border-yellow-500/30">
              Wave {wave}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePause}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                isPaused ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-yellow-600 hover:bg-yellow-500 text-white'
              }`}
            >
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-2 bg-gray-800/50">
          <button className={tabStyle('overview')} onClick={() => setActiveTab('overview')}>📊 Overview</button>
          <button className={tabStyle('zombies')} onClick={() => setActiveTab('zombies')}>🧟 Zombies</button>
          <button className={tabStyle('weapons')} onClick={() => setActiveTab('weapons')}>🔫 Weapons</button>
          <button className={tabStyle('balance')} onClick={() => setActiveTab('balance')}>⚖️ Balance</button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard emoji="🌊" label="Wave" value={wave} color="blue" />
                <StatCard emoji="🧟" label="Zombies Left" value={zombiesLeft} color="red" />
                <StatCard emoji="👥" label="Players" value={gameState.players.filter(p => !p.dead).length} color="green" />
                <StatCard emoji="💀" label="Difficulty" value={difficulty} color="purple" />
              </div>

              {/* Wave Bonuses */}
              <div className="bg-gray-800 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <span>📈</span> Wave Bonuses (Current Wave {wave})
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-700/50 rounded p-2">
                    <div className="text-lg font-bold text-red-400">+{((waveBonus.hp - 1) * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-400">Max HP</div>
                  </div>
                  <div className="bg-gray-700/50 rounded p-2">
                    <div className="text-lg font-bold text-yellow-400">+{((waveBonus.ammo - 1) * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-400">Max Ammo</div>
                  </div>
                  <div className="bg-gray-700/50 rounded p-2">
                    <div className="text-lg font-bold text-cyan-400">+{((waveBonus.fireRate - 1) * 100).toFixed(0)}%</div>
                    <div className="text-xs text-gray-400">Fire Rate</div>
                  </div>
                </div>
              </div>

              {/* Player Stats */}
              <div className="bg-gray-800 rounded-lg p-3">
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <span>👤</span> Players
                </h3>
                <div className="space-y-2">
                  {gameState.players.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-700/50 rounded p-2 text-sm">
                      <span className="font-medium" style={{ color: p.color }}>{p.name}</span>
                      <div className="flex gap-4 text-xs">
                        <span className="text-red-400">❤️ {Math.round(p.hp)}/{p.maxHp}</span>
                        <span className="text-blue-400">🛡️ {Math.round(p.shield)}/{p.maxShield}</span>
                        <span className="text-yellow-400">🏆 {p.kills} kills</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'zombies' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-400 mb-2">
                Total on field: <span className="text-white font-bold">{gameState.zombies.length}</span>
              </div>
              <div className="grid gap-2">
                {(Object.entries(ZOMBIE_TYPES) as [ZombieType, typeof ZOMBIE_TYPES[ZombieType]][]).map(([type, stats]) => (
                  <div key={type} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: stats.color, opacity: 0.8 }}
                    >
                      {type === 'BOSS' ? '👹' : type === 'WITCH' ? '🧙‍♀️' : type === 'BOOMER' ? '💥' : '🧟'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{stats.name}</span>
                        <span className="text-xs text-gray-500">({type})</span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">
                          Wave {stats.minWave}+
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-400 mt-1">
                        <span className="text-red-400">❤️ {stats.hp}</span>
                        <span className="text-yellow-400">⚔️ {stats.attackDamage}</span>
                        <span className="text-cyan-400">💨 {stats.speed.toFixed(1)}</span>
                        <span className="text-purple-400">📏 {stats.attackRange}px</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{zombieCounts[type] || 0}</div>
                      <div className="text-xs text-gray-500">on field</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'weapons' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-400 mb-2">
                Unlocked: <span className="text-white font-bold">{unlockedWeapons.length}</span> / {Object.keys(WEAPON_STATS).length}
              </div>
              <div className="grid gap-2">
                {(Object.entries(WEAPON_STATS) as [WeaponType, typeof WEAPON_STATS[WeaponType]][]).map(([type, stats]) => {
                  const isUnlocked = !stats.unlockWave || stats.unlockWave <= wave;
                  const scaledAmmo = Math.round(stats.maxAmmo * waveBonus.ammo);
                  
                  return (
                    <div key={type} className={`bg-gray-800 rounded-lg p-3 ${!isUnlocked ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{stats.emoji}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{stats.name}</span>
                            {stats.unlockWave && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${isUnlocked ? 'bg-green-700 text-green-200' : 'bg-red-700 text-red-200'}`}>
                                {isUnlocked ? '✓ Unlocked' : `Wave ${stats.unlockWave}`}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 text-xs text-gray-400 mt-1">
                            <span className="text-red-400">💥 {stats.damage}</span>
                            <span className="text-yellow-400">📦 {stats.maxAmmo === -1 ? '∞' : `${stats.maxAmmo} → ${scaledAmmo}`}</span>
                            <span className="text-cyan-400">🔄 {stats.fireRate}ms</span>
                            <span className="text-purple-400">💨 {stats.speed}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'balance' && (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <span>⚖️</span> Difficulty Settings
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {(['EASY', 'NORMAL', 'HARD', 'NIGHTMARE'] as const).map(diff => {
                    const mults = getDiffMults(diff);
                    const isActive = difficulty === diff;
                    return (
                      <div key={diff} className={`p-3 rounded-lg border-2 ${isActive ? 'border-purple-500 bg-purple-900/30' : 'border-gray-700 bg-gray-700/30'}`}>
                        <div className="font-bold text-white flex items-center gap-2">
                          {diff === 'EASY' ? '😊' : diff === 'NORMAL' ? '😐' : diff === 'HARD' ? '😠' : '💀'}
                          {diff}
                          {isActive && <span className="text-xs bg-purple-500 px-1.5 rounded">Active</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                          <div>HP: <span className="text-green-400">{(mults.hp * 100).toFixed(0)}%</span></div>
                          <div>Damage: <span className="text-red-400">{(mults.dmg * 100).toFixed(0)}%</span></div>
                          <div>Zombies: <span className="text-yellow-400">{(mults.zombies * 100).toFixed(0)}%</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-bold text-white mb-3">📊 Current Stats</h3>
                <div className="text-sm text-gray-300 space-y-1">
                  <p>• Healer: <span className="text-green-400">1.5x healing rate</span> (+22 HP every 1.2s)</p>
                  <p>• Boomer: <span className="text-yellow-400">Slime DoT</span> (18 damage over 3s + blur)</p>
                  <p>• Tank/Boss: <span className="text-red-400">JUMP attack!</span> (Warning shadow, 50-80 damage)</p>
                  <p>• Max Mines: <span className="text-orange-400">12</span> (FIFO - oldest explodes first)</p>
                  <p>• Wave Scaling: <span className="text-cyan-400">Capped at 2.5x</span> to prevent bugs</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-800/50 px-4 py-2 text-center text-xs text-gray-500">
          Press ESC or click outside to close • ⚙️ Developer Mode
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ emoji: string; label: string; value: string | number; color: string }> = ({ emoji, label, value, color }) => {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-900 to-blue-800 border-blue-600',
    red: 'from-red-900 to-red-800 border-red-600',
    green: 'from-green-900 to-green-800 border-green-600',
    purple: 'from-purple-900 to-purple-800 border-purple-600',
  };
  
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg p-3 border-l-4 ${colorClasses[color].split(' ')[2]}`}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-300">{label}</div>
    </div>
  );
};

const getDiffMults = (diff: 'EASY' | 'NORMAL' | 'HARD' | 'NIGHTMARE') => {
  switch (diff) {
    case 'EASY': return { hp: 2.0, dmg: 2.0, zombies: 0.60 };
    case 'NORMAL': return { hp: 1.50, dmg: 1.50, zombies: 0.75 };
    case 'HARD': return { hp: 1.25, dmg: 1.25, zombies: 0.90 };
    case 'NIGHTMARE': return { hp: 1.0, dmg: 1.0, zombies: 1.0 };
  }
};

