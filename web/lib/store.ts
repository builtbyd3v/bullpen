import { reduce, type Snapshot } from "./reduce.ts";
import type { Envelope, Fx, HealthState, Plan, UiState } from "./types.ts";

export type StoreState = Snapshot & { ui: UiState; health: HealthState };
export type Store = ReturnType<typeof createStore>;

const INITIAL_HEALTH: HealthState = {
  server: "checking",
  ws: "checking",
  jetson: "checking",
  model: "checking",
  claude: "checking",
};

export function createStore() {
  let state: StoreState = {
    data: { main: "main", worktrees: [], approvals: [], leases: [] },
    feed: [],
    merges: [],
    checks: [],
    plan: null,
    hooks: [],
    replaying: false,
    health: INITIAL_HEALTH,
    ui: { tab: "main", selected: null, zoomedBuildingId: null, selectedRoomPath: null },
  };
  const listeners = new Set<() => void>();
  const fxListeners = new Set<(fx: Fx) => void>();
  const set = (next: StoreState) => {
    state = next;
    listeners.forEach((l) => l());
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispatch(envelope: Envelope) {
      const { snapshot, fx } = reduce(state, envelope);
      if (
        snapshot.data !== state.data ||
        snapshot.feed !== state.feed ||
        snapshot.merges !== state.merges ||
        snapshot.checks !== state.checks ||
        snapshot.plan !== state.plan ||
        snapshot.hooks !== state.hooks ||
        snapshot.replaying !== state.replaying
      ) {
        set({ ...state, ...snapshot });
      }
      fx.forEach((f) => fxListeners.forEach((l) => l(f)));
    },
    setHealth(partial: Partial<HealthState>) {
      set({ ...state, health: { ...state.health, ...partial } });
    },
    dismissMerge(id: string) {
      const merges = state.merges.filter((m) => m.id !== id);
      if (merges.length !== state.merges.length) set({ ...state, merges });
    },
    setPlan(plan: Plan | null) {
      set({ ...state, plan });
    },
    setUi(partial: Partial<UiState>) {
      set({ ...state, ui: { ...state.ui, ...partial } });
    },
    onFx(listener: (fx: Fx) => void) {
      fxListeners.add(listener);
      return () => void fxListeners.delete(listener);
    },
  };
}
