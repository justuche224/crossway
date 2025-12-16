import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  type GameState,
  type Position,
  type Move,
  POSITION_COORDS,
  createInitialState,
  getValidMoves,
  getPieceOwner,
  makeMove,
  getMoveCountsPerPlayer,
  formatMoveNotation,
  getPlayerDangerLevel,
  type Player,
} from "@/lib/game-logic";
import { type AIDifficulty, getAIMove } from "@/lib/game-ai";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/solo")({
  component: SoloGameComponent,
});

const CIRCLE_CENTER = { x: 250, y: 150 };
const CIRCLE_RADIUS = 90;

function GameBoard({
  state,
  onPositionClick,
  disabled,
}: {
  state: GameState;
  onPositionClick: (pos: Position) => void;
  disabled: boolean;
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
                  : isValidMove
                  ? "#22c55e"
                  : isCurrentPlayerPiece && state.status === "playing"
                  ? "#94a3b8"
                  : "transparent"
              }
              strokeWidth={
                isSelected ? 4 : showDangerRing ? 3 : isValidMove ? 3 : 2
              }
              strokeDasharray={isValidMove ? "4 2" : "none"}
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
      <div className="max-h-40 overflow-y-auto space-y-1">
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

function MoveCounter({
  moves,
  playerColor,
}: {
  moves: Move[];
  playerColor: Player;
}) {
  const counts = getMoveCountsPerPlayer(moves);

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-blue-500" />
        <span className="text-sm font-mono font-medium text-foreground">
          {counts.blue}
        </span>
        {playerColor === "blue" && (
          <span className="text-xs text-muted-foreground">(you)</span>
        )}
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <span className="text-sm font-mono font-medium text-foreground">
          {counts.red}
        </span>
        {playerColor === "red" && (
          <span className="text-xs text-muted-foreground">(you)</span>
        )}
      </div>
    </div>
  );
}

function GameSetup({
  onStart,
}: {
  onStart: (playerColor: Player, difficulty: AIDifficulty) => void;
}) {
  const [playerColor, setPlayerColor] = useState<Player>("blue");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("easy");

  return (
    <div className="w-full max-w-md">
      {/* Color Selection */}
      <div className="mb-8">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4">
          Play As
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setPlayerColor("blue")}
            className={`flex-1 group py-4 px-4 border-b-2 transition-all ${
              playerColor === "blue"
                ? "border-blue-500"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <div
                className={`w-5 h-5 rounded-full bg-blue-500 ${
                  playerColor === "blue"
                    ? "ring-2 ring-blue-500/30 ring-offset-2 ring-offset-background"
                    : ""
                }`}
              />
              <span
                className={`font-semibold ${
                  playerColor === "blue"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Blue
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Moves first</p>
          </button>

          <button
            onClick={() => setPlayerColor("red")}
            className={`flex-1 group py-4 px-4 border-b-2 transition-all ${
              playerColor === "red"
                ? "border-red-500"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <div
                className={`w-5 h-5 rounded-full bg-red-500 ${
                  playerColor === "red"
                    ? "ring-2 ring-red-500/30 ring-offset-2 ring-offset-background"
                    : ""
                }`}
              />
              <span
                className={`font-semibold ${
                  playerColor === "red"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Red
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Moves second</p>
          </button>
        </div>
      </div>

      {/* Difficulty Selection */}
      <div className="mb-10">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4">
          Difficulty
        </h3>
        <div className="flex gap-3">
          <button
            onClick={() => setDifficulty("easy")}
            className={`flex-1 py-4 px-4 border-b-2 transition-all ${
              difficulty === "easy"
                ? "border-foreground"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <span
              className={`font-semibold ${
                difficulty === "easy"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Easy
            </span>
            <p className="text-xs text-muted-foreground mt-1">Random moves</p>
          </button>

          <button
            onClick={() => setDifficulty("hard")}
            className={`flex-1 py-4 px-4 border-b-2 transition-all ${
              difficulty === "hard"
                ? "border-foreground"
                : "border-border hover:border-foreground/30"
            }`}
          >
            <span
              className={`font-semibold ${
                difficulty === "hard"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              Hard
            </span>
            <p className="text-xs text-muted-foreground mt-1">Strategic AI</p>
          </button>
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={() => onStart(playerColor, difficulty)}
        className="w-full group flex items-center justify-center gap-3 py-4 bg-foreground text-background font-semibold hover:bg-foreground/90 transition-colors"
      >
        <span>Start Game</span>
        <span className="group-hover:translate-x-1 transition-transform">
          →
        </span>
      </button>
    </div>
  );
}

function SoloGameComponent() {
  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState<Player>("blue");
  const [aiColor, setAiColor] = useState<Player>("red");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("easy");
  const [state, setState] = useState<GameState>(createInitialState);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<GameState[]>([]);

  const isPlayerTurn = state.currentPlayer === playerColor;
  const isGameOver = state.status !== "playing";

  const executeAIMove = useCallback(() => {
    if (state.currentPlayer !== aiColor || state.status !== "playing") return;

    setIsAIThinking(true);

    setTimeout(() => {
      const aiMove = getAIMove(state, difficulty);
      if (aiMove) {
        setMoveHistory((prev) => [...prev, state]);
        setState(makeMove(aiMove.from, aiMove.to, state));
        toast.info(`AI moved: ${aiMove.from} → ${aiMove.to}`);
      }
      setIsAIThinking(false);
    }, 500);
  }, [state, aiColor, difficulty]);

  useEffect(() => {
    if (
      gameStarted &&
      state.currentPlayer === aiColor &&
      state.status === "playing"
    ) {
      executeAIMove();
    }
  }, [gameStarted, state.currentPlayer, aiColor, state.status, executeAIMove]);

  function handleStart(color: Player, diff: AIDifficulty) {
    setPlayerColor(color);
    setAiColor(color === "blue" ? "red" : "blue");
    setDifficulty(diff);
    setState(createInitialState());
    setMoveHistory([]);
    setGameStarted(true);
  }

  function handlePositionClick(pos: Position) {
    if (!isPlayerTurn || isAIThinking || state.status !== "playing") return;

    const owner = getPieceOwner(pos, state);

    if (state.selectedPiece) {
      const validMoves = getValidMoves(state.selectedPiece, state);

      if (validMoves.includes(pos)) {
        setMoveHistory((prev) => [...prev, state]);
        setState(makeMove(state.selectedPiece, pos, state));
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

  function handleUndo() {
    if (moveHistory.length < 2) return;
    const prevState = moveHistory[moveHistory.length - 2];
    setMoveHistory((prev) => prev.slice(0, -2));
    setState(prevState);
  }

  function handleReset() {
    setState(createInitialState());
    setMoveHistory([]);
  }

  function handleNewGame() {
    setGameStarted(false);
    setState(createInitialState());
    setMoveHistory([]);
  }

  // Setup Screen
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </Link>
            <h1 className="text-sm font-medium text-foreground">VS Computer</h1>
            <div className="w-12" />
          </div>
        </header>

        {/* Setup Content */}
        <main className="max-w-4xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-medium mb-3">
              Solo Play
            </p>
            <h2 className="text-4xl font-bold text-foreground">
              Challenge the AI
            </h2>
          </div>

          <div className="flex justify-center">
            <GameSetup onStart={handleStart} />
          </div>
        </main>
      </div>
    );
  }

  // Game Screen
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleNewGame}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Exit
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              VS Computer
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span
              className={`text-xs font-medium ${
                difficulty === "easy"
                  ? "text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {difficulty === "easy" ? "Easy" : "Hard"}
            </span>
          </div>
          <div className="w-12" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
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
              <span className="text-sm font-medium text-foreground">
                {playerColor === "blue" ? "You" : "AI"}
              </span>
              {state.currentPlayer === "blue" && state.status === "playing" && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  ●
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
              <span className="text-sm font-medium text-foreground">
                {playerColor === "red" ? "You" : "AI"}
              </span>
              {state.currentPlayer === "red" && state.status === "playing" && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  ●
                </span>
              )}
            </div>
          </div>

          {/* Move Counter */}
          <MoveCounter moves={state.moveHistory} playerColor={playerColor} />
        </div>

        {/* AI Thinking / Game Status */}
        {isAIThinking && (
          <div className="flex items-center justify-center gap-2 py-3 mb-6 text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-pulse" />
            <span className="text-sm">AI is thinking...</span>
          </div>
        )}

        {isGameOver && (
          <div className="text-center py-6 mb-6 border-y border-border">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Game Over
            </p>
            <p className="text-2xl font-bold text-foreground">
              {(state.status === "blue_wins" && playerColor === "blue") ||
              (state.status === "red_wins" && playerColor === "red")
                ? "You Win! 🎉"
                : "AI Wins"}
            </p>
          </div>
        )}

        {/* Game Area */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Board */}
          <div className="flex-1">
            <GameBoard
              state={state}
              onPositionClick={handlePositionClick}
              disabled={!isPlayerTurn || isAIThinking || isGameOver}
            />

            {/* Hint Text */}
            <p className="text-center text-sm text-muted-foreground mt-4">
              {state.status === "playing"
                ? isAIThinking
                  ? "Waiting for AI..."
                  : isPlayerTurn
                  ? state.selectedPiece
                    ? "Click a highlighted position to move"
                    : "Your turn — select a piece"
                  : "AI's turn"
                : ""}
            </p>
          </div>

          {/* Sidebar */}
          <div className="lg:w-56 space-y-8">
            <MoveHistory moves={state.moveHistory} />

            {/* Controls */}
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium mb-3">
                Actions
              </h3>
              <button
                onClick={handleUndo}
                disabled={moveHistory.length < 2 || isAIThinking}
                className="w-full py-2.5 text-sm text-left px-3 border-b border-border hover:border-foreground/30 disabled:opacity-40 disabled:hover:border-border transition-colors text-foreground"
              >
                Undo Move
              </button>
              <button
                onClick={handleReset}
                disabled={isAIThinking}
                className="w-full py-2.5 text-sm text-left px-3 border-b border-border hover:border-foreground/30 disabled:opacity-40 disabled:hover:border-border transition-colors text-foreground"
              >
                Reset Board
              </button>
              <button
                onClick={handleNewGame}
                className="w-full py-2.5 text-sm text-left px-3 border-b border-border hover:border-foreground/30 transition-colors text-foreground font-medium"
              >
                New Game →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
