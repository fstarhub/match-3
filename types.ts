
export type TileType = 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'orange';

export interface TileData {
  id: string;
  type: TileType;
  row: number;
  col: number;
  isMatched?: boolean;
}

export type GameStatus = 'IDLE' | 'SWAPPING' | 'RESOLVING' | 'GAMEOVER';

export interface GameState {
  board: (TileData | null)[][];
  score: number;
  moves: number;
  status: GameStatus;
  highScore: number;
}
