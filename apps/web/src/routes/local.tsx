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
  getPlayerDangerLevel,
  canPlayerMove,
} from "@/lib/game-logic";

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
  enabledRules,
  onToggleRule,
  blitzEnabled,
  onToggleBlitz,
  blitzTimeLimit,
  onTimeChange,
  disabled,
}: {
  enabledRules: RepetitionRule[];
  onToggleRule: (rule: RepetitionRule) => void;
  blitzEnabled: boolean;
  onToggleBlitz: () => void;
  blitzTimeLimit: number;
  onTimeChange: (time: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="w-full border-t border-border pt-6">
      <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4">
        Game Settings
      </h3>

      {/* Blitz Mode */}
      <div className="mb-6">
        <button
          onClick={onToggleBlitz}
          disabled={disabled}
          className={`flex items-center gap-3 py-2 transition-colors ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <div
            className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center transition-colors ${
              blitzEnabled
                ? "bg-foreground border-foreground"
                : "border-muted-foreground"
            }`}
          >
            {blitzEnabled && <span className="text-background text-xs">✓</span>}
          </div>
          <span className="text-sm font-medium text-foreground">
            Blitz Mode
          </span>
        </button>

        {blitzEnabled && (
          <div className="mt-3 ml-7 flex items-center gap-2">
            {TIME_OPTIONS.map((time) => (
              <button
                key={time}
                onClick={() => onTimeChange(time)}
                disabled={disabled}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${
                  blitzTimeLimit === time
                    ? "border-b-2 border-foreground text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {time}s
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Repetition Rules */}
      <div>
        <p className="text-xs text-muted-foreground mb-3">Repetition Rules</p>
        <div className="space-y-2">
          {(["warning", "block", "forfeit"] as RepetitionRule[]).map((rule) => (
            <button
              key={rule}
              onClick={() => onToggleRule(rule)}
              className="flex items-center gap-3 py-1.5 w-full text-left"
            >
              <div
                className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center transition-colors ${
                  enabledRules.includes(rule)
                    ? "bg-foreground border-foreground"
                    : "border-muted-foreground"
                }`}
              >
                {enabledRules.includes(rule) && (
                  <span className="text-background text-xs">✓</span>
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
          <h1 className="text-sm font-medium text-foreground">Local PvP</h1>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Status Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
          {/* Player Indicators */}
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 px-3 py-2 transition-all ${
                state.currentPlayer === "blue" && state.status === "playing"
                  ? "border-b-2 border-blue-500"
                  : ""
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm font-medium text-foreground">Blue</span>
              {state.currentPlayer === "blue" && state.status === "playing" && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  ●
                </span>
              )}
              {enabledRules.includes("warning") &&
                state.repetitionWarnings.blue > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({state.repetitionWarnings.blue}⚠)
                  </span>
                )}
            </div>

            <span className="text-muted-foreground text-sm">vs</span>

            <div
              className={`flex items-center gap-2 px-3 py-2 transition-all ${
                state.currentPlayer === "red" && state.status === "playing"
                  ? "border-b-2 border-red-500"
                  : ""
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-foreground">Red</span>
              {state.currentPlayer === "red" && state.status === "playing" && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  ●
                </span>
              )}
              {enabledRules.includes("warning") &&
                state.repetitionWarnings.red > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({state.repetitionWarnings.red}⚠)
                  </span>
                )}
            </div>
          </div>

          {/* Move Counter */}
          <MoveCounter moves={state.moveHistory} />
        </div>

        {/* Blitz Timer */}
        {blitzEnabled && isPlaying && (
          <div className="mb-6 flex justify-center">
            <BlitzTimer timeLeft={timeLeft} timeLimit={blitzTimeLimit} />
          </div>
        )}

        {/* Danger Indicator */}
        <DangerIndicator state={state} />

        {/* Game Over Banner */}
        {isGameOver && (
          <div className="text-center py-6 mb-6 border-y border-border">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Game Over{isForfeit ? " — Forfeit" : ""}
            </p>
            <p className="text-2xl font-bold text-foreground">
              {state.status === "blue_wins" || state.status === "red_forfeit"
                ? "Blue Wins!"
                : "Red Wins!"}
            </p>
            {!isForfeit && !canPlayerMove(state.currentPlayer, state) && (
              <p className="text-sm text-muted-foreground mt-2">
                {state.currentPlayer === "blue" ? "Blue" : "Red"} was trapped
                with no valid moves
              </p>
            )}
          </div>
        )}

        {/* Game Area */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Board Section */}
          <div className="flex-1">
            <GameBoard
              state={state}
              onPositionClick={handlePositionClick}
              blockedPosition={blockedPosition}
            />

            {/* Hint Text */}
            <p className="text-center text-sm text-muted-foreground mt-4">
              {state.status === "playing" ? (
                state.selectedPiece ? (
                  "Click a highlighted position to move"
                ) : (
                  <>
                    <span
                      className={
                        state.currentPlayer === "blue"
                          ? "text-blue-500"
                          : "text-red-500"
                      }
                    >
                      {state.currentPlayer === "blue" ? "Blue" : "Red"}
                    </span>
                    {" — Select a piece"}
                  </>
                )
              ) : (
                ""
              )}
            </p>
          </div>

          {/* Sidebar */}
          <div className="lg:w-64 space-y-6">
            <MoveHistory moves={state.moveHistory} />

            {/* Actions */}
            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">
                Actions
              </h3>
              <button
                onClick={handleReset}
                className="w-full py-2.5 text-sm text-left px-3 border-b border-border hover:border-foreground/30 transition-colors text-foreground font-medium"
              >
                {isGameOver ? "Play Again →" : "Reset Game →"}
              </button>
            </div>

            {/* Settings */}
            <GameSettings
              enabledRules={enabledRules}
              onToggleRule={toggleRule}
              blitzEnabled={blitzEnabled}
              onToggleBlitz={handleBlitzToggle}
              blitzTimeLimit={blitzTimeLimit}
              onTimeChange={handleTimeChange}
              disabled={isPlaying}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
