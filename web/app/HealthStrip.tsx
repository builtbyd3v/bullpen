"use client";

import { triggerReplay } from "@/lib/server.ts";
import type { Store } from "@/lib/store.ts";
import type { CheckEvent, HealthState, HealthStatus } from "@/lib/types.ts";

const DOT_CLASS: Record<HealthStatus, string> = {
  ok: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.75)]",
  down: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.75)]",
  checking: "bg-amber-400 animate-pulse",
};

const TEXT_CLASS: Record<HealthStatus, string> = {
  ok: "text-emerald-300",
  down: "text-red-300",
  checking: "text-amber-200",
};

type PillProps = {
  label: string;
  status: HealthStatus;
  detail?: string;
  pending?: string;
};

function HealthPill({ label, status, detail, pending = "checking" }: PillProps) {
  const statusLabel = status === "ok" ? (detail ?? "ok") : status === "down" ? "offline" : pending;
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-mono text-xs">
      <span className={`size-2 rounded-full ${DOT_CLASS[status]}`} aria-hidden="true" />
      <span className="text-white/75">{label}</span>
      <span className={`font-semibold ${TEXT_CLASS[status]}`}>{statusLabel}</span>
    </div>
  );
}

type HealthStripProps = {
  store: Store;
  health: HealthState;
  latestCheck: CheckEvent | undefined;
  replaying: boolean;
};

// Issue #19: top health strip + REPLAY label. Jetson and model come from the latest `check` event:
// rule "offline" means the server could not reach the Jetson (fail closed).
export function HealthStrip({ store, health, latestCheck, replaying }: HealthStripProps) {
  const jetson: HealthStatus = !latestCheck ? "checking" : latestCheck.rule === "offline" ? "down" : "ok";
  return (
    <header
      aria-label="System health"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#07120d] px-3 py-1.5"
    >
      <span className="mr-1 font-mono text-[11px] font-bold tracking-widest text-white/50 uppercase">Health</span>
      <HealthPill label="Server" status={health.server} />
      <HealthPill label="WebSocket" status={health.ws} detail="connected" />
      <HealthPill label="Jetson" status={jetson} detail={`${latestCheck?.latency_ms ?? 0} ms`} pending="no checks yet" />
      <HealthPill label="Model" status={jetson} detail={latestCheck?.model || "rules"} pending="no checks yet" />
      <HealthPill label="Orchestrator" status={health.orchestrator} />

      <div className="ml-auto flex items-center gap-2">
        {replaying && (
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 rounded-md border border-amber-400/70 bg-amber-500/20 px-2.5 py-0.5 font-mono text-xs font-bold tracking-widest text-amber-200 uppercase"
          >
            <span className="size-2 animate-pulse rounded-full bg-amber-300" aria-hidden="true" />
            REPLAY
          </span>
        )}
        <button
          type="button"
          onClick={() => triggerReplay(store)}
          className="rounded border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-xs font-semibold text-white/70 hover:bg-white/15 hover:text-white"
        >
          {replaying ? "Exit replay" : "Replay"}
        </button>
      </div>
    </header>
  );
}
