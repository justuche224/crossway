const PLAYER_ID_KEY = "crossway_player_id";

function generateUUID(): string {
  return crypto.randomUUID();
}

export function getPlayerId(): string {
  if (typeof window === "undefined") {
    return generateUUID();
  }

  let playerId = localStorage.getItem(PLAYER_ID_KEY);

  if (!playerId) {
    playerId = generateUUID();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }

  return playerId;
}

export function clearPlayerId(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PLAYER_ID_KEY);
  }
}

