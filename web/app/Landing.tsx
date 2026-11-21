"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import LandingCampus from "./LandingCampus";

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
const BTN_PRIMARY = `${BTN} border-[#006747] bg-[#006747] text-white hover:bg-[#007f58]`;
const BTN_GHOST = `${BTN} border-[#CFC493]/60 text-[#EDEBD1] hover:border-[#CFC493]`;
const PANEL = "rounded-lg border border-white/10 bg-[#0d231b]";
const LABEL = "text-base font-semibold text-[#CFC493]";
const H2 = "text-3xl font-bold leading-tight sm:text-4xl";
const SUB = "max-w-2xl text-white/75";

const STEPS: [string, React.ReactNode][] = [
  ["Ask once", "Type or say what you want in the chat box."],
  ["Split", "The orchestrator turns it into three tasks: api, web and db."],
  ["Branch", "Each agent works in its own git worktree and branch."],
  ["Referee", <>Every edit asks first. A file lease lasts 90 s; <code className="font-mono text-[#CFC493]">db/**</code> needs your approval.</>],
  ["Commit", "Each edit auto-commits with its agent and task. Undo or merge one agent at a time."],
];

const LEDGER = [
  ["No API key", <>Agents run through the <code className="font-mono text-[#CFC493]">claude</code> CLI on the subscription you already pay for.</>, "claude CLI"],
  ["No code leaves the room", "Commit messages, summaries and ask-why run on local models on the Jetson.", "local"],
  ["History is free", "Writing the history costs zero Claude usage.", "0 tokens"],
  ["Fails closed", "Server down or Jetson unplugged: every edit is denied until it comes back.", "rule offline"],
] as const;

const PROOF = [
  ["Commit timeline", "git log of each worktree branch"],
  ["Locks", "GET /state leases, approvals"],
  ["Referee log", "check events: rule, latency, model"],
  ["Building click", "GET /diff?agent=&file="],
  ["The campus", "campus/campus.json from make_campus.py"],
] as const;

type HeadProps = { label: string; id: string; title: string; children?: React.ReactNode };

function Head({ label, id, title, children }: HeadProps) {
  return (
    <div className="grid gap-2">
      <span className={LABEL}>{label}</span>
      <h2 id={id} className={H2}>{title}</h2>
      {children && <p className={SUB}>{children}</p>}
    </div>
  );
}

type NodeProps = { title: string; port?: string; children: React.ReactNode; className?: string };

function Node({ title, port, children, className = "" }: NodeProps) {
  return (
    <div className={`rounded-md border border-white/15 bg-[#06140e] p-3 ${className}`}>
      <b>{title}</b>
      {port && <span className="ml-2 font-mono text-[13px] text-[#CFC493]">{port}</span>}
      <div className="mt-1 text-[15px] text-white/75">{children}</div>
    </div>
  );
}

function Wire({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1 pl-6 font-mono text-[13px] text-white/70">
      <span aria-hidden className="h-6 w-px bg-[#CFC493]/50" />
      {children}
    </div>
  );
}

function Items({ rows }: { rows: [string, string][] }) {
  return (
    <ul className="mt-1 grid gap-1 text-[14px]">
      {rows.map(([k, v]) => (
        <li key={k}>
          <span className="font-mono text-[#CFC493]">{k}</span> {v}
        </li>
      ))}
    </ul>
  );
}

function Ctas({ href }: { href: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href={href} className={BTN_PRIMARY}>Open the campus</Link>
      <a href="#arch" className={BTN_GHOST}>See the architecture</a>
    </div>
  );
}

export default function Landing() {
  const href = useCampusHref();
  const prsHref = href.replace("/campus", "/prs");
  return (
    <main className="min-h-screen bg-[#06140e] font-sans text-base text-[#EDEBD1]">
      <div className="mx-auto flex max-w-6xl flex-col gap-20 px-4 pb-16 sm:px-6">
        <nav aria-label="Site" className="flex items-center justify-between gap-4 py-4">
          <a href="#top" className="flex items-center gap-2 text-lg font-bold no-underline">
            <img src="/logo.svg" alt="" width={32} height={32} className="[image-rendering:pixelated]" />
            Bullpen
          </a>
          <div className="hidden gap-6 text-[15px] text-white/80 md:flex">
            <a href="#how" className="hover:text-[#CFC493]">How it works</a>
            <a href="#arch" className="hover:text-[#CFC493]">Architecture</a>
            <Link href={prsHref} className="hover:text-[#CFC493]">Pull requests</Link>
          </div>
          <Link href={href} className={BTN_PRIMARY}>Open the campus</Link>
        </nav>

        <header id="top" className="grid gap-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-end">
            <h1 className="text-4xl font-bold leading-[1.05] sm:text-6xl">Source control for AI agents</h1>
            <div className="grid gap-5">
              <p className="text-lg text-white/80">
                Tell one orchestrator what you want. Three Claude Code agents build it on your own sub, and a Jetson referee checks every edit before it lands.
              </p>
              <Ctas href={href} />
            </div>
          </div>
          <LandingCampus />
        </header>

        <section aria-labelledby="prob-h" className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <Head label="The problem" id="prob-h" title="Git was built for humans.">
            Two agents on one repo open the same file. The second save wins, the first agent&apos;s work is gone, and there is no commit to bring it back. Two PRs can each be clean against main and still collide. Bullpen catches it.
          </Head>
          <div className={`${PANEL} overflow-hidden font-mono text-[14px]`} aria-label="Two agents overwrite shared/auth.ts">
            <div className="flex flex-wrap justify-between gap-2 border-b border-white/10 bg-[#005432] px-4 py-2">
              <span>shared/auth.ts</span>
              <span className="text-white/75">two agents, one file, no referee</span>
            </div>
            <div className="grid gap-1 p-4">
              <div><time className="text-white/70">14:02:11</time> <b className="text-[#ff7a7f]">api</b> Edit: adds verifyToken()</div>
              <div><time className="text-white/70">14:02:13</time> <b className="text-[#8da4ef]">web</b> Write: the whole file, from its stale copy</div>
            </div>
            <div role="img" aria-label="Diff: api's verifyToken lines are deleted by web's write" className="grid overflow-x-auto">
              <div className="whitespace-pre bg-[#C4373C]/20 px-4">12 - export function verifyToken(t: string) {"{"}</div>
              <div className="whitespace-pre bg-[#C4373C]/20 px-4">13 -   return jwt.verify(t, SECRET) as Session;</div>
              <div className="whitespace-pre bg-[#C4373C]/20 px-4">14 - {"}"}</div>
              <div className="whitespace-pre bg-[#1F8A5B]/25 px-4">12 + export const login = (u: User) =&gt; session.start(u);</div>
            </div>
            <div className="grid gap-2 p-4">
              <div className="flex flex-wrap gap-x-3">
                <b className="text-[#ff7a7f]">Without Bullpen</b>
                <span>git log shared/auth.ts</span>
                <span className="text-[#ff7a7f]">(no commits)</span>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <b className="text-[#4cc38a]">With Bullpen</b>
                <span>api holds the lease, web waits</span>
                <span className="text-[#4cc38a]">a1b2c3d auth: add verifyToken</span>
              </div>
            </div>
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="grid gap-8">
          <Head label="How it works" id="how-h" title="One ask, three agents, one referee." />
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(([title, body], i) => (
              <li key={title} className={`${PANEL} grid content-start gap-2 p-4`}>
                <span className="font-mono text-[15px] font-bold text-[#CFC493]">{i + 1}</span>
                <b>{title}</b>
                <p className="text-[15px] text-white/75">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="arch" aria-labelledby="arch-h" className="grid gap-8">
          <Head label="Architecture" id="arch-h" title="The rules live on hardware the agents cannot reach." />
          <div className="grid gap-2">
            <p className="text-[15px] text-white/75"><b className="text-[#EDEBD1]">Your Mac</b>, next to the git worktrees</p>
            <div className="rounded-lg border border-[#CFC493]/25 bg-[#0d231b] p-4 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <Node title="Chat or voice">One ask, typed or spoken</Node>
                <Node title="Orchestrator" port=":8650 POST /orchestrate">Claude Code splits the ask into tasks</Node>
              </div>
              <Wire>starts 3 agents, one worktree each</Wire>
              <div className="grid gap-3 sm:grid-cols-3">
                <Node title="api" className="border-l-4 border-l-[#e5484d]">Claude Code, own worktree</Node>
                <Node title="web" className="border-l-4 border-l-[#3e63dd]">Claude Code, own worktree</Node>
                <Node title="db" className="border-l-4 border-l-[#CFC493]">Claude Code, own worktree</Node>
              </div>
              <Wire>every Edit, Write and Bash</Wire>
              <Node title="Hook" port="hooks/bullpen_hook.py">
                PreToolUse asks <code className="font-mono">/checkout</code>, PostToolUse and Stop post to <code className="font-mono">/hook</code>
              </Node>
              <Wire>POST /checkout, POST /hook</Wire>
              <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                <Node title="Server" port=":8600">
                  <Items rows={[["leases", "90 s TTL, wait queue"], ["auto-commit", "with trailers"], ["undo, merge", "per agent"], ["approvals", "60 s, then deny"]]} />
                </Node>
                <div className="grid justify-items-center gap-1 font-mono text-[13px] text-white/70">
                  <span>POST /check</span>
                  <span aria-hidden className="h-px w-16 bg-[#CFC493]/60 max-lg:h-6 max-lg:w-px" />
                  <span>allow, ask, deny</span>
                </div>
                <Node title="Jetson referee" port=":8700, over USB" className="border-[#CFC493]/60">
                  <Items rows={[["/check", "rules, no model"], ["/commit_msg", "qwen2.5-coder:3b"], ["/summarize", "llama3.2:3b"], ["/ask", "nomic-embed-text + llama3.2:3b"], ["/scan", "secret guard"]]} />
                </Node>
              </div>
              <Wire>WebSocket /ws: state, commit, check</Wire>
              <Node title="Web campus" port=":5173, Next.js 16 + Phaser 3">
                Buildings are folders, main is the campus, each branch is a colored layer
              </Node>
            </div>
          </div>
        </section>

        <section aria-labelledby="sub-h" className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <Head label="Cost and privacy" id="sub-h" title="Runs on your own Claude sub, refereed locally.">
            Your sub writes the code. The Jetson keeps it honest, free, and private.
          </Head>
          <dl className={`${PANEL} divide-y divide-white/10`}>
            {LEDGER.map(([term, body, val]) => (
              <div key={term} className="grid gap-1 p-4 sm:grid-cols-[1fr_auto] sm:gap-4">
                <div>
                  <dt className="font-bold">{term}</dt>
                  <dd className="text-[15px] text-white/75">{body}</dd>
                </div>
                <span className="font-mono text-[14px] text-[#CFC493] sm:self-center">{val}</span>
              </div>
            ))}
          </dl>
        </section>

        <section id="proof" aria-labelledby="proof-h" className="grid gap-8">
          <Head label="Proof" id="proof-h" title="Every animation maps to real data." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PROOF.map(([title, src]) => (
              <div key={title} className={`${PANEL} grid content-start gap-2 p-4`}>
                <b>{title}</b>
                <span className="text-[13px] text-white/70">reads</span>
                <span className="break-words font-mono text-[14px] text-[#CFC493]">{src}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="cta-h" className="grid justify-items-start gap-5 rounded-lg border border-[#CFC493]/25 bg-[#0d231b] p-8">
          <h2 id="cta-h" className={H2}>Point it at any repo. It builds your campus.</h2>
          <Ctas href={href} />
        </section>

        <footer className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-6 text-[14px] text-white/70">
          <span>Bullpen, built at HackJam &apos;26, USF Tampa.</span>
          <span className="font-mono">Git was built for humans. Bullpen is version control for agents.</span>
        </footer>
      </div>
    </main>
  );
}
