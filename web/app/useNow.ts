"use client";

import { useEffect, useState } from "react";

// Wall-clock tick for countdowns (lock timers). Syncs with the clock, an outside system.
// Returns 0 until mounted, so server and first client render agree.
export function useNow(ms: number): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
