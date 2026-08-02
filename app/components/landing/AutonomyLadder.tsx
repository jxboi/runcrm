"use client";

import { useState } from "react";

type Rung = {
  level: string;
  may: string;
  example: string;
  tone: string;
  dot: string;
};

const RUNGS: Rung[] = [
  {
    level: "Observer",
    may: "Read and report. Nothing it says can change a row.",
    example: "The Analyst answering “what's stuck?”",
    tone: "border-sky-500/40 bg-sky-500/10 text-sky-200",
    dot: "bg-sky-400",
  },
  {
    level: "Advisor",
    may: "Propose changes as diffs you accept or bin.",
    example: "The Janitor's Friday fix-it list",
    tone: "border-violet-500/40 bg-violet-500/10 text-violet-200",
    dot: "bg-violet-400",
  },
  {
    level: "Operator · gated",
    may: "Act, but only after your one-tap approval.",
    example: "Sending any email to a customer",
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    dot: "bg-amber-400",
  },
  {
    level: "Operator · reporting",
    may: "Act now, tell you after — every change undoable.",
    example: "Logging notes, moving early stages",
    tone: "border-indigo-500/40 bg-indigo-500/10 text-indigo-200",
    dot: "bg-indigo-400",
  },
  {
    level: "Owner",
    may: "Act silently, inside a policy you wrote.",
    example: "Dedupe, enrichment, field hygiene",
    tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    dot: "bg-emerald-400",
  },
];

export default function AutonomyLadder() {
  const [active, setActive] = useState(2);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* The ladder */}
      <div className="relative">
        <div className="absolute bottom-4 left-[15px] top-4 w-px bg-slate-800" aria-hidden />
        <div
          className="absolute left-[15px] top-4 w-px bg-gradient-to-b from-sky-500 via-indigo-500 to-emerald-500 transition-all duration-500"
          style={{ height: `calc((100% - 2rem) * ${active / (RUNGS.length - 1)})` }}
          aria-hidden
        />
        <div className="space-y-1">
          {RUNGS.map((rung, i) => {
            const on = i === active;
            const below = i <= active;
            return (
              <button
                key={rung.level}
                onClick={() => setActive(i)}
                aria-pressed={on}
                className={`relative flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition ${
                  on ? "bg-slate-900/70" : "hover:bg-slate-900/40"
                }`}
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ring-4 ring-slate-950 transition ${
                    below ? rung.dot : "bg-slate-700"
                  } ${on ? "scale-150" : ""}`}
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium transition ${
                      on ? "text-slate-100" : below ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    {rung.level}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{rung.may}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* What that rung actually looks like */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${RUNGS[active].tone}`}>
            {RUNGS[active].level}
          </span>
          <span className="truncate text-[11px] text-slate-500">{RUNGS[active].example}</span>
        </div>

        <Artifact index={active} />

        <p className="mt-3 border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-500">
          Granted per agent, per capability — and one click ratchets it back down.
        </p>
      </div>
    </div>
  );
}

/** A small mock of the surface each rung produces. */
function Artifact({ index }: { index: number }) {
  if (index === 0) {
    return (
      <Card>
        <p className="text-[13px] leading-relaxed text-slate-300">
          Four deals have gone quiet past 14 days — $96,500 in total.
        </p>
        <div className="mt-2 space-y-1 font-mono text-[10px] text-slate-500">
          <div>
            <span className="text-emerald-400">✓</span> <span className="text-indigo-300">list_deals</span>
            (&quot;stage&quot;:&quot;proposal&quot;) <span className="text-slate-600">61ms</span>
          </div>
          <div>
            <span className="text-emerald-400">✓</span>{" "}
            <span className="text-indigo-300">list_activities</span>(&quot;since&quot;:&quot;-14d&quot;){" "}
            <span className="text-slate-600">44ms</span>
          </div>
        </div>
      </Card>
    );
  }

  if (index === 1) {
    return (
      <Card>
        <div className="mb-2 text-[11px] font-medium text-slate-400">Proposed · 3 changes</div>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="rounded bg-rose-500/10 px-2 py-1 text-rose-300">− Initech · stage: proposal</div>
          <div className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300">+ Initech · stage: lost</div>
          <div className="px-2 py-1 text-slate-500">reason: no reply in 41 days, champion left</div>
        </div>
        <div className="mt-2 flex gap-2">
          <Btn tone="ghost">Bin it</Btn>
          <Btn tone="solid">Apply</Btn>
        </div>
      </Card>
    );
  }

  if (index === 2) {
    return (
      <Card>
        <div className="mb-2 flex items-center gap-2 text-[11px] text-amber-300/90">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Waiting on you · Approvals (3)
        </div>
        <p className="text-[13px] leading-relaxed text-slate-300">
          To Dana Whitfield:{" "}
          <span className="text-slate-400">“Following up on Friday&rsquo;s proposal…”</span>
        </p>
        <div className="mt-2 flex gap-2">
          <Btn tone="ghost">Edit</Btn>
          <Btn tone="solid">Approve &amp; send</Btn>
        </div>
      </Card>
    );
  }

  if (index === 3) {
    return (
      <Card>
        <div className="mb-2 text-[11px] font-medium text-slate-400">Your digest · 4:58pm</div>
        <ul className="space-y-1.5 text-[12px] text-slate-300">
          <li className="flex items-center justify-between gap-2">
            <span>Moved 3 deals to qualified</span>
            <span className="shrink-0 text-[10px] text-indigo-300">undo</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>Logged 7 calls from transcripts</span>
            <span className="shrink-0 text-[10px] text-indigo-300">undo</span>
          </li>
        </ul>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-2 text-[11px] font-medium text-slate-400">Journal · no interruption</div>
      <div className="space-y-1 font-mono text-[10px] leading-relaxed text-slate-500">
        <div>
          02:14 <span className="text-indigo-300">merge_contacts</span> #418 ← #902{" "}
          <span className="text-slate-600">by 🧹 Janitor</span>
        </div>
        <div>
          02:14 <span className="text-slate-600">policy: dedupe · exact-email · silent</span>
        </div>
        <div>
          02:14 <span className="text-slate-600">reversible until deleted by you</span>
        </div>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">{children}</div>;
}

function Btn({ children, tone }: { children: React.ReactNode; tone: "solid" | "ghost" }) {
  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
        tone === "solid"
          ? "bg-indigo-600 text-white"
          : "border border-slate-700 text-slate-400"
      }`}
    >
      {children}
    </span>
  );
}
