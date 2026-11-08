import type { CompetencyRecord, CompetencyStatus } from "../schemas";
import { cn } from "../../../lib/cn";

const statusLabel: Record<CompetencyStatus, string> = {
  not_started: "Not started",
  learning: "Learning",
  developing: "Developing",
  proficient: "Proficient",
  mastered: "Mastered",
};
export const statusText = (s: CompetencyStatus) => statusLabel[s];

const statusStyle: Record<CompetencyStatus, string> = {
  not_started: "border-dashed border-ink/30 bg-paper text-ink/70",
  learning: "border-ink/30 bg-white",
  developing: "border-blue/60 bg-blue/10",
  proficient: "border-blue bg-blue/20",
  mastered: "border-ink bg-lime",
};

const NODE_W = 188;
const NODE_H = 76;
const GAP_X = 56;
const GAP_Y = 16;

/** Layers competencies by prerequisite depth and draws prerequisite arrows. Status is shown as text, not colour alone. */
export function CompetencyMap({
  order,
  prerequisites,
  records,
}: {
  order: string[];
  prerequisites: Record<string, string[]>;
  records: CompetencyRecord[];
}) {
  const byName = new Map(records.map((r) => [r.competency, r]));
  const names = Array.from(new Set([...order, ...records.map((r) => r.competency)]));
  const level = new Map<string, number>();
  const depth = (n: string, seen: Set<string>): number => {
    if (level.has(n)) return level.get(n)!;
    if (seen.has(n)) return 0;
    seen.add(n);
    const d = Math.max(-1, ...(prerequisites[n] ?? []).filter((p) => names.includes(p)).map((p) => depth(p, seen))) + 1;
    level.set(n, d);
    return d;
  };
  names.forEach((n) => depth(n, new Set()));
  const columns: string[][] = [];
  names.forEach((n) => {
    const l = level.get(n) ?? 0;
    (columns[l] ??= []).push(n);
  });
  const pos = new Map<string, { x: number; y: number }>();
  columns.forEach((col, ci) => col?.forEach((n, ri) => pos.set(n, { x: ci * (NODE_W + GAP_X), y: ri * (NODE_H + GAP_Y) })));
  const width = columns.length * (NODE_W + GAP_X) - GAP_X;
  const height = Math.max(...columns.map((c) => (c?.length ?? 0))) * (NODE_H + GAP_Y) - GAP_Y;
  const edges = names.flatMap((n) =>
    (prerequisites[n] ?? []).filter((p) => pos.has(p)).map((p) => ({ from: p, to: n })),
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-ink/15 bg-white/40 p-4" role="region" aria-label="Competency map" tabIndex={0}>
      <div className="relative" style={{ width, height }}>
        <svg className="absolute inset-0" width={width} height={height} aria-hidden>
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L8 4 L0 8 z" className="fill-ink/50" />
            </marker>
          </defs>
          {edges.map((e) => {
            const a = pos.get(e.from)!;
            const b = pos.get(e.to)!;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path key={e.from + e.to} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2 - 2} ${y2}`} fill="none" strokeWidth="1.5" className="stroke-ink/40" markerEnd="url(#arrow)" />
            );
          })}
        </svg>
        {names.map((n) => {
          const p = pos.get(n)!;
          const r = byName.get(n);
          const status: CompetencyStatus = r?.status ?? "not_started";
          const needs = (prerequisites[n] ?? []).join(", ");
          return (
            <div
              key={n}
              className={cn("absolute flex flex-col justify-between rounded-xl border-2 p-2.5 text-sm", statusStyle[status])}
              style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
              title={needs ? `Builds on: ${needs}` : undefined}
            >
              <p className="line-clamp-2 font-medium leading-snug">{n}</p>
              <p className="font-mono text-xs text-ink/70">
                {statusText(status)}
                {r?.regression ? " · needs refresh" : ""}
                {r ? ` · ${r.attempts} attempt${r.attempts === 1 ? "" : "s"}` : ""}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink/70">
        Arrows point from a prerequisite to the competency that builds on it. Status comes from your recorded attempts only.
      </p>
    </div>
  );
}
