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
import { Label } from "@/components/ui/label";
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
      <div className="max-h-32 overflow-y-auto text-xs space-y-1">
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

function GameSetup({
  onStart,
}: {
  onStart: (playerColor: Player, difficulty: AIDifficulty) => void;
}) {
  const [playerColor, setPlayerColor] = useState<Player>("blue");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("easy");

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-card border border-border rounded-lg max-w-md">
      <h2 className="text-xl font-bold text-foreground">Game Setup</h2>

      <div className="flex flex-col gap-2 w-full">
        <Label className="text-sm font-medium">Play as:</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setPlayerColor("blue")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              playerColor === "blue"
                ? "bg-blue-500/20 ring-2 ring-blue-500"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span className="font-medium">Blue</span>
            <span className="text-xs text-muted-foreground">(First)</span>
          </button>
          <button
            onClick={() => setPlayerColor("red")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              playerColor === "red"
                ? "bg-red-500/20 ring-2 ring-red-500"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span className="font-medium">Red</span>
            <span className="text-xs text-muted-foreground">(Second)</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full">
        <Label className="text-sm font-medium">AI Difficulty:</Label>
        <div className="flex gap-2">
          <button
            onClick={() => setDifficulty("easy")}
            className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
              difficulty === "easy"
                ? "bg-green-500/20 ring-2 ring-green-500 text-green-500"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <div className="font-medium">Easy</div>
            <div className="text-xs text-muted-foreground">Random moves</div>
          </button>
          <button
            onClick={() => setDifficulty("hard")}
            className={`flex-1 px-4 py-3 rounded-lg transition-colors ${
              difficulty === "hard"
                ? "bg-red-500/20 ring-2 ring-red-500 text-red-500"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <div className="font-medium">Hard</div>
            <div className="text-xs text-muted-foreground">Strategic AI</div>
          </button>
        </div>
      </div>

      <button
        onClick={() => onStart(playerColor, difficulty)}
        className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
      >
        Start Game
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

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center gap-6">
        <Link to="/games/crossway">
          <Button variant="ghost" size="sm">
            ← Back to Crossway
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">
          Crossway - VS Computer
        </h1>
        <GameSetup onStart={handleStart} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold text-foreground">
        Crossway - VS Computer
      </h1>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Difficulty:</span>
        <span
          className={`font-medium ${
            difficulty === "easy" ? "text-green-500" : "text-red-500"
          }`}
        >
          {difficulty === "easy" ? "Easy" : "Hard"}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.currentPlayer === "blue" && state.status === "playing"
              ? "bg-blue-500/20 ring-2 ring-blue-500"
              : "bg-muted"
          }`}
        >
          <div className="w-4 h-4 rounded-full bg-blue-500" />
          <span className="text-foreground font-medium">
            {playerColor === "blue" ? "You" : "AI"}
          </span>
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
          <span className="text-foreground font-medium">
            {playerColor === "red" ? "You" : "AI"}
          </span>
        </div>
      </div>

      <MoveCounter moves={state.moveHistory} />

      {isAIThinking && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-500 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm font-medium">AI is thinking...</span>
        </div>
      )}

      {isGameOver && (
        <div
          className={`px-6 py-3 rounded-lg text-lg font-bold ${
            (state.status === "blue_wins" && playerColor === "blue") ||
            (state.status === "red_wins" && playerColor === "red")
              ? "bg-green-500/20 text-green-500"
              : "bg-red-500/20 text-red-500"
          }`}
        >
          {(state.status === "blue_wins" && playerColor === "blue") ||
          (state.status === "red_wins" && playerColor === "red")
            ? "You Win!"
            : "AI Wins!"}
        </div>
      )}

      <div className="flex flex-col lg:flex-row items-start gap-4 w-full max-w-4xl justify-center">
        <GameBoard
          state={state}
          onPositionClick={handlePositionClick}
          disabled={!isPlayerTurn || isAIThinking || isGameOver}
        />
        <MoveHistory moves={state.moveHistory} />
      </div>

      <div className="text-sm text-muted-foreground text-center max-w-md">
        {state.status === "playing" ? (
          isAIThinking ? (
            <span>Waiting for AI...</span>
          ) : isPlayerTurn ? (
            state.selectedPiece ? (
              <span>Click a highlighted position to move</span>
            ) : (
              <span>Your turn - click one of your pieces</span>
            )
          ) : (
            <span>AI's turn</span>
          )
        ) : (
          <span>Game over!</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={handleUndo}
          disabled={moveHistory.length < 2 || isAIThinking}
        >
          Undo
        </Button>
        <Button variant="secondary" onClick={handleReset} disabled={isAIThinking}>
          Reset
        </Button>
        <Button onClick={handleNewGame}>New Game</Button>
      </div>
    </div>
  );
}

