"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AppNav } from "./AppNav";
import { HealthStrip } from "./HealthStrip";
import { hunkRanges, intersect, overlaps, type LineRange, type Overlap } from "@/lib/overlap.ts";
import { act, connect, fetchDiff } from "@/lib/server.ts";
import { createStore, type Store, type StoreState } from "@/lib/store.ts";
import type { Worktree } from "@/lib/types.ts";

const time = (at: string) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const fmtRanges = (r: LineRange[]) => r.map((x) => (x.start === x.end ? `${x.start}` : `${x.start}-${x.end}`)).join(", ");
const inRanges = (n: number, r: LineRange[]) => r.some((x) => n >= x.start && n <= x.end);
const lastTouch = (w: Worktree | undefined, file: string) =>
  Math.max(0, ...(w?.commits ?? []).filter((c) => c.files.includes(file) && c.at).map((c) => Date.parse(c.at!)));

function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
}

// Land first: the lease holder on the file, else the branch whose latest commit on it is older.
function landOrder(state: StoreState, ov: Overlap): { first: string; other: string; why: string } {
  const [a, b] = ov.agents;
  const holder = state.data.leases?.find((l) => l.file === ov.file && ov.agents.includes(l.agent))?.agent;
  const byAgent = (x: string) => state.data.worktrees.find((w) => w.agent === x);
  if (holder) return { first: holder, other: holder === a ? b : a, why: `${holder} holds the lease on ${ov.file}` };
  const first = lastTouch(byAgent(b), ov.file) < lastTouch(byAgent(a), ov.file) ? b : a;
  return { first, other: first === a ? b : a, why: `${first} changed ${ov.file} first` };
}

type Row = { kind: "hunk" | "ctx" | "add" | "del"; text: string; old?: number; new?: number; hot: boolean };

function parseDiff(diff: string, hot: LineRange[]): Row[] {
  const rows: Row[] = [];
  let o = 0, n = 0;
  for (const line of diff.split("\n")) {
    if (/^(diff --git|index |--- |\+\+\+ )/.test(line)) continue;
    const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
    if (h) {
      o = Number(h[1]);
      n = Number(h[2]);
      rows.push({ kind: "hunk", text: line, hot: false });
    } else if (line.startsWith("+")) rows.push({ kind: "add", text: line.slice(1), new: n, hot: inRanges(n++, hot) });
    else if (line.startsWith("-")) rows.push({ kind: "del", text: line.slice(1), old: o++, hot: inRanges(n, hot) });
    else rows.push({ kind: "ctx", text: line.slice(1), old: o++, new: n++, hot: false });
  }
  return rows;
}

const ROW_CLASS: Record<Row["kind"], string> = {
  hunk: "bg-white/5 text-white/70",
  ctx: "text-white/75",
  add: "bg-emerald-500/15 text-emerald-100",
  del: "bg-red-500/15 text-red-100",
};

function DiffTable({ diff, hot }: { diff: string | undefined; hot: LineRange[] }) {
  if (diff === undefined) return <p className="px-4 py-3 text-[13px] text-white/70">Loading diff…</p>;
  if (!diff) return <p className="px-4 py-3 text-[13px] text-white/70">No diff on this branch.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[13px] leading-6">
        <tbody>
          {parseDiff(diff, hot).map((r, i) => (
            <tr key={i} className={r.hot ? "bg-amber-400/25 text-amber-50" : ROW_CLASS[r.kind]}>
              <td className="w-10 px-2 text-right text-white/60 select-none">{r.old ?? ""}</td>
              <td className="w-10 px-2 text-right text-white/60 select-none">{r.new ?? ""}</td>
              <td className={`w-4 select-none ${r.hot ? "border-l-2 border-amber-400" : ""}`}>
                {r.kind === "add" ? "+" : r.kind === "del" ? "-" : ""}
              </td>
              <td className="pr-4 whitespace-pre">{r.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type CardProps = {
  state: StoreState;
  w: Worktree;
  overlap?: { other: Worktree; file: string; diff: string | undefined; hot: LineRange[] };
};

function PrCard({ state, w, overlap }: CardProps) {
  const allowed = state.checks.filter((c) => c.agent === w.agent && c.decision === "allow").length;
  return (
    <article className="min-w-0 rounded-lg border border-white/10 bg-[#0d231b]">
      <header className="border-b border-white/10 px-4 py-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Dot color={w.color} />
          {w.task || w.branch}
        </h3>
        <p className="mt-1 font-mono text-[13px] text-white/70">
          {w.branch} → main · {w.commits.length} commit{w.commits.length === 1 ? "" : "s"} · {w.changed_files.length} file
          {w.changed_files.length === 1 ? "" : "s"}
        </p>
      </header>
      <ul className="space-y-1.5 px-4 py-3 text-[13px]">
        <li className="flex gap-2 text-white/85">
          <span className="text-emerald-300">✓</span>Clean against main
          <span className="font-mono text-white/70">({w.branch})</span>
        </li>
        <li className="flex gap-2 text-white/85">
          <span className="text-emerald-300">✓</span>Referee: {allowed} check{allowed === 1 ? "" : "s"} allowed
        </li>
        {overlap && (
          <li className="flex gap-2 font-semibold text-red-300">
            <span>✕</span>Overlaps {overlap.other.branch} in <span className="font-mono">{overlap.file}</span>
          </li>
        )}
      </ul>
      {overlap && (
        <div className="border-t border-white/10">
          <p className="px-4 pt-3 pb-1 font-mono text-[13px] text-white/70">{overlap.file}</p>
          <DiffTable diff={overlap.diff} hot={overlap.hot} />
        </div>
      )}
    </article>
  );
}

function Caught({ state, ov }: { state: StoreState; ov: Overlap }) {
  const events = [
    ...state.data.worktrees
      .filter((w) => ov.agents.includes(w.agent))
      .flatMap((w) => w.commits.filter((c) => c.files.includes(ov.file) && c.at).map((c) => ({ at: c.at!, agent: w.agent, what: `committed ${c.sha.slice(0, 7)} "${c.message}"` }))),
    ...state.checks
      .filter((c) => c.file === ov.file && ov.agents.includes(c.agent))
      .map((c) => ({ at: c.at, agent: c.agent, what: `referee ${c.decision} (rule ${c.rule}, ${c.latency_ms} ms)` })),
    ...state.hooks
      .filter((h) => h.target === ov.file && ov.agents.includes(h.agent))
      .map((h) => ({ at: h.at, agent: h.agent, what: `${h.event} ${h.tool}` })),
  ].sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
  const lease = state.data.leases?.find((l) => l.file === ov.file);
  const color = (a: string) => state.data.worktrees.find((w) => w.agent === a)?.color ?? "#888";
  return (
    <section className="rounded-lg border border-white/10 bg-[#0d231b] px-4 py-3">
      <h2 className="mb-2 text-base font-semibold">How it was caught</h2>
      <ol className="space-y-1.5 text-[13px]">
        {events.map((e, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-mono text-white/70">{time(e.at)}</span>
            <Dot color={color(e.agent)} />
            <span className="font-mono">{e.agent}</span>
            <span className="text-white/85">{e.what}</span>
          </li>
        ))}
        {lease && (
          <li className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-mono text-white/70">now</span>
            <Dot color={color(lease.agent)} />
            <span className="font-mono">{lease.agent}</span>
            <span className="text-white/85">
              holds the lease{lease.waiters.length ? `, ${lease.waiters.join(", ")} waiting` : ""}
            </span>
          </li>
        )}
        <li className="flex items-center gap-3 font-semibold text-red-300">
          <span className="w-20 shrink-0 font-mono">now</span>
          Bullpen found both branches changing {ov.file}
        </li>
      </ol>
    </section>
  );
}

export default function PullRequests() {
  const [store] = useState<Store>(createStore);
  useEffect(() => connect(store), [store]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const found = overlaps(state.data.worktrees);
  const ov = found[0];
  const [a, b] = ov?.agents ?? [];
  const wa = state.data.worktrees.find((w) => w.agent === a);
  const wb = state.data.worktrees.find((w) => w.agent === b);

  // Refetch when either branch gets a new head commit.
  const heads = `${wa?.commits[0]?.sha}:${wb?.commits[0]?.sha}`;
  const [diffs, setDiffs] = useState<Record<string, string>>({});
  const file = ov?.file;
  useEffect(() => {
    if (!file || !a || !b || !heads) return;
    let live = true;
    for (const agent of [a, b])
      fetchDiff(agent, file)
        .catch(() => "")
        .then((d) => live && setDiffs((prev) => ({ ...prev, [`${agent}:${file}`]: d })));
    return () => void (live = false);
  }, [a, b, file, heads]);

  const da = ov ? diffs[`${a}:${ov.file}`] : undefined;
  const db = ov ? diffs[`${b}:${ov.file}`] : undefined;
  const hot = da && db ? intersect(hunkRanges(da), hunkRanges(db)) : [];
  const order = ov ? landOrder(state, ov) : null;
  const rest = state.data.worktrees.filter((w) => w.ahead > 0 && w.agent !== a && w.agent !== b);

  return (
    <div className="flex min-h-screen flex-col bg-[#06140e] text-[15px] text-[#EDEBD1]">
      <HealthStrip store={store} health={state.health} latestCheck={state.checks[0]} replaying={state.replaying} />
      <AppNav conflicts={found.length} />
      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
        <h1 className="text-xl font-bold">Pull requests</h1>

        {ov && wa && wb && order ? (
          <>
            <section className="rounded-lg border border-white/10 border-l-4 border-l-red-500 bg-[#0d231b] px-5 py-4">
              <h2 className="text-lg font-bold">
                {wa.branch} and {wb.branch} both change <span className="font-mono">{ov.file}</span>
              </h2>
              <p className="mt-1 text-white/85">
                {hot.length ? (
                  <>
                    Both rewrite lines <span className="font-mono">{fmtRanges(hot)}</span>.{" "}
                  </>
                ) : null}
                Each branch merges into main cleanly on its own, but together they collide.
              </p>
              <p className="mt-2 text-white/85">
                Land <span className="font-mono">{order.first}</span> first: {order.why}. Then{" "}
                <span className="font-mono">{order.other}</span> rebases on top, or undo it and let it redo the edit.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => act(store, { kind: "merge", agent: order.first })}
                  className="rounded-md bg-[#006747] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00805a]"
                >
                  Land {order.first} first
                </button>
                <button
                  type="button"
                  onClick={() => act(store, { kind: "undo", agent: order.other })}
                  className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
                >
                  Undo {order.other}
                </button>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <PrCard state={state} w={wa} overlap={{ other: wb, file: ov.file, diff: da, hot }} />
              <PrCard state={state} w={wb} overlap={{ other: wa, file: ov.file, diff: db, hot }} />
            </div>

            <Caught state={state} ov={ov} />
          </>
        ) : (
          <section className="rounded-lg border border-white/10 bg-[#0d231b] px-5 py-4 text-white/85">
            No two agent branches touch the same file.
          </section>
        )}

        {rest.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((w) => (
              <PrCard key={w.agent} state={state} w={w} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
