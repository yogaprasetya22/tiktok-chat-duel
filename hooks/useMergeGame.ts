import { useState, useCallback, useMemo, useEffect } from "react";

export interface Unit {
  id: string;
  level: number;
  attack: number;
  hp: number;
  maxHp: number;
  speed: number;
  range: number;
  type: "player" | "enemy";
  status: "idle" | "moving" | "attacking" | "dead";
  targetId?: string;
}

export type Cell = Unit | null;
export type GameState = "IDLE" | "BATTLE_START" | "BATTLE_RUNNING" | "BATTLE_ATTACKING" | "BATTLE_ENDED";

const getStats = (level: number, type: "player" | "enemy") => {
  const baseHp = type === "enemy" ? 80 : 100;
  const baseAtk = type === "enemy" ? 15 : 20;
  
  return {
    hp: Math.floor(baseHp * Math.pow(2.2, level - 1)),
    maxHp: Math.floor(baseHp * Math.pow(2.2, level - 1)),
    attack: Math.floor(baseAtk * Math.pow(2, level - 1)),
    speed: 0.1,
    range: 1.5,
  };
};

export const useMergeGame = () => {
  const [playerGrid, setPlayerGrid] = useState<Cell[]>(Array(16).fill(null));
  const [enemyGrid, setEnemyGrid] = useState<Cell[]>(Array(16).fill(null));
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [gameState, setGameState] = useState<GameState>("IDLE");
  const [result, setResult] = useState<string | null>(null);

  const totalPlayerAttack = useMemo(() => {
    return playerGrid.reduce((sum, cell) => sum + (cell ? cell.attack : 0), 0);
  }, [playerGrid]);

  const generateEnemyWave = useCallback(() => {
    setGameState("IDLE");
    setResult(null);
    setEnemyGrid((prev) => {
      const next = Array(16).fill(null);
      // Spawn 3-6 random enemies
      const count = 3 + Math.floor(Math.random() * 4);
      const indices = Array.from({ length: 16 }, (_, i) => i).sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < count; i++) {
        const level = Math.random() > 0.7 ? 2 : 1;
        const stats = getStats(level, "enemy");
        next[indices[i]] = {
          id: `enemy-${Math.random().toString(36).substring(2, 9)}`,
          level,
          ...stats,
          type: "enemy",
          status: "idle",
        };
      }
      return next;
    });
  }, []);

  const spawnUnit = useCallback((levelOverride?: number) => {
    if (gameState !== "IDLE") return;
    setPlayerGrid((prev) => {
      const emptyIndices = prev
        .map((cell, index) => (cell === null ? index : null))
        .filter((val): val is number => val !== null);

      if (emptyIndices.length === 0) return prev;
      const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      const level = levelOverride || (Math.random() > 0.8 ? 2 : 1);
      const stats = getStats(level, "player");
      
      const newUnit: Unit = {
        id: `player-${Math.random().toString(36).substring(2, 9)}`,
        level,
        ...stats,
        type: "player",
        status: "idle",
      };

      const newGrid = [...prev];
      newGrid[randomIndex] = newUnit;
      return newGrid;
    });
  }, [gameState]);

  const handleCellClick = useCallback((index: number) => {
    if (gameState !== "IDLE") return;

    if (!playerGrid[index]) {
      setSelectedIndices([]);
      return;
    }

    setSelectedIndices((prev) => {
      if (prev.includes(index)) return prev.filter((i) => i !== index);
      const newSelected = [...prev, index];
      
      if (newSelected.length === 2) {
        const [idx1, idx2] = newSelected;
        const u1 = playerGrid[idx1];
        const u2 = playerGrid[idx2];

        if (u1 && u2 && u1.level === u2.level && u1.level < 5) {
          setPlayerGrid((currentGrid) => {
            const nextGrid = [...currentGrid];
            const nextLevel = u1.level + 1;
            nextGrid[idx1] = {
              ...u1,
              id: `player-${Math.random().toString(36).substring(2, 9)}`,
              level: nextLevel,
              ...getStats(nextLevel, "player"),
            };
            nextGrid[idx2] = null;
            return nextGrid;
          });
          return [];
        } else {
          return [index];
        }
      }
      return newSelected;
    });
  }, [playerGrid, gameState]);

  const startBattle = useCallback(() => {
    if (gameState !== "IDLE") return;
    const hasPlayer = playerGrid.some(v => v !== null);
    const hasEnemy = enemyGrid.some(v => v !== null);
    if (hasPlayer && hasEnemy) {
      setGameState("BATTLE_START");
      setTimeout(() => setGameState("BATTLE_RUNNING"), 100);
    }
  }, [playerGrid, enemyGrid, gameState]);

  // Real-time Battle Simulation Loop
  useEffect(() => {
    if (gameState !== "BATTLE_RUNNING") return;

    const interval = setInterval(() => {
      setPlayerGrid(prevPlayer => {
        setEnemyGrid(prevEnemy => {
          const nextPlayer = [...prevPlayer];
          const nextEnemy = [...prevEnemy];
          
          let playerAlive = false;
          let enemyAlive = false;

          // Simple Combat Logic: Every tick, units closest to each other deal damage
          // This is a simplified O(N^2) simulation for the prototype
          nextPlayer.forEach((u1, i) => {
            if (!u1 || u1.hp <= 0) return;
            playerAlive = true;
            
            // Find closest enemy
            let targetIdx = -1;
            let minDist = Infinity;
            nextEnemy.forEach((u2, j) => {
              if (!u2 || u2.hp <= 0) return;
              enemyAlive = true;
              // Just use any distance or logic for now, we'll assume they move until range
              // For simplicity in the hook, we just reduce HP if targets exist
              targetIdx = j; 
            });

            if (targetIdx !== -1) {
              const target = nextEnemy[targetIdx]!;
              target.hp -= u1.attack * 0.1; // Dealing damage over time
              if (target.hp <= 0) nextEnemy[targetIdx] = null;
            }
          });

          nextEnemy.forEach((u1, i) => {
            if (!u1 || u1.hp <= 0) return;
            enemyAlive = true;
            
            let targetIdx = -1;
            nextPlayer.forEach((u2, j) => {
              if (!u2 || u2.hp <= 0) return;
              targetIdx = j;
            });

            if (targetIdx !== -1) {
              const target = nextPlayer[targetIdx]!;
              target.hp -= u1.attack * 0.1;
              if (target.hp <= 0) nextPlayer[targetIdx] = null;
            }
          });

          if (!enemyAlive && playerAlive) {
            setResult("WIN");
            setGameState("BATTLE_ENDED");
            setTimeout(generateEnemyWave, 3000);
          } else if (!playerAlive && enemyAlive) {
            setResult("LOSE");
            setGameState("BATTLE_ENDED");
            setTimeout(generateEnemyWave, 3000);
          }

          return nextEnemy;
        });
        return [...prevPlayer];
      });
    }, 200);

    return () => clearInterval(interval);
  }, [gameState, generateEnemyWave]);

  // Initial wave
  useEffect(() => {
    if (typeof window !== "undefined") {
      generateEnemyWave();
    }
  }, [generateEnemyWave]);

  return {
    playerGrid,
    enemyGrid,
    selectedIndices,
    gameState,
    result,
    totalPlayerAttack,
    spawnUnit,
    handleCellClick,
    startBattle,
    generateEnemyWave,
    // Aliases for backward compatibility in page.tsx
    grid: playerGrid,
    enemy: enemyGrid.find(u => u !== null) || null,
    totalAttack: totalPlayerAttack,
    resetGame: generateEnemyWave,
  };
};
