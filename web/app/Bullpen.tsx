"use client";

import dynamic from "next/dynamic";
import { createContext, use, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
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

function CampusPane() {
  return (
    <div className="h-full w-[65%]">
      <Campus store={useStore()} />
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
