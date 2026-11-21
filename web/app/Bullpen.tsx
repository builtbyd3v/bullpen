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
import { createStore, type Store, type StoreState } from "@/lib/store.ts";
import type { CheckDecision, Status } from "@/lib/types.ts";
import { BuildingInteriorDrawer, BuildingInteriorHeader } from "./BuildingInteriorPanel";
import { HealthStrip } from "./HealthStrip";
import { ProblemOpener } from "./ProblemOpener";

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
      <BuildingInteriorDrawer store={store} state={state} />
      <ProblemOpener open={openerOpen} onClose={() => setOpenerOpen(false)} />
    </div>
  );
}

// Plain verbs for the UI. The server's `working` reads as editing.
const STATUS_LABEL: Record<Status, string> = { working: "editing", waiting: "waiting", blocked: "blocked", done: "done" };
const STATUS_ICON: Record<Status, string> = { working: "✎", waiting: "⏳", blocked: "⛔", done: "✓" };

const STATUS_CLASS: Record<Status, string> = {
  working: "bg-emerald-500/20 text-emerald-300",
  waiting: "bg-amber-500/20 text-amber-300",
  blocked: "bg-red-500/20 text-red-300",
  done: "bg-white/10 text-white/60",
};

const DECISION_CLASS: Record<CheckDecision, string> = {
  allow: "bg-emerald-600 text-white",
  ask: "bg-amber-400 text-black",
  deny: "bg-red-600 text-white",
};

const BUTTON = "rounded-md px-3 py-1.5 text-sm font-semibold";

type SectionProps = { title: string; hint?: string; children: ReactNode };

function Section({ title, hint, children }: SectionProps) {
  return (
    <section className="border-b border-[#cfc493]/15 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold tracking-widest text-[#cfc493] uppercase">
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
    <Section title="Orchestrator">
      <form onSubmit={handleOrchestrate} className="flex gap-2">
        <input
          type="text"
          value={askInput}
          onChange={(e) => setAskInput(e.target.value)}
          placeholder="Tell Bullpen what to build..."
          aria-label="Orchestrate task"
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={orchestrating || !askInput.trim()}
          className={`${BUTTON} shrink-0 bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40`}
        >
          {orchestrating ? "Planning..." : "Run"}
        </button>
      </form>
      {orchError && <p className="mt-1.5 text-xs text-red-300">{orchError}</p>}

      {plan && (
        <div className="mt-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/25 p-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-emerald-300">Plan: {plan.ask}</span>
            {plan.source && (
              <span className="font-mono text-[10px] text-white/50">
                {plan.source === "canned" ? "Orchestrator (canned)" : "Orchestrator"}
              </span>
            )}
          </div>
          <ul className="mt-2 space-y-1.5">
            {plan.tasks.map((t) => {
              const color = colorFor(t.agent);
              return (
                <li key={t.agent} style={agentColor(color)} className="flex items-start gap-2 text-xs">
                  <Dot color={color} />
                  <span className="shrink-0 font-mono font-bold text-(--agent)">{t.agent}</span>
                  <span className="text-white/85">{t.task}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form onSubmit={handleAsk} className="mt-3 flex gap-2">
        <input
          type="text"
          value={questionInput}
          onChange={(e) => setQuestionInput(e.target.value)}
          placeholder="Ask why (e.g. Why is db blocked?)"
          aria-label="Ask why"
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-sm text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={asking || !questionInput.trim()}
          className={`${BUTTON} shrink-0 bg-white/10 text-white hover:bg-white/20 disabled:opacity-40`}
        >
          {asking ? "..." : "Ask"}
        </button>
      </form>
      {askError && <p className="mt-1.5 text-xs text-red-300">{askError}</p>}
      {answer && (
        <div className="mt-2 rounded-md border border-sky-400/30 bg-sky-950/30 p-2.5 text-xs leading-relaxed text-sky-100">
          <span className="mr-1.5 font-mono font-bold text-sky-300">JETSON:</span>
          {answer}
        </div>
      )}
    </Section>
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
    <Section title="Locks" hint="One agent edits a file at a time (a lease); the others wait in line. Guarded folders (the fence) need your approval.">
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
  const name = (id: string) => campus.buildings.find((b) => b.id === id)?.name ?? id;

  return (
    <Section title="Commits" hint="Every saved edit is committed on the agent's own branch; Undo drops the branch, Merge lands it on main.">
      {worktrees.map((w) => (
        <div key={w.agent} style={agentColor(w.color)} className="mb-3 rounded-lg border-l-4 border-(--agent) bg-white/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Dot color={w.color} />
            <span className="text-base font-bold text-(--agent)">{w.agent}</span>
            <span className={`rounded px-2 py-0.5 text-sm font-semibold ${STATUS_CLASS[w.status]}`}>{STATUS_LABEL[w.status]}</span>
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
    <Section title="Referee" hint="The Jetson checks every edit before it runs; unplugged, it blocks them all.">
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
  const line = (agent: string, status: Status, commits: { files: string[] }[]) => {
    const held = leases.find((l) => l.agent === agent);
    if (status === "blocked") return "blocked";
    if (status === "waiting" || leases.some((l) => l.waiters.includes(agent))) return "waiting";
    if (held) return `editing ${held.file}${formatTtl(held.expires_at, now) ? ` · ${formatTtl(held.expires_at, now)}` : ""}`;
    const last = commits[0]?.files[0];
    return last ? `saved ${last.split("/").pop()}` : STATUS_LABEL[status];
  };
  return (
    <Section title="Activity" hint="What each agent is doing right now, from live events.">
      <ul className="space-y-2">
        {worktrees.map((w) => (
          <li key={w.agent} style={agentColor(w.color)} className="flex items-center gap-3 text-lg">
            <span aria-hidden="true" className="w-6 text-center">{STATUS_ICON[w.status]}</span>
            <AgentChip agent={w.agent} color={w.color} />
            <span className="min-w-0 truncate font-mono text-white/90">{line(w.agent, w.status, w.commits)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/55">
        {(Object.keys(STATUS_ICON) as Status[]).map((st) => (
          <span key={st}>
            {STATUS_ICON[st]} {STATUS_LABEL[st]}
          </span>
        ))}
      </p>
    </Section>
  );
}

function SidePanel() {
  return (
    <aside className="h-full w-[35%] overflow-y-auto border-l-2 border-[#cfc493]/30 bg-[#0a1f16]">
      <Notice />
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

function TopHealthStrip() {
  const store = useStore();
  const health = useBullpen((s) => s.health);
  const replaying = useBullpen((s) => s.replaying);
  const latestCheck = useBullpen((s) => s.checks[0]);
  return <HealthStrip store={store} health={health} latestCheck={latestCheck} replaying={replaying} />;
}

export default function Bullpen() {
  return (
    <BullpenProvider>
      <div className="flex h-screen flex-col">
        <TopHealthStrip />
        <main className="flex min-h-0 flex-1">
          <CampusPane />
          <SidePanel />
        </main>
      </div>
    </BullpenProvider>
  );
}
