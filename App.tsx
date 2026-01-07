
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { TileData, GameStatus } from './types';
import { GRID_SIZE, MAX_MOVES, INITIAL_ITEMS } from './constants';
import { createBoard, findMatches, applyGravity, isAdjacent, shuffleBoard } from './utils/gameLogic';
import Tile from './components/Tile';

const App: React.FC = () => {
  const [board, setBoard] = useState<(TileData | null)[][]>(() => createBoard());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('match3_highscore') || '0'));
  const [moves, setMoves] = useState(MAX_MOVES);
  const [status, setStatus] = useState<GameStatus>('IDLE');
  const [selectedTile, setSelectedTile] = useState<{r: number, c: number} | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);

  // 道具与设置状态
  const [items, setItems] = useState<typeof INITIAL_ITEMS>(() => {
    const saved = localStorage.getItem('match3_items');
    return saved ? JSON.parse(saved) : INITIAL_ITEMS;
  });
  const [activePowerup, setActivePowerup] = useState<'hammer' | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('match3_settings');
    return saved ? JSON.parse(saved) : { music: true, sound: true, vibration: true };
  });

  // 掉落奖励提示状态
  const [rewardToast, setRewardToast] = useState<{ text: string, icon: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('match3_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('match3_settings', JSON.stringify(settings));
  }, [settings]);

  const showReward = (text: string, icon: string) => {
    setRewardToast({ text, icon });
    if (settings.vibration) window.navigator?.vibrate?.([50, 30, 50]);
    setTimeout(() => setRewardToast(null), 2000);
  };

  const getAiHint = async () => {
    if (loadingHint || moves <= 0 || status !== 'IDLE' || isResolving) return;
    setLoadingHint(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const simplifiedBoard = board.map(row => row.map(t => t?.type || '无')).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `你是一个三消游戏策略分析助手。当前棋盘：\n${simplifiedBoard}\n玩家当前得分：${score}，最高分：${highScore}，剩余步数：${moves}。请用一句简短、幽默的话给出中文策略建议。提示：消除4个或以上可以获得丰厚奖励。`,
        config: { temperature: 0.8 }
      });
      setAiHint(response.text || "试着达成多连消来赢取奖励吧！");
    } catch (e) {
      setAiHint("连击可以获得步数加成，加油！");
    } finally {
      setLoadingHint(false);
    }
  };

  // 移除之前的自动获取提示 useEffect

  const resolveBoard = useCallback(async (currentBoard: (TileData | null)[][]) => {
    setIsResolving(true);
    let tempBoard = currentBoard.map(row => [...row]);
    let hasMatches = true;
    let combo = 0;

    while (hasMatches) {
      const matches = findMatches(tempBoard);
      if (matches.length > 0) {
        combo++;
        const points = matches.length * 10 * combo;
        setScore(prev => prev + points);

        // 检查道具奖励
        if (matches.length === 4) {
          setItems(prev => ({ ...prev, hammer: prev.hammer + 1 }));
          showReward("获得 1 个神锤！", "🔨");
        } else if (matches.length >= 5) {
          setItems(prev => ({ ...prev, shuffle: prev.shuffle + 1 }));
          showReward("获得 1 个重组！", "🌀");
        } else if (combo === 3) {
          setItems(prev => ({ ...prev, extraMoves: prev.extraMoves + 1 }));
          showReward("三连击！获得 5 步！", "⌛");
        }

        if (settings.vibration) window.navigator?.vibrate?.(20);

        matches.forEach(({row, col}) => {
          if (tempBoard[row][col]) {
            tempBoard[row][col] = { ...tempBoard[row][col]!, isMatched: true };
          }
        });
        setBoard([...tempBoard]);
        await new Promise(r => setTimeout(r, 300));

        matches.forEach(({row, col}) => {
          tempBoard[row][col] = null;
        });
        setBoard([...tempBoard]);
        await new Promise(r => setTimeout(r, 100));

        tempBoard = applyGravity(tempBoard);
        setBoard([...tempBoard]);
        await new Promise(r => setTimeout(r, 400));
      } else {
        hasMatches = false;
      }
    }
    
    setIsResolving(false);
    setStatus('IDLE');
    if (moves <= 0) setStatus('GAMEOVER');
  }, [moves, settings.vibration]);

  const handleTileClick = async (r: number, c: number) => {
    if (status !== 'IDLE' || isResolving) return;

    if (activePowerup === 'hammer') {
      if (items.hammer > 0) {
        const newBoard = board.map(row => [...row]);
        newBoard[r][c] = null;
        setBoard(newBoard);
        setItems(prev => ({ ...prev, hammer: prev.hammer - 1 }));
        setActivePowerup(null);
        // 清除旧的提示，鼓励玩家再次请求
        setAiHint(null);
        resolveBoard(applyGravity(newBoard));
      }
      return;
    }

    if (!selectedTile) {
      setSelectedTile({ r, c });
    } else {
      const { r: r1, c: c1 } = selectedTile;
      if (isAdjacent(r, c, r1, c1)) {
        const newBoard = board.map(row => [...row]);
        const tile1 = newBoard[r1][c1];
        const tile2 = newBoard[r][c];

        if (tile1 && tile2) {
          newBoard[r1][c1] = { ...tile2, row: r1, col: c1 };
          newBoard[r][c] = { ...tile1, row: r, col: c };

          setBoard(newBoard);
          setMoves(prev => prev - 1);
          setSelectedTile(null);
          // 每次移动后清除提示词
          setAiHint(null);

          const matches = findMatches(newBoard);
          if (matches.length > 0) {
            resolveBoard(newBoard);
          } else {
            setTimeout(() => {
              const revertedBoard = board.map(row => [...row]);
              revertedBoard[r1][c1] = { ...tile1, row: r1, col: c1 };
              revertedBoard[r][c] = { ...tile2, row: r, col: c };
              setBoard(revertedBoard);
              setMoves(prev => prev + 1);
            }, 400);
          }
        }
      } else {
        setSelectedTile({ r, c });
      }
    }
  };

  const useShuffle = () => {
    if (items.shuffle > 0 && status === 'IDLE' && !isResolving) {
      const newBoard = shuffleBoard(board);
      setBoard(newBoard);
      setItems(prev => ({ ...prev, shuffle: prev.shuffle - 1 }));
      setShowItems(false);
      setAiHint(null);
      resolveBoard(newBoard);
    }
  };

  const useExtraMoves = () => {
    if (items.extraMoves > 0) {
      setMoves(prev => prev + 5);
      setItems(prev => ({ ...prev, extraMoves: prev.extraMoves - 1 }));
      setShowItems(false);
      showReward("步数已增加！", "⌛");
    }
  };

  const resetGame = () => {
    setBoard(createBoard());
    setScore(0);
    setMoves(MAX_MOVES);
    setItems(INITIAL_ITEMS);
    setStatus('IDLE');
    setSelectedTile(null);
    setAiHint(null);
    setActivePowerup(null);
  };

  const clearData = () => {
    if (confirm("确定要重置所有最高分和道具吗？")) {
      setHighScore(0);
      setItems(INITIAL_ITEMS);
      localStorage.clear();
      resetGame();
      setShowSettings(false);
    }
  };

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('match3_highscore', score.toString());
    }
  }, [score, highScore]);

  return (
    <div className={`flex flex-col h-screen max-w-md mx-auto bg-slate-900 text-white font-sans overflow-hidden transition-all ${activePowerup === 'hammer' ? 'ring-4 ring-rose-500 ring-inset' : ''}`}>
      {/* 顶部奖励提示 (Toast) */}
      {rewardToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] animate-bounce pointer-events-none">
          <div className="bg-yellow-500 text-slate-900 px-6 py-3 rounded-full font-black shadow-2xl flex items-center gap-3 border-4 border-white/20">
            <span className="text-2xl">{rewardToast.icon}</span>
            <span className="whitespace-nowrap">{rewardToast.text}</span>
          </div>
        </div>
      )}

      {/* 顶部标题栏 */}
      <div className="p-4 flex justify-between items-center bg-slate-800 shadow-lg z-10 border-b border-white/5">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">得分</span>
          <span className="text-2xl font-black text-yellow-400 drop-shadow-sm">{score.toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-center">
          <div className={`px-4 py-1 rounded-full ${moves < 5 ? 'bg-rose-500 animate-pulse' : 'bg-slate-700'}`}>
            <span className="text-xl font-black text-white">{moves}</span>
            <span className="ml-1 text-[10px] uppercase opacity-60">步</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">最高分</span>
          <span className="text-xl font-bold text-emerald-400">{highScore.toLocaleString()}</span>
        </div>
      </div>

      {/* AI 建议栏 (按钮功能恢复，初始文案优化) */}
      <div className="px-4 py-2 bg-indigo-950/60 text-xs flex items-center justify-between backdrop-blur-md h-12">
        <div className="flex items-center gap-3 overflow-hidden flex-1">
          <div className={`w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0 ${loadingHint ? 'animate-bounce' : ''}`}>
            🤖
          </div>
          <p className="italic text-indigo-100 truncate pr-2">
            {loadingHint 
              ? "正在分析星云轨迹..." 
              : (aiHint || "你知道吗？四连消除可以获得奖励哦！")}
          </p>
        </div>
        <button 
          onClick={getAiHint}
          disabled={loadingHint || moves <= 0 || status !== 'IDLE' || isResolving}
          className="bg-indigo-600/50 border border-indigo-400/30 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all whitespace-nowrap shrink-0 ml-2 shadow-inner"
        >
          {aiHint ? '更新建议' : '获取提示'}
        </button>
      </div>

      {/* 棋盘区域 */}
      <div className="flex-1 p-3 flex items-center justify-center bg-slate-950 relative">
        <div className="w-full aspect-square grid grid-cols-8 gap-1.5 p-2 bg-slate-800/50 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 relative">
          {board.map((row, r) => 
            row.map((tile, c) => (
              <Tile
                key={tile?.id || `empty-${r}-${c}`}
                tile={tile}
                isSelected={selectedTile?.r === r && selectedTile?.c === c}
                isMatched={tile?.isMatched || false}
                onClick={() => handleTileClick(r, c)}
              />
            ))
          )}

          {activePowerup === 'hammer' && (
             <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-rose-500/10 z-20">
                <span className="text-2xl animate-pulse drop-shadow-xl font-bold bg-slate-900/50 px-4 py-2 rounded-xl border border-rose-500">🔨 请粉碎一个方块</span>
             </div>
          )}

          {status === 'GAMEOVER' && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-50 backdrop-blur-md animate-in fade-in duration-500">
              <div className="text-6xl mb-2">🏁</div>
              <h2 className="text-5xl font-black text-white mb-1 tracking-tighter italic">挑战结束</h2>
              <p className="text-slate-400 text-lg mb-8 bg-white/5 px-6 py-1 rounded-full">最终得分: <span className="text-yellow-400 font-bold">{score}</span></p>
              <button 
                onClick={resetGame}
                className="bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-900 font-black px-12 py-4 rounded-2xl text-xl shadow-[0_10px_20px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 transition-all"
              >
                再来一局
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 底部控制栏 */}
      <div className="p-6 bg-slate-900 border-t border-white/5 grid grid-cols-3 gap-4">
        <button 
          onClick={() => setShowItems(true)}
          className="group bg-slate-800 p-4 rounded-3xl flex flex-col items-center gap-2 hover:bg-indigo-600 transition-all active:scale-90 relative"
        >
          <span className="text-3xl filter drop-shadow-md">🎒</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">道具</span>
          <div className="absolute -top-1 -right-1 bg-rose-500 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900">
            {Object.values(items).reduce((a: number, b: number) => a + b, 0)}
          </div>
        </button>
        <button 
          onClick={resetGame}
          className="bg-slate-800 p-4 rounded-3xl flex flex-col items-center gap-2 hover:bg-amber-500 transition-all active:scale-90"
        >
          <span className="text-3xl">🔄</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">重新开始</span>
        </button>
        <button 
          onClick={() => setShowSettings(true)}
          className="bg-slate-800 p-4 rounded-3xl flex flex-col items-center gap-2 hover:bg-slate-600 transition-all active:scale-90"
        >
          <span className="text-3xl">⚙️</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-white">设置</span>
        </button>
      </div>

      {/* 道具面板 */}
      {showItems && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-in slide-in-from-bottom duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowItems(false)} />
          <div className="relative w-full bg-slate-800 rounded-t-[3rem] p-8 border-t border-white/10 shadow-2xl">
            <div className="w-12 h-1.5 bg-slate-600 rounded-full mx-auto mb-8" onClick={() => setShowItems(false)} />
            <h3 className="text-2xl font-black mb-6 flex items-center gap-2">
              <span>战备箱</span>
              <span className="text-sm font-normal text-slate-400 italic">达成多连消可获赠奖励</span>
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <button 
                onClick={() => { setActivePowerup('hammer'); setShowItems(false); }}
                disabled={items.hammer <= 0}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl bg-slate-700 hover:bg-slate-600 transition-all ${items.hammer <= 0 ? 'opacity-40' : 'active:scale-95'}`}
              >
                <span className="text-4xl">🔨</span>
                <span className="font-bold text-xs uppercase">神锤</span>
                <span className="bg-slate-900 px-3 py-1 rounded-full text-indigo-400 text-xs font-black">x{items.hammer}</span>
              </button>
              <button 
                onClick={useShuffle}
                disabled={items.shuffle <= 0}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl bg-slate-700 hover:bg-slate-600 transition-all ${items.shuffle <= 0 ? 'opacity-40' : 'active:scale-95'}`}
              >
                <span className="text-4xl">🌀</span>
                <span className="font-bold text-xs uppercase">重组</span>
                <span className="bg-slate-900 px-3 py-1 rounded-full text-indigo-400 text-xs font-black">x{items.shuffle}</span>
              </button>
              <button 
                onClick={useExtraMoves}
                disabled={items.extraMoves <= 0}
                className={`flex flex-col items-center gap-3 p-4 rounded-3xl bg-slate-700 hover:bg-slate-600 transition-all ${items.extraMoves <= 0 ? 'opacity-40' : 'active:scale-95'}`}
              >
                <span className="text-4xl">⌛</span>
                <span className="font-bold text-xs uppercase">+5 步</span>
                <span className="bg-slate-900 px-3 py-1 rounded-full text-indigo-400 text-xs font-black">x{items.extraMoves}</span>
              </button>
            </div>
            <button 
              onClick={() => setShowItems(false)}
              className="w-full mt-10 bg-slate-700 py-4 rounded-2xl font-bold text-slate-400 hover:text-white transition-colors"
            >
              继续游戏
            </button>
          </div>
        </div>
      )}

      {/* 设置面板 */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-200">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-sm bg-slate-800 rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
            <h3 className="text-3xl font-black mb-8 text-center italic">控制面板</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-700/50 p-4 rounded-2xl">
                <span className="font-bold uppercase tracking-widest text-sm flex items-center gap-3">
                  <span className="text-xl">🎵</span> 环境音乐
                </span>
                <div 
                  onClick={() => setSettings(s => ({...s, music: !s.music}))}
                  className={`w-14 h-8 rounded-full transition-all relative cursor-pointer ${settings.music ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings.music ? 'left-7' : 'left-1'}`} />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-700/50 p-4 rounded-2xl">
                <span className="font-bold uppercase tracking-widest text-sm flex items-center gap-3">
                  <span className="text-xl">🔊</span> 动作音效
                </span>
                <div 
                  onClick={() => setSettings(s => ({...s, sound: !s.sound}))}
                  className={`w-14 h-8 rounded-full transition-all relative cursor-pointer ${settings.sound ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings.sound ? 'left-7' : 'left-1'}`} />
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-700/50 p-4 rounded-2xl">
                <span className="font-bold uppercase tracking-widest text-sm flex items-center gap-3">
                  <span className="text-xl">📳</span> 触感反馈
                </span>
                <div 
                  onClick={() => setSettings(s => ({...s, vibration: !s.vibration}))}
                  className={`w-14 h-8 rounded-full transition-all relative cursor-pointer ${settings.vibration ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings.vibration ? 'left-7' : 'left-1'}`} />
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3">
              <button 
                onClick={clearData}
                className="w-full bg-rose-500/10 text-rose-400 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
              >
                重置星图记录
              </button>
              <button 
                onClick={() => setShowSettings(false)}
                className="w-full bg-slate-700 py-4 rounded-2xl font-bold text-white transition-all hover:bg-slate-600"
              >
                保存并退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
