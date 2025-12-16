export type Position =
  | 'L1' | 'L2' | 'L3'
  | 'R1' | 'R2' | 'R3'
  | 'CT' | 'CL' | 'CC' | 'CR' | 'CB'

export type Player = 'blue' | 'red'

export type GameStatus = 'playing' | 'blue_wins' | 'red_wins' | 'blue_forfeit' | 'red_forfeit'

export type RepetitionRule = 'warning' | 'forfeit' | 'block'

export interface Move {
  from: Position
  to: Position
  player: Player
}

export interface GameState {
  currentPlayer: Player
  bluePieces: Position[]
  redPieces: Position[]
  selectedPiece: Position | null
  status: GameStatus
  moveHistory: Move[]
  boardStateHistory: string[]
  repetitionWarnings: { blue: number; red: number }
}

export const BLUE_HOME: Position[] = ['L1', 'L2', 'L3']
export const RED_HOME: Position[] = ['R1', 'R2', 'R3']

export const BOARD_GRAPH: Record<Position, Position[]> = {
  L1: ['L2'],
  L2: ['L1', 'L3', 'CL'],
  L3: ['L2'],
  R1: ['R2'],
  R2: ['R1', 'R3', 'CR'],
  R3: ['R2'],
  CT: ['CC', 'CL', 'CR'],
  CL: ['CC', 'CT', 'CB', 'L2'],
  CC: ['CT', 'CL', 'CR', 'CB'],
  CR: ['CC', 'CT', 'CB', 'R2'],
  CB: ['CC', 'CL', 'CR'],
}

export const POSITION_COORDS: Record<Position, { x: number; y: number }> = {
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
}

export function serializeBoardState(state: GameState): string {
  const blue = [...state.bluePieces].sort().join(',')
  const red = [...state.redPieces].sort().join(',')
  return `${state.currentPlayer}:${blue}|${red}`
}

export function createInitialState(): GameState {
  const state: GameState = {
    currentPlayer: 'blue',
    bluePieces: ['L1', 'L2', 'L3'],
    redPieces: ['R1', 'R2', 'R3'],
    selectedPiece: null,
    status: 'playing',
    moveHistory: [],
    boardStateHistory: [],
    repetitionWarnings: { blue: 0, red: 0 },
  }
  state.boardStateHistory.push(serializeBoardState(state))
  return state
}

export function getAllPiecePositions(state: GameState): Position[] {
  return [...state.bluePieces, ...state.redPieces]
}

export function isPositionOccupied(position: Position, state: GameState): boolean {
  return getAllPiecePositions(state).includes(position)
}

export function getValidMoves(position: Position, state: GameState): Position[] {
  const neighbors = BOARD_GRAPH[position]
  return neighbors.filter(neighbor => !isPositionOccupied(neighbor, state))
}

export function getPieceOwner(position: Position, state: GameState): Player | null {
  if (state.bluePieces.includes(position)) return 'blue'
  if (state.redPieces.includes(position)) return 'red'
  return null
}

export function checkWinCondition(state: GameState): GameStatus {
  const blueInRedHome = state.bluePieces.every(pos => RED_HOME.includes(pos))
  const redInBlueHome = state.redPieces.every(pos => BLUE_HOME.includes(pos))
  
  if (blueInRedHome) return 'blue_wins'
  if (redInBlueHome) return 'red_wins'
  return 'playing'
}

export function canPlayerMove(player: Player, state: GameState): boolean {
  const pieces = player === 'blue' ? state.bluePieces : state.redPieces
  return pieces.some(pos => getValidMoves(pos, state).length > 0)
}

export function detectPieceBounce(moveHistory: Move[], player: Player): boolean {
  const playerMoves = moveHistory.filter(m => m.player === player)
  if (playerMoves.length < 2) return false
  
  const lastTwo = playerMoves.slice(-2)
  return lastTwo[0].from === lastTwo[1].to && lastTwo[0].to === lastTwo[1].from
}

export function detectBoardRepetition(boardStateHistory: string[]): number {
  if (boardStateHistory.length === 0) return 0
  const currentState = boardStateHistory[boardStateHistory.length - 1]
  return boardStateHistory.filter(s => s === currentState).length
}

export interface RepetitionCheckResult {
  isPieceBounce: boolean
  boardRepetitionCount: number
  shouldWarn: boolean
  shouldBlock: boolean
  shouldForfeit: boolean
}

export function checkRepetition(
  from: Position,
  to: Position,
  state: GameState,
  enabledRules: RepetitionRule[]
): RepetitionCheckResult {
  const simulatedMove: Move = { from, to, player: state.currentPlayer }
  const simulatedHistory = [...state.moveHistory, simulatedMove]
  
  const owner = getPieceOwner(from, state)
  const newBluePieces = owner === 'blue'
    ? state.bluePieces.map(p => p === from ? to : p)
    : state.bluePieces
  const newRedPieces = owner === 'red'
    ? state.redPieces.map(p => p === from ? to : p)
    : state.redPieces
  
  const nextPlayer = state.currentPlayer === 'blue' ? 'red' : 'blue'
  const simulatedState: GameState = {
    ...state,
    currentPlayer: nextPlayer,
    bluePieces: newBluePieces,
    redPieces: newRedPieces,
  }
  
  const simulatedBoardState = serializeBoardState(simulatedState)
  const simulatedBoardHistory = [...state.boardStateHistory, simulatedBoardState]
  
  const isPieceBounce = detectPieceBounce(simulatedHistory, state.currentPlayer)
  const boardRepetitionCount = detectBoardRepetition(simulatedBoardHistory)
  
  const hasRepetition = isPieceBounce || boardRepetitionCount >= 3
  const warningCount = state.repetitionWarnings[state.currentPlayer]
  
  return {
    isPieceBounce,
    boardRepetitionCount,
    shouldWarn: hasRepetition && enabledRules.includes('warning'),
    shouldBlock: hasRepetition && enabledRules.includes('block'),
    shouldForfeit: hasRepetition && enabledRules.includes('forfeit') && warningCount >= 2,
  }
}

export function makeMove(from: Position, to: Position, state: GameState): GameState {
  const owner = getPieceOwner(from, state)
  if (!owner || owner !== state.currentPlayer) return state
  
  const validMoves = getValidMoves(from, state)
  if (!validMoves.includes(to)) return state
  
  const newBluePieces = owner === 'blue'
    ? state.bluePieces.map(p => p === from ? to : p)
    : state.bluePieces
    
  const newRedPieces = owner === 'red'
    ? state.redPieces.map(p => p === from ? to : p)
    : state.redPieces
  
  const nextPlayer = state.currentPlayer === 'blue' ? 'red' : 'blue'
  
  const newMove: Move = { from, to, player: state.currentPlayer }
  const newMoveHistory = [...state.moveHistory, newMove]
  
  const newState: GameState = {
    currentPlayer: nextPlayer,
    bluePieces: newBluePieces,
    redPieces: newRedPieces,
    selectedPiece: null,
    status: 'playing',
    moveHistory: newMoveHistory,
    boardStateHistory: [...state.boardStateHistory],
    repetitionWarnings: { ...state.repetitionWarnings },
  }
  
  newState.boardStateHistory.push(serializeBoardState(newState))
  newState.status = checkWinCondition(newState)
  
  return newState
}

export function makeMoveWithWarning(
  from: Position,
  to: Position,
  state: GameState,
  incrementWarning: boolean
): GameState {
  const newState = makeMove(from, to, state)
  if (newState === state) return state
  
  if (incrementWarning) {
    const player = state.currentPlayer
    newState.repetitionWarnings = {
      ...newState.repetitionWarnings,
      [player]: state.repetitionWarnings[player] + 1,
    }
  }
  
  return newState
}

export function forfeitGame(state: GameState, player: Player): GameState {
  return {
    ...state,
    status: player === 'blue' ? 'blue_forfeit' : 'red_forfeit',
    selectedPiece: null,
  }
}

export interface AvailableMove {
  from: Position
  to: Position
}

export function getAllValidMovesForPlayer(state: GameState, player: Player): AvailableMove[] {
  const pieces = player === 'blue' ? state.bluePieces : state.redPieces
  const moves: AvailableMove[] = []
  
  for (const piece of pieces) {
    const validDestinations = getValidMoves(piece, state)
    for (const to of validDestinations) {
      moves.push({ from: piece, to })
    }
  }
  
  return moves
}

export function getRandomMove(state: GameState): AvailableMove | null {
  const moves = getAllValidMovesForPlayer(state, state.currentPlayer)
  if (moves.length === 0) return null
  const randomIndex = Math.floor(Math.random() * moves.length)
  return moves[randomIndex]
}

export function getMoveCountsPerPlayer(moveHistory: Move[]): { blue: number; red: number } {
  return {
    blue: moveHistory.filter(m => m.player === 'blue').length,
    red: moveHistory.filter(m => m.player === 'red').length,
  }
}

export function formatMoveNotation(move: Move, moveNumber: number): string {
  return `${moveNumber}. ${move.from}→${move.to}`
}

export function getPlayerDangerLevel(state: GameState, player: Player): 'safe' | 'warning' | 'danger' {
  const availableMoves = getAllValidMovesForPlayer(state, player)
  if (availableMoves.length === 0) return 'danger'
  if (availableMoves.length <= 2) return 'warning'
  return 'safe'
}
