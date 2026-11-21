"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Campus link that keeps `?fake` when the current URL has it. */
export function useCampusHref(): string {
  const fake = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).has("fake"),
    () => false,
  );
  return fake ? "/campus?fake" : "/campus";
}

export const BTN =
  "inline-flex items-center justify-center rounded-md border border-[#CFC493] px-5 py-2.5 text-sm font-semibold no-underline";
const BTN_PRIMARY = `${BTN} border-[#CFC493] bg-[#CFC493] text-[#0D231B] hover:bg-[#E8DA9E]`;
const KICKER = "text-xs font-semibold uppercase tracking-widest text-[#CFC493]";
const H3 = "text-3xl font-bold leading-tight";

type StepProps = { title: string; children: React.ReactNode };

function Step({ title, children }: StepProps) {
  return (
    <li className="rounded-lg border border-[#CFC493] bg-[#0D231B] p-4">
      <b>{title}</b>
      <p className="mt-1 text-sm text-[#9DBFB7]">{children}</p>
    </li>
  );
}

export default function Landing() {
  const href = useCampusHref();
  return (
    <main className="min-h-screen bg-[#072E20] font-sans text-[#EDEBD1]">
      <div className="mx-auto flex max-w-5xl flex-col gap-16 px-5 pb-20">
        <nav aria-label="Site" className="flex items-center justify-between py-4">
          <a href="#top" className="flex items-center gap-2 text-lg font-bold no-underline">
            <img src="/logo.svg" alt="" width={32} height={32} className="[image-rendering:pixelated]" />
            Bullpen
          </a>
          <div className="hidden gap-6 text-sm sm:flex">
            <a href="#how">How it works</a>
            <Link href="/settings">Settings</Link>
          </div>
          <Link href={href} className={BTN_PRIMARY}>
            Open campus
          </Link>
        </nav>

        <header id="top" className="grid gap-8">
          <h1 className="text-5xl font-bold leading-tight">Source control for AI agents</h1>
          <p className="max-w-2xl text-lg text-[#9DBFB7]">
            Tell one orchestrator what you want. Three Claude Code agents build it on your own sub, and a Jetson referee checks every edit before it lands.
          </p>
          <div>
            <Link href={href} className={BTN_PRIMARY}>
              Open campus
            </Link>
          </div>
          <img
            src="/campus-hero.png"
            alt="The Bullpen pixel campus"
            className="w-full rounded-lg border border-[#CFC493] [image-rendering:pixelated]"
          />
        </header>

        <section aria-labelledby="prob-h" className="grid gap-6">
          <div className="grid gap-2">
            <span className={KICKER}>The problem</span>
            <h3 id="prob-h" className={H3}>Git was built for humans.</h3>
            <p className="max-w-2xl text-[#9DBFB7]">
              Two agents on one repo open the same file. The second save wins, the first agent&apos;s work is gone, and there is no commit to bring it back.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-[#CFC493] bg-[#0D231B] font-mono text-sm">
            <div className="flex justify-between bg-[#005432] px-4 py-2">
              <span>shared/auth.ts</span>
              <span>two agents, one file, no referee</span>
            </div>
            <div className="grid gap-1 p-4">
              <div><time>14:02:11</time> <b className="text-[#e5484d]">api</b> Edit: adds verifyToken()</div>
              <div><time>14:02:13</time> <b className="text-[#3e63dd]">web</b> Write: the whole file, from its stale copy</div>
            </div>
            <div role="img" aria-label="Diff: api's verifyToken lines are deleted by web's write" className="grid">
              <div className="bg-[#C4373C]/15 px-4">12 - export function verifyToken(t: string) {"{"}</div>
              <div className="bg-[#C4373C]/15 px-4">13 -   return jwt.verify(t, SECRET) as Session;</div>
              <div className="bg-[#C4373C]/15 px-4">14 - {"}"}</div>
              <div className="bg-[#1F8A5B]/15 px-4">12 + export const login = (u: User) =&gt; session.start(u);</div>
            </div>
            <div className="grid gap-2 p-4">
              <div className="flex flex-wrap gap-3">
                <b className="text-[#C4373C]">Without Bullpen</b>
                <span>git log shared/auth.ts</span>
                <span className="text-[#C4373C]">(no commits)</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <b className="text-[#1F8A5B]">With Bullpen</b>
                <span>api holds the lease, web waits</span>
                <span className="text-[#1F8A5B]">a1b2c3d auth: add verifyToken</span>
              </div>
            </div>
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="grid gap-6">
          <div className="grid gap-2">
            <span className={KICKER}>How it works</span>
            <h3 id="how-h" className={H3}>One ask, three agents, one referee.</h3>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Step title="Ask once">Type or say what you want in the chat box.</Step>
            <Step title="Split">The orchestrator turns it into three tasks: api, web and db.</Step>
            <Step title="Branch">Each agent works in its own git worktree and branch.</Step>
            <Step title="Referee">
              Every edit asks first. A file lease lasts 90 s; <code>db/**</code> needs your approval.
            </Step>
            <Step title="Commit">Each edit auto-commits with its agent and task. Undo or merge one agent at a time.</Step>
          </ol>
        </section>

        <section className="grid justify-items-start gap-3 rounded-lg bg-[#005432] p-8 text-[#EDEBD1]">
          <p className="text-xl font-bold">Your sub writes the code. The Jetson keeps it honest, free, and private.</p>
          <Link href={href} className={`${BTN} border-[#CFC493] bg-[#CFC493] text-[#0D231B]`}>
            Open campus
          </Link>
        </section>
      </div>
    </main>
  );
}
