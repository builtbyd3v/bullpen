"use client";

import dynamic from "next/dynamic";
import { createContext, use, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import campus from "../../campus/campus.json" with { type: "json" };
import { buildingForFile } from "@/lib/campus.ts";
import { DEMO } from "@/lib/fake.ts";
import { act, connect, isFake } from "@/lib/server.ts";
import { createStore, type Store, type StoreState } from "@/lib/store.ts";
import type { Status } from "@/lib/types.ts";

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
    <button onClick={play} disabled={played} className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-40">
      Play demo
    </button>
  );
}

function Tabs() {
  const store = useStore();
  const tab = useBullpen((s) => s.ui.tab);
  const worktrees = useBullpen((s) => s.data.worktrees);
  const tabs = [
    { id: "main", label: "main", color: "#ffffff", ahead: null as number | null },
    ...worktrees.map((w) => ({ id: w.agent, label: w.agent, color: w.color, ahead: w.ahead })),
  ];
  return (
    <nav className="flex gap-2 border-b border-white/10 p-3">
      {tabs.map((t) => (
        <button
          key={t.id}
          style={agentColor(t.color)}
          onClick={() => store.setUi({ tab: t.id })}
          className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-lg font-semibold ${
            tab === t.id ? "border-(--agent) bg-(--agent)/25 text-white" : "border-transparent text-white/60 hover:bg-white/5"
          }`}
        >
          <span className="size-3 rounded-full bg-(--agent)" />
          {t.label}
          {t.ahead !== null && <span className="font-mono text-sm text-white/60">+{t.ahead}</span>}
        </button>
      ))}
      <PlayDemo />
    </nav>
  );
}

function CampusPane() {
  return (
    <div className="flex h-full w-[65%] flex-col">
      <Tabs />
      <div className="min-h-0 flex-1">
        <Campus store={useStore()} />
      </div>
    </div>
  );
}

const STATUS_CLASS: Record<Status, string> = {
  working: "bg-emerald-500/20 text-emerald-300",
  waiting: "bg-amber-500/20 text-amber-300",
  blocked: "bg-red-500/20 text-red-300",
  done: "bg-white/10 text-white/60",
};

const BUTTON = "rounded-md px-3 py-1.5 text-sm font-semibold";

type SectionProps = { title: string; children: ReactNode };

function Section({ title, children }: SectionProps) {
  return (
    <section className="border-b border-white/10 p-4">
      <h2 className="mb-3 text-base font-bold tracking-widest text-white/80 uppercase">{title}</h2>
      {children}
    </section>
  );
}

type DotProps = { color: string };

function Dot({ color }: DotProps) {
  return <span style={agentColor(color)} className="inline-block size-3 shrink-0 rounded-full bg-(--agent)" />;
}

function NeedsYou() {
  const store = useStore();
  const approvals = useBullpen((s) => s.data.approvals);
  const worktrees = useBullpen((s) => s.data.worktrees);
  return (
    <Section title="Needs you">
      {approvals.length === 0 && <p className="text-white/50">Nothing needs you.</p>}
      {approvals.map((a) => (
        <div
          key={a.id}
          style={agentColor(worktrees.find((w) => w.agent === a.agent)?.color ?? "#888888")}
          className="mb-2 rounded-lg border-l-4 border-(--agent) bg-(--agent)/10 p-3"
        >
          <p className="text-lg font-semibold">
            <span className="text-(--agent)">{a.agent}</span> wants {a.tool} <span className="font-mono">{a.target}</span>
          </p>
          <p className="mb-2 text-white/70">{a.reason}</p>
          <div className="flex gap-2">
            <button onClick={() => act(store, { kind: "approve", id: a.id, decision: "allow" })} className={`${BUTTON} bg-emerald-600 hover:bg-emerald-500`}>
              Approve
            </button>
            <button onClick={() => act(store, { kind: "approve", id: a.id, decision: "deny" })} className={`${BUTTON} bg-white/10 hover:bg-white/20`}>
              Deny
            </button>
          </div>
        </div>
      ))}
    </Section>
  );
}

function Agents() {
  const store = useStore();
  const worktrees = useBullpen((s) => s.data.worktrees);
  const name = (id: string) => campus.buildings.find((b) => b.id === id)?.name ?? id;
  return (
    <Section title="Agents">
      {worktrees.map((w) => (
        <div key={w.agent} style={agentColor(w.color)} className="mb-2 rounded-lg border-l-4 border-(--agent) bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <Dot color={w.color} />
            <span className="text-lg font-bold text-(--agent)">{w.agent}</span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[w.status]}`}>{w.status}</span>
            <span className="ml-auto font-mono text-sm text-white/60">+{w.ahead}</span>
          </div>
          <p className="mt-1">{w.task}</p>
          <p className="font-mono text-sm text-white/50">{w.branch}</p>
          {w.claims.length > 0 && <p className="text-sm text-white/70">Claims: {w.claims.map(name).join(", ")}</p>}
          <div className="mt-2 flex gap-2">
            <button onClick={() => act(store, { kind: "merge", agent: w.agent })} className={`${BUTTON} bg-white/10 hover:bg-white/20`}>
              Merge
            </button>
            <button onClick={() => act(store, { kind: "undo", agent: w.agent })} className={`${BUTTON} bg-red-600/80 hover:bg-red-500`}>
              Undo
            </button>
          </div>
        </div>
      ))}
    </Section>
  );
}

function Selection() {
  const store = useStore();
  const selected = useBullpen((s) => s.ui.selected);
  const worktrees = useBullpen((s) => s.data.worktrees);
  if (!selected) return null;
  const building = selected.kind === "building" ? campus.buildings.find((b) => b.id === selected.id) : undefined;
  const bull = selected.kind === "bull" ? worktrees.find((w) => w.agent === selected.agent) : undefined;
  return (
    <Section title="Selection">
      <div className="mb-2 flex items-center">
        <p className="text-lg font-bold">
          {building && `${building.name} (${building.folder === null ? "unmapped" : building.folder || "/"})`}
          {bull && <span style={agentColor(bull.color)} className="text-(--agent)">{bull.agent}</span>}
        </p>
        <button onClick={() => store.setUi({ selected: null })} className={`${BUTTON} ml-auto bg-white/10 hover:bg-white/20`}>
          Close
        </button>
      </div>
      {building &&
        worktrees.map((w) => {
          const files = w.changed_files.filter((f) => buildingForFile(f, campus.buildings) === building.id);
          return (
            files.length > 0 && (
              <div key={w.agent} style={agentColor(w.color)} className="mb-2">
                <p className="font-bold text-(--agent)">{w.agent}</p>
                <ul className="font-mono text-sm">
                  {files.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )
          );
        })}
      {bull?.commits.map((c) => (
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
        <p key={f.sha} className="mb-1 flex items-center gap-2">
          <Dot color={f.color} />
          <span className="flex-1">{f.message}</span>
          <span className="font-mono text-sm text-white/50">{f.sha.slice(0, 7)}</span>
        </p>
      ))}
    </Section>
  );
}

function SidePanel() {
  return (
    <aside className="h-full w-[35%] overflow-y-auto border-l border-white/10">
      <NeedsYou />
      <Agents />
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
