"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------- the script */

type Beat =
  | { k: "type"; text: string }
  | { k: "send" }
  | { k: "tool"; tool: string; input: string; ms: number; result: string }
  | { k: "blocked"; tool: string; note: string }
  | { k: "say"; text: string }
  | { k: "stage"; id: number; stage: Stage }
  | { k: "task"; task: TaskRow }
  | { k: "unchanged" }
  | { k: "pause"; ms: number };

type Stage = "lead" | "qualified" | "proposal" | "won" | "lost";
type DealRow = { id: number; title: string; company: string; value: number; stage: Stage };
type TaskRow = { id: number; title: string; emoji: string };

type Scene = {
  tab: string;
  blurb: string;
  agent: { name: string; emoji: string; badge: string };
  deals: DealRow[];
  tasks: TaskRow[];
  beats: Beat[];
};

const BASE_DEALS: DealRow[] = [
  { id: 7, title: "Platform rollout", company: "Globex", value: 48000, stage: "qualified" },
  { id: 4, title: "Data migration", company: "Initech", value: 22500, stage: "proposal" },
  { id: 9, title: "Seat expansion", company: "Umbrella", value: 61000, stage: "lead" },
];

const BASE_TASKS: TaskRow[] = [
  { id: 31, title: "Chase Umbrella security review", emoji: "🤝" },
  { id: 29, title: "Monday pipeline brief", emoji: "📊" },
];

const SCENES: Scene[] = [
  {
    tab: "The record keeps itself",
    blurb: "One sentence after a call. Four writes, every one of them traced.",
    agent: { name: "Sales Assistant", emoji: "🤝", badge: "write · contacts, deals, activities, tasks" },
    deals: BASE_DEALS,
    tasks: BASE_TASKS,
    beats: [
      { k: "type", text: "Just off the call with Globex — they want a proposal by Friday. Log it." },
      { k: "send" },
      { k: "pause", ms: 500 },
      {
        k: "tool",
        tool: "list_deals",
        input: '"q":"Globex"',
        ms: 148,
        result: "1 match · #7 Platform rollout · $48,000 · qualified",
      },
      { k: "tool", tool: "update_deal", input: '"id":7,"stage":"proposal"', ms: 96, result: "ok" },
      { k: "stage", id: 7, stage: "proposal" },
      {
        k: "tool",
        tool: "log_activity",
        input: '"type":"call","deal_id":7,"content":"Procurement review…"',
        ms: 71,
        result: "activity #212",
      },
      {
        k: "tool",
        tool: "create_task",
        input: '"title":"Send Globex proposal","assignee":"you"',
        ms: 88,
        result: "task #34",
      },
      { k: "task", task: { id: 34, title: "Send Globex proposal — Friday", emoji: "🙋" } },
      {
        k: "say",
        text: "Done. Globex is in proposal, the call is logged against deal #7, and Friday's proposal is on your list — not mine, since it needs your numbers. I left the $48,000 alone; you didn't say it moved.",
      },
    ],
  },
  {
    tab: "The badge is the boundary",
    blurb: "The Analyst is read-only. Not discouraged from writing — incapable of it.",
    agent: { name: "Analyst", emoji: "📊", badge: "read · everywhere · write · nothing" },
    deals: BASE_DEALS,
    tasks: BASE_TASKS,
    beats: [
      { k: "type", text: "Mark the Initech deal as won — I'm sure it'll close." },
      { k: "send" },
      { k: "pause", ms: 500 },
      {
        k: "tool",
        tool: "list_deals",
        input: '"q":"Initech"',
        ms: 61,
        result: "1 match · #4 Data migration · $22,500 · proposal",
      },
      { k: "blocked", tool: "update_deal", note: "not in this agent's toolbox" },
      { k: "unchanged" },
      {
        k: "say",
        text: "I can't. I'm read-only on deals, so update_deal was never handed to me — there's no prompt you could write that changes that. What I can tell you: #4 has sat in proposal for 19 days and nobody has touched it in 11. Ask the Assistant to move it, or grant me write and I'll do it myself.",
      },
    ],
  },
];

/* ------------------------------------------------------------- the machine */

type Step = { tool: string; input: string; ms?: number; result?: string; blocked?: string };
type Msg = { role: "user" | "agent"; text: string };

const STAGE_STYLES: Record<Stage, string> = {
  lead: "border-slate-700 bg-slate-800/60 text-slate-300",
  qualified: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  proposal: "border-indigo-500/40 bg-indigo-500/15 text-indigo-200",
  won: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  lost: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

export default function LiveDemo() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [runId, setRunId] = useState(0);
  // Without an observer there's nothing to wait for, so play straight away.
  const [started, setStarted] = useState(() => typeof IntersectionObserver === "undefined");

  const scene = SCENES[sceneIndex];
  const rootRef = useRef<HTMLDivElement>(null);

  // Don't burn a timeline the visitor can't see.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goTo = useCallback((index: number) => {
    setSceneIndex(index);
    setRunId((n) => n + 1);
  }, []);

  const next = useCallback(() => {
    goTo((sceneIndex + 1) % SCENES.length);
  }, [goTo, sceneIndex]);

  return (
    <div ref={rootRef} className="w-full">
      {/* Scene tabs */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SCENES.map((s, i) => (
          <button
            key={s.tab}
            onClick={() => goTo(i)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
              i === sceneIndex
                ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
            }`}
          >
            {s.tab}
          </button>
        ))}
        <button
          onClick={() => setRunId((n) => n + 1)}
          className="ml-auto rounded-full border border-slate-800 px-3 py-1 text-[11px] text-slate-500 transition hover:border-slate-600 hover:text-slate-300"
          aria-label="Replay this scene"
        >
          ↻ Replay
        </button>
      </div>

      {/* Keyed so every take starts from a clean mount instead of a reset. */}
      <Stage key={`${sceneIndex}:${runId}`} scene={scene} started={started} onFinish={next} />

      <p className="mt-3 text-center text-[11px] text-slate-600">{scene.blurb}</p>
    </div>
  );
}

function Stage({
  scene,
  started,
  onFinish,
}: {
  scene: Scene;
  started: boolean;
  onFinish: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [live, setLive] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [deals, setDeals] = useState<DealRow[]>(scene.deals);
  const [tasks, setTasks] = useState<TaskRow[]>(scene.tasks);
  const [flash, setFlash] = useState<string | null>(null);
  const [unchanged, setUnchanged] = useState(false);

  useEffect(() => {
    if (!started) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    const reduced =
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const play = async () => {
      await sleep(reduced ? 200 : 900);

      let typed = "";
      let said = "";
      let stepCount = 0;

      for (const beat of scene.beats) {
        if (cancelled) return;

        switch (beat.k) {
          case "type":
            typed = beat.text;
            if (reduced) {
              setDraft(beat.text);
              break;
            }
            for (let i = 1; i <= beat.text.length; i++) {
              if (cancelled) return;
              setDraft(beat.text.slice(0, i));
              await sleep(beat.text[i - 1] === " " ? 34 : 19);
            }
            await sleep(320);
            break;

          case "send":
            setDraft("");
            setMessages((cur) => [...cur, { role: "user", text: typed }]);
            setWorking(true);
            setLive("");
            break;

          case "tool": {
            const at = stepCount++;
            setSteps((cur) => [...cur, { tool: beat.tool, input: beat.input }]);
            await sleep(reduced ? 60 : Math.min(beat.ms * 3.2, 620));
            setSteps((cur) => cur.map((s, i) => (i === at ? { ...s, ms: beat.ms, result: beat.result } : s)));
            await sleep(reduced ? 40 : 260);
            break;
          }

          case "blocked":
            await sleep(reduced ? 40 : 420);
            stepCount++;
            setSteps((cur) => [...cur, { tool: beat.tool, input: "", blocked: beat.note }]);
            await sleep(reduced ? 40 : 500);
            break;

          case "stage":
            setDeals((cur) => cur.map((d) => (d.id === beat.id ? { ...d, stage: beat.stage } : d)));
            setFlash(`deal-${beat.id}`);
            break;

          case "task":
            setTasks((cur) => [beat.task, ...cur]);
            setFlash(`task-${beat.task.id}`);
            break;

          case "unchanged":
            setUnchanged(true);
            break;

          case "say": {
            said = beat.text;
            if (reduced) {
              setLive(beat.text);
              break;
            }
            const words = beat.text.split(" ");
            for (let i = 0; i < words.length; i++) {
              if (cancelled) return;
              setLive(words.slice(0, i + 1).join(" "));
              await sleep(28);
            }
            break;
          }

          case "pause":
            await sleep(reduced ? 60 : beat.ms);
            break;
        }
      }

      if (cancelled) return;
      setWorking(false);

      // Hand the streamed turn to the transcript, exactly like the real client.
      setLive(null);
      setMessages((cur) => [...cur, { role: "agent", text: said }]);

      await sleep(reduced ? 6000 : 5200);
      if (!cancelled) onFinish();
    };

    void play();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [scene, started, onFinish]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl shadow-indigo-950/40">
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-slate-800/80 bg-slate-900/60 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="font-mono">runcrm · workspace</span>
        </div>
        {working && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] text-indigo-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />1 running
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        {/* Chat */}
        <div className="flex min-h-[420px] min-w-0 flex-col border-slate-800/80 lg:border-r">
          <div className="flex min-w-0 items-center gap-2 border-b border-slate-800/60 px-4 py-2">
            <span className="text-sm">{scene.agent.emoji}</span>
            <span className="shrink-0 text-xs font-semibold text-slate-300">{scene.agent.name}</span>
            <span className="min-w-0 truncate font-mono text-[10px] text-slate-600">
              {scene.agent.badge}
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden px-4 py-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2 text-[13px] leading-relaxed text-white">
                    {m.text}
                  </div>
                </div>
              ) : (
                <AgentTurn key={i} scene={scene} steps={steps} text={m.text} />
              )
            )}
            {live !== null && <AgentTurn scene={scene} steps={steps} text={live} streaming />}
          </div>

          {/* Composer */}
          <div className="border-t border-slate-800/60 p-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
              <span className="min-h-[18px] flex-1 text-[13px] text-slate-300">
                {draft || <span className="text-slate-600">Message {scene.agent.name}…</span>}
                {draft && <span className="rc-caret ml-px text-indigo-400">▌</span>}
              </span>
              <span className="rounded-lg bg-indigo-600/80 px-3 py-1 text-[11px] font-medium text-white">
                Send
              </span>
            </div>
          </div>
        </div>

        {/* Record panel */}
        <div className="flex flex-col border-t border-slate-800/80 bg-slate-900/20 lg:border-t-0">
          <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              The record
            </span>
            {unchanged ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">
                unchanged
              </span>
            ) : (
              <span className="text-[10px] text-slate-600">live</span>
            )}
          </div>

          <div className="px-3 py-3">
            <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Deals
            </div>
            <div className="space-y-1">
              {deals.map((d) => (
                <div
                  key={d.id}
                  className={`rounded-lg px-2 py-1.5 ${flash === `deal-${d.id}` ? "rc-flash" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] text-slate-300">{d.title}</span>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${STAGE_STYLES[d.stage]}`}
                    >
                      {d.stage}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-600">
                    <span>{d.company}</span>
                    <span>·</span>
                    <span className="font-mono">${d.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-1 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Tasks
            </div>
            <div className="space-y-1">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-slate-300 ${
                    flash === `task-${t.id}` ? "rc-flash" : ""
                  }`}
                >
                  <span className="text-[11px]">{t.emoji}</span>
                  <span className="truncate">{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentTurn({
  scene,
  steps,
  text,
  streaming,
}: {
  scene: Scene;
  steps: Step[];
  text: string;
  streaming?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm">
        {scene.agent.emoji}
      </span>
      <div className="min-w-0 max-w-[88%]">
        <div className="mb-1 flex items-baseline gap-2 pl-1">
          <span className="text-[11px] font-semibold text-slate-300">{scene.agent.name}</span>
          {streaming && <span className="text-[10px] text-slate-600">working…</span>}
        </div>

        {steps.length > 0 && (
          <div className="mb-1.5 space-y-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
            {steps.map((s, i) => (
              <div key={i} className="break-words font-mono text-[10px] leading-relaxed">
                {s.blocked ? (
                  <>
                    <span className="text-rose-400">🔒</span>{" "}
                    <span className="text-slate-500 line-through">{s.tool}</span>
                    <span className="ml-1.5 text-rose-300/80">{s.blocked}</span>
                  </>
                ) : (
                  <>
                    <span className={s.result ? "text-emerald-400" : "text-slate-500"}>
                      {s.result ? "✓" : "◌"}
                    </span>{" "}
                    <span className="text-indigo-300">{s.tool}</span>
                    <span className="text-slate-500">({s.input})</span>
                    {s.ms !== undefined && <span className="ml-1 text-slate-600">{s.ms}ms</span>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl rounded-tl-sm border border-slate-800 bg-slate-900/70 px-3.5 py-2 text-[13px] leading-relaxed text-slate-200">
          {text ? (
            <span>{text}</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              thinking
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1 w-1 animate-bounce rounded-full bg-indigo-400"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
