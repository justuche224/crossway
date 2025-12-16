import {
  type Position,
  type Player,
  type GameState,
  type AvailableMove,
  getAllValidMovesForPlayer,
  makeMove,
  checkWinCondition,
} from './game-logic'

const POSITION_PROGRESS: Record<Position, { blue: number; red: number }> = {
  L1: { blue: 0, red: 5 },
  L2: { blue: 1, red: 4 },
  L3: { blue: 0, red: 5 },
  CL: { blue: 2, red: 3 },
  CT: { blue: 3, red: 3 },
  CC: { blue: 3, red: 3 },
  CB: { blue: 3, red: 3 },
  CR: { blue: 4, red: 2 },
  R1: { blue: 5, red: 0 },
  R2: { blue: 4, red: 1 },
  R3: { blue: 5, red: 0 },
}

export function getPositionScore(position: Position, player: Player): number {
  return POSITION_PROGRESS[position][player]
}

export function evaluateBoard(state: GameState, forPlayer: Player): number {
  let score = 0

  for (const pos of state.bluePieces) {
    const pieceScore = getPositionScore(pos, 'blue')
    score += forPlayer === 'blue' ? pieceScore : -pieceScore
  }

  for (const pos of state.redPieces) {
    const pieceScore = getPositionScore(pos, 'red')
    score += forPlayer === 'red' ? pieceScore : -pieceScore
  }

  const status = checkWinCondition(state)
  if (status === 'blue_wins') {
    score += forPlayer === 'blue' ? 1000 : -1000
  } else if (status === 'red_wins') {
    score += forPlayer === 'red' ? 1000 : -1000
  }

  return score
}

export function dumbAI(state: GameState): AvailableMove | null {
  const moves = getAllValidMovesForPlayer(state, state.currentPlayer)
  if (moves.length === 0) return null

  const aiMoves = state.moveHistory.filter(m => m.player === state.currentPlayer)
  const lastAIMove = aiMoves.length > 0 ? aiMoves[aiMoves.length - 1] : null

  let filteredMoves = moves
  if (lastAIMove) {
    filteredMoves = moves.filter(
      move => !(move.from === lastAIMove.to && move.to === lastAIMove.from)
    )
  }

  if (filteredMoves.length === 0) {
    filteredMoves = moves
  }

  const randomIndex = Math.floor(Math.random() * filteredMoves.length)
  return filteredMoves[randomIndex]
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  aiPlayer: Player
): number {
  const status = checkWinCondition(state)
  if (status !== 'playing' || depth === 0) {
    return evaluateBoard(state, aiPlayer)
  }

  const moves = getAllValidMovesForPlayer(state, state.currentPlayer)
  if (moves.length === 0) {
    return evaluateBoard(state, aiPlayer)
  }

  if (maximizingPlayer) {
    let maxEval = -Infinity
    for (const move of moves) {
      const newState = makeMove(move.from, move.to, state)
      const evalScore = minimax(newState, depth - 1, alpha, beta, false, aiPlayer)
      maxEval = Math.max(maxEval, evalScore)
      alpha = Math.max(alpha, evalScore)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const move of moves) {
      const newState = makeMove(move.from, move.to, state)
      const evalScore = minimax(newState, depth - 1, alpha, beta, true, aiPlayer)
      minEval = Math.min(minEval, evalScore)
      beta = Math.min(beta, evalScore)
      if (beta <= alpha) break
    }
    return minEval
  }
}

export function smartAI(state: GameState, depth: number = 3): AvailableMove | null {
  const moves = getAllValidMovesForPlayer(state, state.currentPlayer)
  if (moves.length === 0) return null

  const aiPlayer = state.currentPlayer
  let bestMove: AvailableMove | null = null
  let bestScore = -Infinity

  for (const move of moves) {
    const newState = makeMove(move.from, move.to, state)
    const score = minimax(newState, depth - 1, -Infinity, Infinity, false, aiPlayer)

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove || moves[0]
}

export type AIDifficulty = 'easy' | 'hard'

export function getAIMove(state: GameState, difficulty: AIDifficulty): AvailableMove | null {
  if (difficulty === 'easy') {
    return dumbAI(state)
  }
  return smartAI(state, 3)
}

