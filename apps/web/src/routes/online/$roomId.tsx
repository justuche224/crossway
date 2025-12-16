import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Copy, Check } from "lucide-react";
import { useSocket } from "@/hooks/use-socket";
import type {
  GameState,
  Position,
  RepetitionRule,
  Move,
  Player,
  GameSettings,
} from "@crossway/socket";
import {
  BOARD_GRAPH,
  getValidMoves,
  getPieceOwner,
  checkRepetition,
  getAllValidMovesForPlayer,
} from "@crossway/socket";

export const Route = createFileRoute("/online/$roomId")({
  component: OnlineGameComponent,
});

const POSITION_COORDS: Record<Position, { x: number; y: number }> = {
  L1: { x: 80, y: 60 },
  L2: { x: 80, y: 150 },
  L3: { x: 80, y: 240 },
  R1: { x: 420, y: 60 },
  R2: { x: 420, y: 150 },
  R3: { x: 420, y: 240 },
  CT: { x: 250, y: 60 },
  CL: { x: 160, y: 150 },
  CC: { x: 250, y: 150 },
  CR: { x: 340, y: 150 },
  CB: { x: 250, y: 240 },
};

const CIRCLE_CENTER = { x: 250, y: 150 };
const CIRCLE_RADIUS = 90;
const TIME_OPTIONS = [5, 10, 15, 30] as const;

function getPlayerDangerLevel(
  state: GameState,
  player: Player
): "safe" | "warning" | "danger" {
  const availableMoves = getAllValidMovesForPlayer(state, player);
  if (availableMoves.length === 0) return "danger";
  if (availableMoves.length <= 2) return "warning";
  return "safe";
}

function getMoveCountsPerPlayer(moveHistory: Move[]): {
  blue: number;
  red: number;
} {
  return {
    blue: moveHistory.filter((m) => m.player === "blue").length,
    red: moveHistory.filter((m) => m.player === "red").length,
  };
}

function GameBoard({
  state,
  onPositionClick,
  blockedPosition,
  disabled,
}: {
  state: GameState;
  onPositionClick: (pos: Position) => void;
  blockedPosition: Position | null;
  disabled?: boolean;
}) {
  const validMoves = state.selectedPiece
    ? getValidMoves(state.selectedPiece, state)
    : [];

  const blueDanger = getPlayerDangerLevel(state, "blue");
  const redDanger = getPlayerDangerLevel(state, "red");

  const connections: [Position, Position][] = [
    ["L1", "L2"],
    ["L2", "L3"],
    ["L2", "CL"],
    ["R1", "R2"],
    ["R2", "R3"],
    ["R2", "CR"],
    ["CT", "CC"],
    ["CB", "CC"],
    ["CL", "CC"],
    ["CR", "CC"],
  ];

  return (
    <svg
      viewBox="0 0 500 300"
      className={`w-full max-w-2xl border border-border rounded-lg bg-card ${
        disabled ? "opacity-70 pointer-events-none" : ""
      }`}
    >
      {connections.map(([from, to]) => (
        <line
          key={`${from}-${to}`}
          x1={POSITION_COORDS[from].x}
          y1={POSITION_COORDS[from].y}
          x2={POSITION_COORDS[to].x}
          y2={POSITION_COORDS[to].y}
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground"
        />
      ))}

      <circle
        cx={CIRCLE_CENTER.x}
        cy={CIRCLE_CENTER.y}
        r={CIRCLE_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-muted-foreground"
      />

      {(Object.keys(POSITION_COORDS) as Position[]).map((pos) => {
        const { x, y } = POSITION_COORDS[pos];
        const owner = getPieceOwner(pos, state);
        const isSelected = state.selectedPiece === pos;
        const isValidMove = validMoves.includes(pos);
        const isCurrentPlayerPiece = owner === state.currentPlayer;
        const isBlocked = blockedPosition === pos;

        const currentPlayerDanger =
          state.currentPlayer === "blue" ? blueDanger : redDanger;
        const showDangerRing =
          isCurrentPlayerPiece &&
          currentPlayerDanger !== "safe" &&
          state.status === "playing";

        return (
          <g
            key={pos}
            onClick={() => !disabled && onPositionClick(pos)}
            className={disabled ? "cursor-not-allowed" : "cursor-pointer"}
          >
            <circle
              cx={x}
              cy={y}
              r={isValidMove ? 18 : 16}
              fill={
                owner === "blue"
                  ? "#3b82f6"
                  : owner === "red"
                  ? "#ef4444"
                  : isBlocked
                  ? "rgba(239, 68, 68, 0.3)"
                  : isValidMove
                  ? "rgba(34, 197, 94, 0.3)"
                  : "transparent"
              }
              stroke={
                isSelected
                  ? "#fbbf24"
                  : showDangerRing
                  ? currentPlayerDanger === "danger"
                    ? "#ef4444"
                    : "#f59e0b"
                  : isBlocked
                  ? "#ef4444"
                  : isValidMove
                  ? "#22c55e"
                  : isCurrentPlayerPiece && state.status === "playing"
                  ? "#94a3b8"
                  : "transparent"
              }
              strokeWidth={
                isSelected
                  ? 4
                  : showDangerRing
                  ? 3
                  : isBlocked
                  ? 3
                  : isValidMove
                  ? 3
                  : 2
              }
              strokeDasharray={isValidMove && !isBlocked ? "4 2" : "none"}
            />
            {owner && (
              <circle
                cx={x}
                cy={y}
                r={8}
                fill={owner === "blue" ? "#1d4ed8" : "#b91c1c"}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function MoveHistory({ moves }: { moves: Move[] }) {
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [moves.length]);

  if (moves.length === 0) {
    return (
      <div className="w-full">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">
          Moves
        </h3>
        <p className="text-sm text-muted-foreground/50 italic">No moves yet</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">
        Moves
      </h3>
      <div ref={historyRef} className="max-h-40 overflow-y-auto space-y-1">
        {moves.map((move, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0"
          >
            <span className="text-xs text-muted-foreground/50 w-5 font-mono">
              {idx + 1}.
            </span>
            <div
              className={`w-2 h-2 rounded-full ${
                move.player === "blue" ? "bg-blue-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm font-mono text-foreground">
              {move.from} → {move.to}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoveCounter({ moves }: { moves: Move[] }) {
  const counts = getMoveCountsPerPlayer(moves);

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="text-sm font-mono font-medium text-foreground">
          {counts.blue}
        </span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <span className="text-sm font-mono font-medium text-foreground">
          {counts.red}
        </span>
      </div>
    </div>
  );
}

function DangerIndicator({ state }: { state: GameState }) {
  const blueDanger = getPlayerDangerLevel(state, "blue");
  const redDanger = getPlayerDangerLevel(state, "red");

  if (blueDanger === "safe" && redDanger === "safe") return null;

  return (
    <div className="flex items-center justify-center gap-4 py-2">
      {blueDanger !== "safe" && (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span
            className={
              blueDanger === "danger"
                ? "text-red-500 font-medium"
                : "text-muted-foreground"
            }
          >
            {blueDanger === "danger" ? "No moves!" : "Low moves"}
          </span>
        </div>
      )}
      {redDanger !== "safe" && (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span
            className={
              redDanger === "danger"
                ? "text-red-500 font-medium"
                : "text-muted-foreground"
            }
          >
            {redDanger === "danger" ? "No moves!" : "Low moves"}
          </span>
        </div>
      )}
    </div>
  );
}

function GameSettings({
  settings,
  onSettingsChange,
  disabled,
  isHost,
  gameStarted,
}: {
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  disabled: boolean;
  isHost: boolean;
  gameStarted: boolean;
}) {
  const canModify = isHost && !gameStarted;

  function toggleRule(rule: RepetitionRule) {
    if (!canModify) return;
    const newRules = settings.enabledRules.includes(rule)
      ? settings.enabledRules.filter((r) => r !== rule)
      : [...settings.enabledRules, rule];
    onSettingsChange({ ...settings, enabledRules: newRules });
  }

  function toggleBlitz() {
    if (!canModify) return;
    onSettingsChange({ ...settings, blitzEnabled: !settings.blitzEnabled });
  }

  function changeTime(time: number) {
    if (!canModify) return;
    onSettingsChange({ ...settings, blitzTimeLimit: time });
  }

  return (
    <div className="w-full border-t border-border pt-6">
      <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4">
        Game Settings {!isHost && "(Host only)"}
      </h3>

      <div className="mb-6">
        <button
          onClick={toggleBlitz}
          disabled={!canModify}
          className={`flex items-center gap-3 py-2 transition-colors ${
            !canModify ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <div
            className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center transition-colors ${
              settings.blitzEnabled
                ? "bg-foreground border-foreground"
                : "border-muted-foreground"
            }`}
          >
            {settings.blitzEnabled && (
              <Check className="w-3 h-3 text-background" />
            )}
          </div>
          <span className="text-sm font-medium text-foreground">
            Blitz Mode
          </span>
        </button>

        {settings.blitzEnabled && (
          <div className="mt-3 ml-7 flex items-center gap-2">
            {TIME_OPTIONS.map((time) => (
              <button
                key={time}
                onClick={() => changeTime(time)}
                disabled={!canModify}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  settings.blitzTimeLimit === time
                    ? "border-b-2 border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${!canModify ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {time}s
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-3">Repetition Rules</p>
        <div className="space-y-2">
          {(["warning", "block", "forfeit"] as RepetitionRule[]).map((rule) => (
            <button
              key={rule}
              onClick={() => toggleRule(rule)}
              disabled={!canModify}
              className={`flex items-center gap-3 py-1.5 w-full text-left ${
                !canModify ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <div
                className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center transition-colors ${
                  settings.enabledRules.includes(rule)
                    ? "bg-foreground border-foreground"
                    : "border-muted-foreground"
                }`}
              >
                {settings.enabledRules.includes(rule) && (
                  <Check className="w-3 h-3 text-background" />
                )}
              </div>
              <span className="text-sm text-foreground capitalize">{rule}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlitzTimer({
  timeLeft,
  timeLimit,
}: {
  timeLeft: number;
  timeLimit: number;
}) {
  const percentage = (timeLeft / timeLimit) * 100;
  const isLow = timeLeft <= 3;

  return (
    <div className="w-full max-w-md">
      <div className="flex justify-between text-xs mb-2">
        <span
          className={
            isLow ? "text-red-500 font-medium" : "text-muted-foreground"
          }
        >
          Time
        </span>
        <span
          className={`font-mono ${
            isLow ? "text-red-500 font-bold animate-pulse" : "text-foreground"
          }`}
        >
          {timeLeft}s
        </span>
      </div>
      <div className="w-full h-1 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ${
            isLow
              ? "bg-red-500"
              : percentage > 50
              ? "bg-foreground"
              : "bg-muted-foreground"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ConnectionStatus({
  isConnected,
  isInRoom,
  opponent,
}: {
  isConnected: boolean;
  isInRoom: boolean;
  opponent: { id: string; color: Player; connected: boolean } | null;
}) {
  if (!isConnected) {
    return (
      <div className="border-b border-border bg-red-500/10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-red-500" />
          <span className="text-xs text-red-500">Connecting to server...</span>
        </div>
      </div>
    );
  }

  if (!isInRoom) {
    return (
      <div className="border-b border-border bg-amber-500/10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
          <span className="text-xs text-amber-500">Joining room...</span>
        </div>
      </div>
    );
  }

  if (!opponent) {
    return (
      <div className="border-b border-border bg-amber-500/10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-amber-500">
            Waiting for opponent to join...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-green-500/10">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs text-green-500">Connected - Game ready</span>
      </div>
    </div>
  );
}

function OnlineGameComponent() {
  const { roomId } = Route.useParams();
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [blockedPosition, setBlockedPosition] = useState<Position | null>(null);
  const [copied, setCopied] = useState(false);

  const handleError = useCallback(
    (error: { code: string; message: string }) => {
      if (error.code === "MOVE_BLOCKED") {
        toast.warning(error.message);
      } else if (error.code === "NOT_YOUR_TURN") {
        toast.error("It's not your turn");
      } else if (error.code === "ROOM_FULL") {
        toast.error("This room is full");
      } else {
        toast.error(error.message);
      }
    },
    []
  );

  const {
    isConnected,
    isInRoom,
    gameState,
    settings,
    timeLeft,
    yourColor,
    isHost,
    opponent,
    makeMove,
    updateSettings,
    resetGame,
  } = useSocket({ roomId, onError: handleError });

  const localGameState: GameState = gameState
    ? { ...gameState, selectedPiece }
    : {
        currentPlayer: "blue",
        bluePieces: ["L1", "L2", "L3"],
        redPieces: ["R1", "R2", "R3"],
        selectedPiece: null,
        status: "playing",
        moveHistory: [],
        boardStateHistory: [],
        repetitionWarnings: { blue: 0, red: 0 },
      };

  const isPlayerTurn = localGameState.currentPlayer === yourColor;
  const canPlay = isConnected && isInRoom && opponent && isPlayerTurn;
  const gameStarted = localGameState.moveHistory.length > 0;

  function handlePositionClick(pos: Position) {
    if (!canPlay || localGameState.status !== "playing") return;

    const owner = getPieceOwner(pos, localGameState);

    if (selectedPiece) {
      const validMoves = getValidMoves(selectedPiece, localGameState);

      if (validMoves.includes(pos)) {
        if (settings) {
          const repetitionCheck = checkRepetition(
            selectedPiece,
            pos,
            localGameState,
            settings.enabledRules
          );

          if (repetitionCheck.shouldBlock) {
            setBlockedPosition(pos);
            toast.warning("Move blocked! This would cause repetition.");
            setTimeout(() => setBlockedPosition(null), 1000);
            setSelectedPiece(null);
            return;
          }
        }

        makeMove(selectedPiece, pos);
        setSelectedPiece(null);
        return;
      }

      if (owner === yourColor) {
        setSelectedPiece(pos);
        return;
      }

      setSelectedPiece(null);
      return;
    }

    if (owner === yourColor) {
      setSelectedPiece(pos);
    }
  }

  function handleReset() {
    if (!isHost) {
      toast.error("Only the host can reset the game");
      return;
    }
    resetGame();
    setSelectedPiece(null);
    setBlockedPosition(null);
  }

  function copyRoomLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success("Room link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  const isGameOver = localGameState.status !== "playing";
  const isForfeit =
    localGameState.status === "blue_forfeit" ||
    localGameState.status === "red_forfeit";
  const isPlaying =
    localGameState.status === "playing" &&
    localGameState.moveHistory.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/online"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Lobby
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Room</span>
            <span className="font-mono font-bold text-foreground tracking-wider">
              {roomId}
            </span>
            <button
              onClick={copyRoomLink}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 border border-border rounded hover:border-foreground/30 flex items-center gap-1"
            >
              {copied ? (
                <Check className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <ConnectionStatus
        isConnected={isConnected}
        isInRoom={isInRoom}
        opponent={opponent}
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 px-3 py-2 transition-all ${
                localGameState.currentPlayer === "blue" &&
                localGameState.status === "playing"
                  ? "border-b-2 border-blue-500"
                  : ""
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm font-medium text-foreground">Blue</span>
              {yourColor === "blue" && (
                <span className="text-xs text-muted-foreground">(you)</span>
              )}
              {localGameState.currentPlayer === "blue" &&
                localGameState.status === "playing" && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    ●
                  </span>
                )}
            </div>

            <span className="text-muted-foreground text-sm">vs</span>

            <div
              className={`flex items-center gap-2 px-3 py-2 transition-all ${
                localGameState.currentPlayer === "red" &&
                localGameState.status === "playing"
                  ? "border-b-2 border-red-500"
                  : ""
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-foreground">Red</span>
              {yourColor === "red" && (
                <span className="text-xs text-muted-foreground">(you)</span>
              )}
              {localGameState.currentPlayer === "red" &&
                localGameState.status === "playing" && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    ●
                  </span>
                )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isHost && (
              <span className="text-xs px-2 py-1 bg-foreground/10 rounded text-foreground">
                Host
              </span>
            )}
            <MoveCounter moves={localGameState.moveHistory} />
          </div>
        </div>

        {settings?.blitzEnabled && isPlaying && timeLeft !== null && (
          <div className="mb-6 flex justify-center">
            <BlitzTimer
              timeLeft={timeLeft}
              timeLimit={settings.blitzTimeLimit}
            />
          </div>
        )}

        <DangerIndicator state={localGameState} />

        {isGameOver && (
          <div className="text-center py-6 mb-6 border-y border-border">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Game Over{isForfeit ? " — Forfeit" : ""}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {localGameState.status === "blue_wins" ||
              localGameState.status === "red_forfeit"
                ? "Blue Wins!"
                : "Red Wins!"}
            </p>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <GameBoard
              state={localGameState}
              onPositionClick={handlePositionClick}
              blockedPosition={blockedPosition}
              disabled={!canPlay}
            />

            <p className="text-center text-sm text-muted-foreground mt-4">
              {!isConnected
                ? "Connecting..."
                : !isInRoom
                ? "Joining room..."
                : !opponent
                ? "Waiting for opponent..."
                : localGameState.status !== "playing"
                ? ""
                : isPlayerTurn
                ? selectedPiece
                  ? "Click a highlighted position to move"
                  : "Your turn — select a piece"
                : "Waiting for opponent..."}
            </p>
          </div>

          <div className="lg:w-64 space-y-6">
            <MoveHistory moves={localGameState.moveHistory} />

            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">
                Actions
              </h3>
              <button
                onClick={handleReset}
                disabled={!isHost}
                className="w-full py-2.5 text-sm text-left px-3 border-b border-border hover:border-foreground/30 transition-colors text-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGameOver ? "Play Again →" : "Reset Game →"}
                {!isHost && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (Host only)
                  </span>
                )}
              </button>
            </div>

            {settings && (
              <GameSettings
                settings={settings}
                onSettingsChange={updateSettings}
                disabled={!isHost || gameStarted}
                isHost={isHost}
                gameStarted={gameStarted}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
