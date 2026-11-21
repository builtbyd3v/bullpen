"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import LandingCampus from "./LandingCampus";
import "./landing.css";

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

// Ported 1:1 from design/mockups-v3/screens/landing.html (styles in landing.css, dark tokens).
export default function Landing() {
  const campusHref = useCampusHref();
  const prsHref = campusHref.replace("/campus", "/prs");
  return (
    <div id="landing">
      <div className="lp-wrap">
      <div className="lp">
      
              <nav className="lp-nav" aria-label="Site">
                <a className="lp-brand" href="#land-top"><img src="/logo.svg" alt="" width={28} height={28} className="[image-rendering:pixelated]" />Bullpen</a>
                <div className="lp-links">
                  <a href="#land-how">How it works</a>
                  <a href="#land-arch">Architecture</a>
                  <a href="#land-proof">Proof</a>
                  <a href={prsHref}>Pull requests</a>
                </div>
                <a className="btn btn-sm btn-primary" href={campusHref}>Open the campus</a>
              </nav>
      
              <header className="lp-hero" id="land-top">
                <div className="lp-hero-copy">
                  <h3>Source control for AI agents</h3>
                  <div className="side">
                    <p className="lp-sub">Tell one orchestrator what you want. Three Claude Code agents build it on your own sub, and a Jetson referee checks every edit before it lands.</p>
                    <div className="ctas">
                      <a className="btn btn-primary" href={campusHref}>Open the campus</a>
                      <a className="btn" href="#land-arch">Read the docs</a>
                    </div>
                  </div>
                </div>
      
                <LandingCampus />
              </header>
      
              <section className="lp-problem" aria-labelledby="land-prob-h">
                <div className="lp-h">
                  <span className="k">The problem</span>
                  <h3 id="land-prob-h">Git was built for humans.</h3>
                  <p>Two agents on one repo open the same file. The second save wins, the first agent's work is gone, and there is no commit to bring it back.</p>
                </div>
                <div className="vignette" aria-label="Two agents overwrite shared/auth.ts">
                  <div className="v-bar"><span>shared/auth.ts</span><span>two agents, one file, no referee</span></div>
                  <div className="v-log">
                    <div><time>14:02:11</time><span className="who who-api">api</span><span>Edit: adds verifyToken()</span></div>
                    <div><time>14:02:13</time><span className="who who-web">web</span><span>Write: the whole file, from its stale copy</span></div>
                  </div>
                  <div className="diff" role="img" aria-label="Diff: api's verifyToken lines are deleted by web's write">
                    <div className="del"><span className="n">12</span><span className="g">-</span><span>export function verifyToken(t: string) {"{"}</span></div>
                    <div className="del"><span className="n">13</span><span className="g">-</span><span>  return jwt.verify(t, SECRET) as Session;</span></div>
                    <div className="del"><span className="n">14</span><span className="g">-</span><span>{"}"}</span></div>
                    <div className="add"><span className="n">12</span><span className="g">+</span><span>export const login = (u: User) =&gt; session.start(u);</span></div>
                  </div>
                  <div className="v-out">
                    <div><b className="bad">Without Bullpen</b><span>git log shared/auth.ts</span><span className="bad">(no commits)</span></div>
                    <div><b className="ok">With Bullpen</b><span>api holds the lease, web waits</span><span className="ok">a1b2c3d auth: add verifyToken</span></div>
                  </div>
                </div>
              </section>
      
              <section className="lp-how" id="land-how" aria-labelledby="land-how-h" style={{ display: "grid", gap: 32 }}>
                <div className="lp-h">
                  <span className="k">How it works</span>
                  <h3 id="land-how-h">One ask, three agents, one referee.</h3>
                </div>
                <ol className="flow">
                  <li><b>Ask once</b><p>Type or say what you want in the chat box.</p></li>
                  <li><b>Split</b><p>The orchestrator turns it into three tasks: api, web and db.</p></li>
                  <li><b>Branch</b><p>Each agent works in its own git worktree and branch.</p></li>
                  <li><b>Referee</b><p>Every edit asks first. A file lease lasts 90 s; <code>db/**</code> needs your approval.</p></li>
                  <li><b>Commit</b><p>Each edit auto-commits with its agent and task. Undo or merge one agent at a time.</p></li>
                </ol>
              </section>
      
              <section id="land-arch" aria-labelledby="land-arch-h" style={{ display: "grid", gap: 32 }}>
                <div className="lp-h">
                  <span className="k">Architecture</span>
                  <h3 id="land-arch-h">The rules live on hardware the agents cannot reach.</h3>
                </div>
                <div className="arch">
                  <div className="zone-label"><b>Your Mac</b>, next to the git worktrees</div>
                  <div className="arch-zone">
                    <div className="row row-2">
                      <div className="node"><b>Chat or voice</b><p>One ask, typed or spoken</p></div>
                      <div className="node"><b>Orchestrator</b><span className="port">:8650 POST /orchestrate</span><p>Claude Code splits the ask into tasks</p></div>
                    </div>
                    <div className="link">starts 3 agents, one worktree each</div>
                    <div className="row row-3">
                      <div className="node node-agent" style={{ "--c": "var(--api)" } as CSSProperties}><b>api</b><p>Claude Code, own worktree</p></div>
                      <div className="node node-agent" style={{ "--c": "var(--web)" } as CSSProperties}><b>web</b><p>Claude Code, own worktree</p></div>
                      <div className="node node-agent" style={{ "--c": "var(--db)" } as CSSProperties}><b>db</b><p>Claude Code, own worktree</p></div>
                    </div>
                    <div className="link">every Edit, Write and Bash</div>
                    <div className="node"><b>Hook</b><span className="port">hooks/bullpen_hook.py</span><p>PreToolUse asks <code>/checkout</code>, PostToolUse and Stop post to <code>/hook</code></p></div>
                    <div className="link">POST /checkout, POST /hook</div>
                    <div className="row row-ref">
                      <div className="node"><b>Server</b><span className="port">:8600</span>
                        <ul><li><span>leases</span> 90 s TTL, wait queue</li><li><span>auto-commit</span> with trailers</li><li><span>undo, merge</span> per agent</li><li><span>approvals</span> 60 s, then deny</li></ul></div>
                      <div className="link-h"><span>POST /check</span><span className="bar"></span><span>allow, ask, deny</span></div>
                      <div className="node node-jet"><b>Jetson referee</b><span className="port">:8700, over USB</span>
                        <ul><li><span>/check</span> rules, no model</li><li><span>/commit_msg</span> qwen2.5-coder:3b</li><li><span>/summarize</span> llama3.2:3b</li><li><span>/ask</span> nomic-embed-text + llama3.2:3b</li><li><span>/scan</span> secret guard</li></ul></div>
                    </div>
                    <div className="link">WebSocket /ws: state, commit, check</div>
                    <div className="node"><b>Web campus</b><span className="port">:5173, Next.js 16 + Phaser 3</span><p>Buildings are folders, main is the campus, each branch is a colored layer</p></div>
                  </div>
                </div>
              </section>
      
              <section className="lp-sub-sec" aria-labelledby="land-sub-h">
                <div className="lp-h">
                  <span className="k">Cost and privacy</span>
                  <h3 id="land-sub-h">Runs on your own Claude sub, refereed locally.</h3>
                  <p>Your sub writes the code. The Jetson keeps it honest, free, and private.</p>
                </div>
                <dl className="ledger">
                  <div><dt>No API key</dt><dd>Agents run through the <code>claude</code> CLI on the subscription you already pay for.</dd><span className="val">claude CLI</span></div>
                  <div><dt>No code leaves the room</dt><dd>Commit messages, summaries and ask-why run on local models on the Jetson.</dd><span className="val">local</span></div>
                  <div><dt>History is free</dt><dd>Writing the history costs zero Claude usage.</dd><span className="val">0 tokens</span></div>
                  <div><dt>Fails closed</dt><dd>Server down or Jetson unplugged: every edit is denied until it comes back.</dd><span className="val">rule offline</span></div>
                </dl>
              </section>
      
              <section className="proof" id="land-proof" aria-labelledby="land-proof-h">
                <div className="lp-h">
                  <span className="k">Proof</span>
                  <h3 id="land-proof-h">Every animation maps to real data.</h3>
                </div>
                <div className="maps">
                  <div><b>Commit timeline</b><span className="arrow">reads</span><span className="src">git log of each worktree branch</span></div>
                  <div><b>Leases panel</b><span className="arrow">reads</span><span className="src">GET /state leases, approvals</span></div>
                  <div><b>Referee log</b><span className="arrow">reads</span><span className="src">check events: rule, latency, model</span></div>
                  <div><b>Building click</b><span className="arrow">reads</span><span className="src">GET /diff?agent=&amp;file=</span></div>
                  <div><b>The campus</b><span className="arrow">reads</span><span className="src">campus/campus.json from make_campus.py</span></div>
                </div>
              </section>
      
              <section className="lp-cta" id="land-cta" aria-labelledby="land-cta-h">
                <h3 id="land-cta-h">Point it at any repo. It builds your campus.</h3>
                <div className="ctas">
                  <a className="btn btn-primary" href={campusHref}>Open the campus</a>
                  <a className="btn" href="#land-arch">Read the docs</a>
                </div>
              </section>
              <footer className="lp-foot"><span>Bullpen, built at HackJam '26, USF Tampa.</span><span className="mono">Git was built for humans. Bullpen is version control for agents.</span></footer>
      </div>
      </div>
    </div>
  );
}
