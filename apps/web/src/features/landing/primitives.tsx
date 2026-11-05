import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Eyebrow({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return <p className={cn("font-mono text-sm", onDark ? "text-paper/65" : "text-ink/60")}>{children}</p>;
}

/** Consistent vertical rhythm and width for every landing section. */
export function Section({
  id,
  tone = "paper",
  labelledBy,
  children,
  className,
}: {
  id?: string;
  tone?: "paper" | "ink" | "lime";
  labelledBy?: string;
  children: ReactNode;
  className?: string;
}) {
  const bg = tone === "ink" ? "bg-ink text-paper" : tone === "lime" ? "bg-lime text-ink" : "";
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("scroll-mt-20 py-20 md:py-28", bg, className)}>
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}

export function H2({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl", className)}>
      {children}
    </h2>
  );
}

/** Label for any block that shows sample data or a scripted illustration. */
export function DemoNote({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return <p className={cn("font-mono text-xs", onDark ? "text-paper/65" : "text-ink/60")}>{children}</p>;
}

export function ProgressBar({ value, onDark = false }: { value: number; onDark?: boolean }) {
  return (
    <div aria-hidden="true" className={cn("h-2 w-full rounded-full", onDark ? "bg-paper/20" : "bg-ink/10")}>
      <div className="h-2 rounded-full bg-blue" style={{ width: `${value}%` }} />
    </div>
  );
}
