"use client";

import Link from "next/link";
import { useState } from "react";
import { resetDemo, SERVER_URL } from "../lib/server";
import { SoundToggle } from "./Alerts";
import { useCampusHref } from "./Landing";

const ORCHESTRATOR_URL = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:8650";
const ROW = "flex flex-wrap items-center justify-between gap-3 border-t border-[#CFC493] py-4";

type UrlRowProps = { label: string; value: string };

function UrlRow({ label, value }: UrlRowProps) {
  return (
    <div className={ROW}>
      <span className="font-semibold">{label}</span>
      <code className="rounded bg-[#E2DFC0] px-2 py-1 text-sm">{value}</code>
    </div>
  );
}

export default function Settings() {
  const campus = useCampusHref();
  const fakeOn = campus.endsWith("?fake");
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const reset = async () => {
    setResetting(true);
    setResetMsg(null);
    try {
      setResetMsg(`Reset in ${await resetDemo()}s`);
    } catch (err: unknown) {
      setResetMsg(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };
  const BTN = "rounded-md border border-[#006747] bg-[#006747] px-4 py-2 text-sm font-semibold text-[#F7F6EA] no-underline hover:bg-[#005432]";
  return (
    <main className="min-h-screen bg-[#EDEBD1] font-sans text-[#0D231B]">
      <div className="mx-auto grid max-w-2xl gap-6 px-5 py-10">
        <Link href={campus} className="text-sm font-semibold text-[#006747]">
          Back to campus
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-[#466069]">
            The referee decides allow, ask or deny for every edit. Put it where the agents cannot touch it.
          </p>
        </div>
        <section className="rounded-lg border border-[#CFC493] bg-[#F7F6EA] px-5">
          <div className={`${ROW} border-t-0`}>
            <span className="font-semibold">Sound</span>
            <SoundToggle className={BTN} />
          </div>
          <div className={ROW}>
            <span className="font-semibold">Fake mode</span>
            <Link href={fakeOn ? "/settings" : "/settings?fake"} className={BTN}>
              {fakeOn ? "On, turn off" : "Off, turn on"}
            </Link>
          </div>
          <div className={ROW}>
            <span className="font-semibold">Demo repo</span>
            <span className="flex items-center gap-3">
              {resetMsg && <span className="text-sm text-[#466069]">{resetMsg}</span>}
              <button type="button" onClick={reset} disabled={resetting} className={`${BTN} disabled:opacity-50`}>
                {resetting ? "Resetting..." : "Reset demo"}
              </button>
            </span>
          </div>
          <UrlRow label="Server URL" value={SERVER_URL} />
          <UrlRow label="Orchestrator URL" value={ORCHESTRATOR_URL} />
        </section>
      </div>
    </main>
  );
}
