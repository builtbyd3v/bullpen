"use client";

import dynamic from "next/dynamic";
import {
  createContext,
  use,
  useEffect,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import campus from "../../campus/campus.json" with { type: "json" };
import { DEMO } from "@/lib/fake.ts";
import { act, askWhy, connect, isFake, orchestrate, SERVER_URL } from "@/lib/server.ts";
import { overlaps } from "@/lib/overlap.ts";
import { createStore, type Store, type StoreState } from "@/lib/store.ts";
import type { CheckDecision, Status } from "@/lib/types.ts";
import { Alerts } from "./Alerts";
import { BuildingInteriorDrawer, BuildingInteriorHeader } from "./BuildingInteriorPanel";
import { HealthStrip } from "./HealthStrip";
import { ProblemOpener } from "./ProblemOpener";
import "./bp.css";

const Campus = dynamic(() => import("./Campus"), { ssr: false });

const StoreContext = createContext<Store | null>(null);

function useStore(): Store {
  const store = use(StoreContext);
  if (!store) throw new Error("useStore needs a BullpenProvider");
  return store;
}

export function useBullpen<T>(selector: (state: StoreState) => T): T {
  const store = useStore();
  const get = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, get, get);
}

type BullpenProviderProps = { children: ReactNode };

export function BullpenProvider({ children }: BullpenProviderProps) {
  const [store] = useState(createStore);
  useEffect(() => connect(store), [store]);
  return <StoreContext value={store}>{children}</StoreContext>;
}

// The one dynamic value Tailwind can't express: classes read it as bg-(--agent), text-(--agent), etc.
const agentColor = (color: string) => ({ "--agent": color }) as CSSProperties;

const noSubscribe = () => () => {};

function useNowTick(active: boolean) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function formatTtl(expiresAt: string | undefined, nowMs: number | null): string | null {
  if (!expiresAt || nowMs === null) return null;
  const target = Date.parse(expiresAt);
  if (Number.isNaN(target)) return null;
  const sec = Math.ceil((target - nowMs) / 1000);
  if (sec <= 0) return "expired";
  return `${sec}s`;
}

function formatIsoTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function PlayDemo() {
  const store = useStore();
  const fake = useSyncExternalStore(noSubscribe, isFake, () => false);
  const [played, setPlayed] = useState(false);
  if (!fake) return null;
  const play = () => {
    setPlayed(true);
    DEMO.forEach((step) => setTimeout(() => step.run().forEach(store.dispatch), step.at));
  };
  return (
    <button
      type="button"
      onClick={play}
      disabled={played}
      className="rounded-lg bg-[#006747] px-3 py-2 text-sm font-semibold ring-1 ring-[#cfc493]/60 hover:bg-[#008a5e] disabled:opacity-40"
    >
      Play demo
    </button>
  );
}

function Tabs({ onStartOpener }: { onStartOpener: () => void }) {
  const store = useStore();
  const tab = useBullpen((s) => s.ui.tab);
  const worktrees = useBullpen((s) => s.data.worktrees);
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const conflicts = overlaps(worktrees).length;
  const tabs = [
    { id: "main", label: "main", color: "#ffffff", ahead: null as number | null },
    ...worktrees.map((w) => ({ id: w.agent, label: w.agent, color: w.color, ahead: w.ahead })),
  ];
  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          style={agentColor(t.color)}
          onClick={() => store.setUi({ tab: t.id })}
          className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-base font-semibold ${
            tab === t.id ? "border-(--agent) bg-(--agent)/25 text-white" : "border-transparent text-white/60 hover:bg-white/5"
          }`}
        >
          <span className="size-3 rounded-full bg-(--agent)" />
          {t.label}
          {t.ahead !== null && <span className="font-mono text-xs text-white/60">+{t.ahead}</span>}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onStartOpener}
          className="rounded-lg border border-amber-400/50 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/25"
        >
          10s opener
        </button>
        <PlayDemo />
        <a
          href={`/prs${search}`}
          className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
        >
          Pull requests
          {conflicts > 0 && <span className="rounded bg-red-500/30 px-1.5 font-mono text-xs text-red-100">{conflicts}</span>}
        </a>
        <a
          href={`/settings${search}`}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
        >
          Settings
        </a>
      </div>
    </nav>
  );
}

// Real mode only: server offline (with a one-click fallback to ?fake), or the server cannot read its repo.
function ServerBanner() {
  const fake = useSyncExternalStore(noSubscribe, isFake, () => false);
  const conn = useBullpen((s) => s.ui.conn);
  const error = useBullpen((s) => s.data.error);
  if (fake) return null;
  if (conn === "offline") {
    return (
      <div role="status" className="flex items-center gap-3 border-b border-red-500/40 bg-red-950/60 px-4 py-2 text-sm text-red-100">
        <span className="size-2 animate-pulse rounded-full bg-red-400" />
        <span>
          Server offline at <span className="font-mono">{SERVER_URL}</span>. Retrying...
        </span>
        <button
          type="button"
          onClick={() => (window.location.search = "fake")}
          className={`${BUTTON} ml-auto bg-white/10 text-white hover:bg-white/20`}
        >
          Switch to fake mode
        </button>
      </div>
    );
  }
  if (!error) return null;
  return (
    <div role="status" className="border-b border-amber-500/40 bg-amber-950/60 px-4 py-2 text-sm text-amber-100">
      Server is up but cannot read the demo repo (no agents to show). Check <span className="font-mono">BULLPEN_REPO</span>:{" "}
      <span className="font-mono text-amber-200/80">{error}</span>
    </div>
  );
}

function Notice() {
  const store = useStore();
  const notice = useBullpen((s) => s.notice);
  if (!notice) return null;
  return (
    <div role="alert" className="flex items-start gap-2 border-b border-red-500/40 bg-red-950/60 p-3 text-sm text-red-100">
      <span className="flex-1">{notice}</span>
      <button type="button" onClick={() => store.notify(null)} className="rounded px-2 text-xs font-semibold text-white/70 hover:bg-white/10">
        Dismiss
      </button>
    </div>
  );
}

function CampusPane() {
  const store = useStore();
  const state = useBullpen((s) => s);
  const [openerOpen, setOpenerOpen] = useState(false);

  // Escape key returns from zoomed building interior to campus
  useEffect(() => {
    if (!state.ui.zoomedBuildingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") store.setUi({ zoomedBuildingId: null, selectedRoomPath: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, state.ui.zoomedBuildingId]);

  return (
    <div className="relative flex h-full w-[65%] flex-col">
      <Tabs onStartOpener={() => setOpenerOpen(true)} />
      <ServerBanner />
      <BuildingInteriorHeader store={store} state={state} />
      <div className="min-h-0 flex-1">
        <Campus store={store} />
      </div>
      <p className="flex justify-between border-t border-[#cfc493]/15 px-4 py-1.5 font-mono text-xs text-white/55">
        <span>
          {state.ui.tab === "main"
            ? "main · repo folders on the USF map · hover or click a building"
            : `agent/${state.ui.tab} · its layer at full color, the rest dimmed`}
        </span>
        <span>{campus.repo}</span>
      </p>
      <BuildingInteriorDrawer store={store} state={state} />
      <ProblemOpener open={openerOpen} onClose={() => setOpenerOpen(false)} />
    </div>
  );
}

// Plain verbs for the UI. The server's `working` reads as editing.
// What an agent is doing, as shown: the server's `working` reads as editing only while it holds a lock, else idle.
type Kind = Status | "idle";
const STATUS_LABEL: Record<Kind, string> = { working: "editing", waiting: "waiting", blocked: "blocked", done: "done", idle: "idle" };
const STATUS_ICON: Record<Kind, string> = { working: "✎", waiting: "⏳", blocked: "⛔", done: "✓", idle: "○" };
const LEGEND: [Kind, string][] = [["idle", "idle"], ["working", "editing"], ["waiting", "waiting"], ["blocked", "blocked"], ["done", "saved"]];
const kindOf = (status: Status, holdsLock: boolean): Kind => (status === "working" && !holdsLock ? "idle" : status);

const STATUS_CLASS: Record<Kind, string> = {
  working: "bg-emerald-500/20 text-emerald-300",
  waiting: "bg-amber-500/20 text-amber-300",
  blocked: "bg-red-500/20 text-red-300",
  done: "bg-white/10 text-white/60",
  idle: "bg-white/10 text-white/60",
};

const DECISION_CLASS: Record<CheckDecision, string> = {
  allow: "bg-emerald-600 text-white",
  ask: "bg-amber-400 text-black",
  deny: "bg-red-600 text-white",
};

const BUTTON = "rounded-md px-3 py-1.5 text-sm font-semibold";

type SectionProps = { title: string; hint?: string; src?: string; children: ReactNode };

// A panel card per mockups-v3: title, a `?` hint, and the data source it reads on the right.
function Section({ title, hint, src, children }: SectionProps) {
  return (
    <section className="m-3 rounded-lg border border-[#cfc493]/20 bg-[#0d231b] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-[#EDEBD1]">
        {title}
        {hint && (
          <span
            title={hint}
            aria-label={hint}
            className="grid size-5 cursor-help place-items-center rounded-full border border-[#cfc493]/50 text-xs normal-case tracking-normal"
          >
            ?
          </span>
        )}
        {src && <span className="ml-auto font-mono text-xs font-normal text-white/55">{src}</span>}
      </h2>
      {children}
    </section>
  );
}

type DotProps = { color: string };

function Dot({ color }: DotProps) {
  return <span style={agentColor(color)} className="inline-block size-3 shrink-0 rounded-full bg-(--agent)" />;
}

type AgentChipProps = { agent: string; color: string };

function AgentChip({ agent, color }: AgentChipProps) {
  return (
    <span style={agentColor(color)} className="shrink-0 rounded bg-(--agent) px-1.5 py-0.5 font-mono text-xs font-bold text-white [text-shadow:0_1px_1px_#000]">
      {agent}
    </span>
  );
}

// Asks that reliably hit the core beats: three agents, api and web both edit shared/auth.ts first, db edits db/schema.sql.
const SUGGESTED_ASKS = [
  "Add login with roles: API checks the role, web shows it, and the db stores it.",
  "Add a role field to login across api, web and db",
  "Add an account-locked flag: api rejects locked users, web shows a banner, db stores it",
];

// ============================================================================
// ISSUE #27 — Orchestrator chat box (POST /orchestrate + POST /ask)
// ============================================================================
function OrchestratorBox() {
  const store = useStore();
  const plan = useBullpen((s) => s.plan);
  const worktrees = useBullpen((s) => s.data.worktrees);

  const [askInput, setAskInput] = useState("");
  const [orchestrating, setOrchestrating] = useState(false);
  const [orchError, setOrchError] = useState<string | null>(null);

  const [questionInput, setQuestionInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  const colorFor = (agent: string) =>
    worktrees.find((w) => w.agent === agent)?.color ??
    ({ api: "#e5484d", web: "#3e63dd", db: "#f5b400" }[agent] ?? "#94a3b8");

  const handleOrchestrate = async (e: FormEvent) => {
    e.preventDefault();
    const text = askInput.trim();
    if (!text || orchestrating) return;
    setOrchestrating(true);
    setOrchError(null);
    try {
      await orchestrate(store, text);
      setAskInput("");
    } catch (err: unknown) {
      setOrchError(err instanceof Error ? err.message : "Orchestrator failed");
    } finally {
      setOrchestrating(false);
    }
  };

  const handleAsk = async (e: FormEvent) => {
    e.preventDefault();
    const q = questionInput.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError(null);
    try {
      const reply = await askWhy(q);
      setAnswer(reply);
      setQuestionInput("");
    } catch (err: unknown) {
      setAskError(err instanceof Error ? err.message : "Ask failed");
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="card">
      <h2>
        Orchestrator
        <span className="tag ok">Claude Code</span>
        <span className="src">POST :8650/orchestrate</span>
      </h2>
      <div className="ask">
        <p className="text-[13px] text-(--ink-3)">Splits your ask across 3 Claude Code agents that run on your own Claude plan. No API key.</p>
        <form onSubmit={handleOrchestrate}>
          <input value={askInput} onChange={(e) => setAskInput(e.target.value)} placeholder="Tell Bullpen what to build..." aria-label="Orchestrate task" />
          <button className="btn primary" type="submit" disabled={orchestrating || !askInput.trim()}>{orchestrating ? "Planning..." : "Run"}</button>
        </form>
        {!plan && (
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_ASKS.slice(0, 2).map((q) => (
              <button key={q} type="button" className="btn" onClick={() => setAskInput(q)}>{q}</button>
            ))}
          </div>
        )}
        {orchError && <p className="text-[13px] text-(--red)">{orchError}</p>}
        {plan && (
          <div className="plan">
            {plan.tasks.map((t) => (
              <div key={t.agent}><span className="dot" style={{ background: colorFor(t.agent) }} /><b>{t.agent}</b><span className="min-w-0 flex-1">{t.task}</span><span className="tag mute">claude-code</span></div>
            ))}
          </div>
        )}
        <form onSubmit={handleAsk}>
          <input value={questionInput} onChange={(e) => setQuestionInput(e.target.value)} placeholder="Ask why (e.g. Why is db blocked?)" aria-label="Ask why" />
          <button className="btn" type="submit" disabled={asking || !questionInput.trim()}>{asking ? "Asking..." : "Ask"}</button>
        </form>
        {askError && <p className="text-[13px] text-(--red)">{askError}</p>}
        {answer && <p className="text-[13px] text-(--ink-2)"><b className="mono">Jetson:</b> {answer}</p>}
      </div>
    </section>
  );
}

// ============================================================================
// ISSUE #18 — Merged intent cards
// ============================================================================
function MergeIntentCards() {
  const store = useStore();
  const merges = useBullpen((s) => s.merges);
  if (merges.length === 0) return null;
  return (
    <Section title="Merged intent">
      <div className="flex flex-col gap-3">
        {merges.map((card) => (
          <article
            key={card.id}
            style={agentColor(card.color)}
            className="rounded-lg border border-(--agent)/40 border-l-4 border-l-(--agent) bg-(--agent)/10 p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Dot color={card.color} />
              <span className="text-lg font-bold text-(--agent)">{card.agent}</span>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold tracking-wide text-emerald-300 uppercase">
                Merged
              </span>
              <button
                type="button"
                onClick={() => store.dismissMerge(card.id)}
                className="ml-auto rounded px-2 py-0.5 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white"
                aria-label={`Dismiss ${card.agent} merge card`}
              >
                Dismiss
              </button>
            </div>
            <p className="mt-0.5 font-mono text-xs text-white/50">
              {card.branch}
              {card.sha && <span className="ml-2 text-white/40">{card.sha.slice(0, 7)}</span>}
            </p>
            <div className="mt-2.5 rounded-md border border-white/10 bg-black/25 p-2.5">
              <p className="text-[11px] font-bold tracking-widest text-white/50 uppercase">Intent</p>
              <p className="mt-1 text-sm leading-relaxed text-white/95">
                {card.intent || <span className="italic text-white/50">No intent summary provided.</span>}
              </p>
            </div>
            <div className="mt-2.5">
              <p className="mb-1 text-[11px] font-bold tracking-widest text-white/50 uppercase">
                Commits ({card.commits.length})
              </p>
              {card.commits.length === 0 ? (
                <p className="text-xs italic text-white/50">No branch commits recorded.</p>
              ) : (
                <ul className="space-y-1">
                  {card.commits.map((c) => (
                    <li key={c.sha} className="flex items-baseline gap-2 text-sm">
                      <span className="shrink-0 font-mono text-xs text-white/50">{c.sha.slice(0, 7)}</span>
                      <span className="text-white/85">{c.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

// ============================================================================
// ISSUE #32 (Panel 2) — Leases (with live TTL + wait queue) & Pending Approvals
// ============================================================================
function LeasesAndApprovals() {
  const store = useStore();
  const approvals = useBullpen((s) => s.data.approvals);
  const leases = useBullpen((s) => s.data.leases ?? []);
  const worktrees = useBullpen((s) => s.data.worktrees);
  const now = useNowTick(leases.length > 0 || approvals.some((a) => Boolean(a.expires_at)));

  const colorOf = (agent: string) => worktrees.find((w) => w.agent === agent)?.color ?? "#888888";
  if (leases.length === 0 && approvals.length === 0) return null;

  return (
    <Section title="Locks" src="/state leases, approvals" hint="One agent edits a file at a time (a lease); the others wait in line. Guarded folders (the fence) need your approval.">
      {/* Pending human approvals */}
      {approvals.length > 0 && (
        <div className="mb-3 space-y-2">
          {approvals.map((a) => {
            const ttl = formatTtl(a.expires_at, now);
            // The server denies at expiry; the card stays until its `denied` event arrives.
            const expired = ttl === "expired";
            return (
              <div
                key={a.id}
                style={agentColor(colorOf(a.agent))}
                className="rounded-lg border-2 border-amber-400 bg-amber-400/10 p-3 shadow-[0_0_0_4px_rgba(251,191,36,0.15)]"
              >
                <p className="mb-1 text-xs font-bold tracking-widest text-amber-300 uppercase">Needs your approval</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">
                    <span className="text-(--agent)">{a.agent}</span> wants {a.tool}{" "}
                    <span className="font-mono text-white">{a.target}</span>
                  </p>
                  {ttl && (
                    <span className="ml-auto rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] text-amber-200">
                      {expired ? "expired: denied" : ttl}
                    </span>
                  )}
                </div>
                <p className="mt-1 mb-2 text-sm text-white/80">{a.reason}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={expired}
                    onClick={() => act(store, { kind: "approve", id: a.id, decision: "allow" })}
                    className={`${BUTTON} bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={expired}
                    onClick={() => act(store, { kind: "approve", id: a.id, decision: "deny" })}
                    className={`${BUTTON} bg-white/10 hover:bg-white/20 disabled:opacity-40`}
                  >
                    Deny
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active file leases: "api holds shared/auth.ts · 72s", then the wait queue in order. */}
      {leases.length > 0 && (
        <ul className="space-y-2">
          {leases.map((lease) => {
            const ttl = formatTtl(lease.expires_at, now);
            return (
              <li
                key={`${lease.file}:${lease.agent}`}
                style={agentColor(colorOf(lease.agent))}
                className="rounded-md border-l-4 border-(--agent) bg-white/5 px-3 py-2"
              >
                <p className="flex items-baseline gap-2 text-sm">
                  <AgentChip agent={lease.agent} color={colorOf(lease.agent)} />
                  <span className="text-white/60">editing</span>
                  <span className="min-w-0 truncate font-mono font-semibold text-white">{lease.file}</span>
                  <span className="ml-auto shrink-0 font-mono text-base text-[#cfc493]">{ttl ?? "active"}</span>
                </p>
                {lease.waiters.length > 0 && (
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    {lease.waiters.map((w, i) => (
                      <span key={w} style={agentColor(colorOf(w))} className="rounded bg-amber-400/15 px-2 py-0.5 text-xs text-amber-200">
                        <strong className="text-(--agent)">{w}</strong> waiting #{i + 1}
                      </span>
                    ))}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ============================================================================
// ISSUE #32 (Panel 1) — Commit timeline per agent (sha, message, time, trailers)
// ============================================================================
function CommitTimeline() {
  const store = useStore();
  const worktrees = useBullpen((s) => s.data.worktrees);
  const leases = useBullpen((s) => s.data.leases ?? []);
  const name = (id: string) => campus.buildings.find((b) => b.id === id)?.name ?? id;

  return (
    <Section title="Commits" src="git log agent/*" hint="Every saved edit is committed on the agent's own branch; Undo drops the branch, Merge lands it on main.">
      {worktrees.map((w) => (
        <div key={w.agent} style={agentColor(w.color)} className="mb-3 rounded-lg border-l-4 border-(--agent) bg-white/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Dot color={w.color} />
            <span className="text-base font-bold text-(--agent)">{w.agent}</span>
            <span className={`rounded px-2 py-0.5 text-sm font-semibold ${STATUS_CLASS[kindOf(w.status, leases.some((l) => l.agent === w.agent))]}`}>
              {STATUS_LABEL[kindOf(w.status, leases.some((l) => l.agent === w.agent))]}
            </span>
            <span className="ml-auto font-mono text-xs text-white/60">+{w.ahead}</span>
          </div>
          {w.task && (
            <details className="mt-1 text-sm text-white/90">
              <summary className="cursor-pointer truncate">{w.task}</summary>
              <p className="mt-1 text-white/75">{w.task}</p>
            </details>
          )}
          <p className="font-mono text-xs text-white/50">{w.branch}</p>
          {w.claims.length > 0 && <p className="mt-0.5 text-sm text-white/65">In {w.claims.map(name).join(", ")}</p>}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => act(store, { kind: "merge", agent: w.agent })}
              className={`${BUTTON} bg-[#006747] text-white ring-1 ring-[#cfc493]/60 hover:bg-[#008a5e]`}
            >
              Merge to main
            </button>
            <button
              type="button"
              onClick={() => act(store, { kind: "undo", agent: w.agent })}
              className={`${BUTTON} bg-red-600/80 hover:bg-red-500`}
            >
              Undo
            </button>
          </div>

          <div className="mt-3 space-y-2 border-t border-white/10 pt-2">
            {w.commits.length === 0 ? (
              <p className="text-xs italic text-white/45">No unmerged commits on {w.branch}.</p>
            ) : (
              w.commits.map((c) => {
                const time = formatIsoTime(c.at);
                const taskTrailer = c.task ?? w.task;
                return (
                  <div key={c.sha} className="rounded bg-black/25 p-2 text-sm">
                    <div className="flex items-baseline gap-2">
                      <AgentChip agent={w.agent} color={w.color} />
                      <span className="shrink-0 font-mono text-xs text-[#cfc493]">{c.sha.slice(0, 7)}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-white/95" title={c.message}>{c.message}</span>
                      {time && <span className="shrink-0 font-mono text-xs text-white/50">{time}</span>}
                    </div>
                    {taskTrailer && (
                      <details className="mt-1 font-mono text-[11px] text-white/55">
                        <summary className="cursor-pointer truncate">Bullpen-Task: {taskTrailer}</summary>
                        <p className="mt-0.5">Bullpen-Agent: {w.agent}</p>
                        <p className="break-words">Bullpen-Task: {taskTrailer}</p>
                      </details>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </Section>
  );
}

// ============================================================================
// ISSUE #32 (Panel 3) — Jetson referee log (check events; highlight deny & OFFLINE)
// ============================================================================
function RefereeLog() {
  const checks = useBullpen((s) => s.checks);
  return (
    <Section title="Referee" src="check events" hint="The Jetson checks every edit before it runs; unplugged, it blocks them all.">
      {checks.length === 0 ? (
        <p className="text-base text-white/55">No edits checked yet.</p>
      ) : (
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
          {checks.map((c, idx) => {
            const isOffline = c.rule === "offline";
            const isDeny = c.decision === "deny";
            return (
              <div
                key={`${c.at}-${c.agent}-${c.file}-${idx}`}
                className={`rounded-md border px-2.5 py-2 text-xs ${
                  isOffline || isDeny
                    ? "border-red-500/60 bg-red-950/45"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`w-16 rounded px-2 py-1 text-center font-mono text-sm font-black uppercase ${DECISION_CLASS[c.decision]}`}
                  >
                    {c.decision}
                  </span>
                  {isOffline ? (
                    <span className="rounded bg-red-600 px-2 py-1 font-mono text-sm font-bold text-white uppercase">
                      OFFLINE · fail closed
                    </span>
                  ) : (
                    <span className="font-mono text-sm text-white/90">{c.rule}</span>
                  )}
                  <span className="ml-auto font-mono text-xs text-white/60">
                    {c.latency_ms}ms · {c.model || "—"}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-white/70">
                  {c.agent} · {c.tool} {c.file}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function Selection() {
  const store = useStore();
  const selected = useBullpen((s) => s.ui.selected);
  const worktrees = useBullpen((s) => s.data.worktrees);
  if (!selected || selected.kind === "building") return null;
  const bull = worktrees.find((w) => w.agent === selected.agent);
  if (!bull) return null;
  return (
    <Section title="Selected agent">
      <div className="mb-2 flex items-center">
        <p className="text-lg font-bold">
          <span style={agentColor(bull.color)} className="text-(--agent)">
            {bull.agent}
          </span>
        </p>
        <button
          type="button"
          onClick={() => store.setUi({ selected: null })}
          className={`${BUTTON} ml-auto bg-white/10 hover:bg-white/20`}
        >
          Close
        </button>
      </div>
      {bull.commits.map((c) => (
        <p key={c.sha} className="text-sm">
          <span className="font-mono text-white/50">{c.sha.slice(0, 7)}</span> {c.message}
        </p>
      ))}
    </Section>
  );
}

// One line per agent, built from live state: what file it is editing and for how long, or that it waits, or what it last saved.
function Activity() {
  const worktrees = useBullpen((s) => s.data.worktrees);
  const leases = useBullpen((s) => s.data.leases ?? []);
  const now = useNowTick(leases.length > 0);
  if (worktrees.length === 0) return null;
  const line = (agent: string, status: Status, commits: { files: string[] }[]): [Kind, string] => {
    const held = leases.find((l) => l.agent === agent);
    if (status === "blocked") return ["blocked", "blocked"];
    if (status === "waiting" || leases.some((l) => l.waiters.includes(agent))) return ["waiting", "waiting"];
    const ttl = held ? formatTtl(held.expires_at, now) : null;
    if (held) return ["working", `editing ${held.file}${ttl ? ` · ${ttl}` : ""}`];
    const last = commits[0]?.files[0];
    if (last) return ["done", `saved ${last.split("/").pop()}`];
    // No lock and nothing saved yet: the agent is parked, not editing.
    const kind = kindOf(status, false);
    return [kind, STATUS_LABEL[kind]];
  };
  return (
    <Section title="Activity" src="/state" hint="What each agent is doing right now, from live events.">
      <ul className="space-y-2">
        {worktrees.map((w) => {
          const [kind, text] = line(w.agent, w.status, w.commits);
          return (
            <li key={w.agent} className="flex items-center gap-3 text-lg">
              <span aria-hidden="true" className="w-6 text-center">{STATUS_ICON[kind]}</span>
              <AgentChip agent={w.agent} color={w.color} />
              <span className="min-w-0 truncate font-mono text-white/90">{text}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/55">
        {LEGEND.map(([st, label]) => (
          <span key={st}>
            {STATUS_ICON[st]} {label}
          </span>
        ))}
      </p>
    </Section>
  );
}

// Source control at a glance: each agent branch against main, and files two branches both change.
function SourceControl() {
  const store = useStore();
  const worktrees = useBullpen((s) => s.data.worktrees);
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const clashes = overlaps(worktrees);
  const clashing = new Set(clashes.flatMap((o) => o.agents));
  return (
    <Section title="Branches" src="agent/* vs main" hint="Each agent works on its own branch. Merge lands it on main; Undo drops it. Two branches that change the same file collide even when each is clean against main.">
      {clashes.map((o) => (
        <a
          key={o.file}
          href={`/prs${search}`}
          className="mb-3 flex items-center gap-3 rounded-md border border-red-400/50 bg-red-950/50 px-3 py-2.5 text-sm text-red-50 no-underline hover:bg-red-900/50"
        >
          <span className="rounded bg-red-500/30 px-1.5 py-0.5 font-mono text-xs font-semibold">overlap</span>
          <span className="min-w-0 flex-1">
            <b>{o.agents.map((a) => `agent/${a}`).join(" and ")}</b> both change <span className="font-mono">{o.file}</span>
          </span>
          <span className="shrink-0 font-semibold text-red-100">Review →</span>
        </a>
      ))}
      {worktrees.length === 0 ? (
        <p className="text-sm text-white/65">No agent branches yet. Send the orchestrator an ask.</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {worktrees.map((w) => (
            <li key={w.agent} style={agentColor(w.color)} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
              <Dot color={w.color} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-sm font-semibold text-white">{w.branch}</span>
                <span className="block truncate text-[13px] text-white/70" title={w.task}>{w.task || "No task yet"}</span>
              </span>
              <span className="font-mono text-sm text-emerald-300" title="Commits ahead of main">↑{w.ahead}</span>
              <span className="font-mono text-[13px] text-white/70" title="Files changed">{w.changed_files.length} files</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                  clashing.has(w.agent) ? "bg-red-500/25 text-red-200" : w.ahead > 0 ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/60"
                }`}
              >
                {clashing.has(w.agent) ? "overlap" : w.ahead > 0 ? "clean" : "empty"}
              </span>
              <span className="flex gap-1.5">
                <button type="button" onClick={() => act(store, { kind: "merge", agent: w.agent })} className={`${BUTTON} bg-[#006747] text-white hover:bg-[#008a5e]`}>
                  Merge to main
                </button>
                <button type="button" onClick={() => act(store, { kind: "undo", agent: w.agent })} className={`${BUTTON} border border-red-400/50 text-red-200 hover:bg-red-900/40`}>
                  Undo
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function SidePanel() {
  return (
    <aside className="h-full w-[35%] overflow-y-auto border-l-2 border-[#cfc493]/30 bg-[#0a1f16]">
      <Notice />
      <SourceControl />
      <Activity />
      <OrchestratorBox />
      <MergeIntentCards />
      <LeasesAndApprovals />
      <CommitTimeline />
      <RefereeLog />
      <Selection />
    </aside>
  );
}

function AlertsHost() {
  return <Alerts store={useStore()} />;
}

function TopHealthStrip() {
  const store = useStore();
  const health = useBullpen((s) => s.health);
  const replaying = useBullpen((s) => s.replaying);
  const latestCheck = useBullpen((s) => s.checks[0]);
  return <HealthStrip store={store} health={health} latestCheck={latestCheck} replaying={replaying} />;
}


// ===================== mockups-v3 screens: /campus (design/mockups-v3/screens/dashboard.html) =====================
function useSearch() {
  return useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
}

function TopBar() {
  const health = useBullpen((s) => s.health);
  const check = useBullpen((s) => s.checks[0]);
  const branches = useBullpen((s) => s.data.worktrees.length);
  const search = useSearch();
  const jetsonDown = check?.rule === "offline";
  const pill = (label: string, value: string, ok: boolean) => (
    <span className="pill">
      <i style={ok ? undefined : { background: "#e5484d" }} />
      {label} <b>{value}</b>
    </span>
  );
  return (
    <div className="top">
      <a className="brand" href={`/${search}`}>
        <img src="/logo.svg" alt="" width={24} height={24} className="[image-rendering:pixelated]" />
        Bullpen
      </a>
      <span className="crumb">
        {campus.repo} <span className="muted">/</span> <b>main</b> <span className="tag mute">{branches} agent branches</span>
      </span>
      <div className="health" role="status" aria-label="System health">
        {pill("Server", ":8600", health.server !== "down")}
        {pill("WebSocket", health.ws === "ok" ? "live" : health.ws, health.ws !== "down")}
        {pill("Jetson", jetsonDown ? "offline" : `${check?.latency_ms ?? 0} ms`, !jetsonDown)}
        {pill("Referee", check?.model || "rules", !jetsonDown)}
        {pill("Orchestrator", ":8650", health.orchestrator !== "down")}
      </div>
    </div>
  );
}

function ViewNav({ current }: { current: "campus" | "prs" }) {
  const conflicts = overlaps(useBullpen((s) => s.data.worktrees)).length;
  const search = useSearch();
  return (
    <nav className="nav" aria-label="Views">
      <a href={`/campus${search}`} aria-current={current === "campus" ? "page" : undefined}>Campus</a>
      <a href={`/prs${search}`} aria-current={current === "prs" ? "page" : undefined}>
        Pull requests {conflicts > 0 && <span className="n bad">{conflicts} conflict{conflicts > 1 ? "s" : ""}</span>}
      </a>
      <a href={`/campus${search}#history`}>History</a>
      <a href={`/settings${search}`}>Settings</a>
    </nav>
  );
}

function CampusCard() {
  const store = useStore();
  const state = useBullpen((s) => s);
  const { worktrees, leases = [], approvals = [] } = state.data;
  useEffect(() => {
    if (!state.ui.zoomedBuildingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") store.setUi({ zoomedBuildingId: null, selectedRoomPath: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, state.ui.zoomedBuildingId]);
  const where = (id: string) => campus.buildings.find((b) => b.id === id)?.name ?? id;
  const line = (agent: string, status: Status, building: string) => {
    const held = leases.find((l) => l.agent === agent);
    const waiting = leases.find((l) => l.waiters.includes(agent));
    const asks = approvals.find((a) => a.agent === agent);
    if (held) return `${agent} edits ${held.file} in ${where(building)}`;
    if (waiting) return `${agent} waits at the door for ${waiting.file}`;
    if (asks) return `${agent} needs approval for ${asks.target}`;
    return `${agent} is ${status === "done" ? "done" : "idle"}`;
  };
  return (
    <section className="card campus-card" aria-label="Campus">
      <div className="tabs" role="group" aria-label="Branch view">
        <button className="tab" type="button" aria-pressed={state.ui.tab === "main"} onClick={() => store.setUi({ tab: "main" })}>main</button>
        {worktrees.map((w) => (
          <button key={w.agent} className="tab" type="button" aria-pressed={state.ui.tab === w.agent} onClick={() => store.setUi({ tab: w.agent })}>
            <span className="dot" style={{ background: w.color }} />
            {w.branch} <small>+{w.ahead}</small>
          </button>
        ))}
        <span className="muted" style={{ marginLeft: "auto", fontSize: 13 }}>Hover a building for who is there. Click to open it.</span>
      </div>
      <BuildingInteriorHeader store={store} state={state} />
      <div className="stage">
        <div className="aspect-[960/640] w-full">
          <Campus store={store} />
        </div>
      </div>
      <BuildingInteriorDrawer store={store} state={state} />
      <div className="foot">
        {worktrees.length === 0 ? (
          <span>No agents yet. Send the orchestrator an ask.</span>
        ) : (
          worktrees.map((w) => (
            <span key={w.agent}>
              <span className="dot" style={{ background: w.color }} />
              {line(w.agent, w.status, w.building)}
            </span>
          ))
        )}
      </div>
    </section>
  );
}

function RefereeCard() {
  const checks = useBullpen((s) => s.checks);
  const tag = { allow: "ok", ask: "warn", deny: "bad" } as const;
  return (
    <section className="card">
      <h2>Referee <span className="src">Jetson /check</span></h2>
      <div className="ref">
        {checks.length === 0 && <div><span className="tag mute">idle</span><span className="muted">No checks yet.</span><span /></div>}
        {checks.slice(0, 6).map((c, i) => (
          <div key={`${c.at}-${i}`}>
            <span className={`tag ${c.rule === "offline" ? "bad" : tag[c.decision]}`}>{c.rule === "offline" ? "offline" : c.decision}</span>
            <span><b>{c.agent}</b> {c.tool} <span className="mono">{c.file}</span></span>
            <span className="r">{c.rule === "offline" ? "fail closed" : `${c.rule} · ${c.latency_ms} ms`}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SideColumn() {
  const store = useStore();
  const { worktrees, leases = [], approvals = [] } = useBullpen((s) => s.data);
  const search = useSearch();
  const now = useNowTick(leases.length > 0 || approvals.length > 0);
  const clashes = overlaps(worktrees);
  const clashing = new Set(clashes.flatMap((o) => o.agents));
  const color = (a: string) => worktrees.find((w) => w.agent === a)?.color ?? "#CFC493";
  const pairs = worktrees.flatMap((a, i) => worktrees.slice(i + 1).map((b) => [a, b] as const));
  const commits = worktrees
    .flatMap((w) => w.commits.map((c) => ({ ...c, agent: w.agent, color: w.color, task: c.task ?? w.task })))
    .sort((x, y) => (y.at ?? "").localeCompare(x.at ?? ""));
  const secs = (iso?: string) => (iso && now ? Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000)) : null);
  return (
    <aside className="side" aria-label="Source control">
      {clashes.map((o) => (
        <div key={o.file} className="alert">
          <span className="tag bad">conflict</span>
          <b>{o.agents.map((a) => `agent/${a}`).join(" and ")} both change {o.file}</b>
          <p>Each branch merges cleanly into main. Together they do not.</p>
          <span className="act"><a className="btn" href={`/prs${search}`}>Review</a></span>
        </div>
      ))}
      {approvals.map((a) => (
        <div key={a.id} className="alert ask">
          <span className="tag warn">approval</span>
          <b>{a.agent} wants to edit {a.target}</b>
          <p>{a.reason}. No answer in {secs(a.expires_at) ?? 60} s means deny.</p>
          <span className="act">
            <button className="btn primary" type="button" onClick={() => act(store, { kind: "approve", id: a.id, decision: "allow" })}>Approve</button>
            <button className="btn danger" type="button" onClick={() => act(store, { kind: "approve", id: a.id, decision: "deny" })}>Deny</button>
          </span>
        </div>
      ))}
      <section className="card">
        <header><h2>Branches</h2><span className="src">vs main</span></header>
        <table className="br">
          <thead><tr><th>Branch</th><th>Ahead</th><th>Files</th><th>Merge</th><th /></tr></thead>
          <tbody>
            {worktrees.length === 0 && <tr><td colSpan={5} className="muted">No agent branches yet.</td></tr>}
            {worktrees.map((w) => (
              <tr key={w.agent}>
                <td><div className="bname"><span className="dot" style={{ background: w.color }} /><span>{w.branch}<small>{w.task || "No task yet"}</small></span></div></td>
                <td className="ab"><span className="up">↑{w.ahead}</span> <span className="down">↓0</span></td>
                <td className="mono">{w.changed_files.length}</td>
                <td><span className={`tag ${clashing.has(w.agent) ? "bad" : w.ahead > 0 ? "ok" : "mute"}`}>{clashing.has(w.agent) ? "blocked" : w.ahead > 0 ? "clean" : "empty"}</span></td>
                <td>
                  <div className="acts">
                    <button className="btn" type="button" onClick={() => act(store, { kind: "undo", agent: w.agent })}>Undo</button>
                    <button className={`btn ${clashing.has(w.agent) ? "" : "primary"}`} type="button" onClick={() => act(store, { kind: "merge", agent: w.agent })}>Merge to main</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <header><h2>Cross-branch check</h2><span className="src">changed files per branch</span></header>
        <div className="pairs">
          {pairs.length === 0 && <div className="pair"><span className="tag mute">idle</span><span className="what">Needs two agent branches.</span><span /></div>}
          {pairs.map(([a, b]) => {
            const hit = clashes.find((o) => o.agents.includes(a.agent) && o.agents.includes(b.agent));
            return (
              <div key={a.agent + b.agent} className={`pair ${hit ? "bad" : ""}`}>
                <span className={`tag ${hit ? "bad" : "ok"}`}>{hit ? "overlap" : "clean"}</span>
                <span><span className="who">{a.agent} × {b.agent}</span> <span className="what">{hit ? hit.file : "no shared files"}</span></span>
                {hit ? <a className="btn" href={`/prs${search}`}>Open</a> : <span />}
              </div>
            );
          })}
        </div>
      </section>
      <section className="card">
        <header><h2>File locks</h2><span className="src">90 s, renewed by the holder</span></header>
        {leases.length === 0 && <div className="lease"><span className="muted">No file is locked.</span></div>}
        {leases.map((l) => {
          const left = secs(l.expires_at);
          return (
            <div key={l.file} className="lease">
              <span className="f"><span className="dot" style={{ background: color(l.agent) }} />{l.file}</span>
              <span className="t">{left === null ? "" : `${left} s`}</span>
              <div className="bar"><i style={{ width: `${Math.min(100, ((left ?? 90) / 90) * 100)}%`, background: color(l.agent) }} /></div>
              <div className="q">Held by <b style={{ color: color(l.agent) }}>{l.agent}</b>{l.waiters.length ? ` · ${l.waiters.map((w, i) => `#${i + 1} ${w} waiting`).join(", ")}` : " · no queue"}</div>
            </div>
          );
        })}
      </section>
      <section className="card" id="history">
        <header><h2>Commits</h2><span className="src">auto-commit per edit</span></header>
        <ul className="log">
          {commits.length === 0 && <li><i /><span className="m muted">No agent commits yet.</span><span /></li>}
          {commits.slice(0, 8).map((c) => (
            <li key={c.sha}><i style={{ background: c.color }} /><span className="m">{c.message}<small>Bullpen-Agent: {c.agent} · Bullpen-Task: {c.task}</small></span><span className="sha">{c.sha.slice(0, 7)}</span></li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export default function Bullpen() {
  return (
    <BullpenProvider>
      <div className="bp">
        <div className="app">
          <TopBar />
          <ViewNav current="campus" />
          <div className="dash-main">
            <div>
              <CampusCard />
              <div className="under">
                <OrchestratorBox />
                <RefereeCard />
              </div>
            </div>
            <SideColumn />
          </div>
        </div>
      </div>
      <AlertsHost />
    </BullpenProvider>
  );
}
