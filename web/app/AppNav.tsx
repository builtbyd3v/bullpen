"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

type AppNavProps = { conflicts?: number };

// Views of one repo: the campus, its agent pull requests, settings. Keeps ?fake across views.
export function AppNav({ conflicts = 0 }: AppNavProps) {
  const path = usePathname();
  const q = useSyncExternalStore(noSubscribe, () => (new URLSearchParams(window.location.search).has("fake") ? "?fake" : ""), () => "");
  const items = [
    { href: "/campus", label: "Campus" },
    { href: "/prs", label: "Pull requests", badge: conflicts },
    { href: "/settings", label: "Settings" },
  ];
  return (
    <nav aria-label="Views" className="flex gap-1 border-b border-white/10 bg-[#0b1a13] px-4">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href + q}
          aria-current={path === i.href ? "page" : undefined}
          className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold no-underline ${
            path === i.href ? "border-[#CFC493] text-white" : "border-transparent text-white/60 hover:text-white"
          }`}
        >
          {i.label}
          {i.badge ? <span className="rounded bg-red-500/25 px-1.5 py-0.5 font-mono text-xs text-red-200">{i.badge} conflict{i.badge > 1 ? "s" : ""}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
