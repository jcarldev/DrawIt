"use client";

import type { Player } from "./Lobby";

type PlayerListProps = {
  players: Player[];
  drawerId?: string | null;
  currentPlayerId?: string;
};

export default function PlayerList({
  players,
  drawerId,
  currentPlayerId,
}: PlayerListProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-lg">

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-gray-900">
          Players
        </h2>

        <span className="text-sm text-gray-400">
          {players.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">

        {players.map((player) => {
          const isDrawer =
            player.id === drawerId;

          const isYou =
            player.id === currentPlayerId;

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between rounded-xl p-3 ${
                isYou
                  ? "bg-blue-50"
                  : "bg-gray-50"
              }`}
            >

              <div className="flex items-center gap-3">

                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500 text-sm font-bold text-white">
                  {player.username
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>

                  <div className="flex items-center gap-2">

                    <p className="text-sm font-semibold text-gray-900">
                      {player.username}
                    </p>

                    {isYou && (
                      <span className="text-xs text-blue-500">
                        You
                      </span>
                    )}

                  </div>

                  {isDrawer && (
                    <p className="text-xs text-purple-500">
                      🎨 Drawing
                    </p>
                  )}

                </div>

              </div>

              <span className="text-sm font-bold text-gray-600">
                {player.score}
              </span>

            </div>
          );
        })}

      </div>
    </div>
  );
}