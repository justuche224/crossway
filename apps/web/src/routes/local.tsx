import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  type GameState,
  type Position,
  type RepetitionRule,
  type Move,
  POSITION_COORDS,
  createInitialState,
  getValidMoves,
  getPieceOwner,
  makeMoveWithWarning,
  makeMove,
  checkRepetition,
  forfeitGame,
  getRandomMove,
  getMoveCountsPerPlayer,
  formatMoveNotation,
  getPlayerDangerLevel,
} from "@/lib/game-logic";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/local")({
  component: LocalGameComponent,
});

const CIRCLE_CENTER = { x: 250, y: 150 };
const CIRCLE_RADIUS = 90;
const TIME_OPTIONS = [5, 10, 15, 30] as const;

function GameBoard({
  state,
  onPositionClick,
  blockedPosition,
}: {
  state: GameState;
  onPositionClick: (pos: Position) => void;
  blockedPosition: Position | null;
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
      className="w-full max-w-2xl border border-border rounded-lg bg-card"
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
            onClick={() => onPositionClick(pos)}
            className="cursor-pointer"
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
      <div className="w-full max-w-xs p-3 bg-muted/50 rounded-lg">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Move History
        </h3>
        <p className="text-xs text-muted-foreground/60 italic">No moves yet</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs p-3 bg-muted/50 rounded-lg">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        Move History
      </h3>
      <div
        ref={historyRef}
        className="max-h-32 overflow-y-auto text-xs space-y-1 scrollbar-thin"
      >
        {moves.map((move, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 px-2 py-1 rounded ${
              move.player === "blue" ? "bg-blue-500/10" : "bg-red-500/10"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                move.player === "blue" ? "bg-blue-500" : "bg-red-500"
              }`}
            />
            <span className="font-mono">
              {formatMoveNotation(move, idx + 1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoveCounter({ moves }: { moves: Move[] }) {
  const counts = getMoveCountsPerPlayer(moves);
  const total = moves.length;

  return (
    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="text-sm font-mono">{counts.blue}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        Total: <span className="font-mono font-medium">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono">{counts.red}</span>
        <div className="w-3 h-3 rounded-full bg-red-500" />
      </div>
    </div>
  );
}

function DangerIndicator({ state }: { state: GameState }) {
  const blueDanger = getPlayerDangerLevel(state, "blue");
  const redDanger = getPlayerDangerLevel(state, "red");

  if (blueDanger === "safe" && redDanger === "safe") return null;

  return (
    <div className="flex items-center gap-3">
      {blueDanger !== "safe" && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            blueDanger === "danger"
              ? "bg-red-500/20 text-red-500"
              : "bg-amber-500/20 text-amber-500"
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          {blueDanger === "danger" ? "No moves!" : "Low moves"}
        </div>
      )}
      {redDanger !== "safe" && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
            redDanger === "danger"
              ? "bg-red-500/20 text-red-500"
              : "bg-amber-500/20 text-amber-500"
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          {redDanger === "danger" ? "No moves!" : "Low moves"}
        </div>
      )}
    </div>
  );
}

function RuleCheckboxes({
  enabledRules,
  onToggle,
}: {
  enabledRules: RepetitionRule[];
  onToggle: (rule: RepetitionRule) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 p-3 bg-muted/50 rounded-lg">
      <span className="text-sm font-medium text-muted-foreground">
        Repetition Rules:
      </span>
      <div className="flex items-center gap-2">
        <Checkbox
          id="warning"
          checked={enabledRules.includes("warning")}
          onCheckedChange={() => onToggle("warning")}
        />
        <Label htmlFor="warning" className="text-sm cursor-pointer">
          Warning
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="forfeit"
          checked={enabledRules.includes("forfeit")}
          onCheckedChange={() => onToggle("forfeit")}
        />
        <Label htmlFor="forfeit" className="text-sm cursor-pointer">
          Auto-forfeit
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="block"
          checked={enabledRules.includes("block")}
          onCheckedChange={() => onToggle("block")}
        />
        <Label htmlFor="block" className="text-sm cursor-pointer">
          Block move
        </Label>
      </div>
    </div>
  );
}

function BlitzControls({
  enabled,
  onToggle,
  timeLimit,
  onTimeChange,
  timeLeft,
  isPlaying,
}: {
  enabled: boolean;
  onToggle: () => void;
  timeLimit: number;
  onTimeChange: (time: number) => void;
  timeLeft: number;
  isPlaying: boolean;
}) {
  const percentage = (timeLeft / timeLimit) * 100;
  const isLow = timeLeft <= 3;

  return (
    <div className="flex flex-col items-center gap-3 p-3 bg-muted/50 rounded-lg w-full max-w-md">
      <div className="flex items-center gap-4 w-full justify-center">
        <div className="flex items-center gap-2">
          <Checkbox
            id="blitz"
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={isPlaying}
          />
          <Label
            htmlFor="blitz"
            className={`text-sm cursor-pointer font-medium ${
              enabled ? "text-amber-500" : ""
            }`}
          >
            Blitz Mode
          </Label>
        </div>

        {enabled && (
          <div className="flex items-center gap-2">
            {TIME_OPTIONS.map((time) => (
              <button
                key={time}
                onClick={() => onTimeChange(time)}
                disabled={isPlaying}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  timeLimit === time
                    ? "bg-amber-500 text-white"
                    : "bg-muted hover:bg-muted-foreground/20 text-muted-foreground"
                } ${isPlaying ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {time}s
              </button>
            ))}
          </div>
        )}
      </div>

      {enabled && isPlaying && (
        <div className="w-full">
          <div className="flex justify-between text-xs mb-1">
            <span
              className={
                isLow ? "text-red-500 font-bold" : "text-muted-foreground"
              }
            >
              Time Left
            </span>
            <span
              className={`font-mono ${
                isLow ? "text-red-500 font-bold animate-pulse" : ""
              }`}
            >
              {timeLeft}s
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                isLow
                  ? "bg-red-500"
                  : percentage > 50
                  ? "bg-green-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function LocalGameComponent() {
  const [state, setState] = useState<GameState>(createInitialState);
  const [enabledRules, setEnabledRules] = useState<RepetitionRule[]>([
    "warning",
  ]);
  const [blockedPosition, setBlockedPosition] = useState<Position | null>(null);
  const [blitzEnabled, setBlitzEnabled] = useState(false);
  const [blitzTimeLimit, setBlitzTimeLimit] = useState(10);
  const [timeLeft, setTimeLeft] = useState(10);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPlayerRef = useRef(state.currentPlayer);

  const executeRandomMove = useCallback(() => {
    const randomMove = getRandomMove(state);
    if (randomMove) {
      toast.info(
        `Time's up! Auto-moved ${
          state.currentPlayer === "blue" ? "Blue" : "Red"
        }'s piece.`
      );
      setState(makeMove(randomMove.from, randomMove.to, state));
    }
  }, [state]);

  useEffect(() => {
    if (lastPlayerRef.current !== state.currentPlayer) {
      lastPlayerRef.current = state.currentPlayer;
      if (blitzEnabled && state.status === "playing") {
        setTimeLeft(blitzTimeLimit);
      }
    }
  }, [state.currentPlayer, state.status, blitzEnabled, blitzTimeLimit]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!blitzEnabled || state.status !== "playing") {
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setTimeout(executeRandomMove, 0);
          return blitzTimeLimit;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [blitzEnabled, state.status, blitzTimeLimit, executeRandomMove]);

  function toggleRule(rule: RepetitionRule) {
    setEnabledRules((prev) =>
      prev.includes(rule) ? prev.filter((r) => r !== rule) : [...prev, rule]
    );
  }

  function handlePositionClick(pos: Position) {
    if (state.status !== "playing") return;

    const owner = getPieceOwner(pos, state);

    if (state.selectedPiece) {
      const validMoves = getValidMoves(state.selectedPiece, state);

      if (validMoves.includes(pos)) {
        const repetitionCheck = checkRepetition(
          state.selectedPiece,
          pos,
          state,
          enabledRules
        );

        if (repetitionCheck.shouldForfeit) {
          toast.error(
            `${
              state.currentPlayer === "blue" ? "Blue" : "Red"
            } forfeits due to excessive repetition!`
          );
          setState(forfeitGame(state, state.currentPlayer));
          return;
        }

        if (repetitionCheck.shouldBlock) {
          setBlockedPosition(pos);
          toast.warning("Move blocked! This would cause repetition.");
          setTimeout(() => setBlockedPosition(null), 1000);
          return;
        }

        if (repetitionCheck.shouldWarn) {
          const warningCount =
            state.repetitionWarnings[state.currentPlayer] + 1;
          const maxWarnings = enabledRules.includes("forfeit") ? 3 : Infinity;
          toast.warning(
            `Warning: Repetitive move detected! (${warningCount}/${
              maxWarnings === Infinity ? "∞" : maxWarnings
            })`
          );
          setState(makeMoveWithWarning(state.selectedPiece, pos, state, true));
          return;
        }

        setState(makeMoveWithWarning(state.selectedPiece, pos, state, false));
        return;
      }

      if (owner === state.currentPlayer) {
        setState({ ...state, selectedPiece: pos });
        return;
      }

      setState({ ...state, selectedPiece: null });
      return;
    }

    if (owner === state.currentPlayer) {
      setState({ ...state, selectedPiece: pos });
    }
  }

  function handleReset() {
    setState(createInitialState());
    setBlockedPosition(null);
    setTimeLeft(blitzTimeLimit);
    lastPlayerRef.current = "blue";
  }

  function handleBlitzToggle() {
    if (state.status === "playing" && state.moveHistory.length > 0) {
      toast.error("Cannot change blitz mode during an active game");
      return;
    }
    setBlitzEnabled((prev) => !prev);
    setTimeLeft(blitzTimeLimit);
  }

  function handleTimeChange(time: number) {
    if (state.status === "playing" && state.moveHistory.length > 0) {
      toast.error("Cannot change time limit during an active game");
      return;
    }
    setBlitzTimeLimit(time);
    setTimeLeft(time);
  }

  const isGameOver = state.status !== "playing";
  const isForfeit =
    state.status === "blue_forfeit" || state.status === "red_forfeit";
  const isPlaying = state.status === "playing" && state.moveHistory.length > 0;

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center gap-4">
      <Link to="/games/crossway">
        <Button variant="ghost" size="sm">
          ← Back to Crossway
        </Button>
      </Link>

      <h1 className="text-2xl font-bold text-foreground">
        Crossway - Local PvP
      </h1>

      <div className="flex items-center gap-4">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.currentPlayer === "blue" && state.status === "playing"
              ? "bg-blue-500/20 ring-2 ring-blue-500"
              : "bg-muted"
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span className="text-foreground font-medium">Blue</span>
          {enabledRules.includes("warning") &&
            state.repetitionWarnings.blue > 0 && (
              <span className="text-xs text-amber-500">
                ({state.repetitionWarnings.blue} warnings)
              </span>
            )}
        </div>

        <span className="text-muted-foreground">vs</span>

        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.currentPlayer === "red" && state.status === "playing"
              ? "bg-red-500/20 ring-2 ring-red-500"
              : "bg-muted"
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-red-500" />
          <span className="text-foreground font-medium">Red</span>
          {enabledRules.includes("warning") &&
            state.repetitionWarnings.red > 0 && (
              <span className="text-xs text-amber-500">
                ({state.repetitionWarnings.red} warnings)
              </span>
            )}
        </div>
      </div>

      <MoveCounter moves={state.moveHistory} />

      <DangerIndicator state={state} />

      {isGameOver && (
        <div
          className={`px-6 py-3 rounded-lg text-lg font-bold ${
            state.status === "blue_wins" || state.status === "red_forfeit"
              ? "bg-blue-500/20 text-blue-500"
              : "bg-red-500/20 text-red-500"
          }`}
        >
          {state.status === "blue_wins"
            ? "Blue Wins!"
            : state.status === "red_wins"
            ? "Red Wins!"
            : state.status === "blue_forfeit"
            ? "Red Wins! (Blue forfeited)"
            : "Blue Wins! (Red forfeited)"}
        </div>
      )}

      <BlitzControls
        enabled={blitzEnabled}
        onToggle={handleBlitzToggle}
        timeLimit={blitzTimeLimit}
        onTimeChange={handleTimeChange}
        timeLeft={timeLeft}
        isPlaying={isPlaying}
      />

      <RuleCheckboxes enabledRules={enabledRules} onToggle={toggleRule} />

      <div className="flex flex-col lg:flex-row items-start gap-4 w-full max-w-4xl justify-center">
        <GameBoard
          state={state}
          onPositionClick={handlePositionClick}
          blockedPosition={blockedPosition}
        />
        <MoveHistory moves={state.moveHistory} />
      </div>

      <div className="text-sm text-muted-foreground text-center max-w-md">
        {state.status === "playing" ? (
          state.selectedPiece ? (
            <span>
              Click a highlighted position to move, or click another piece
            </span>
          ) : (
            <span>Click one of your pieces to select it</span>
          )
        ) : (
          <span>
            Game over{isForfeit ? " by forfeit" : ""}! Click reset to play again
          </span>
        )}
      </div>

      <Button onClick={handleReset}>Reset Game</Button>
    </div>
  );
}
