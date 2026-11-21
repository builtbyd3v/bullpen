"use client";

import { useEffect, useState } from "react";

type ProblemOpenerProps = {
  open: boolean;
  onClose: () => void;
};

const TOTAL_MS = 10_000;

// 10-second scripted opener (Issue #34 / Beat 1 in docs/DEMO.md):
// Two agents overwrite auth.ts -> work is gone, no history -> "Now with Bullpen" card.
export function ProblemOpener({ open, onClose }: ProblemOpenerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open) return;
    const startedAt = performance.now();
    const id = window.setInterval(() => {
      const ms = performance.now() - startedAt;
      if (ms >= TOTAL_MS) {
        setElapsed(TOTAL_MS);
        window.clearInterval(id);
        onClose();
      } else {
        setElapsed(ms);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [open, onClose]);

  if (!open) return null;

  const beat = elapsed < 2500 ? 0 : elapsed < 5200 ? 1 : elapsed < 7600 ? 2 : 3;
  const pct = Math.min(100, (elapsed / TOTAL_MS) * 100);
  const sec = Math.min(10, Math.ceil((TOTAL_MS - elapsed) / 1000));

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#08120d]/95 p-6 backdrop-blur-xs">
      <div className="flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-white/15 bg-[#0f1f17] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold tracking-widest text-white/50 uppercase">
            {beat < 3 ? "WITHOUT BULLPEN" : "WITH BULLPEN"} · {sec}s
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/20"
          >
            {beat === 3 ? "Enter Bullpen →" : "Skip"}
          </button>
        </div>

        {beat < 3 ? (
          <>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {beat === 0 && "Git was built for humans."}
                {beat === 1 && "Two agents overwrite shared/auth.ts."}
                {beat === 2 && "The work is gone — and there is no history."}
              </h2>
              <p className="mt-1 text-sm text-white/70">
                {beat === 0 && "Two coding agents edit the same shared file at the exact same time with no locks and no referee."}
                {beat === 1 && "api writes verifyToken(), then web saves right over it. Neither agent knows."}
                {beat === 2 && "No blame, no waiting line, no way to undo just one agent's work."}
              </p>
            </div>

            {/* Scene-style building & colliding agents diagram */}
            <div className="relative flex flex-col items-center rounded-lg border border-white/10 bg-[#0b1711] p-5">
              <div
                className={`flex w-72 flex-col items-center rounded-md border-2 px-4 py-3 font-mono transition-colors duration-300 ${
                  beat >= 1 ? "border-red-500 bg-red-950/50" : "border-emerald-400/60 bg-[#1f3a2e]"
                }`}
              >
                <span className="text-sm font-bold text-white">shared/auth.ts</span>
                <span className="mt-1 text-xs text-white/60">
                  {beat === 0 && "2 agents editing simultaneously"}
                  {beat === 1 && "OVERWRITTEN — api's edit wiped!"}
                  {beat === 2 && "LOST EDITS · 0 AUDIT TRAIL"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-center gap-12 font-mono text-xs">
                <div
                  className={`flex items-center gap-2 rounded-full border border-[#e5484d] bg-[#e5484d]/20 px-3 py-1.5 font-bold text-[#ff8a8e] transition-opacity duration-300 ${
                    beat === 2 ? "opacity-40 line-through" : "opacity-100"
                  }`}
                >
                  <span className="size-2.5 rounded-full bg-[#e5484d]" />
                  api → auth.ts
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[#3e63dd] bg-[#3e63dd]/20 px-3 py-1.5 font-bold text-[#93b4ff]">
                  <span className="size-2.5 rounded-full bg-[#3e63dd]" />
                  web → auth.ts
                </div>
              </div>

              <div className="mt-4 w-full rounded border border-white/10 bg-black/40 p-3 font-mono text-xs">
                {beat === 0 && (
                  <>
                    <p className="text-[#ff8a8e]">[api] writing verifyToken() to shared/auth.ts...</p>
                    <p className="text-[#93b4ff]">[web] writing parseSession() to shared/auth.ts...</p>
                  </>
                )}
                {beat === 1 && (
                  <>
                    <p className="text-red-400">- export function verifyToken(jwt: string) {"{ ... }"}  // overwritten by web</p>
                    <p className="text-[#93b4ff]">+ export function parseSession(cookie: string) {"{ ... }"}</p>
                  </>
                )}
                {beat === 2 && (
                  <div className="flex items-center justify-between text-red-300">
                    <span>git log shared/auth.ts → (no agent commit history)</span>
                    <span className="rounded bg-red-500/20 px-2 py-0.5 font-bold text-red-300">WORK LOST</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center rounded-xl border-2 border-emerald-400/70 bg-emerald-950/40 px-6 py-8 text-center">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-xs font-bold tracking-widest text-emerald-300 uppercase">
              Now with Bullpen
            </span>
            <h2 className="mt-3 text-3xl font-bold text-white">Now the same run with Bullpen.</h2>
            <p className="mt-2 max-w-lg text-sm text-white/80">
              File locks keep agents from colliding, the Jetson referee enforces guarded zones, and every edit auto-commits per agent.
            </p>
            <div className="mt-5 grid w-full grid-cols-3 gap-3 font-mono text-xs">
              <div className="rounded-lg border border-emerald-400/30 bg-black/30 p-3">
                <p className="font-bold text-emerald-300">Locks</p>
                <p className="mt-1 text-white/60">Wait at the door instead of overwriting</p>
              </div>
              <div className="rounded-lg border border-emerald-400/30 bg-black/30 p-3">
                <p className="font-bold text-emerald-300">Jetson Referee</p>
                <p className="mt-1 text-white/60">Hardware guardrails &amp; fail-closed checks</p>
              </div>
              <div className="rounded-lg border border-emerald-400/30 bg-black/30 p-3">
                <p className="font-bold text-emerald-300">Per-Agent Undo</p>
                <p className="mt-1 text-white/60">Roll back one agent cleanly in git</p>
              </div>
            </div>
          </div>
        )}

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full transition-all duration-75 ${beat < 3 ? "bg-red-400" : "bg-emerald-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
