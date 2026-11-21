"use client";

import { useEffect, useState } from "react";
import campus from "../../campus/campus.json" with { type: "json" };
import { buildingForFile } from "@/lib/campus.ts";
import { fetchDiff } from "@/lib/server.ts";
import type { Store, StoreState } from "@/lib/store.ts";
import type { Building } from "@/lib/types.ts";

const buildings: Building[] = campus.buildings;

type Props = {
  store: Store;
  state: StoreState;
};

function DiffLines({ diff }: { diff: string }) {
  if (!diff.trim()) {
    return <p className="font-mono text-xs italic text-white/50">No diff lines for this selection.</p>;
  }
  return (
    <pre className="overflow-x-auto font-mono text-xs leading-5">
      {diff.split("\n").map((line, i) => {
        const cls =
          line.startsWith("+") && !line.startsWith("+++")
            ? "bg-emerald-500/15 text-emerald-300"
            : line.startsWith("-") && !line.startsWith("---")
              ? "bg-red-500/15 text-red-300"
              : line.startsWith("@@")
                ? "text-sky-300"
                : "text-white/75";
        return (
          <div key={i} className={`px-2 ${cls}`}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

// Header bar (Back button) + bottom real diff & live hook mini-log for the zoomed building (Issue #37).
export function BuildingInteriorHeader({ store, state }: Props) {
  const buildingId = state.ui.zoomedBuildingId;
  if (!buildingId) return null;
  const b = buildings.find((item) => item.id === buildingId);
  if (!b) return null;
  const folder = b.folder === null ? "unmapped" : b.folder || "/";

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#0b1913] px-3 py-2">
      <button
        type="button"
        onClick={() => store.setUi({ zoomedBuildingId: null, selectedRoomPath: null })}
        className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
      >
        ← Back to campus
      </button>
      <div className="flex items-center gap-2">
        <span className="font-bold text-white">{b.name}</span>
        <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-emerald-300">{folder}</span>
        {b.guarded && (
          <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300 uppercase">
            Guarded
          </span>
        )}
      </div>
      <span className="ml-auto text-xs text-white/50">Click any room to inspect its diff</span>
    </div>
  );
}

export function BuildingInteriorDrawer({ store, state }: Props) {
  const buildingId = state.ui.zoomedBuildingId;
  const b = buildings.find((item) => item.id === buildingId);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leasesHere = (state.data.leases ?? []).filter((l) => buildingForFile(l.file, buildings) === buildingId);
  const agentsHere = state.data.worktrees.filter(
    (w) =>
      w.building === buildingId ||
      leasesHere.some((l) => l.agent === w.agent) ||
      w.changed_files.some((f) => buildingForFile(f, buildings) === buildingId),
  );
  const fallbackAgents = agentsHere.length > 0 ? agentsHere : state.data.worktrees;
  const activeAgent = fallbackAgents.find((w) => w.agent === selectedAgent)?.agent ?? fallbackAgents[0]?.agent ?? "";

  const activeLeaseFile = leasesHere.find((l) => l.agent === activeAgent)?.file;
  const targetFile = state.ui.selectedRoomPath ?? activeLeaseFile ?? b?.folder ?? "";

  useEffect(() => {
    if (!buildingId || !activeAgent) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDiff(activeAgent, targetFile)
      .then((text) => {
        if (!cancelled) setDiff(text);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load diff");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId, activeAgent, targetFile]);

  if (!buildingId || !b) return null;

  const relevantAgents = new Set(agentsHere.map((w) => w.agent));
  const miniLogs = state.hooks
    .filter(
      (h) =>
        (relevantAgents.size === 0 || relevantAgents.has(h.agent)) ||
        (h.target && buildingForFile(h.target, buildings) === buildingId),
    )
    .slice(0, 12);

  return (
    <div className="grid h-56 shrink-0 grid-cols-12 border-t border-white/15 bg-[#09140f]">
      {/* Live mini log of agent hook actions */}
      <div className="col-span-4 flex min-h-0 flex-col border-r border-white/10 p-3">
        <p className="mb-2 text-xs font-bold tracking-widest text-white/70 uppercase">
          Live action log ({miniLogs.length})
        </p>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto font-mono text-xs">
          {miniLogs.length === 0 ? (
            <p className="italic text-white/45">No hook events recorded for this building yet.</p>
          ) : (
            miniLogs.map((h) => {
              const color = state.data.worktrees.find((w) => w.agent === h.agent)?.color ?? "#94a3b8";
              return (
                <div key={h.id} className="rounded bg-white/5 px-2 py-1">
                  <span style={{ color }} className="font-bold">
                    {h.agent}
                  </span>{" "}
                  <span className="text-white/60">{h.event}</span>
                  {h.tool && <span className="text-emerald-300"> {h.tool}</span>}
                  {h.target && <p className="truncate text-[11px] text-white/55">{h.target}</p>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Real diff from GET /diff?agent=&file= */}
      <div className="col-span-8 flex min-h-0 flex-col p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold tracking-widest text-white/70 uppercase">Diff</p>
          <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs text-amber-200">
            {targetFile || "/"}
          </span>
          <div className="ml-auto flex gap-1">
            {fallbackAgents.map((w) => (
              <button
                key={w.agent}
                type="button"
                onClick={() => setSelectedAgent(w.agent)}
                className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                  activeAgent === w.agent ? "bg-white/20 text-white" : "bg-white/5 text-white/55 hover:bg-white/10"
                }`}
              >
                {w.agent}
              </button>
            ))}
            {state.ui.selectedRoomPath && (
              <button
                type="button"
                onClick={() => store.setUi({ selectedRoomPath: null })}
                className="rounded bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/15"
              >
                All folder
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded border border-white/10 bg-black/40 py-1.5">
          {loading ? (
            <p className="px-2 font-mono text-xs text-white/50">Loading diff...</p>
          ) : error ? (
            <p className="px-2 font-mono text-xs text-red-300">{error}</p>
          ) : (
            <DiffLines diff={diff} />
          )}
        </div>
      </div>
    </div>
  );
}
