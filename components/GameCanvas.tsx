
import React, { useRef, useEffect, forwardRef, useState } from 'react';
import { GameState, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, PLAYER_RADIUS, MAP_SIZE, ITEM_RADIUS, ZOMBIE_RADIUS, ZOMBIE_TYPES, WEAPON_STATS, TEAM_COLORS, BALL_RADIUS, MOBILE_ZOOM } from '../types';

interface GameCanvasProps {
  gameState: GameState;
}

const GameCanvas = forwardRef<HTMLCanvasElement, GameCanvasProps>(({ gameState }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const me = gameState.players.find(p => p.id === gameState.myId);
    
    // Mobile zoom - show less of the map but bigger characters
    const zoom = isMobile ? MOBILE_ZOOM : 1;
    const effectiveViewW = VIEWPORT_WIDTH / zoom;
    const effectiveViewH = VIEWPORT_HEIGHT / zoom;
    
    const now = Date.now();

    // During goal celebration, focus camera on ball/goal
    let camX = me ? me.x - effectiveViewW / 2 : 0;
    let camY = me ? me.y - effectiveViewH / 2 : 0;
    
    if (gameState.goalCelebrationUntil && now < gameState.goalCelebrationUntil && gameState.ball) {
      // Focus on ball during celebration
      camX = gameState.ball.x - effectiveViewW / 2;
      camY = gameState.ball.y - effectiveViewH / 2;
    }

    ctx.imageSmoothingEnabled = false;

    // Background
    const grad = ctx.createRadialGradient(VIEWPORT_WIDTH/2, VIEWPORT_HEIGHT/2, 0, VIEWPORT_WIDTH/2, VIEWPORT_HEIGHT/2, 500);
    grad.addColorStop(0, '#1a2a3a');
    grad.addColorStop(1, '#0a0f14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    ctx.save();
    // Apply zoom for mobile
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // Grid
    ctx.strokeStyle = '#1e2e3e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x = 0; x <= MAP_SIZE; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, MAP_SIZE); }
    for(let y = 0; y <= MAP_SIZE; y += 80) { ctx.moveTo(0, y); ctx.lineTo(MAP_SIZE, y); }
    ctx.stroke();

    // Goals for Brawl Ball
    if (gameState.goals) {
      gameState.goals.forEach(goal => {
        ctx.fillStyle = goal.team === 'RED' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)';
        ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
        ctx.strokeStyle = goal.team === 'RED' ? '#ef4444' : '#3b82f6';
        ctx.lineWidth = 4;
        ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);
      });
    }

    // Walls
    gameState.walls.forEach(w => {
      if (w.type === 'WATER') {
        const wave = Math.sin(now / 400 + w.x / 40) * 2;
        ctx.fillStyle = '#1e5aa8';
        ctx.fillRect(w.x, w.y + wave, w.w, w.h);
        ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
        ctx.fillRect(w.x + 2, w.y + wave + 2, w.w - 4, 3);
      } else if (w.type === 'BUSH') {
        ctx.fillStyle = '#2d5a2d';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#3d7a3d';
        for (let i = 0; i < w.w; i += 14) {
          for (let j = 0; j < w.h; j += 14) {
            ctx.beginPath();
            ctx.arc(w.x + i + 7, w.y + j + 7, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (w.type === 'BARREL') {
        // Explosive barrel
        ctx.fillStyle = '#cc4444';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(w.x + 5, w.y + 5, w.w - 10, w.h - 10);
        ctx.fillStyle = '#000';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💥', w.x + w.w/2, w.y + w.h/2 + 4);
        // HP bar
        if (w.hp && w.maxHp) {
          ctx.fillStyle = '#440000';
          ctx.fillRect(w.x, w.y - 6, w.w, 4);
          ctx.fillStyle = '#ff4444';
          ctx.fillRect(w.x, w.y - 6, w.w * (w.hp / w.maxHp), 4);
        }
      } else if (w.type === 'DESTRUCTIBLE') {
        ctx.fillStyle = '#5a5a4a';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#6a6a5a';
        ctx.fillRect(w.x, w.y, w.w, 3);
        ctx.fillStyle = '#3a3a2a';
        ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
        ctx.strokeStyle = '#2a2a1a';
        ctx.lineWidth = 2;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
        // Cracks if damaged
        if (w.hp && w.maxHp && w.hp < w.maxHp * 0.7) {
          ctx.strokeStyle = '#1a1a0a';
          ctx.beginPath();
          ctx.moveTo(w.x + w.w * 0.3, w.y);
          ctx.lineTo(w.x + w.w * 0.5, w.y + w.h * 0.5);
          ctx.lineTo(w.x + w.w * 0.7, w.y + w.h);
          ctx.stroke();
        }
      } else if (w.type === 'CRATE') {
        // Color-coded crates based on drop type
        let crateColor = '#8B4513'; // Default brown
        let crateInner = '#A0522D';
        let icon = '?';
        let iconColor = '#FFD700';
        
        if (w.dropType) {
          if (w.dropType === 'HEALTH') { crateColor = '#8B2020'; crateInner = '#A05050'; icon = '❤️'; }
          else if (w.dropType === 'SHIELD') { crateColor = '#2040A0'; crateInner = '#4060C0'; icon = '🛡️'; }
          else if (w.dropType === 'AMMO' || w.dropType === 'SPEED_BOOST' || w.dropType === 'DAMAGE_BOOST' || w.dropType === 'FIRE_RATE_BOOST') { 
            crateColor = '#A08020'; crateInner = '#C0A040'; icon = '⚡'; 
          }
          else if (w.dropType.startsWith('WEAPON_')) { crateColor = '#602080'; crateInner = '#8040A0'; icon = '⚔️'; }
        }
        
        ctx.fillStyle = crateColor;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = crateInner;
        ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, w.h - 4);
        // Wood grain
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w.x + w.w/2, w.y);
        ctx.lineTo(w.x + w.w/2, w.y + w.h);
        ctx.moveTo(w.x, w.y + w.h/2);
        ctx.lineTo(w.x + w.w, w.y + w.h/2);
        ctx.stroke();
        // Icon
        ctx.fillStyle = iconColor;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(icon, w.x + w.w/2, w.y + w.h/2 + 3);
        // HP bar
        if (w.hp && w.maxHp && w.hp > 0) {
          ctx.fillStyle = '#440000';
          ctx.fillRect(w.x, w.y - 6, w.w, 4);
          ctx.fillStyle = '#ff8800';
          ctx.fillRect(w.x, w.y - 6, w.w * Math.max(0, w.hp / w.maxHp), 4);
        }
      } else if (w.type === 'POND') {
        // Blue pond (impassable water)
        const wave = Math.sin(now / 500 + w.x / 30) * 1.5;
        ctx.fillStyle = '#1565C0';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#1E88E5';
        ctx.fillRect(w.x + 3, w.y + 3 + wave, w.w - 6, w.h - 6);
        // Ripples
        ctx.strokeStyle = 'rgba(144, 202, 249, 0.5)';
        ctx.lineWidth = 1;
        const ripplePhase = (now / 800) % 1;
        ctx.beginPath();
        ctx.ellipse(w.x + w.w/2, w.y + w.h/2, (w.w/3) * ripplePhase, (w.h/3) * ripplePhase, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (w.type === 'SWAMP') {
        // Swamp (slows down players and zombies)
        const wave = Math.sin(now / 600 + w.x / 25) * 1;
        ctx.fillStyle = '#3d5c3d';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#4a6a4a';
        ctx.fillRect(w.x + 2, w.y + 2 + wave, w.w - 4, w.h - 4);
        // Bubbles
        ctx.fillStyle = 'rgba(100, 140, 100, 0.6)';
        const bubbleTime = (now / 300) % 20;
        for (let i = 0; i < 3; i++) {
          const bx = w.x + (w.w * 0.2) + (i * w.w * 0.3) + Math.sin(now/500 + i) * 3;
          const by = w.y + w.h - 5 - (bubbleTime + i * 5) % 15;
          if (by > w.y + 5) {
            ctx.beginPath();
            ctx.arc(bx, by, 2 + Math.sin(now/200 + i), 0, Math.PI * 2);
            ctx.fill();
          }
        }
        // Slow icon in center
        ctx.fillStyle = 'rgba(255, 200, 100, 0.4)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🐌', w.x + w.w/2, w.y + w.h/2 + 3);
      } else if (w.type === 'ASYLUM_WALL') {
        // Player-built asylum wall (wave 10+)
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#6a5a4a';
        ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, w.h - 4);
        // Brick pattern
        ctx.strokeStyle = '#4a3a2a';
        ctx.lineWidth = 1;
        for (let by = 0; by < w.h; by += 8) {
          const offset = (by / 8) % 2 === 0 ? 0 : w.w / 4;
          for (let bx = offset; bx < w.w; bx += w.w / 2) {
            ctx.strokeRect(w.x + bx, w.y + by, w.w / 2, 8);
          }
        }
        // HP bar if damaged
        if (w.hp && w.maxHp && w.hp < w.maxHp) {
          ctx.fillStyle = '#440000';
          ctx.fillRect(w.x, w.y - 6, w.w, 4);
          ctx.fillStyle = '#88aa44';
          ctx.fillRect(w.x, w.y - 6, w.w * Math.max(0, w.hp / w.maxHp), 4);
        }
      } else {
        // Solid wall
        ctx.fillStyle = '#4a5a6a';
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = '#5a6a7a';
        ctx.fillRect(w.x, w.y, w.w, 3);
        ctx.fillRect(w.x, w.y, 3, w.h);
        ctx.fillStyle = '#2a3a4a';
        ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
        ctx.fillRect(w.x + w.w - 3, w.y, 3, w.h);
        ctx.strokeStyle = '#1a2a3a';
        ctx.lineWidth = 1;
        ctx.strokeRect(w.x, w.y, w.w, w.h);
      }
    });

    // Items
    gameState.items.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);
      const float = Math.sin(now / 250 + item.x) * 3;
      ctx.translate(0, float);
        ctx.rotate(item.rotation);
      ctx.shadowBlur = 12;
        
        if (item.type === 'HEALTH') {
        ctx.shadowColor = '#ff6666';
        ctx.fillStyle = '#ff4444';
            ctx.beginPath();
        ctx.moveTo(0, ITEM_RADIUS/2);
        ctx.bezierCurveTo(-ITEM_RADIUS, -ITEM_RADIUS/2, -ITEM_RADIUS/2, -ITEM_RADIUS, 0, -ITEM_RADIUS/3);
        ctx.bezierCurveTo(ITEM_RADIUS/2, -ITEM_RADIUS, ITEM_RADIUS, -ITEM_RADIUS/2, 0, ITEM_RADIUS/2);
            ctx.fill();
            ctx.fillStyle = '#fff';
        ctx.fillRect(-1.5, -4, 3, 8);
        ctx.fillRect(-4, -1.5, 8, 3);
        } else if (item.type === 'AMMO') {
        ctx.shadowColor = '#ffdd44';
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(-ITEM_RADIUS+2, -ITEM_RADIUS+2, ITEM_RADIUS*2-4, ITEM_RADIUS*2-4);
        ctx.fillStyle = '#884400';
        for (let i = 0; i < 3; i++) ctx.fillRect(-6+i*5, -3, 3, 8);
      } else if (item.type === 'SHIELD') {
        // Bulletproof vest / shield
        ctx.shadowColor = '#4488ff';
        ctx.fillStyle = '#2266cc';
        // Shield shape
            ctx.beginPath();
            ctx.moveTo(0, -ITEM_RADIUS);
        ctx.quadraticCurveTo(ITEM_RADIUS, -ITEM_RADIUS * 0.5, ITEM_RADIUS, ITEM_RADIUS * 0.3);
        ctx.quadraticCurveTo(ITEM_RADIUS * 0.5, ITEM_RADIUS, 0, ITEM_RADIUS);
        ctx.quadraticCurveTo(-ITEM_RADIUS * 0.5, ITEM_RADIUS, -ITEM_RADIUS, ITEM_RADIUS * 0.3);
        ctx.quadraticCurveTo(-ITEM_RADIUS, -ITEM_RADIUS * 0.5, 0, -ITEM_RADIUS);
            ctx.fill();
        ctx.fillStyle = '#88bbff';
        ctx.fillRect(-2, -4, 4, 8);
      } else if (item.type === 'FIRE_RATE_BOOST') {
        // Lightning bolt for fire rate
        ctx.shadowColor = '#ff8800';
        ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
        ctx.moveTo(-3, -ITEM_RADIUS);
        ctx.lineTo(3, -2);
        ctx.lineTo(0, 0);
        ctx.lineTo(5, ITEM_RADIUS);
        ctx.lineTo(-2, 2);
        ctx.lineTo(0, 0);
        ctx.lineTo(-5, -ITEM_RADIUS + 4);
        ctx.closePath();
            ctx.fill();
      } else if (item.type === 'WALL_KIT') {
        // Wall building kit
        ctx.shadowColor = '#8866aa';
        ctx.fillStyle = '#6a5a4a';
        ctx.fillRect(-ITEM_RADIUS+2, -ITEM_RADIUS+2, ITEM_RADIUS*2-4, ITEM_RADIUS*2-4);
        // Brick pattern
        ctx.fillStyle = '#8a7a6a';
        ctx.fillRect(-ITEM_RADIUS+4, -ITEM_RADIUS+4, ITEM_RADIUS-4, ITEM_RADIUS/2-2);
        ctx.fillRect(-2, -ITEM_RADIUS+4, ITEM_RADIUS-2, ITEM_RADIUS/2-2);
        ctx.fillRect(-ITEM_RADIUS+4, 2, ITEM_RADIUS-2, ITEM_RADIUS/2-2);
        ctx.fillRect(2, 2, ITEM_RADIUS-4, ITEM_RADIUS/2-2);
      } else if (item.type === 'GEM') {
        ctx.shadowColor = '#66ffff';
        ctx.fillStyle = '#44ddff';
            ctx.beginPath();
            ctx.moveTo(0, -ITEM_RADIUS);
            ctx.lineTo(ITEM_RADIUS, 0);
            ctx.lineTo(0, ITEM_RADIUS);
            ctx.lineTo(-ITEM_RADIUS, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.moveTo(0, -ITEM_RADIUS+3);
        ctx.lineTo(ITEM_RADIUS-4, 0);
        ctx.lineTo(0, 2);
        ctx.closePath();
        ctx.fill();
      } else if (item.type === 'MINE') {
        // LANDMINE with arming indicator
        const isArmed = item.spawnTime && (now - item.spawnTime > 2000);
        const armingProgress = item.spawnTime ? Math.min(1, (now - item.spawnTime) / 2000) : 1;
        
        // Pulsing glow when armed
        const pulse = isArmed ? 1 + Math.sin(now / 100) * 0.3 : 1;
        
        // Outer ring (red when armed, yellow when arming)
        ctx.strokeStyle = isArmed ? '#ff0000' : '#ffaa00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, ITEM_RADIUS * pulse + 4, 0, Math.PI * 2);
        ctx.stroke();
        
        // Arming progress arc
        if (!isArmed) {
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, ITEM_RADIUS + 2, -Math.PI/2, -Math.PI/2 + armingProgress * Math.PI * 2);
          ctx.stroke();
        }
        
        ctx.shadowColor = isArmed ? '#ff4444' : '#ffaa00';
        ctx.shadowBlur = isArmed ? 15 * pulse : 5;
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(0, 0, ITEM_RADIUS, 0, Math.PI*2);
        ctx.fill();
        
        // Center light (blinks when armed)
        const centerColor = isArmed ? (Math.floor(now / 200) % 2 === 0 ? '#ff0000' : '#ff4444') : '#ffaa00';
        ctx.fillStyle = centerColor;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI*2);
        ctx.fill();
        
        // Warning icon
        ctx.fillStyle = isArmed ? '#ff0000' : '#888';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isArmed ? '💣' : '⏳', 0, -ITEM_RADIUS - 8);
        ctx.shadowBlur = 0;
      } else if (item.type.startsWith('WEAPON_')) {
        const colors: Record<string, string> = {
          'WEAPON_SHOTGUN': '#a855f7', 'WEAPON_RIFLE': '#3b82f6', 'WEAPON_MACHINE_GUN': '#10b981',
          'WEAPON_SNIPER': '#f59e0b', 'WEAPON_ROCKET': '#ef4444', 'WEAPON_FLAMETHROWER': '#f97316',
          'WEAPON_GRENADE': '#ff6b6b', 'WEAPON_LASER': '#00ffff', 'WEAPON_MINIGUN': '#ff4444',
          'WEAPON_CHAINSAW': '#ff6600', 'WEAPON_BAT': '#8B4513', 'WEAPON_LANDMINE': '#ff4444'
        };
        const color = colors[item.type] || '#888';
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 144 - 90) * Math.PI / 180;
          if (i === 0) ctx.moveTo(Math.cos(angle) * ITEM_RADIUS, Math.sin(angle) * ITEM_RADIUS);
          else ctx.lineTo(Math.cos(angle) * ITEM_RADIUS, Math.sin(angle) * ITEM_RADIUS);
        }
        ctx.closePath();
        ctx.fill();
      } else if (item.type === 'SPEED_BOOST') {
        ctx.shadowColor = '#06d6d6';
        ctx.fillStyle = '#06b6d4';
        ctx.beginPath();
        ctx.moveTo(2, -ITEM_RADIUS);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-1, 0);
        ctx.lineTo(-3, ITEM_RADIUS);
        ctx.lineTo(5, -2);
        ctx.lineTo(1, -2);
        ctx.closePath();
        ctx.fill();
      } else if (item.type === 'DAMAGE_BOOST') {
        ctx.shadowColor = '#c084fc';
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i * 45) * Math.PI / 180;
          const r = i % 2 === 0 ? ITEM_RADIUS : ITEM_RADIUS * 0.5;
          if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
            ctx.fill();
        } else if (item.type === 'ARMOR') {
        ctx.shadowColor = '#60a5fa';
            ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(0, -ITEM_RADIUS);
        ctx.lineTo(ITEM_RADIUS, -ITEM_RADIUS*0.3);
        ctx.lineTo(ITEM_RADIUS*0.8, ITEM_RADIUS*0.5);
        ctx.lineTo(0, ITEM_RADIUS);
        ctx.lineTo(-ITEM_RADIUS*0.8, ITEM_RADIUS*0.5);
        ctx.lineTo(-ITEM_RADIUS, -ITEM_RADIUS*0.3);
        ctx.closePath();
        ctx.fill();
      } else if (item.type === 'VENOM_PUDDLE') {
        // Fire puddle (from Boss) if value > 100, otherwise venom puddle
        // OPTIMIZED - simpler rendering to reduce lag
        const isFirePuddle = item.value && item.value > 100;
        
        // Simple glow (reduced shadow for performance)
        ctx.shadowColor = isFirePuddle ? '#ff4400' : '#88ff44';
        ctx.shadowBlur = 8; // Reduced from 15
        
        const puddleSize = ITEM_RADIUS * 2.2; // No pulsing for performance
        
        // Main puddle only (removed outer glow for performance)
        ctx.fillStyle = isFirePuddle ? 'rgba(255, 80, 20, 0.6)' : 'rgba(80, 220, 40, 0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, puddleSize, 0, Math.PI * 2);
        ctx.fill();
        
        // Simple center icon (no animated bubbles for performance)
        ctx.fillStyle = isFirePuddle ? 'rgba(255, 150, 50, 0.9)' : 'rgba(100, 200, 80, 0.9)';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isFirePuddle ? '🔥' : '☠️', 0, 4);
      } else if (item.type === 'SMOKE_CLOUD') {
        // BIG smoke cloud that covers everything within!
        const cloudRadius = ITEM_RADIUS * 5;
        const fadeAge = item.spawnTime ? 1 - Math.min(1, (now - item.spawnTime) / (item.value || 25000)) : 1;
        
        // Multiple smoke layers for thick cloud effect
        for (let layer = 3; layer >= 0; layer--) {
          const layerRadius = cloudRadius * (0.5 + layer * 0.2);
          const layerAlpha = 0.15 * fadeAge * (1 - layer * 0.15);
          ctx.fillStyle = `rgba(80, 80, 80, ${layerAlpha})`;
          ctx.beginPath();
          ctx.arc((Math.sin(now/1000 + layer) * 5), (Math.cos(now/800 + layer) * 5), layerRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Center smoke icon
        ctx.fillStyle = `rgba(100, 100, 100, ${0.7 * fadeAge})`;
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💨', 0, 6);
      }
      ctx.shadowBlur = 0;
        ctx.restore();
    });

    // Particles
    gameState.particles.forEach(p => {
      ctx.globalAlpha = Math.min(1, p.life * 2);
        if (p.type === 'TEXT' && p.text) {
            ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(p.text, p.x, p.y);
        } else if (p.type === 'MUZZLE_FLASH') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life * 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
      ctx.globalAlpha = 1;
    });

    // Zombies
    gameState.zombies.forEach(z => {
        ctx.save();
        ctx.translate(z.x, z.y);
        ctx.rotate(z.rotation);
        
      const zType = ZOMBIE_TYPES[z.type];
      const size = zType.size;
      const radius = ZOMBIE_RADIUS * size;
      const bounce = Math.sin(z.animFrame * Math.PI) * 2;
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, radius + 3, radius * 0.7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.translate(0, -bounce);
        
        // Body
      ctx.fillStyle = zType.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Boss crown
      if (z.isBoss) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(-radius/2, -radius - 5);
        ctx.lineTo(-radius/3, -radius - 12);
        ctx.lineTo(0, -radius - 5);
        ctx.lineTo(radius/3, -radius - 12);
        ctx.lineTo(radius/2, -radius - 5);
        ctx.closePath();
        ctx.fill();
      }
      
      // Type features
      if (z.type === 'FAST') {
        ctx.strokeStyle = '#88ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-radius - 4, -3);
        ctx.lineTo(-radius - 10, -3);
        ctx.moveTo(-radius - 4, 3);
        ctx.lineTo(-radius - 10, 3);
        ctx.stroke();
      } else if (z.type === 'SPITTER') {
        ctx.fillStyle = '#88ff88';
        ctx.beginPath();
        ctx.arc(radius - 2, 5, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (z.type === 'SLOW') {
        ctx.fillStyle = '#88ffff';
        ctx.beginPath();
        ctx.arc(radius - 3, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (z.type === 'HEALER') {
        ctx.fillStyle = '#44ff44';
        ctx.font = `${12 * size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('+', 0, 3 * size);
      } else if (z.type === 'FLAME_BOSS') {
        // Flame boss - fire effects
        ctx.fillStyle = '#ff4400';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff6600';
        // Flame crown instead of gold
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI + Math.sin(now / 100 + i) * 0.1;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle - Math.PI/2) * (radius + 8), Math.sin(angle - Math.PI/2) * (radius + 8));
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (z.type === 'CHARGER') {
        // Charger - horns
        ctx.fillStyle = '#aa4422';
        ctx.beginPath();
        ctx.moveTo(-radius * 0.6, -radius * 0.8);
        ctx.lineTo(-radius * 0.3, -radius * 1.4);
        ctx.lineTo(-radius * 0.1, -radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(radius * 0.6, -radius * 0.8);
        ctx.lineTo(radius * 0.3, -radius * 1.4);
        ctx.lineTo(radius * 0.1, -radius * 0.8);
        ctx.closePath();
        ctx.fill();
      } else if (z.type === 'SMOKE') {
        // Smoke zombie - smoky effect
        ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (z.type === 'BOOMER') {
        // Boomer - CHUBBY green slime zombie that explodes!
        // Draw as a fat bulging body
        ctx.fillStyle = '#66cc33'; // Slime green
        // Main body already drawn above, add bulges for chubby look
        ctx.beginPath();
        ctx.ellipse(-radius * 0.5, radius * 0.3, radius * 0.4, radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(radius * 0.5, radius * 0.3, radius * 0.4, radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, radius * 0.4, radius * 0.5, radius * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        // Slime drip effect
        ctx.fillStyle = '#88ff44';
        ctx.beginPath();
        ctx.moveTo(-radius * 0.3, radius - 2);
        ctx.quadraticCurveTo(-radius * 0.3, radius + 10 + Math.sin(now / 200) * 3, -radius * 0.15, radius + 6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(radius * 0.2, radius);
        ctx.quadraticCurveTo(radius * 0.2, radius + 8 + Math.cos(now / 250) * 3, radius * 0.35, radius + 4);
        ctx.fill();
        // Warning icon for explosion
        ctx.fillStyle = '#ffff00';
        ctx.font = `bold ${8 * size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('💀', 0, radius + 14);
      } else if (z.type === 'WITCH') {
        // WITCH BOSS - Spider-like appearance with tongue!
        ctx.fillStyle = '#8844aa';
        
        // Spider legs (8 legs)
        ctx.strokeStyle = '#6633aa';
        ctx.lineWidth = 3;
        for (let leg = 0; leg < 8; leg++) {
          const legAngle = (leg / 8) * Math.PI * 2 + Math.sin(now / 100 + leg) * 0.1;
          const legLen = radius * 1.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(legAngle) * radius * 0.6, Math.sin(legAngle) * radius * 0.6);
          const midX = Math.cos(legAngle) * legLen * 0.7 + Math.sin(now / 200 + leg) * 3;
          const midY = Math.sin(legAngle) * legLen * 0.7;
          ctx.quadraticCurveTo(midX, midY - 5, Math.cos(legAngle) * legLen, Math.sin(legAngle) * legLen);
          ctx.stroke();
        }
        
        // Body segments
        ctx.beginPath();
        ctx.ellipse(0, radius * 0.3, radius * 0.6, radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Hat/hood
        ctx.fillStyle = '#553388';
        ctx.beginPath();
        ctx.moveTo(-radius * 0.6, -radius * 0.3);
        ctx.lineTo(0, -radius * 1.3);
        ctx.lineTo(radius * 0.6, -radius * 0.3);
        ctx.closePath();
        ctx.fill();
        
        // Glowing purple eyes
        ctx.fillStyle = '#ff00ff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff00ff';
        ctx.beginPath();
        ctx.arc(-5 * size, -2 * size, 4 * size, 0, Math.PI * 2);
        ctx.arc(5 * size, -2 * size, 4 * size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Draw tongue if attacking
        if (z.tongueState && z.tongueState !== 'AIMING' && z.tongueProgress) {
          const target = gameState.players.find(p => p.tongueGrabbedBy === z.id || p.id === z.tongueTarget);
          if (target) {
            const tongueLen = z.tongueProgress * 250;
            const angle = Math.atan2(target.y - z.y, target.x - z.x);
            ctx.strokeStyle = '#ff6688';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(0, 3);
            ctx.lineTo(Math.cos(angle - z.rotation) * tongueLen, Math.sin(angle - z.rotation) * tongueLen + 3);
            ctx.stroke();
            // Tongue tip
            ctx.fillStyle = '#ff4466';
            ctx.beginPath();
            ctx.arc(Math.cos(angle - z.rotation) * tongueLen, Math.sin(angle - z.rotation) * tongueLen + 3, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      
      // Eyes (for zombies that don't have custom eyes)
            ctx.fillStyle = '#ff0000';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#ff0000';
      ctx.beginPath();
      ctx.arc(-4 * size, -3 * size, 3 * size, 0, Math.PI * 2);
      ctx.arc(4 * size, -3 * size, 3 * size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.restore();
      
      // HP Bar - clamp to 0 to prevent negative bars
      if (z.hp < z.maxHp && z.hp > 0) {
        const barW = radius * 2;
        const hpPercent = Math.max(0, z.hp) / z.maxHp; // Clamp to 0
        ctx.fillStyle = '#330000';
        ctx.fillRect(z.x - barW/2, z.y - radius - 10, barW, 4);
            ctx.fillStyle = '#00ff00';
        ctx.fillRect(z.x - barW/2, z.y - radius - 10, barW * hpPercent, 4);
      }
    });

    // Ball for Brawl Ball - ALWAYS render (even when held)
    if (gameState.ball) {
      let ballX = gameState.ball.x;
      let ballY = gameState.ball.y;
      let ballRotation = gameState.ball.rotation;
      
      // If held by a player, position in front of them with dribbling animation
      if (gameState.ball.heldBy) {
        const holder = gameState.players.find(p => p.id === gameState.ball?.heldBy);
        if (holder) {
          const dribbleOffset = Math.sin(now / 100) * 3; // Dribbling bounce
          ballX = holder.x + Math.cos(holder.aimRotation) * (PLAYER_RADIUS + BALL_RADIUS + 8);
          ballY = holder.y + Math.sin(holder.aimRotation) * (PLAYER_RADIUS + BALL_RADIUS + 8) + dribbleOffset;
          ballRotation = now / 150; // Continuous spin when dribbling
        }
      }
      
      ctx.save();
      ctx.translate(ballX, ballY);
      ctx.rotate(ballRotation);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, BALL_RADIUS + 4, BALL_RADIUS * 0.9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Ball - bigger and more visible
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Pentagon pattern (soccer ball look)
      ctx.fillStyle = '#333';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const r = BALL_RADIUS * 0.5;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(-4, -4, BALL_RADIUS * 0.3, 0, Math.PI * 2);
      ctx.fill();
        
        ctx.restore();
    }

    // Players
    const isPvpMode = gameState.settings.gameMode !== 'ZOMBIE_SURVIVAL';
    gameState.players.forEach(p => {
        if (p.dead) return;
      
      const isMe = p.id === gameState.myId;
      const sameTeam = me && p.team !== 'NONE' && p.team === me.team;
      
      // In PvP modes, enemies in bush are hidden
      // After 1.5 seconds in bush, completely invisible unless we're in the same bush
      let bushHidden = false;
      let fullyHidden = false;
      if (!isMe && !sameTeam && isPvpMode && p.inBush) {
        bushHidden = true;
        // Check if in bush for over 1.5 seconds - fully invisible
        const timeInBush = p.bushEnterTime > 0 ? now - p.bushEnterTime : 0;
        if (timeInBush > 1500) {
          // Check if current player is in same bush (within 60 units)
          if (me && me.inBush) {
            const distToMe = Math.sqrt((p.x - me.x) ** 2 + (p.y - me.y) ** 2);
            if (distToMe > 80) {
              fullyHidden = true; // Different bush - fully invisible
            }
          } else {
            fullyHidden = true; // We're not in bush - they're invisible
          }
        }
      }
      
      // Don't render fully hidden players at all
      if (fullyHidden) return;

        ctx.save();
        ctx.translate(p.x, p.y);
        
      // Apply semi-transparency for hidden players
      if (bushHidden) {
        ctx.globalAlpha = 0.15; // Very faint
      }
      
      const bounce = p.isMoving ? Math.sin(p.animFrame * Math.PI) * 2 : 0;
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, PLAYER_RADIUS + 2, PLAYER_RADIUS * 0.7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Auras
        if (p.speedBoostUntil > now) {
        ctx.strokeStyle = '#06d6d6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.arc(0, 0, PLAYER_RADIUS + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if (p.damageBoostUntil > now) {
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, PLAYER_RADIUS + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
      if (p.slowedUntil > now) {
        ctx.fillStyle = 'rgba(100, 200, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_RADIUS + 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // SLIME EFFECT - covered in sticky green slime!
      if (p.slimeCoveredUntil > now) {
        // Dripping slime effect
        ctx.fillStyle = 'rgba(100, 255, 80, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_RADIUS + 6, 0, Math.PI * 2);
        ctx.fill();
        // Slime drips
        for (let drip = 0; drip < 4; drip++) {
          const dripAngle = (drip / 4) * Math.PI * 2 + now / 500;
          const dripLen = 8 + Math.sin(now / 200 + drip) * 4;
          ctx.fillStyle = 'rgba(150, 255, 100, 0.7)';
          ctx.beginPath();
          ctx.ellipse(
            Math.cos(dripAngle) * (PLAYER_RADIUS + 4),
            Math.sin(dripAngle) * (PLAYER_RADIUS + 4) + dripLen,
            3, 5, 0, 0, Math.PI * 2
          );
          ctx.fill();
        }
      }
      
      // TONGUE GRABBED - being pulled by witch!
      if (p.tongueGrabbedBy) {
        const witch = gameState.zombies.find(z => z.id === p.tongueGrabbedBy);
        if (witch) {
          ctx.strokeStyle = '#ff6688';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(witch.x - p.x, witch.y - p.y);
          ctx.stroke();
          // Struggle icon
          ctx.fillStyle = '#ff4444';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('😱', 0, -PLAYER_RADIUS - 15);
        }
      }

      // Team indicator
      if (p.team !== 'NONE') {
        ctx.fillStyle = TEAM_COLORS[p.team];
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_RADIUS + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.translate(0, -bounce);

      // Body
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(-4, -4, PLAYER_RADIUS * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Face
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(-5, -2, 4, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(5, -2, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      const lookX = Math.cos(p.aimRotation) * 1.5;
      const lookY = Math.sin(p.aimRotation) * 1.5;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-5 + lookX, -2 + lookY, 2, 0, Math.PI * 2);
      ctx.arc(5 + lookX, -2 + lookY, 2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 4, 3, 0.2, Math.PI - 0.2);
      ctx.stroke();

      // Weapon
      ctx.rotate(p.aimRotation);
      const weapon = p.weapons[p.currentWeaponIndex];
      const wColors: Record<string, string> = {
        'PISTOL': '#555', 'SHOTGUN': '#8b5cf6', 'RIFLE': '#3b82f6', 'MACHINE_GUN': '#10b981',
        'SNIPER': '#f59e0b', 'ROCKET': '#ef4444', 'FLAMETHROWER': '#f97316',
        'GRENADE': '#ff6b6b', 'LASER': '#00ffff', 'MINIGUN': '#cc4444',
        'CHAINSAW': '#ff6600', 'BAT': '#8B4513'
      };
      ctx.fillStyle = wColors[weapon?.type || 'PISTOL'] || '#555';
      
      const wType = weapon?.type || 'PISTOL';
      if (wType === 'PISTOL') ctx.fillRect(PLAYER_RADIUS - 2, -2, 12, 4);
      else if (wType === 'SHOTGUN') { ctx.fillRect(PLAYER_RADIUS - 2, -3, 18, 6); ctx.fillRect(PLAYER_RADIUS + 12, -2, 4, 4); }
      else if (wType === 'RIFLE') { ctx.fillRect(PLAYER_RADIUS - 2, -2, 20, 4); ctx.fillRect(PLAYER_RADIUS + 4, -4, 6, 2); }
      else if (wType === 'MACHINE_GUN') { ctx.fillRect(PLAYER_RADIUS - 2, -3, 16, 6); ctx.fillRect(PLAYER_RADIUS - 4, -5, 8, 3); }
      else if (wType === 'SNIPER') { ctx.fillRect(PLAYER_RADIUS - 2, -1.5, 26, 3); ctx.fillRect(PLAYER_RADIUS + 7, -3, 5, 6); }
      else if (wType === 'ROCKET') { ctx.fillRect(PLAYER_RADIUS - 3, -4, 18, 8); ctx.fillRect(PLAYER_RADIUS + 12, -3, 6, 6); }
      else if (wType === 'GRENADE') { ctx.fillRect(PLAYER_RADIUS - 2, -2, 10, 4); ctx.beginPath(); ctx.arc(PLAYER_RADIUS + 12, 0, 5, 0, Math.PI*2); ctx.fill(); }
      else if (wType === 'FLAMETHROWER') { ctx.fillRect(PLAYER_RADIUS - 3, -3, 14, 6); ctx.fillRect(PLAYER_RADIUS + 9, -2, 5, 4); }
      else if (wType === 'LASER') { ctx.fillRect(PLAYER_RADIUS - 2, -1, 22, 2); ctx.fillStyle = '#fff'; ctx.fillRect(PLAYER_RADIUS + 18, -2, 4, 4); }
      else if (wType === 'MINIGUN') { ctx.fillRect(PLAYER_RADIUS - 4, -5, 20, 10); for(let i=0;i<3;i++) ctx.fillRect(PLAYER_RADIUS+14, -4+i*4, 6, 2); }
      else if (wType === 'CHAINSAW') { 
        // Chainsaw - long serrated blade
        ctx.fillRect(PLAYER_RADIUS - 2, -3, 22, 6); 
        ctx.fillStyle = '#888';
        for(let i=0;i<6;i++) { ctx.fillRect(PLAYER_RADIUS + i*3, -5, 2, 2); ctx.fillRect(PLAYER_RADIUS + i*3, 3, 2, 2); }
      }
      else if (wType === 'BAT') { 
        // Baseball bat with WIDE SWINGING animation (-70° to +70° = 140° total arc)
        const timeSinceShot = now - (weapon?.lastShotTime || 0);
        const isSwinging = timeSinceShot < 350; // Swing animation lasts 350ms
        
        ctx.save();
        if (isSwinging) {
          // Swing from -70 degrees to +70 degrees (140 degree arc!)
          const swingProgress = timeSinceShot / 350; // 0 to 1
          const swingAngle = (-70 * Math.PI/180) + (140 * Math.PI/180) * swingProgress; // -70° to +70°
          ctx.rotate(swingAngle);
        }
        
        ctx.fillStyle = '#8B4513';
        // Bat handle
        ctx.fillRect(PLAYER_RADIUS - 4, -2, 10, 4);
        // Bat shaft (thinner)
        ctx.fillRect(PLAYER_RADIUS + 4, -3, 12, 6);
        // Bat barrel (wider, rounded end)
        ctx.beginPath();
        ctx.ellipse(PLAYER_RADIUS + 20, 0, 5, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Grip tape
        ctx.fillStyle = '#333';
        ctx.fillRect(PLAYER_RADIUS - 4, -1, 8, 2);
        
        ctx.restore();
      }
      
      ctx.restore();

      // Name & HP above player
      const nameY = p.y - PLAYER_RADIUS - 24;
      const hpY = p.y - PLAYER_RADIUS - 12;
      
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(p.name).width;
      ctx.fillRect(p.x - tw/2 - 3, nameY - 8, tw + 6, 11);
      
      ctx.fillStyle = p.team !== 'NONE' ? TEAM_COLORS[p.team] : '#fff';
      ctx.fillText(p.name, p.x, nameY);

      const hpW = 30;
      // Shield bar (above HP)
      if (p.shield > 0) {
        const shieldY = hpY - 5;
        ctx.fillStyle = '#000';
        ctx.fillRect(p.x - hpW/2 - 1, shieldY - 1, hpW + 2, 5);
        ctx.fillStyle = '#113355';
        ctx.fillRect(p.x - hpW/2, shieldY, hpW, 3);
        ctx.fillStyle = '#4488ff';
        ctx.fillRect(p.x - hpW/2, shieldY, hpW * Math.min(1, p.shield / p.maxShield), 3);
      }
      // HP bar
      ctx.fillStyle = '#000';
      ctx.fillRect(p.x - hpW/2 - 1, hpY - 1, hpW + 2, 6);
      ctx.fillStyle = '#440000';
      ctx.fillRect(p.x - hpW/2, hpY, hpW, 4);
      ctx.fillStyle = p.hp > 30 ? '#00dd00' : '#dd0000';
      ctx.fillRect(p.x - hpW/2, hpY, hpW * Math.max(0, p.hp / p.maxHp), 4);
      
      // Ball indicator
      if (p.hasBall) {
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.fillText('⚽', p.x, p.y - PLAYER_RADIUS - 32);
      }
      
      // Gem count
      if (gameState.settings.gameMode === 'GEM_GRAB' && p.gems > 0) {
        ctx.fillStyle = '#44ddff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`💎${p.gems}`, p.x, p.y - PLAYER_RADIUS - 32);
      }
      
      // Reset alpha if was hidden in bush
      ctx.globalAlpha = 1;
    });

    // Bullets
    gameState.bullets.forEach(b => {
      const colors: Record<string, string> = {
        'PISTOL': '#ffdd00', 'SHOTGUN': '#c084fc', 'RIFLE': '#60a5fa', 'MACHINE_GUN': '#34d399',
        'SNIPER': '#fbbf24', 'ROCKET': '#f87171', 'FLAMETHROWER': '#fb923c',
        'GRENADE': '#ff6b6b', 'LASER': '#00ffff', 'MINIGUN': '#ff8888'
      };
      
      // ZOMBIE PROJECTILES (SPITTER VENOM) - EXTREMELY VISIBLE PURPLE!
      if (b.isZombieProjectile) {
        const pulse = 1 + Math.sin(now / 80) * 0.3;
        const zombieR = 16 * pulse; // HUGE!
        
        // MASSIVE outer warning ring - pulsing
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(b.x, b.y, zombieR + 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        
        // Outer purple glow
        ctx.fillStyle = 'rgba(200, 50, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, zombieR + 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Middle magenta glow
        ctx.fillStyle = 'rgba(255, 100, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, zombieR + 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Main projectile - BRIGHT PURPLE/MAGENTA
        ctx.fillStyle = '#cc44ff';
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#ff00ff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, zombieR, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright core - WHITE
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, zombieR * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // Skull icon in center
        ctx.fillStyle = '#880088';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☠', b.x, b.y);
        
        // VERY long pulsing trail
        ctx.strokeStyle = '#ff66ff';
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 2.5, b.y - b.vy * 2.5);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      } else {
        // Normal player bullets
        const color = colors[b.weaponType] || '#fff';
        const r = b.weaponType === 'ROCKET' || b.weaponType === 'GRENADE' ? 6 : b.weaponType === 'SNIPER' || b.weaponType === 'LASER' ? 4 : 3;
        
        // Trail
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = r;
            ctx.beginPath();
            ctx.moveTo(b.x - b.vx * 0.3, b.y - b.vy * 0.3);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        ctx.globalAlpha = 1;
        
        ctx.fillStyle = color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        if (b.weaponType === 'ROCKET' || b.weaponType === 'GRENADE') {
          ctx.fillStyle = '#ff8800';
          ctx.beginPath();
          ctx.arc(b.x - b.vx * 0.15, b.y - b.vy * 0.15, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    ctx.restore();

    // Minimap - Desktop: bottom-left to avoid UI overlap, Mobile: top-left below status
    const mmScale = isMobile ? 0.06 : 0.10;
    const mmSize = MAP_SIZE * mmScale;
    const mmX = isMobile ? 12 : 16; 
    const mmY = isMobile ? 120 : canvas.height - mmSize - 80; // Desktop: bottom-left, above controls
    
    ctx.fillStyle = 'rgba(10, 20, 30, 0.9)';
    ctx.fillRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);
    ctx.strokeStyle = '#4a6a8a';
    ctx.lineWidth = 1;
    ctx.strokeRect(mmX - 2, mmY - 2, mmSize + 4, mmSize + 4);
    
    // Bushes on minimap
    gameState.walls.forEach(w => {
      if (w.type === 'BUSH') {
        ctx.fillStyle = 'rgba(45, 90, 45, 0.5)';
        ctx.fillRect(mmX + w.x * mmScale, mmY + w.y * mmScale, Math.max(2, w.w * mmScale), Math.max(2, w.h * mmScale));
      } else if (w.type !== 'WATER') {
        ctx.fillStyle = w.type === 'BARREL' ? '#cc4444' : '#3a4a5a';
        ctx.fillRect(mmX + w.x * mmScale, mmY + w.y * mmScale, Math.max(2, w.w * mmScale), Math.max(2, w.h * mmScale));
      }
    });

    if (gameState.ball && !gameState.ball.heldBy) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(mmX + gameState.ball.x * mmScale, mmY + gameState.ball.y * mmScale, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    gameState.items.forEach(item => {
      ctx.fillStyle = item.type === 'GEM' ? '#44ddff' : '#ffdd00';
      ctx.fillRect(mmX + item.x * mmScale - 1, mmY + item.y * mmScale - 1, 2, 2);
    });

    gameState.zombies.forEach(z => {
      ctx.fillStyle = '#ff4444';
        ctx.beginPath();
      ctx.arc(mmX + z.x * mmScale, mmY + z.y * mmScale, z.isBoss ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // Don't show hidden enemies in bush on minimap in PvP modes
    gameState.players.forEach(p => {
        if(p.dead) return;
      const isMe = p.id === gameState.myId;
      const sameTeam = me && p.team !== 'NONE' && p.team === me.team;
      // Don't show enemies in bush on minimap
      if (!isMe && !sameTeam && isPvpMode && p.inBush) return;
      ctx.fillStyle = isMe ? '#fff' : (p.team !== 'NONE' ? TEAM_COLORS[p.team] : p.color);
        ctx.beginPath();
      ctx.arc(mmX + p.x * mmScale, mmY + p.y * mmScale, isMe ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
    });

  }, [gameState, isMobile]);

  useEffect(() => {
    if (ref && typeof ref !== 'function') {
      (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = canvasRef.current;
    }
  }, [ref]);

  // Apply blur effect if player is blurred by smoke zombie
  const me = gameState.players.find(p => p.id === gameState.myId);
  const isBlurred = me && me.blurredUntil > Date.now();

  return (
    <canvas 
      ref={canvasRef} 
      width={VIEWPORT_WIDTH} 
      height={VIEWPORT_HEIGHT} 
      className={`bg-slate-900 ${isMobile ? 'fixed inset-0 w-full h-full border-0 rounded-none' : 'border-2 border-slate-600 rounded-lg shadow-xl w-full h-auto max-h-[calc(100vh-40px)]'}`}
      style={{ 
        imageRendering: 'pixelated', 
        objectFit: isMobile ? 'cover' : 'contain',
        filter: isBlurred ? 'blur(4px)' : 'none',
        transition: 'filter 0.3s ease',
      }}
    />
  );
});

GameCanvas.displayName = 'GameCanvas';
export default GameCanvas;
