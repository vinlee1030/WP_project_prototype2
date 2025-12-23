
import React, { useState, useRef, useEffect } from 'react';
import { GameState, ChatMessage, WEAPON_STATS, TEAM_COLORS, WAVE_REST_TIME } from '../types';

interface UIOverlayProps {
  gameState: GameState;
  chatMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
  setChatFocus: (focused: boolean) => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ gameState, chatMessages, onSendMessage, setChatFocus }) => {
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const me = gameState.players.find(p => p.id === gameState.myId);
  const currentWeapon = me?.weapons[me.currentWeaponIndex];
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendMessage(chatInput.trim());
      setChatInput('');
    }
  };

  const sortedPlayers = [...gameState.players].filter(p => !p.dead).sort((a, b) => 
    gameState.settings.gameMode === 'GEM_GRAB' ? b.gems - a.gems : b.score - a.score
  );
  const restTimeLeft = gameState.waveState === 'REST' ? Math.max(0, Math.ceil((WAVE_REST_TIME - (Date.now() - gameState.waveRestStartTime)) / 1000)) : 0;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
      
      {/* ===== ANNOUNCEMENTS BANNER - Compact, slide in/out one at a time ===== */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 z-50" style={{ maxWidth: '85%' }}>
        {gameState.announcements.slice(-2).map((ann, idx) => { // Show max 2 at once
          const elapsed = Date.now() - ann.startTime;
          const remaining = ann.duration - elapsed;
          const slideIn = Math.min(1, elapsed / 150);
          const slideOut = remaining < 300 ? remaining / 300 : 1;
          const opacity = slideIn * slideOut;
          const translateY = -20 * (1 - slideIn) + (idx * 22); // Slide from top
          const scale = 0.9 + slideIn * 0.1;
          
          return (
            <div 
              key={ann.id}
              className="px-2 py-1 lg:px-4 lg:py-2 rounded-md text-center font-bold shadow-lg pixel-font text-xs lg:text-sm whitespace-nowrap max-w-[280px] lg:max-w-none truncate"
              style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: ann.color,
                opacity,
                transform: `translateY(${translateY}px) scale(${scale})`,
                transition: 'all 0.15s ease-out',
                border: `1px solid ${ann.color}50`
              }}
            >
              {ann.text}
            </div>
          );
        })}
      </div>
      
      {/* ===== MOBILE UI (Brawl Stars style - landscape optimized) ===== */}
      <div className="lg:hidden">
        {/* Top Left - HP & Weapon & Ammo (compact row) */}
        {me && (
          <div className="absolute top-1 left-1 flex items-center gap-1.5" style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)' }}>
            {/* HP Bar */}
            <div className="bg-black/70 rounded-lg px-2 py-1 flex items-center gap-1">
              <span className="text-red-500 text-xs">❤️</span>
              <div className="w-14 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all"
                  style={{ 
                    width: `${(me.hp / me.maxHp) * 100}%`,
                    backgroundColor: me.hp > 50 ? '#22c55e' : me.hp > 25 ? '#eab308' : '#ef4444'
                  }}
                />
              </div>
            </div>
            {/* Weapon + Ammo + Reload */}
            {currentWeapon && (
              <div className="bg-black/70 rounded-lg px-2 py-1 flex items-center gap-1">
                <span className="text-base">{WEAPON_STATS[currentWeapon.type].emoji}</span>
                {me.reloading ? (
                  <span className="text-orange-400 text-xs font-bold animate-pulse">🔄</span>
                ) : (
                  <span className="text-amber-400 text-xs font-bold">
                    {currentWeapon.ammo === -1 ? '∞' : currentWeapon.ammo}
                  </span>
                )}
              </div>
            )}
            {/* Wall Kits (wave 10+) */}
            {me.wallKits > 0 && (
              <div className="bg-purple-800/80 rounded-lg px-2 py-1 flex items-center gap-1 border border-purple-400/50">
                <span className="text-sm">🧱</span>
                <span className="text-purple-200 text-xs font-bold">{me.wallKits}</span>
              </div>
            )}
            {/* Buffs inline */}
            {me.speedBoostUntil > Date.now() && <span className="bg-cyan-500/80 rounded-full w-6 h-6 flex items-center justify-center text-sm">⚡</span>}
            {me.damageBoostUntil > Date.now() && <span className="bg-purple-500/80 rounded-full w-6 h-6 flex items-center justify-center text-sm">💪</span>}
            {me.slowedUntil > Date.now() && <span className="bg-blue-500/80 rounded-full w-6 h-6 flex items-center justify-center text-sm">❄️</span>}
            {(me.burningUntil || 0) > Date.now() && <span className="bg-orange-500/80 rounded-full w-6 h-6 flex items-center justify-center text-sm">🔥</span>}
          </div>
        )}

        {/* Top Center - Wave/Score/Time with zombie count + Stars/Kills inline */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          {gameState.settings.gameMode === 'ZOMBIE_SURVIVAL' ? (
            <div className="bg-black/70 rounded-lg px-2 py-1 flex items-center gap-1.5">
              {gameState.waveState === 'REST' ? (
                <span className="text-green-400 font-bold text-sm">✓ {restTimeLeft}s</span>
              ) : (
                <>
                  <span className="text-amber-400 font-bold text-sm">W{gameState.wave}</span>
                  <span className="text-red-400 text-sm">🧟{gameState.zombies.length}</span>
                </>
              )}
              {/* Stars/Kills inline */}
              {me && (
                <>
                  <span className="text-gray-500 text-xs">|</span>
                  <span className="text-amber-300 text-sm">⭐{me.score}</span>
                  <span className="text-red-300 text-sm">☠️{me.kills}</span>
                </>
              )}
            </div>
          ) : gameState.settings.gameMode === 'BRAWL_BALL' || gameState.settings.gameMode === 'TEAM_DEATHMATCH' ? (
            <div className="bg-black/70 rounded-lg px-2 py-1 flex items-center gap-1">
              <span className="text-red-500 font-black text-base">{gameState.teamScores.RED}</span>
              <span className="text-gray-400 text-xs">vs</span>
              <span className="text-blue-500 font-black text-base">{gameState.teamScores.BLUE}</span>
              <span className="text-white text-sm ml-1">{Math.max(0, Math.floor(gameState.matchTimeRemaining))}s</span>
            </div>
          ) : gameState.settings.gameMode === 'GEM_GRAB' ? (
            <div className="bg-black/70 rounded-lg px-2 py-1 flex items-center gap-1">
              {/* Team gem totals */}
              <span className="text-red-400 font-bold text-sm">🔴{gameState.players.filter(p => p.team === 'RED').reduce((sum, p) => sum + p.gems, 0)}</span>
              <span className="text-gray-400 text-xs">vs</span>
              <span className="text-blue-400 font-bold text-sm">🔵{gameState.players.filter(p => p.team === 'BLUE').reduce((sum, p) => sum + p.gems, 0)}</span>
              <span className="text-gray-500 text-xs">|</span>
              <span className="text-cyan-400 font-bold text-sm">💎{me?.gems || 0}</span>
              <span className="text-white text-sm">{Math.max(0, Math.floor(gameState.matchTimeRemaining))}s</span>
            </div>
          ) : gameState.settings.gameMode === 'GUN_GAME' ? (
            <div className="bg-black/70 rounded-lg px-2 py-1 flex items-center gap-1">
              <span className="text-amber-400 font-bold text-sm">🔫Lv{(me?.gunGameRank || 0) + 1}</span>
              <span className="text-green-400 text-sm">{me?.gunGameKillsAtRank || 0}/2</span>
              <span className="text-red-500 font-black text-sm">{gameState.teamScores.RED}</span>
              <span className="text-gray-400 text-xs">-</span>
              <span className="text-blue-500 font-black text-sm">{gameState.teamScores.BLUE}</span>
            </div>
          ) : null}
        </div>

        {/* Mobile Chat - minimized by default */}
        <div className="absolute bottom-32 left-2 pointer-events-auto" style={{ paddingLeft: 'env(safe-area-inset-left)' }}>
          <button
            onClick={() => setShowChat(!showChat)}
            className="w-10 h-10 bg-slate-800/80 rounded-full border border-slate-600 flex items-center justify-center text-lg active:scale-95"
          >
            💬
          </button>
          
          {showChat && (
            <div className="absolute bottom-12 left-0 w-56 bg-slate-900/95 rounded-lg border border-slate-600 overflow-hidden shadow-xl">
              <div className="h-24 overflow-y-auto p-2 space-y-1">
                {chatMessages.slice(-10).map((msg) => (
                  <div key={msg.id} className="text-xs">
                    <span style={{ color: msg.color }} className="font-bold">{msg.sender}: </span>
                    <span className="text-slate-300">{msg.text}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="border-t border-slate-600">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onFocus={() => setChatFocus(true)}
                  onBlur={() => setChatFocus(false)}
                  placeholder="Chat..."
                  className="w-full px-2 py-1.5 bg-slate-800/50 text-white text-xs placeholder-slate-500 focus:outline-none"
                  maxLength={50}
                />
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ===== DESKTOP UI (Full panels) ===== */}
      <div className="hidden lg:block">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-56 p-3 flex justify-between items-start gap-4">
          
          {/* Left: Player stats */}
          {me && (
            <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl p-4 border border-slate-600 shadow-xl min-w-[280px]">
              <div className="flex items-center gap-4">
                {/* HP */}
                <div className="flex-1">
                  <div className="w-full h-5 bg-slate-700 rounded-full overflow-hidden border border-slate-600">
                    <div 
                      className="h-full transition-all duration-200 rounded-full"
                      style={{ 
                        width: `${(me.hp / me.maxHp) * 100}%`,
                        backgroundColor: me.hp > 50 ? '#22c55e' : me.hp > 25 ? '#eab308' : '#ef4444'
                      }}
                    />
                  </div>
                  <div className="text-base text-white mt-1 font-bold">❤️ {Math.ceil(me.hp)}/{me.maxHp}</div>
                </div>

                {/* Weapon + Reload */}
                {currentWeapon && (
                  <div className="text-center border-l border-slate-600 pl-4">
                    <div className="text-3xl">{WEAPON_STATS[currentWeapon.type].emoji}</div>
                    {me.reloading ? (
                      <div className="text-base text-orange-400 font-bold animate-pulse">🔄 RELOADING</div>
                    ) : (
                      <div className="text-base text-amber-400 font-bold">
                        {currentWeapon.ammo === -1 ? '∞' : currentWeapon.ammo}
                      </div>
                    )}
                    <div className="text-xs text-slate-400">{WEAPON_STATS[currentWeapon.type].name}</div>
                  </div>
                )}

                {/* Switch indicator */}
                {me.weapons.length > 1 && (
                  <div className="text-center border-l border-slate-600 pl-4">
                    <div className="text-sm text-amber-400 font-bold bg-slate-700 px-2 py-1 rounded">Q</div>
                    <div className="text-sm text-white mt-1">{me.currentWeaponIndex + 1}/{me.weapons.length}</div>
                  </div>
                )}
                
                {/* Wall Kits (wave 10+) */}
                {me.wallKits > 0 && (
                  <div className="text-center border-l border-slate-600 pl-4">
                    <div className="text-2xl">🧱</div>
                    <div className="text-sm text-purple-300 font-bold">{me.wallKits}</div>
                    <div className="text-xs text-slate-400">Press E</div>
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div className="flex gap-4 mt-3 text-base border-t border-slate-700 pt-2">
                <span className="text-slate-300">⚔️ Kills: <span className="text-white font-bold">{me.kills}</span></span>
                <span className="text-slate-300">⭐ Score: <span className="text-amber-400 font-bold">{me.score}</span></span>
                {gameState.settings.gameMode === 'GEM_GRAB' && (
                  <span className="text-cyan-400">💎 Gems: <span className="font-bold">{me.gems}</span></span>
                )}
              </div>

              {/* Buffs */}
              {(me.speedBoostUntil > Date.now() || me.damageBoostUntil > Date.now() || me.slowedUntil > Date.now() || me.blurredUntil > Date.now()) && (
                <div className="flex gap-2 mt-2">
                  {me.speedBoostUntil > Date.now() && <span className="text-xs px-2 py-1 bg-cyan-600/50 rounded-lg text-cyan-200 font-bold">⚡ SPEED</span>}
                  {me.damageBoostUntil > Date.now() && <span className="text-xs px-2 py-1 bg-purple-600/50 rounded-lg text-purple-200 font-bold">💥 DAMAGE</span>}
                  {me.slowedUntil > Date.now() && <span className="text-xs px-2 py-1 bg-blue-600/50 rounded-lg text-blue-200 font-bold">❄️ SLOWED</span>}
                  {me.blurredUntil > Date.now() && <span className="text-xs px-2 py-1 bg-gray-600/50 rounded-lg text-gray-200 font-bold">💨 BLURRED</span>}
                </div>
              )}
            </div>
          )}

          {/* Center: Wave/Mode info */}
          <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl px-6 py-4 border border-slate-600 shadow-xl">
            {gameState.settings.gameMode === 'ZOMBIE_SURVIVAL' ? (
              <div className="text-center">
                {gameState.waveState === 'REST' ? (
                  <>
                    <div className="text-lg text-green-400 font-bold">✅ WAVE COMPLETE!</div>
                    <div className="text-5xl font-black text-green-400">{restTimeLeft}s</div>
                    <div className="text-sm text-slate-400">Next: Wave {gameState.wave + 1}</div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-slate-400 font-bold">WAVE</div>
                    <div className="text-6xl font-black text-amber-400">{gameState.wave}</div>
                    <div className="text-sm text-red-400 font-bold">🧟 {gameState.zombies.length} zombies</div>
                  </>
                )}
              </div>
            ) : gameState.settings.gameMode === 'BRAWL_BALL' || gameState.settings.gameMode === 'TEAM_DEATHMATCH' ? (
              <div className="flex items-center gap-5">
                <div className="text-center">
                  <div className="text-5xl font-black text-red-500">{gameState.teamScores.RED}</div>
                  <div className="text-sm text-red-400 font-bold">RED</div>
                </div>
                <div className="text-slate-500 text-xl font-bold">vs</div>
                <div className="text-center">
                  <div className="text-5xl font-black text-blue-500">{gameState.teamScores.BLUE}</div>
                  <div className="text-sm text-blue-400 font-bold">BLUE</div>
                </div>
                <div className="border-l border-slate-600 pl-4 text-center">
                  <div className="text-sm text-slate-400 font-bold">TIME</div>
                  <div className="text-3xl font-bold text-white">{Math.max(0, Math.floor(gameState.matchTimeRemaining))}s</div>
                </div>
              </div>
            ) : gameState.settings.gameMode === 'GEM_GRAB' ? (
              <div className="flex items-center gap-5">
                {/* Team Totals */}
                <div className="text-center">
                  <div className="text-sm text-slate-400 font-bold">RED TEAM</div>
                  <div className="text-4xl font-black text-red-500">🔴 {gameState.players.filter(p => p.team === 'RED').reduce((sum, p) => sum + p.gems, 0)}</div>
                </div>
                <div className="text-3xl text-slate-500">vs</div>
                <div className="text-center">
                  <div className="text-sm text-slate-400 font-bold">BLUE TEAM</div>
                  <div className="text-4xl font-black text-blue-500">🔵 {gameState.players.filter(p => p.team === 'BLUE').reduce((sum, p) => sum + p.gems, 0)}</div>
                </div>
                <div className="border-l border-slate-600 pl-4 text-center">
                  <div className="text-sm text-slate-400 font-bold">YOU</div>
                  <div className="text-3xl font-black text-cyan-400">💎 {me?.gems || 0}</div>
                </div>
                <div className="border-l border-slate-600 pl-4 text-center">
                  <div className="text-sm text-slate-400 font-bold">TIME</div>
                  <div className="text-3xl font-bold text-white">{Math.max(0, Math.floor(gameState.matchTimeRemaining))}s</div>
                </div>
              </div>
            ) : gameState.settings.gameMode === 'GUN_GAME' ? (
              <div className="flex items-center gap-5">
                <div className="text-center">
                  <div className="text-sm text-slate-400 font-bold">🔫 GUN GAME</div>
                  <div className="text-4xl font-black text-amber-400">Lv.{(me?.gunGameRank || 0) + 1}/{gameState.gunGameWeaponOrder?.length || 12}</div>
                  <div className="text-lg text-green-400 font-bold">{me?.gunGameKillsAtRank || 0}/2 kills</div>
                </div>
                <div className="border-l border-slate-600 pl-4">
                  <div className="text-center">
                    <div className="text-4xl font-black text-red-500">{gameState.teamScores.RED}</div>
                    <div className="text-xs text-red-400">RED</div>
                  </div>
                </div>
                <div className="text-slate-500 text-lg font-bold">vs</div>
                <div className="text-center">
                  <div className="text-4xl font-black text-blue-500">{gameState.teamScores.BLUE}</div>
                  <div className="text-xs text-blue-400">BLUE</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right side: Leaderboard */}
        <div className="absolute top-20 right-3 bg-slate-900/90 backdrop-blur-sm rounded-xl p-4 border border-slate-600 shadow-xl min-w-[220px]">
          <div className="text-base text-slate-200 mb-2 text-center font-bold border-b border-slate-600 pb-2">
            {gameState.settings.gameMode === 'GEM_GRAB' ? '💎 GEM LEADERS' : '🏆 SCOREBOARD'}
          </div>
          <div className="space-y-1.5">
            {sortedPlayers.slice(0, 6).map((p, i) => (
              <div 
                key={p.id}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-base ${
                  p.id === gameState.myId ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50' : 'text-slate-200 bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-5 font-bold">{i + 1}.</span>
                  <span 
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-white/30"
                    style={{ backgroundColor: p.team !== 'NONE' ? TEAM_COLORS[p.team] : p.color }}
                  />
                  <span className="truncate max-w-[80px] font-medium">{p.name}</span>
                  {p.isBot && <span className="text-xs text-slate-500">🤖</span>}
                </div>
                <span className="font-bold text-amber-400 ml-2 text-base">
                  {gameState.settings.gameMode === 'GEM_GRAB' ? p.gems : p.score}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat toggle - desktop only */}
        <div className="absolute bottom-4 left-3 pointer-events-auto">
          <button
            onClick={() => setShowChat(!showChat)}
            className="px-4 py-2 bg-slate-800/90 rounded-lg text-sm text-slate-300 hover:text-white border border-slate-600 font-bold"
          >
            {showChat ? '▼ Hide Chat' : '▲ Chat'}
          </button>
          
          {showChat && (
            <div className="mt-2 w-80 bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-600 overflow-hidden shadow-xl">
              <div className="h-40 overflow-y-auto p-3 space-y-1.5">
                {chatMessages.slice(-20).map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <span style={{ color: msg.color }} className="font-bold">{msg.sender}: </span>
                    <span className="text-slate-300">{msg.text}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="border-t border-slate-600">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onFocus={() => setChatFocus(true)}
                  onBlur={() => setChatFocus(false)}
                  placeholder="Type message..."
                  className="w-full px-4 py-3 bg-slate-800/50 text-white text-sm placeholder-slate-500 focus:outline-none focus:bg-slate-800"
                  maxLength={80}
                />
              </form>
            </div>
          )}
        </div>

        {/* Controls hint - desktop only */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-sm text-slate-400 bg-slate-900/80 px-5 py-2 rounded-full border border-slate-600 shadow-lg">
          <span className="text-slate-300 font-bold">WASD</span> Move • <span className="text-slate-300 font-bold">Mouse</span> Aim • <span className="text-slate-300 font-bold">Click/Space</span> Shoot • <span className="text-amber-400 font-bold">Q</span> Switch Weapon
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;
