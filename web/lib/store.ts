import { reduce, type Snapshot } from "./reduce.ts";
import type { Envelope, Fx, UiState } from "./types.ts";

export type StoreState = Snapshot & { ui: UiState };
export type Store = ReturnType<typeof createStore>;

export function createStore() {
  let state: StoreState = {
    data: { main: "main", worktrees: [], approvals: [] },
    feed: [],
    ui: { tab: "main", selected: null },
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
      if (snapshot.data !== state.data || snapshot.feed !== state.feed) set({ ...state, ...snapshot });
      fx.forEach((f) => fxListeners.forEach((l) => l(f)));
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
