"use client";

import { useEffect, useState } from "react";

type TimerProps = {
  duration: number;
  running: boolean;
  startTime: number | null;
  onComplete?: () => void;
};

export default function Timer({
  duration,
  running,
  startTime,
  onComplete,
}: TimerProps) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    if (!running || !startTime) {
      setRemaining(duration);
      return;
    }

    function updateTimer() {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      const nextRemaining = Math.max(duration - elapsed, 0);

      setRemaining(nextRemaining);

      if (nextRemaining <= 0) {
        onComplete?.();
      }
    }

    updateTimer();

    const interval = setInterval(updateTimer, 250);

    return () => {
      clearInterval(interval);
    };
  }, [duration, running, startTime, onComplete]);

  const minutes = Math.floor(remaining / 60);

  const seconds = remaining % 60;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Time
      </p>

      <p className="font-mono text-xl font-bold text-gray-900">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </p>
    </div>
  );
}
