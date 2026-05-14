'use client';

import { useStore } from "@/src/state/useStore";
import { Trophy, TrendingUp, Award } from "lucide-react";
import { useMemo } from "react";

interface LeaderboardEntry {
  username: string;
  teamType: "player" | "enemy";
  damage: number;
  kills: number;
  unitsSpawned: number;
  healing?: number;
}

export function Leaderboard() {
  const { liveStats } = useStore((s) => ({
    liveStats: s.liveStats,
  }));

  // Calculate leaderboard data
  const leaderboardData = useMemo(() => {
    const entries: LeaderboardEntry[] = [];

    // Process player damage
    Object.entries(liveStats.playerDamage).forEach(([username, damage]) => {
      entries.push({
        username,
        teamType: "player",
        damage,
        kills: liveStats.playerKills[username] || 0,
        unitsSpawned: liveStats.unitsSpawned[username] || 0,
      });
    });

    // Process enemy damage
    Object.entries(liveStats.enemyDamage).forEach(([username, damage]) => {
      entries.push({
        username,
        teamType: "enemy",
        damage,
        kills: liveStats.enemyKills[username] || 0,
        unitsSpawned: liveStats.unitsSpawned[username] || 0,
      });
    });

    // Sort by damage dealt (descending)
    return entries.sort((a, b) => b.damage - a.damage).slice(0, 10);
  }, [liveStats]);

  const playerTeam = leaderboardData.filter((e) => e.teamType === "player");
  const enemyTeam = leaderboardData.filter((e) => e.teamType === "enemy");

  const renderTeam = (team: LeaderboardEntry[], teamName: string, teamColor: string) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg">
        <Trophy size={16} className={teamColor} />
        <h3 className="text-sm font-black uppercase tracking-widest text-gray-200">
          {teamName}
        </h3>
        <span className="ml-auto text-xs font-bold text-gray-400">
          {team.length} USERS
        </span>
      </div>

      <div className="space-y-2">
        {team.length === 0 ? (
          <div className="text-center py-4 text-gray-400 text-xs">
            No activity yet
          </div>
        ) : (
          team.map((entry, idx) => (
            <div
              key={`${entry.teamType}-${entry.username}`}
              className={`p-3 rounded-lg border transition-all ${
                entry.teamType === "player"
                  ? "bg-blue-50/5 border-blue-200/20 hover:bg-blue-50/10"
                  : "bg-red-50/5 border-red-200/20 hover:bg-red-50/10"
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-black text-gray-400">
                    #{idx + 1}
                  </span>
                  <span className={`text-sm font-bold truncate ${
                    entry.teamType === "player"
                      ? "text-blue-600"
                      : "text-red-600"
                  }`}>
                    {entry.username}
                  </span>
                </div>
                {idx === 0 && <Award size={16} className="text-amber-400 flex-shrink-0" />}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-50/50 border border-yellow-200/30 rounded p-2">
                  <div className="text-yellow-700 font-black">
                    {Math.round(entry.damage)}
                  </div>
                  <div className="text-yellow-600 text-[10px] font-bold uppercase">
                    DMG
                  </div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-red-50/50 border border-red-200/30 rounded p-2">
                  <div className="text-red-700 font-black">
                    {entry.kills}
                  </div>
                  <div className="text-red-600 text-[10px] font-bold uppercase">
                    KILLS
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-50/50 border border-purple-200/30 rounded p-2">
                  <div className="text-purple-700 font-black">
                    {entry.unitsSpawned}
                  </div>
                  <div className="text-purple-600 text-[10px] font-bold uppercase">
                    ARMY
                  </div>
                </div>
              </div>

              {/* Damage bar */}
              <div className="mt-2 h-1.5 bg-gray-200/20 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    entry.teamType === "player"
                      ? "bg-blue-500"
                      : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      (entry.damage / (leaderboardData[0]?.damage || 1)) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg">
            <Trophy size={20} className="text-white" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
            LEADERBOARD
          </h2>
        </div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
          Top Contributors & Battle Stats
        </p>
      </div>

      {/* Main leaderboard */}
      <div className="grid md:grid-cols-2 gap-6 px-4">
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
          {renderTeam(playerTeam, "PIHAK A", "text-blue-500")}
        </div>
        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-lg">
          {renderTeam(enemyTeam, "PIHAK B", "text-red-500")}
        </div>
      </div>

      {/* Team Summary */}
      <div className="grid md:grid-cols-2 gap-4 px-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-50/50 rounded-xl p-4 border border-blue-200/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-blue-700 uppercase tracking-wider">
              Pihak A Total
            </span>
            <TrendingUp size={16} className="text-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-2xl font-black text-blue-700">
                {Math.round(
                  Object.values(liveStats.playerDamage).reduce((a, b) => a + b, 0)
                )}
              </div>
              <div className="text-xs font-bold text-blue-600">Damage</div>
            </div>
            <div>
              <div className="text-2xl font-black text-blue-700">
                {Object.values(liveStats.playerKills).reduce((a, b) => a + b, 0)}
              </div>
              <div className="text-xs font-bold text-blue-600">Kills</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-50/50 rounded-xl p-4 border border-red-200/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-red-700 uppercase tracking-wider">
              Pihak B Total
            </span>
            <TrendingUp size={16} className="text-red-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-2xl font-black text-red-700">
                {Math.round(
                  Object.values(liveStats.enemyDamage).reduce((a, b) => a + b, 0)
                )}
              </div>
              <div className="text-xs font-bold text-red-600">Damage</div>
            </div>
            <div>
              <div className="text-2xl font-black text-red-700">
                {Object.values(liveStats.enemyKills).reduce((a, b) => a + b, 0)}
              </div>
              <div className="text-xs font-bold text-red-600">Kills</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
