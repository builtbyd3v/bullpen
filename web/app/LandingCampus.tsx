"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore} from "react";
import { connect } from "@/lib/server.ts";
import { createStore } from "@/lib/store.ts";
import { useNow } from "./useNow";

const Campus = dynamic(() => import("./Campus"), { ssr: false });


type ChipProps = { color: string; children: React.ReactNode; detail: string };

// Evidence chip from the mockup's rail (.chip in landing.css).
function Chip({ color, children, detail }: ChipProps) {
  return (
    <div className="chip">
      <i style={{ background: color }} />
      <span>
        {children}
        <small>{detail}</small>
      </span>
    </div>
  );
}

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
    <div className="stage">
      <div className="stage-cv">
        <div className="aspect-[960/640] w-full">
          <Campus store={store} />
        </div>
      </div>
      <aside className="rail" aria-label="Live evidence">
        <div className="rail-head">
          <span className="live">live</span>
          <span>GET /state</span>
        </div>
        {empty ? (
          <p className="rail-foot">All quiet. Leases, the wait queue, referee checks and commits appear here as agents work.</p>
        ) : (
          <>
            {lease && (
              <Chip color={colorOf(lease.agent)} detail={ttl === null ? "lease" : `lease, ${ttl} s left`}>
                <b>{lease.agent}</b> holds <b>{lease.file}</b>
              </Chip>
            )}
            {waited && (
              <Chip color={colorOf(waited.waiters[0])} detail={`queue for ${waited.file}`}>
                <b>{waited.waiters[0]}</b> waits at the door, #1
              </Chip>
            )}
            {check && (
              <Chip color="#CFC493" detail={`rule ${check.rule}, ${check.latency_ms} ms, model ${check.model || "rules"}`}>
                Jetson: <b className="tag-ask">{check.decision}</b> {check.file}
              </Chip>
            )}
            {commit && (
              <Chip color={colorOf(commit.agent)} detail={`Bullpen-Agent: ${commit.agent}${commit.task ? `, Bullpen-Task: ${commit.task}` : ""}`}>
                commit <b>{commit.sha.slice(0, 7)}</b>
              </Chip>
            )}
          </>
        )}
        <p className="rail-foot">Live from your repo: leases, queue, referee checks and commits.</p>
      </aside>
    </div>
  );
}
