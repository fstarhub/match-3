
import { TileData, TileType } from '../types';
import { GRID_SIZE, TILE_TYPES } from '../constants';

export const generateTile = (row: number, col: number): TileData => {
  const type = TILE_TYPES[Math.floor(Math.random() * TILE_TYPES.length)];
  return {
    id: `${Date.now()}-${Math.random()}`,
    type,
    row,
    col,
  };
};

export const createBoard = (): TileData[][] => {
  const board: TileData[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      let tile: TileData;
      do {
        tile = generateTile(r, c);
      } while (
        (c >= 2 && board[r][c - 1]?.type === tile.type && board[r][c - 2]?.type === tile.type) ||
        (r >= 2 && board[r - 1][c]?.type === tile.type && board[r - 2][c]?.type === tile.type)
      );
      board[r][c] = tile;
    }
  }
  return board;
};

export const shuffleBoard = (board: (TileData | null)[][]): (TileData | null)[][] => {
  const tiles: TileData[] = [];
  board.forEach(row => row.forEach(tile => {
    if (tile) tiles.push(tile);
  }));

  // Fisher-Yates shuffle
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  const newBoard: (TileData | null)[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null));
  let index = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (index < tiles.length) {
        newBoard[r][c] = { ...tiles[index], row: r, col: c };
        index++;
      }
    }
  }
  return newBoard;
};

export const findMatches = (board: (TileData | null)[][]): { row: number, col: number }[] => {
  const matches = new Set<string>();

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE - 2; c++) {
      const t1 = board[r][c];
      const t2 = board[r][c + 1];
      const t3 = board[r][c + 2];
      if (t1 && t2 && t3 && t1.type === t2.type && t2.type === t3.type) {
        matches.add(`${r}-${c}`);
        matches.add(`${r}-${c + 1}`);
        matches.add(`${r}-${c + 2}`);
      }
    }
  }

  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r < GRID_SIZE - 2; r++) {
      const t1 = board[r][c];
      const t2 = board[r + 1][c];
      const t3 = board[r + 2][c];
      if (t1 && t2 && t3 && t1.type === t2.type && t2.type === t3.type) {
        matches.add(`${r}-${c}`);
        matches.add(`${r + 1}-${c}`);
        matches.add(`${r + 2}-${c}`);
      }
    }
  }

  return Array.from(matches).map(s => {
    const [r, c] = s.split('-').map(Number);
    return { row: r, col: c };
  });
};

export const applyGravity = (board: (TileData | null)[][]): (TileData | null)[][] => {
  const newBoard = board.map(row => [...row]);
  
  for (let c = 0; c < GRID_SIZE; c++) {
    let emptyRow = GRID_SIZE - 1;
    for (let r = GRID_SIZE - 1; r >= 0; r--) {
      if (newBoard[r][c] !== null) {
        const tile = newBoard[r][c]!;
        newBoard[r][c] = null;
        newBoard[emptyRow][c] = { ...tile, row: emptyRow, col: c };
        emptyRow--;
      }
    }
    for (let r = emptyRow; r >= 0; r--) {
      newBoard[r][c] = generateTile(r, c);
    }
  }
  return newBoard;
};

export const isAdjacent = (r1: number, c1: number, r2: number, c2: number): boolean => {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
};
