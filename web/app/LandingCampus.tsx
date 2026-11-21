"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { connect } from "@/lib/server.ts";
import { createStore } from "@/lib/store.ts";
import { useNow } from "./useNow";

const Campus = dynamic(() => import("./Campus"), { ssr: false });

// Agent colors come from the server, so a CSS variable is the one unavoidable inline style.
const dot = (color: string) => ({ "--agent": color }) as CSSProperties;

type ChipProps = { color: string; children: React.ReactNode; detail: string };

function Chip({ color, children, detail }: ChipProps) {
  return (
    <li style={dot(color)} className="flex gap-3 rounded-md border border-white/10 bg-[#06140e] p-3">
      <i aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-(--agent)" />
      <span className="min-w-0 break-words text-[15px]">
        {children}
        <span className="block font-mono text-[13px] text-white/70">{detail}</span>
      </span>
    </li>
  );
}

const DECISION = { allow: "text-[#4cc38a]", ask: "text-[#CFC493]", deny: "text-[#ff6369]" } as const;

export default function LandingCampus() {
  const [store] = useState(createStore);
  useEffect(() => connect(store), [store]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const now = useNow(1000);

  const { worktrees, leases = [] } = state.data;
  const colorOf = (agent: string) => worktrees.find((w) => w.agent === agent)?.color ?? "#CFC493";
  const lease = leases[0];
  const waited = leases.find((l) => l.waiters.length > 0);
  const check = state.checks.at(-1);
  const commit = worktrees
    .flatMap((w) => w.commits.map((c) => ({ ...c, agent: w.agent })))
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))[0];
  const ttl = lease && now ? Math.max(0, Math.round((Date.parse(lease.expires_at) - now) / 1000)) : null;
  const empty = !lease && !waited && !check && !commit;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
      <div className="aspect-[960/640] w-full overflow-hidden rounded-lg border border-[#CFC493]/25 bg-[#0d1b14]">
        <Campus store={store} />
      </div>
      <aside aria-label="Live evidence" className="grid content-start gap-3 rounded-lg border border-white/10 bg-[#0d231b] p-4">
        <div className="flex items-center justify-between text-[13px] text-white/70">
          <span className="flex items-center gap-2 font-semibold text-[#EDEBD1]">
            <i aria-hidden className="size-2 rounded-full bg-[#4cc38a]" />
            Live
          </span>
          <span className="font-mono">GET /state</span>
        </div>
        {empty ? (
          <p className="text-[15px] text-white/70">All quiet. Leases, the wait queue, referee checks and commits appear here as agents work.</p>
        ) : (
          <ul className="grid gap-2">
            {lease && (
              <Chip color={colorOf(lease.agent)} detail={ttl === null ? "lease" : `lease, ${ttl} s left`}>
                <b>{lease.agent}</b> holds <b className="font-mono">{lease.file}</b>
              </Chip>
            )}
            {waited && (
              <Chip color={colorOf(waited.waiters[0])} detail={`queue for ${waited.file}`}>
                <b>{waited.waiters[0]}</b> waits, #1
              </Chip>
            )}
            {check && (
              <Chip color="#CFC493" detail={`rule ${check.rule}, ${check.latency_ms} ms, ${check.model}`}>
                Jetson: <b className={DECISION[check.decision]}>{check.decision}</b>{" "}
                <span className="font-mono">{check.file}</span>
              </Chip>
            )}
            {commit && (
              <Chip color={colorOf(commit.agent)} detail={`Bullpen-Agent: ${commit.agent}${commit.task ? `, Bullpen-Task: ${commit.task}` : ""}`}>
                commit <b className="font-mono">{commit.sha.slice(0, 7)}</b>
              </Chip>
            )}
          </ul>
        )}
        <p className="text-[13px] text-white/70">Live from your repo: leases, queue, referee checks and commits.</p>
      </aside>
    </div>
  );
}
