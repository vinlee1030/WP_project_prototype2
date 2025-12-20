
import { LobbyRoomInfo } from '../types';

// Lobby feature is disabled - requires backend with proper CORS setup
// Game works perfectly by sharing room IDs directly between players

// Send heartbeat to lobby list - disabled
export const heartbeatRoom = async (
  _roomId: string, 
  _hostName: string, 
  _roomName: string,
  _playerCount: number,
  _maxZombies: number,
  _difficulty: string,
  _gameMode: string = 'ZOMBIE_SURVIVAL'
): Promise<void> => {
  // Disabled - no backend configured
  return;
};

// List active rooms - disabled, returns empty
export const listRooms = async (): Promise<LobbyRoomInfo[]> => {
  // Disabled - no backend configured
  // Players can still join by sharing room IDs directly
  return [];
};

// Remove room from lobby
export const removeRoom = async (roomId: string): Promise<void> => {
  const url = getScriptUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'remove',
        roomId,
      }),
    });
  } catch (e) {
    console.error('Remove room failed:', e);
  }
};
