"use client";

import "./bp.css";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import campus from "../../campus/campus.json" with { type: "json" };
import { hunkRanges, intersect, overlaps, type LineRange, type Overlap } from "@/lib/overlap.ts";
import { act, connect, fetchDiff } from "@/lib/server.ts";
import { createStore, type Store, type StoreState } from "@/lib/store.ts";
import type { HealthStatus, Worktree } from "@/lib/types.ts";

const time = (at: string) => new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const fmtRanges = (r: LineRange[]) => r.map((x) => (x.start === x.end ? `${x.start}` : `${x.start}-${x.end}`)).join(", ");
const inRanges = (n: number, r: LineRange[]) => r.some((x) => n >= x.start && n <= x.end);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const lastTouch = (w: Worktree | undefined, file: string) =>
  Math.max(0, ...(w?.commits ?? []).filter((c) => c.files.includes(file) && c.at).map((c) => Date.parse(c.at!)));
const noSubscribe = () => () => {};

// Land first: the lease holder on the file, else the branch whose latest commit on it is older.
function landOrder(state: StoreState, ov: Overlap): { first: string; other: string; why: string } {
  const [a, b] = ov.agents;
  const holder = state.data.leases?.find((l) => l.file === ov.file && ov.agents.includes(l.agent))?.agent;
  const byAgent = (x: string) => state.data.worktrees.find((w) => w.agent === x);
  if (holder) return { first: holder, other: holder === a ? b : a, why: `${holder} holds the lease on ${ov.file}.` };
  const first = lastTouch(byAgent(b), ov.file) < lastTouch(byAgent(a), ov.file) ? b : a;
  return { first, other: first === a ? b : a, why: `${first} changed ${ov.file} first.` };
}

type Row = { kind: "hunk" | "ctx" | "add" | "del"; text: string; ln?: number; hot: boolean };

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
    } else if (line.startsWith("+")) rows.push({ kind: "add", text: line.slice(1), ln: n, hot: inRanges(n++, hot) });
    else if (line.startsWith("-")) rows.push({ kind: "del", text: line.slice(1), ln: o++, hot: inRanges(n, hot) });
    else {
      rows.push({ kind: "ctx", text: line.slice(1), ln: n++, hot: false });
      o++;
    }
  }
  return rows;
}

function DiffTable({ diff, hot }: { diff: string | undefined; hot: LineRange[] }) {
  if (diff === undefined) return <div className="note">Loading diff…</div>;
  if (!diff) return <div className="note">No diff on this branch.</div>;
  return (
    <table>
      <tbody>
        {parseDiff(diff, hot).map((r, i) => (
          <tr key={i} className={r.hot ? `${r.kind} hot` : r.kind}>
            <td className="ln">{r.ln ?? ""}</td>
            <td className="code">{r.text}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type CardProps = { state: StoreState; w: Worktree; other: Worktree; file: string; diff: string | undefined; hot: LineRange[] };

function PrCard({ state, w, other, file, diff, hot }: CardProps) {
  const allowed = state.checks.filter((c) => c.agent === w.agent && c.decision === "allow").length;
  return (
    <section className="card pr" aria-label={`Pull request ${w.branch}`}>
      <header>
        <span className="dot" style={{ background: w.color }} />
        <span className="num">{w.branch}</span>
        <span className="title">{w.task || w.branch}</span>
        <span className="tag bad ml-auto">blocked</span>
      </header>
      <div className="meta">
        <code>{w.branch}</code> → <code>main</code> · {plural(w.commits.length, "commit")} · {plural(w.changed_files.length, "file")}
      </div>
      <div className="checks">
        <div className="ok"><span className="ic">✓</span><span>Clean against main</span><small>{w.branch}</small></div>
        <div className="ok"><span className="ic">✓</span><span>Referee: {plural(allowed, "check")} allowed</span><small>Jetson /check</small></div>
        <div className="bad">
          <span className="ic">✗</span>
          <span>Overlaps {other.branch} in {file}</span>
          {hot.length > 0 && <small>L{fmtRanges(hot)}</small>}
        </div>
      </div>
      <div className="diff">
        <div className="fh">{file} <span className="tag warn">overlaps {other.branch}</span></div>
        <DiffTable diff={diff} hot={hot} />
      </div>
    </section>
  );
}

type TlItem = { at: string; agent: string; what: string; detail: string };

function timeline(state: StoreState, ov: Overlap): TlItem[] {
  return [
    ...state.data.worktrees
      .filter((w) => ov.agents.includes(w.agent))
      .flatMap((w) =>
        w.commits
          .filter((c) => c.files.includes(ov.file) && c.at)
          .map((c) => ({ at: c.at!, agent: w.agent, what: `${w.agent} commits "${c.message}"`, detail: `${c.sha.slice(0, 7)} on ${w.branch}` })),
      ),
    ...state.checks
      .filter((c) => c.file === ov.file && ov.agents.includes(c.agent))
      .map((c) => ({ at: c.at, agent: c.agent, what: `referee ${c.decision} for ${c.agent}`, detail: `rule ${c.rule}, ${c.latency_ms} ms` })),
    ...state.hooks
      .filter((h) => h.target === ov.file && ov.agents.includes(h.agent))
      .map((h) => ({ at: h.at, agent: h.agent, what: `${h.agent} ${h.event}`, detail: h.tool })),
  ].sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
}

function Pill({ label, status, detail }: { label: string; status: HealthStatus; detail: string }) {
  const color = status === "ok" ? undefined : status === "down" ? "var(--red)" : "var(--ink-3)";
  return (
    <span className="pill">
      <i style={color ? { background: color } : undefined} />
      {label} <b>{status === "ok" ? detail : status === "down" ? "offline" : "checking"}</b>
    </span>
  );
}

export default function PullRequests() {
  const [store] = useState<Store>(createStore);
  useEffect(() => connect(store), [store]);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const q = useSyncExternalStore(noSubscribe, () => (new URLSearchParams(window.location.search).has("fake") ? "?fake" : ""), () => "");
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
  const events = ov ? timeline(state, ov) : [];
  const caughtAt = events.at(-1)?.at;
  const lease = ov ? state.data.leases?.find((l) => l.file === ov.file) : undefined;
  const color = (x: string) => state.data.worktrees.find((w) => w.agent === x)?.color ?? "var(--ink-3)";
  const check = state.checks[0];
  const jetson: HealthStatus = !check ? "checking" : check.rule === "offline" ? "down" : "ok";
  const span = hot.length ? { start: Math.min(...hot.map((r) => r.start)), end: Math.max(...hot.map((r) => r.end)) } : null;

  return (
    <div className="bp">
      <div className="app">
        <div className="top">
          <Link className="brand" href={`/${q}`}>
            <img src="/logo.svg" alt="" width={24} height={24} className="[image-rendering:pixelated]" />
            Bullpen
          </Link>
          <span className="crumb">
            {campus.repo} <span className="muted">/</span> <b>pull requests</b>
          </span>
          <div className="health" role="status" aria-label="System health">
            <Pill label="Server" status={state.health.server} detail=":8600" />
            <Pill label="WebSocket" status={state.health.ws} detail="live" />
            <Pill label="Jetson" status={jetson} detail={`${check?.latency_ms ?? 0} ms`} />
            <Pill label="Orchestrator" status={state.health.orchestrator} detail=":8650" />
          </div>
        </div>
        <nav className="nav" aria-label="Views">
          <Link href={`/campus${q}`}>Campus</Link>
          <Link href={`/prs${q}`} aria-current="page">
            Pull requests {found.length > 0 && <span className="n bad">{plural(found.length, "conflict")}</span>}
          </Link>
          <a href="#">History</a>
          <Link href={`/settings${q}`}>Settings</Link>
        </nav>

        <div className="wrapx">
          {ov && wa && wb && order ? (
            <>
              <section className="verdict" aria-label="Bullpen verdict">
                <div className="l">
                  <span>
                    <span className="tag bad">cross-PR conflict</span>{" "}
                    {caughtAt && <span className="muted mono text-[12.5px]">caught {time(caughtAt)}</span>}
                  </span>
                  <h1>
                    {wa.branch} and {wb.branch} both change <span className="mono">{ov.file}</span>
                    {span && (span.start === span.end ? ` line ${span.start}` : ` lines ${span.start} to ${span.end}`)}
                  </h1>
                  <p>
                    Each branch merges cleanly into <span className="mono">main</span> on its own, so both look green. Merge either
                    one and the other breaks: both rewrite the same lines of <span className="mono">{ov.file}</span>.
                  </p>
                </div>
                <div className="r">
                  <h2>Bullpen recommends</h2>
                  <span className="big">
                    Land {order.first} first. Then {order.other} rebases on top.
                  </span>
                  <span className="muted text-[13px]">{order.why}</span>
                  <button className="btn primary" type="button" onClick={() => act(store, { kind: "merge", agent: order.first })}>
                    Land {order.first} first
                  </button>
                  <button className="btn" type="button" onClick={() => act(store, { kind: "undo", agent: order.other })}>
                    Undo {order.other}
                  </button>
                </div>
              </section>

              <div className="prs">
                <PrCard state={state} w={wa} other={wb} file={ov.file} diff={da} hot={hot} />
                <PrCard state={state} w={wb} other={wa} file={ov.file} diff={db} hot={hot} />
              </div>
            </>
          ) : (
            <section className="verdict" aria-label="Bullpen verdict">
              <div className="l">
                <span><span className="tag ok">no conflicts</span></span>
                <h1>No two agent branches touch the same file</h1>
              </div>
            </section>
          )}

          <div className="lower">
            <section className="card" aria-label="Other branches">
              <header><h2>Other branches</h2><span className="src">git worktrees</span></header>
              {rest.length ? (
                <ul className="tl">
                  {rest.map((w) => (
                    <li key={w.agent}>
                      <span className="t">{w.branch}</span>
                      <i style={{ background: w.color }} />
                      <span>
                        {w.task || w.branch}
                        <small>{plural(w.commits.length, "commit")} · {plural(w.changed_files.length, "file")}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted px-4 py-3 text-[13px]">No other branches ahead of main.</p>
              )}
            </section>
            {ov && (
              <section className="card" aria-label="How it was caught">
                <header><h2>How Bullpen caught it</h2><span className="src">hook events + git</span></header>
                <ul className="tl">
                  {events.map((e, i) => (
                    <li key={i}>
                      <span className="t">{time(e.at)}</span>
                      <i style={{ background: color(e.agent) }} />
                      <span>{e.what}<small>{e.detail}</small></span>
                    </li>
                  ))}
                  {lease && (
                    <li>
                      <span className="t">now</span>
                      <i style={{ background: color(lease.agent) }} />
                      <span>
                        {lease.agent} holds the lease on {ov.file}
                        <small>{lease.waiters.length ? `${lease.waiters.join(", ")} waiting` : "no waiters"}</small>
                      </span>
                    </li>
                  )}
                  <li className="hit">
                    <span className="t">{caughtAt ? time(caughtAt) : "now"}</span>
                    <i style={{ background: "var(--red)" }} />
                    <span>
                      <b>Cross-branch check fails</b>
                      <small>
                        {wa?.branch} and {wb?.branch} both change {ov.file}
                        {hot.length ? `, L${fmtRanges(hot)}` : ""}
                      </small>
                    </span>
                  </li>
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
