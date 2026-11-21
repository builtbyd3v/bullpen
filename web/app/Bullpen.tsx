"use client";

import dynamic from "next/dynamic";
import { createContext, use, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { connect } from "@/lib/server.ts";
import { createStore, type Store, type StoreState } from "@/lib/store.ts";

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

function SidePanel() {
  const agents = useBullpen((s) => s.data.worktrees.length);
  return (
    <aside className="h-full w-[35%] border-l border-white/10 p-4 font-mono text-sm text-white/60">
      Side panel ({agents} agents)
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
