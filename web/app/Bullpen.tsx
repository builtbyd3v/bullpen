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
import { act, askWhy, connect, isFake, orchestrate } from "@/lib/server.ts";
import { createStore, type Store, type StoreState } from "@/lib/store.ts";
import type { CheckDecision, Status } from "@/lib/types.ts";
import { BuildingInteriorDrawer, BuildingInteriorHeader } from "./BuildingInteriorPanel";
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
      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40"
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
      <BuildingInteriorHeader store={store} state={state} />
      <div className="min-h-0 flex-1">
        <Campus store={store} />
      </div>
      <BuildingInteriorDrawer store={store} state={state} />
      <ProblemOpener open={openerOpen} onClose={() => setOpenerOpen(false)} />
    </div>
  );
}

const STATUS_CLASS: Record<Status, string> = {
  working: "bg-emerald-500/20 text-emerald-300",
  waiting: "bg-amber-500/20 text-amber-300",
  blocked: "bg-red-500/20 text-red-300",
  done: "bg-white/10 text-white/60",
};

const DECISION_CLASS: Record<CheckDecision, string> = {
  allow: "bg-emerald-500/20 text-emerald-300",
  ask: "bg-amber-500/20 text-amber-300",
  deny: "bg-red-500/25 text-red-200",
};

const BUTTON = "rounded-md px-3 py-1.5 text-sm font-semibold";

type SectionProps = { title: string; children: ReactNode };

function Section({ title, children }: SectionProps) {
  return (
    <section className="border-b border-white/10 p-4">
      <h2 className="mb-3 text-sm font-bold tracking-widest text-white/80 uppercase">{title}</h2>
      {children}
    </section>
  );
}

type DotProps = { color: string };

function Dot({ color }: DotProps) {
  return <span style={agentColor(color)} className="inline-block size-3 shrink-0 rounded-full bg-(--agent)" />;
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
            {plan.source && <span className="font-mono text-[10px] text-white/50">{plan.source}</span>}
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

  return (
    <Section title="Leases & approvals">
      {/* Pending human approvals */}
      {approvals.length > 0 && (
        <div className="mb-3 space-y-2">
          {approvals.map((a) => {
            const ttl = formatTtl(a.expires_at, now);
            return (
              <div
                key={a.id}
                style={agentColor(colorOf(a.agent))}
                className="rounded-lg border-l-4 border-(--agent) bg-(--agent)/15 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">
                    <span className="text-(--agent)">{a.agent}</span> wants {a.tool}{" "}
                    <span className="font-mono text-white">{a.target}</span>
                  </p>
                  {ttl && (
                    <span className="ml-auto rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] text-amber-200">
                      {ttl}
                    </span>
                  )}
                </div>
                <p className="mt-1 mb-2 text-xs text-white/75">{a.reason}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(store, { kind: "approve", id: a.id, decision: "allow" })}
                    className={`${BUTTON} bg-emerald-600 hover:bg-emerald-500`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => act(store, { kind: "approve", id: a.id, decision: "deny" })}
                    className={`${BUTTON} bg-white/10 hover:bg-white/20`}
                  >
                    Deny
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active file leases with TTL countdown & wait queue */}
      {leases.length === 0 && approvals.length === 0 ? (
        <p className="text-xs text-white/50">No active file leases or pending approvals.</p>
      ) : leases.length > 0 ? (
        <div className="space-y-2">
          {leases.map((lease) => {
            const ttl = formatTtl(lease.expires_at, now);
            const holderColor = colorOf(lease.agent);
            return (
              <div
                key={`${lease.file}:${lease.agent}`}
                style={agentColor(holderColor)}
                className="rounded-md border border-white/10 border-l-4 border-l-(--agent) bg-white/5 px-2.5 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Dot color={holderColor} />
                  <span className="truncate font-mono font-semibold text-white">{lease.file}</span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-emerald-300">
                    {ttl ?? "active"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/65">
                  <span>
                    Holder: <strong className="text-(--agent)">{lease.agent}</strong>
                  </span>
                  {lease.waiters.length > 0 && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">
                      Wait queue: {lease.waiters.join(" → ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
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
    <Section title="Commit timeline">
      {worktrees.map((w) => (
        <div key={w.agent} style={agentColor(w.color)} className="mb-3 rounded-lg border-l-4 border-(--agent) bg-white/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Dot color={w.color} />
            <span className="text-base font-bold text-(--agent)">{w.agent}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[w.status]}`}>{w.status}</span>
            <span className="ml-auto font-mono text-xs text-white/60">+{w.ahead}</span>
          </div>
          <p className="mt-1 text-sm text-white/90">{w.task}</p>
          <p className="font-mono text-xs text-white/50">{w.branch}</p>
          {w.claims.length > 0 && <p className="mt-0.5 text-xs text-white/65">Claims: {w.claims.map(name).join(", ")}</p>}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => act(store, { kind: "merge", agent: w.agent })}
              className={`${BUTTON} bg-white/10 hover:bg-white/20`}
            >
              Merge
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
                  <div key={c.sha} className="rounded bg-black/25 p-2 text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 font-mono text-amber-200/90">{c.sha.slice(0, 7)}</span>
                      <span className="flex-1 font-medium text-white/90">{c.message}</span>
                      {time && <span className="shrink-0 font-mono text-[10px] text-white/45">{time}</span>}
                    </div>
                    <div className="mt-1 space-y-0.5 font-mono text-[10px] text-white/55">
                      <p>Bullpen-Agent: {w.agent}</p>
                      {taskTrailer && <p className="truncate">Bullpen-Task: {taskTrailer}</p>}
                    </div>
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
    <Section title="Jetson referee log">
      {checks.length === 0 ? (
        <p className="text-xs text-white/50">No policy checks recorded yet.</p>
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
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${DECISION_CLASS[c.decision]}`}
                  >
                    {c.decision}
                  </span>
                  {isOffline ? (
                    <span className="rounded bg-red-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white uppercase">
                      OFFLINE · fail closed
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-white/85">rule: {c.rule}</span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-white/55">
                    {c.latency_ms}ms · {c.model || "—"}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-white/70">
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

function Feed() {
  const feed = useBullpen((s) => s.feed);
  return (
    <Section title="Feed">
      {[...feed].reverse().map((f) => (
        <p key={f.sha} className="mb-1 flex items-center gap-2 text-sm">
          <Dot color={f.color} />
          <span className="flex-1">{f.message}</span>
          <span className="font-mono text-xs text-white/50">{f.sha.slice(0, 7)}</span>
        </p>
      ))}
    </Section>
  );
}

function SidePanel() {
  return (
    <aside className="h-full w-[35%] overflow-y-auto border-l border-white/10">
      <OrchestratorBox />
      <MergeIntentCards />
      <LeasesAndApprovals />
      <CommitTimeline />
      <RefereeLog />
      <Selection />
      <Feed />
    </aside>
  );
}

export default function Bullpen() {
  return (
    <BullpenProvider>
      <main className="flex h-screen">
        <CampusPane />
        <SidePanel />
      </main>
    </BullpenProvider>
  );
}
