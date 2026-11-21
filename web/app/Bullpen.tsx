"use client";

import dynamic from "next/dynamic";

const Campus = dynamic(() => import("./Campus"), { ssr: false });

export default function Bullpen() {
  return (
    <main className="flex h-screen">
      <div className="h-full w-[65%]">
        <Campus />
      </div>
      <aside className="h-full w-[35%] border-l border-white/10 p-4 font-mono text-sm text-white/60">
        Side panel
      </aside>
    </main>
  );
}
