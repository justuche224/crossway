import type {
  Room,
  RoomPlayer,
  GameState,
  GameSettings,
  Player,
} from "@crossway/socket";
import { createInitialGameState, createDefaultSettings } from "@crossway/socket";

export interface RoomStore {
  get(roomId: string): Room | undefined;
  set(roomId: string, room: Room): void;
  delete(roomId: string): boolean;
  size(): number;
  values(): IterableIterator<Room>;
}

class InMemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  set(roomId: string, room: Room): void {
    this.rooms.set(roomId, room);
  }

  delete(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  size(): number {
    return this.rooms.size;
  }

  values(): IterableIterator<Room> {
    return this.rooms.values();
  }
}

export class RoomManager {
  private store: RoomStore;
  private maxRooms: number;
  private playerRooms = new Map<string, string>();

  constructor(store?: RoomStore, maxRooms?: number) {
    this.store = store ?? new InMemoryRoomStore();
    this.maxRooms = maxRooms ?? parseInt(process.env.MAX_ROOMS ?? "100", 10);
  }

  canCreateRoom(): boolean {
    return this.store.size() < this.maxRooms;
  }

  getRoomCount(): number {
    return this.store.size();
  }

  getMaxRooms(): number {
    return this.maxRooms;
  }

  getRoom(roomId: string): Room | undefined {
    return this.store.get(roomId);
  }

  getPlayerRoom(playerId: string): string | undefined {
    return this.playerRooms.get(playerId);
  }

  createOrJoinRoom(
    roomId: string,
    playerId: string
  ): { success: true; room: Room; color: Player } | { success: false; error: string; code: string } {
    let room = this.store.get(roomId);

    if (room) {
      const existingPlayer = room.players.find((p) => p.id === playerId);
      if (existingPlayer) {
        existingPlayer.connected = true;
        this.store.set(roomId, room);
        this.playerRooms.set(playerId, roomId);
        return { success: true, room, color: existingPlayer.color };
      }

      if (room.players.length >= 2) {
        return { success: false, error: "Room is full", code: "ROOM_FULL" };
      }

      const firstPlayer = room.players[0];
      const color: Player = firstPlayer?.color === "blue" ? "red" : "blue";
      const newPlayer: RoomPlayer = { id: playerId, color, connected: true };
      room.players.push(newPlayer);
      this.store.set(roomId, room);
      this.playerRooms.set(playerId, roomId);
      return { success: true, room, color };
    }

    if (!this.canCreateRoom()) {
      return {
        success: false,
        error: "Maximum room limit reached. Please try again later.",
        code: "MAX_ROOMS_REACHED",
      };
    }

    const color: Player = "blue";
    const newPlayer: RoomPlayer = { id: playerId, color, connected: true };
    const newRoom: Room = {
      id: roomId,
      hostId: playerId,
      players: [newPlayer],
      gameState: createInitialGameState(),
      settings: createDefaultSettings(),
      createdAt: Date.now(),
    };

    this.store.set(roomId, newRoom);
    this.playerRooms.set(playerId, roomId);
    return { success: true, room: newRoom, color };
  }

  leaveRoom(playerId: string): { roomId: string; color: Player; roomDeleted: boolean } | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;

    const room = this.store.get(roomId);
    if (!room) {
      this.playerRooms.delete(playerId);
      return null;
    }

    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      this.playerRooms.delete(playerId);
      return null;
    }

    player.connected = false;
    this.playerRooms.delete(playerId);

    const connectedPlayers = room.players.filter((p) => p.connected);
    if (connectedPlayers.length === 0) {
      this.store.delete(roomId);
      return { roomId, color: player.color, roomDeleted: true };
    }

    const newHost = connectedPlayers[0];
    if (room.hostId === playerId && newHost) {
      room.hostId = newHost.id;
    }

    this.store.set(roomId, room);
    return { roomId, color: player.color, roomDeleted: false };
  }

  updateGameState(roomId: string, gameState: GameState): boolean {
    const room = this.store.get(roomId);
    if (!room) return false;

    room.gameState = gameState;
    this.store.set(roomId, room);
    return true;
  }

  updateSettings(roomId: string, playerId: string, settings: GameSettings): boolean {
    const room = this.store.get(roomId);
    if (!room) return false;

    if (room.hostId !== playerId) return false;

    room.settings = settings;
    this.store.set(roomId, room);
    return true;
  }

  resetGame(roomId: string, playerId: string): GameState | null {
    const room = this.store.get(roomId);
    if (!room) return null;

    if (room.hostId !== playerId) return null;

    room.gameState = createInitialGameState();
    this.store.set(roomId, room);
    return room.gameState;
  }

  isHost(roomId: string, playerId: string): boolean {
    const room = this.store.get(roomId);
    return room?.hostId === playerId;
  }

  cleanupStaleRooms(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const room of this.store.values()) {
      const connectedPlayers = room.players.filter((p) => p.connected);
      if (connectedPlayers.length === 0 && now - room.createdAt > maxAgeMs) {
        for (const player of room.players) {
          this.playerRooms.delete(player.id);
        }
        this.store.delete(room.id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

export const roomManager = new RoomManager();

