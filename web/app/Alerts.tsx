"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { act } from "@/lib/server.ts";
import { closesNotice, createSfx, noticesFor, type Notice, type NoticeKind, type Sound } from "@/lib/sound.ts";
import type { Store } from "@/lib/store.ts";

const VOLUME = 0.15;
const MUTE_KEY = "bullpen:muted";
const TOAST_MS = 6000;
const MAX_TOASTS = 3;

// Mute covers sounds, chimes and browser notifications. Toasts always show.
let muted = false;
try {
  muted = typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
} catch {}
const muteListeners = new Set<() => void>();
const setMuted = (next: boolean) => {
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {}
  muteListeners.forEach((l) => l());
};

// The AudioContext exists only after the first click, so the browser never blocks autoplay.
let ctx: AudioContext | null = null;
function unlock() {
  ctx ??= new AudioContext();
  if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
}

// [frequency Hz, length s] notes, square wave for the 8-bit event sounds, triangle for the softer chimes.
const SOUNDS: Record<Sound, [number, number][]> = {
  claim: [[523, 0.05], [784, 0.07]],
  wait: [[392, 0.08], [392, 0.08]],
  commit: [[659, 0.05], [988, 0.08]],
  undo: [[523, 0.06], [392, 0.06], [262, 0.12]],
  merge: [[523, 0.05], [659, 0.05], [784, 0.05], [1047, 0.12]],
  blocked: [[196, 0.16]],
  offline: [[330, 0.12], [220, 0.12], [147, 0.22]],
};
const CHIMES: Record<NoticeKind, [number, number][]> = {
  approval: [[880, 0.12], [1175, 0.2]],
  blocked: [[440, 0.12], [370, 0.2]],
  wait: [[698, 0.18]],
  done: [[784, 0.1], [1047, 0.2]],
  merge: [[1047, 0.1], [1319, 0.1], [1568, 0.22]],
  offline: [[294, 0.2], [220, 0.3]],
};

function playNotes(notes: [number, number][], wave: OscillatorType) {
  if (muted || !ctx) return;
  let t = ctx.currentTime;
  for (const [freq, len] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(VOLUME, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + len);
    t += len;
  }
}

type SoundToggleProps = { className?: string };

export function SoundToggle({ className = "" }: SoundToggleProps) {
  const isMuted = useSyncExternalStore(
    (l) => (muteListeners.add(l), () => void muteListeners.delete(l)),
    () => muted,
    () => false,
  );
  return (
    <button
      type="button"
      onClick={() => setMuted(!isMuted)}
      aria-pressed={!isMuted}
      title="Sounds, chimes and browser notifications"
      className={className}
    >
      {isMuted ? "🔇 Sound off" : "🔊 Sound on"}
    </button>
  );
}

const TOAST_CLASS: Record<NoticeKind, string> = {
  approval: "border-amber-400 bg-[#2a2410]",
  blocked: "border-red-500 bg-[#2a1010]",
  offline: "border-red-500 bg-[#2a1010]",
  wait: "border-amber-300/60 bg-[#0d231b]",
  done: "border-emerald-400/70 bg-[#0d231b]",
  merge: "border-[#cfc493] bg-[#0d231b]",
};

type AlertsProps = { store: Store };

export function Alerts({ store }: AlertsProps) {
  const [toasts, setToasts] = useState<Notice[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    window.addEventListener("pointerdown", unlock, { once: true });
    const sfx = createSfx((s) => playNotes(SOUNDS[s], "square"));
    const close = (key: string) => setToasts((ts) => ts.filter((t) => t.key !== key));
    let prev: Record<string, string> = {};
    const off = store.onEnvelope((e) => {
      const before = prev;
      prev = Object.fromEntries(store.getState().data.worktrees.map((w) => [w.agent, w.status]));
      sfx(e);
      const closing = closesNotice(e);
      if (closing) close(closing);
      if (e.replay) return;
      if (e.type === "check" && e.data.rule !== "offline") seen.current.delete("offline");
      for (const n of noticesFor(e, before)) {
        if (seen.current.has(n.key)) continue;
        seen.current.add(n.key);
        playNotes(CHIMES[n.kind], "triangle");
        if (!muted && !document.hasFocus() && typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Bullpen", { body: n.text, tag: n.key });
          } catch {}
        }
        // Newest first; approvals stay until answered, others leave after 6 s or when pushed past three.
        setToasts((ts) => [n, ...ts].slice(0, MAX_TOASTS));
        if (n.kind !== "approval") window.setTimeout(() => close(n.key), TOAST_MS);
      }
    });
    return () => {
      off();
      window.removeEventListener("pointerdown", unlock);
    };
  }, [store]);

  if (toasts.length === 0) return null;
  return (
    <div role="status" className="fixed right-4 bottom-4 z-50 flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.key} className={`rounded-lg border-2 p-3 text-base text-white shadow-lg ${TOAST_CLASS[t.kind]}`}>
          <div className="flex items-start gap-2">
            <p className="flex-1">{t.text}</p>
            <button
              type="button"
              onClick={() => setToasts((ts) => ts.filter((x) => x.key !== t.key))}
              aria-label="Dismiss"
              className="px-1 text-white/60 hover:text-white"
            >
              ×
            </button>
          </div>
          {t.approvalId && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => act(store, { kind: "approve", id: t.approvalId!, decision: "allow" })}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => act(store, { kind: "approve", id: t.approvalId!, decision: "deny" })}
                className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20"
              >
                Deny
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
