
import React, { useState, useEffect, useRef } from 'react';
import LoginScreen from './components/LoginScreen';
import GameCanvas from './components/GameCanvas';
import UIOverlay from './components/UIOverlay';
import { DevPanel } from './components/DevPanel';
import { GameState, InputState, NetMessage, GameSettings, MAX_CONNECTIONS, ChatMessage } from './types';
import { initGame, updateGame, addPlayer, removePlayer } from './services/gameLogic';
import { audioService } from './services/audioService';
import { Peer, DataConnection } from 'peerjs';

const ROOM_PREFIX = 'zs3-';

const PEER_CONFIG: any = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
    // Allow candidates from host for same-device connections
    iceCandidatePoolSize: 10,
  }
};

let retryCount = 0;
const MAX_RETRIES = 3;

// Dual joystick mobile controls - Brawl Stars style (closer to center, bigger)
const MobileControls: React.FC<{ 
  setInput: (updater: (prev: InputState) => InputState) => void;
  gameState: GameState | null;
  onSwitchWeapon: () => void;
}> = ({ setInput, gameState, onSwitchWeapon }) => {
  const moveJoystickRef = useRef<HTMLDivElement>(null);
  const aimJoystickRef = useRef<HTMLDivElement>(null);
  const [moveKnob, setMoveKnob] = useState({ x: 0, y: 0 });
  const [aimKnob, setAimKnob] = useState({ x: 0, y: 0 });
  const [isAiming, setIsAiming] = useState(false);
  const audioInitedRef = useRef(false);
  const aimTouchIdRef = useRef<number | null>(null);
  
  // Init and unlock audio on ANY touch (mobile requirement)
  const ensureAudio = () => {
    if (!audioInitedRef.current) {
      audioService.unlock();
      // Also try to start BGM if not playing
      setTimeout(() => audioService.startBGM(), 100);
      audioInitedRef.current = true;
    }
  };
  
  // Prevent context menu globally
  useEffect(() => {
    const prevent = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('selectstart', prevent);
    // Unlock audio on any touch
    const unlockAudio = () => { ensureAudio(); };
    document.addEventListener('touchstart', unlockAudio, { once: true });
    return () => {
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('selectstart', prevent);
    };
  }, []);

  const handleMoveTouch = (touch: React.Touch) => {
    const rect = moveJoystickRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const maxRadius = rect.width / 2.2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const clampedX = dist > maxRadius ? dx * maxRadius / dist : dx;
    const clampedY = dist > maxRadius ? dy * maxRadius / dist : dy;
    setMoveKnob({ x: clampedX, y: clampedY });
    
    const deadZone = 10;
    let u = false, d = false, l = false, r = false;
    if (dist > deadZone) {
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const normAngle = angle < 0 ? angle + 360 : angle;
      if (normAngle >= 337.5 || normAngle < 22.5) r = true;
      else if (normAngle >= 22.5 && normAngle < 67.5) { r = true; d = true; }
      else if (normAngle >= 67.5 && normAngle < 112.5) d = true;
      else if (normAngle >= 112.5 && normAngle < 157.5) { d = true; l = true; }
      else if (normAngle >= 157.5 && normAngle < 202.5) l = true;
      else if (normAngle >= 202.5 && normAngle < 247.5) { l = true; u = true; }
      else if (normAngle >= 247.5 && normAngle < 292.5) u = true;
      else if (normAngle >= 292.5 && normAngle < 337.5) { u = true; r = true; }
    }
    setInput(prev => ({ ...prev, up: u, down: d, left: l, right: r }));
  };

  const handleAimTouch = (touch: React.Touch | Touch) => {
    const rect = aimJoystickRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const maxRadius = rect.width / 2.2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const clampedX = dist > maxRadius ? dx * maxRadius / dist : dx;
    const clampedY = dist > maxRadius ? dy * maxRadius / dist : dy;
    setAimKnob({ x: clampedX, y: clampedY });
    
    // Always fire when touching aim joystick - even tiny touches
    // Use a default direction if dx/dy are both 0
    const aimDx = Math.abs(dx) < 1 && Math.abs(dy) < 1 ? 1 : dx;
    const aimDy = Math.abs(dx) < 1 && Math.abs(dy) < 1 ? 0 : dy;
    setInput(prev => ({ ...prev, aimX: aimDx, aimY: aimDy, fire: true }));
  };

  const me = gameState?.players.find(p => p.id === gameState?.myId);
  const hasMultipleWeapons = me && me.weapons.length > 1;

  return (
    <div className="fixed inset-0 pointer-events-none lg:hidden z-50 select-none">
      {/* Move Joystick - Bottom Left, closer to center */}
      <div 
        ref={moveJoystickRef}
        className="absolute w-28 h-28 bg-black/40 rounded-full pointer-events-auto touch-none"
        style={{ 
          bottom: '12px', 
          left: '8%',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)'
        }}
        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); ensureAudio(); handleMoveTouch(e.targetTouches[0]); }}
        onTouchMove={(e) => { e.preventDefault(); e.stopPropagation(); handleMoveTouch(e.targetTouches[0]); }}
        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setMoveKnob({ x: 0, y: 0 }); setInput(prev => ({ ...prev, up: false, down: false, left: false, right: false })); }}
        onTouchCancel={(e) => { e.preventDefault(); setMoveKnob({ x: 0, y: 0 }); setInput(prev => ({ ...prev, up: false, down: false, left: false, right: false })); }}
      >
        <div className="absolute inset-0 rounded-full border-3 border-white/30" />
        <div 
          className="absolute w-12 h-12 bg-white/90 rounded-full shadow-xl"
          style={{ 
            top: '50%', 
            left: '50%', 
            marginTop: '-24px', 
            marginLeft: '-24px', 
            transform: `translate(${moveKnob.x}px, ${moveKnob.y}px)` 
          }}
        />
      </div>
      
      {/* Weapon Switch Button - Always visible when has multiple weapons, centered recycle icon */}
      {hasMultipleWeapons && (
        <button
          onTouchStart={(e) => { e.stopPropagation(); onSwitchWeapon(); }}
          className="absolute pointer-events-auto w-12 h-12 bg-amber-500/90 rounded-full border-3 border-amber-300 shadow-lg active:scale-90 active:bg-amber-600 transition-all z-[60]"
          style={{ 
            bottom: '130px', 
            right: 'calc(8% + 56px + env(safe-area-inset-right))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <span style={{ fontSize: '24px', lineHeight: 1 }}>🔄</span>
        </button>
      )}
      
      {/* Aim/Attack Joystick - Bottom Right, closer to center */}
      <div 
        ref={aimJoystickRef}
        className={`absolute w-32 h-32 rounded-full pointer-events-auto touch-none transition-all ${
          isAiming ? 'bg-red-500/60 scale-105' : 'bg-red-900/50'
        }`}
        style={{ 
          bottom: '12px', 
          right: '8%',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingRight: 'env(safe-area-inset-right)'
        }}
        onTouchStart={(e) => { 
          e.preventDefault(); e.stopPropagation();
          ensureAudio(); 
          setIsAiming(true); 
          // Track the touch that started on this element
          const touch = e.targetTouches[0] || e.changedTouches[0];
          if (touch) {
            aimTouchIdRef.current = touch.identifier;
            handleAimTouch(touch); 
          }
        }}
        onTouchMove={(e) => { 
          e.preventDefault(); e.stopPropagation();
          // Find our tracked touch or use the first touch on this element
          let touch = null;
          for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === aimTouchIdRef.current) {
              touch = e.touches[i];
              break;
            }
          }
          // Fallback: use targetTouches (touches on this element)
          if (!touch && e.targetTouches.length > 0) {
            touch = e.targetTouches[0];
            aimTouchIdRef.current = touch.identifier;
          }
          if (touch) {
            handleAimTouch(touch);
          }
        }}
        onTouchEnd={(e) => { 
          e.preventDefault(); e.stopPropagation();
          // Check if any touch is still on the aim joystick
          if (e.targetTouches.length === 0) {
            setIsAiming(false); 
            setAimKnob({ x: 0, y: 0 }); 
            setInput(prev => ({ ...prev, aimX: undefined, aimY: undefined, fire: false })); 
            aimTouchIdRef.current = null;
          }
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          setIsAiming(false); 
          setAimKnob({ x: 0, y: 0 }); 
          setInput(prev => ({ ...prev, aimX: undefined, aimY: undefined, fire: false })); 
          aimTouchIdRef.current = null;
        }}
      >
        <div className={`absolute inset-0 rounded-full border-3 transition-colors ${isAiming ? 'border-red-400' : 'border-red-500/60'}`} />
        {!isAiming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-red-300 text-3xl opacity-70">🎯</span>
          </div>
        )}
        <div 
          className={`absolute w-14 h-14 rounded-full shadow-xl transition-colors ${isAiming ? 'bg-red-500' : 'bg-red-600/90'}`}
          style={{ 
            top: '50%', 
            left: '50%', 
            marginTop: '-28px', 
            marginLeft: '-28px', 
            transform: `translate(${aimKnob.x}px, ${aimKnob.y}px)` 
          }}
        >
          {isAiming && <span className="absolute inset-0 flex items-center justify-center text-white text-2xl">🔥</span>}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatFocused, setIsChatFocused] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const stateRef = useRef<GameState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<InputState>({ up: false, down: false, left: false, right: false, fire: false, switchWeapon: false });
  const allInputsRef = useRef<Record<string, InputState>>({});
  const lastSwitchRef = useRef<number>(0);
  
  const reqRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const hostConnRef = useRef<DataConnection | null>(null);

  const handleJoin = async (name: string, roomId: string, roomName: string, settings: GameSettings) => {
    if (retryCount === 0) setStatusMsg('Connecting to server...');
    
    const fullRoomId = ROOM_PREFIX + roomId;
    const hostPeer = new Peer(fullRoomId, PEER_CONFIG);
    
    const connectionTimeout = setTimeout(() => {
      setStatusMsg('Connection timeout. Please try again.');
      hostPeer.destroy();
    }, 10000);
    
    hostPeer.on('open', () => {
      clearTimeout(connectionTimeout);
      retryCount = 0;
      setStatusMsg('');
      
      peerRef.current = hostPeer;
      const initialState = initGame(name, roomId, roomName, settings);
      stateRef.current = initialState;
      setGameState(initialState);
      setIsPlaying(true);
      audioService.init();
      audioService.startBGM();
      allInputsRef.current['host'] = inputRef.current;

      hostPeer.on('connection', (conn) => {
        if (connectionsRef.current.length >= MAX_CONNECTIONS) {
          conn.on('open', () => {
            conn.send({ type: 'ERROR', message: 'Room Full' } as NetMessage);
            setTimeout(() => conn.close(), 500);
          });
          return;
        }

        conn.on('open', () => {
          connectionsRef.current.push(conn);
        });
        
        conn.on('data', (data: any) => {
          const msg = data as NetMessage;
          if (msg.type === 'JOIN') {
            if (stateRef.current) {
              stateRef.current = addPlayer(stateRef.current, conn.peer, msg.name);
              conn.send({ type: 'WELCOME', playerId: conn.peer, state: stateRef.current } as NetMessage);
            }
          } else if (msg.type === 'INPUT') {
            allInputsRef.current[conn.peer] = msg.input;
          } else if (msg.type === 'CHAT') {
            setChatMessages(prev => [...prev, msg.message]);
            connectionsRef.current.forEach(c => { if (c.peer !== conn.peer && c.open) c.send(msg); });
          } else if (msg.type === 'PONG') {
            if (stateRef.current) {
              const rtt = Date.now() - msg.timestamp;
              const pIndex = stateRef.current.players.findIndex(p => p.id === conn.peer);
              if (pIndex !== -1) stateRef.current.players[pIndex].ping = rtt;
            }
          }
        });

        conn.on('close', () => {
          if (stateRef.current) {
            stateRef.current = removePlayer(stateRef.current, conn.peer);
            delete allInputsRef.current[conn.peer];
            connectionsRef.current = connectionsRef.current.filter(c => c.peer !== conn.peer);
          }
        });
      });
    });

    hostPeer.on('error', (err: any) => {
      clearTimeout(connectionTimeout);
      
      if (err.type === 'unavailable-id') {
        hostPeer.destroy();
        setStatusMsg('Room found! Joining...');
        const clientPeer = new Peer(undefined, PEER_CONFIG);
        peerRef.current = clientPeer;

        clientPeer.on('open', () => {
          setStatusMsg('Connecting to host...');
          // Simple connection without extra options - matches working prototype 2
          const conn = clientPeer.connect(fullRoomId);
          hostConnRef.current = conn;
          
          conn.on('open', () => {
            setStatusMsg('Connected, syncing...');
            conn.send({ type: 'JOIN', name } as NetMessage);
          });

          conn.on('data', (data: any) => {
            const msg = data as NetMessage;
            if (msg.type === 'WELCOME') {
              retryCount = 0;
              setIsPlaying(true);
              setStatusMsg('');
              audioService.init();
              audioService.startBGM();
              stateRef.current = { ...msg.state, myId: msg.playerId, isHost: false };
              setGameState(stateRef.current);
            } else if (msg.type === 'STATE_UPDATE') {
              if (stateRef.current) {
                stateRef.current = { ...msg.state, myId: stateRef.current.myId, isHost: false };
                setGameState(stateRef.current);
              }
            } else if (msg.type === 'ERROR') {
              alert(msg.message);
              conn.close();
              window.location.reload();
            } else if (msg.type === 'CHAT') {
              setChatMessages(prev => [...prev, msg.message]);
            } else if (msg.type === 'PING') {
              conn.send({ type: 'PONG', timestamp: msg.timestamp } as NetMessage);
            }
          });
          
          conn.on('close', () => {
            if (isPlaying) {
              alert('Connection to host lost');
              window.location.reload();
            }
          });
        });
        
        clientPeer.on('error', () => {
          setStatusMsg('Connection failed. Try again.');
        });
      } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
        hostPeer.destroy();
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          setStatusMsg(`Server busy. Retrying (${retryCount}/${MAX_RETRIES})...`);
          setTimeout(() => handleJoin(name, roomId, roomName, settings), 1500 * retryCount);
        } else {
          retryCount = 0;
          setStatusMsg('Server unavailable. Please try again later.');
        }
      } else {
        setStatusMsg('Connection error. Click JOIN to retry.');
        retryCount = 0;
      }
    });
  };

  const handleSendMessage = (text: string) => {
    if (!gameState || !gameState.myId) return;
    const me = gameState.players.find(p => p.id === gameState.myId);
    const msg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      sender: me?.name || 'Unknown',
      text, color: me?.color || '#fff',
      timestamp: Date.now()
    };
    setChatMessages(prev => [...prev, msg]);
    const netMsg: NetMessage = { type: 'CHAT', message: msg };
    if (gameState.isHost) {
      connectionsRef.current.forEach(c => { if (c.open) c.send(netMsg); });
    } else if (hostConnRef.current?.open) {
      hostConnRef.current.send(netMsg);
    }
  };

  // Weapon switch uses timestamp to ensure one switch per press
  const lastWeaponSwitchRef = useRef(0);
  
  const handleSwitchWeapon = () => {
    const now = Date.now();
    // Only allow switch once every 500ms
    if (now - lastWeaponSwitchRef.current < 500) return;
    lastWeaponSwitchRef.current = now;
    
    // Directly switch weapon in local state
    if (stateRef.current) {
      const me = stateRef.current.players.find(p => p.id === stateRef.current?.myId);
      if (me && me.weapons.length > 1) {
        me.currentWeaponIndex = (me.currentWeaponIndex + 1) % me.weapons.length;
        setGameState({ ...stateRef.current });
        
        // Send the new weapon index directly instead of a boolean
        if (hostConnRef.current?.open) {
          hostConnRef.current.send({ 
            type: 'INPUT', 
            input: { ...inputRef.current, newWeaponIndex: me.currentWeaponIndex } 
          } as NetMessage);
        }
      }
    }
  };

  // Keyboard inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isChatFocused) return;
      let changed = false;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') { inputRef.current.up = true; changed = true; }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') { inputRef.current.down = true; changed = true; }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') { inputRef.current.left = true; changed = true; }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') { inputRef.current.right = true; changed = true; }
      if (e.code === 'Space') { inputRef.current.fire = true; changed = true; }
      if (e.code === 'KeyQ') { handleSwitchWeapon(); }
      if (e.code === 'KeyE') { inputRef.current.buildWall = true; changed = true; } // Build wall
      if (e.code === 'Escape') { setShowDevPanel(prev => !prev); }
      
      if (changed && hostConnRef.current?.open) {
        hostConnRef.current.send({ type: 'INPUT', input: inputRef.current } as NetMessage);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (isChatFocused) {
        inputRef.current = { up: false, down: false, left: false, right: false, fire: false, switchWeapon: false };
        return;
      }
      let changed = false;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') { inputRef.current.up = false; changed = true; }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') { inputRef.current.down = false; changed = true; }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') { inputRef.current.left = false; changed = true; }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') { inputRef.current.right = false; changed = true; }
      if (e.code === 'Space') { inputRef.current.fire = false; changed = true; }
      if (e.code === 'KeyE') { inputRef.current.buildWall = false; changed = true; }
      
      if (changed && hostConnRef.current?.open) {
        hostConnRef.current.send({ type: 'INPUT', input: inputRef.current } as NetMessage);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isChatFocused]);

  // Mouse input
  useEffect(() => {
    if (!isPlaying || !gameState || !canvasRef.current) return;
    const canvas = canvasRef.current;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      const me = gameState.players.find(p => p.id === gameState.myId);
      if (me) {
        const camX = me.x - 400;
        const camY = me.y - 300;
        inputRef.current.mouseX = x + camX;
        inputRef.current.mouseY = y + camY;
        if (hostConnRef.current?.open) {
          hostConnRef.current.send({ type: 'INPUT', input: inputRef.current } as NetMessage);
        }
      }
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.fire = true;
        if (hostConnRef.current?.open) hostConnRef.current.send({ type: 'INPUT', input: inputRef.current } as NetMessage);
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        inputRef.current.fire = false;
        if (hostConnRef.current?.open) hostConnRef.current.send({ type: 'INPUT', input: inputRef.current } as NetMessage);
      }
    };
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPlaying, gameState]);

  // Broadcast room info periodically when hosting
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  
  useEffect(() => {
    if (!isPlaying || !gameState?.isHost) return;
    
    // Setup broadcast channel
    try {
      broadcastChannelRef.current = new BroadcastChannel('zombie-arena-rooms');
    } catch {}
    
    const ROOMS_STORAGE_KEY = 'zombie-arena-rooms-v2';
    
    const broadcastRoom = () => {
      try {
        const stored = localStorage.getItem(ROOMS_STORAGE_KEY);
        const rooms = stored ? JSON.parse(stored) : [];
        const myRoom = {
          id: gameState.roomId,
          name: gameState.roomName || `Room ${gameState.roomId}`,
          host: gameState.players.find(p => p.id === 'host')?.name || 'Host',
          mode: gameState.settings.gameMode,
          players: gameState.players.filter(p => !p.isBot).length,
          maxPlayers: 8,
          timestamp: Date.now(),
        };
        const updated = [myRoom, ...rooms.filter((r: any) => r.id !== gameState.roomId)].slice(0, 10);
        localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(updated));
        
        // Also broadcast via BroadcastChannel
        broadcastChannelRef.current?.postMessage({ type: 'ROOM_UPDATE' });
      } catch {}
    };
    
    // Broadcast immediately and then every 2 seconds
    broadcastRoom();
    const interval = setInterval(broadcastRoom, 2000);
    
    // Cleanup room when leaving
    return () => {
      clearInterval(interval);
      broadcastChannelRef.current?.close();
      try {
        const stored = localStorage.getItem(ROOMS_STORAGE_KEY);
        if (stored) {
          const rooms = JSON.parse(stored);
          const filtered = rooms.filter((r: any) => r.id !== gameState.roomId);
          localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch {}
    };
  }, [isPlaying, gameState?.isHost, gameState?.roomId, gameState?.players.length]);

  // Game loop with pause support
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  
  useEffect(() => {
    if (!isPlaying) return;

    const loop = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      
      // Only update game if not paused (host only - clients receive state from host)
      if (!isPausedRef.current) {
        const dt = (time - lastTimeRef.current) / 16.67;
        lastTimeRef.current = time;

        if (stateRef.current?.isHost) {
          allInputsRef.current['host'] = inputRef.current;
          stateRef.current = updateGame(stateRef.current, allInputsRef.current, dt);
          
          const updateMsg: NetMessage = { type: 'STATE_UPDATE', state: stateRef.current };
          connectionsRef.current.forEach(conn => { if (conn.open) conn.send(updateMsg); });
          setGameState(stateRef.current);
        }
      } else {
        // Still update last time to prevent huge dt jump when unpaused
        lastTimeRef.current = time;
      }
      
      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);
    return () => { if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [isPlaying]);

  const setInputState = (updater: (prev: InputState) => InputState) => {
    inputRef.current = updater(inputRef.current);
    if (hostConnRef.current?.open) {
      hostConnRef.current.send({ type: 'INPUT', input: inputRef.current } as NetMessage);
    }
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center overflow-hidden">
      {!isPlaying ? (
        <>
          <LoginScreen onJoin={handleJoin} />
          {statusMsg && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-amber-400 font-bold animate-pulse bg-slate-800/90 px-6 py-3 rounded-xl border border-amber-500/30 z-50">
              {statusMsg}
            </div>
          )}
        </>
      ) : (
        gameState && (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
            <GameCanvas ref={canvasRef} gameState={gameState} />
            <UIOverlay 
              gameState={gameState} 
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              setChatFocus={setIsChatFocused}
            />
            <MobileControls setInput={setInputState} gameState={gameState} onSwitchWeapon={handleSwitchWeapon} />
            
            {/* Connection badge - Compact on both mobile & desktop */}
            <div className="absolute top-1 right-0 lg:top-2 lg:right-2 text-xs font-mono pointer-events-auto z-50 bg-slate-900/95 px-2 py-1 rounded-l-lg lg:rounded-lg border border-slate-600 shadow-lg" style={{ paddingRight: 'env(safe-area-inset-right)' }}>
              <div className="flex items-center gap-2">
                <span className={gameState.isHost ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'}>
                  {gameState.isHost ? `🏠` : `📡`}
                </span>
                <span className="text-amber-400">
                  <span className="text-white font-bold select-all">{gameState.roomId}</span>
                </span>
                <span className="text-slate-400">👥{gameState.players.length}</span>
              </div>
              {gameState.isHost && (
                <button 
                  onClick={() => navigator.clipboard.writeText(gameState.roomId)}
                  className="mt-1 px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 w-full"
                >
                  📋 Copy
                </button>
              )}
            </div>
            
            {/* Developer Settings Button - Mobile: top left below status, Desktop: bottom right */}
            <button
              onClick={() => setShowDevPanel(true)}
              className="absolute z-50 w-10 h-10 lg:w-12 lg:h-12 bg-purple-700/80 hover:bg-purple-600 rounded-xl transition-all shadow-lg border border-purple-400/50 pointer-events-auto flex items-center justify-center top-16 left-2 lg:top-auto lg:left-auto lg:bottom-20 lg:right-4"
              title="Developer Panel (ESC)"
            >
              <span className="text-xl lg:text-2xl">⚙️</span>
            </button>
            
            {/* Pause indicator */}
            {isPaused && !showDevPanel && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                <div className="text-6xl font-black text-white drop-shadow-2xl animate-pulse bg-black/50 px-8 py-4 rounded-2xl">
                  ⏸️ PAUSED
                </div>
              </div>
            )}
            
            {/* Developer Panel Modal */}
            {showDevPanel && gameState && (
              <DevPanel 
                gameState={gameState}
                isPaused={isPaused}
                onTogglePause={() => setIsPaused(p => !p)}
                onClose={() => setShowDevPanel(false)}
              />
            )}
            
            {/* End screen */}
            {gameState.showEndScreen && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="text-center bg-gradient-to-b from-slate-800 to-slate-900 p-10 rounded-3xl border-4 border-amber-500 shadow-2xl">
                  <h1 className="text-5xl font-black mb-4" style={{ color: gameState.winnerTeam === 'RED' ? '#ef4444' : gameState.winnerTeam === 'BLUE' ? '#3b82f6' : '#f59e0b' }}>
                    {gameState.settings.gameMode === 'ZOMBIE_SURVIVAL' ? '💀 GAME OVER' : 
                     gameState.winnerTeam ? `🏆 ${gameState.winnerTeam === 'RED' ? 'RED' : 'BLUE'} TEAM WINS!` : '🤝 IT\'S A TIE!'}
                  </h1>
                  {gameState.settings.gameMode === 'ZOMBIE_SURVIVAL' && (
                    <div className="text-2xl text-slate-300 mb-4">
                      Wave Reached: <span className="text-amber-400 font-bold">{gameState.wave}</span>
                    </div>
                  )}
                  {gameState.settings.gameMode === 'GEM_GRAB' && (
                    <div className="text-xl text-cyan-300 mb-4">
                      💎 Your Gems: {gameState.players.find(p => p.id === gameState.myId)?.gems || 0}
                    </div>
                  )}
                  <div className="text-6xl my-4 animate-bounce">
                    {gameState.winnerTeam === 'RED' ? '🔴' : gameState.winnerTeam === 'BLUE' ? '🔵' : '⭐'}
                  </div>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-4 px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg rounded-xl hover:scale-105 transition-all"
                  >
                    🏠 Return to Menu
                  </button>
                </div>
              </div>
            )}
            
            {gameState.gameOver && !gameState.showEndScreen && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
                <div className="text-center">
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-10 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-2xl rounded-2xl hover:scale-105 transition-all shadow-xl"
                  >
                    🔄 PLAY AGAIN
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default App;
