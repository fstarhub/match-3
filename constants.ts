
import { TileType } from './types';

export const GRID_SIZE = 8;
export const MAX_MOVES = 30;

export const INITIAL_ITEMS = {
  hammer: 3,
  shuffle: 2,
  extraMoves: 1
};

export const TILE_COLORS: Record<TileType, string> = {
  blue: 'bg-blue-500',
  red: 'bg-rose-500',
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  purple: 'bg-violet-500',
  orange: 'bg-orange-500',
};

export const TILE_SYMBOLS: Record<TileType, string> = {
  blue: '💎',
  red: '❤️',
  green: '🍀',
  yellow: '⭐',
  purple: '🌙',
  orange: '🔥',
};

export const TILE_TYPES: TileType[] = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];
