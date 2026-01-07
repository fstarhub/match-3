
import React from 'react';
import { TileData } from '../types';
import { TILE_COLORS, TILE_SYMBOLS } from '../constants';

interface TileProps {
  tile: TileData | null;
  isSelected: boolean;
  isMatched: boolean;
  onClick: () => void;
}

const Tile: React.FC<TileProps> = ({ tile, isSelected, isMatched, onClick }) => {
  if (!tile) return <div className="aspect-square w-full" />;

  return (
    <div
      onClick={onClick}
      className={`
        aspect-square w-full rounded-lg flex items-center justify-center 
        text-2xl cursor-pointer transition-all duration-300 transform
        ${TILE_COLORS[tile.type]} 
        ${isSelected ? 'scale-110 shadow-[0_0_15px_rgba(255,255,255,0.8)] z-10' : 'hover:brightness-110'}
        ${isMatched ? 'tile-match' : 'tile-enter'}
        active:scale-90
      `}
      style={{
        boxShadow: isSelected ? 'inset 0 0 10px rgba(0,0,0,0.2)' : 'none'
      }}
    >
      <span className="drop-shadow-md select-none">
        {TILE_SYMBOLS[tile.type]}
      </span>
      {isSelected && (
        <div className="absolute inset-0 border-2 border-white rounded-lg animate-pulse" />
      )}
    </div>
  );
};

export default Tile;
