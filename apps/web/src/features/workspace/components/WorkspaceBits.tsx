import { Link } from "react-router-dom";
import { ChevronDown, FlaskConical } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "../../../components/ui/Feedback";
import { cn } from "../../../lib/cn";
import { classStatus, classPath, formatMinutes, type ClassStatus } from "../courseView";
import type { CourseModule } from "../../course/schemas/course";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="font-mono text-xs text-ink/60">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-ink/70">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export const primaryLink =
  "inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper hover:bg-ink/90";
export const accentLink =
  "inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-medium text-ink";
export const ghostLink =
  "inline-flex items-center gap-2 rounded-full border border-ink/25 px-5 py-2.5 font-medium hover:bg-ink/5";

/** Shown on every page that renders the built-in sample. Never shown for real courses. */
export function DemoBanner({ what = "course" }: { what?: string }) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-ink/40 bg-lime/40 px-4 py-3 text-sm"
    >
      <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        <strong>Demo {what}.</strong> This is built-in sample content to show the workspace. It is not your course,
        and nothing here is saved to your account.
      </p>
      <Link to="/app/courses/new" className="font-medium underline">
        Create your own
      </Link>
    </div>
  );
}

const statusCopy: Record<ClassStatus, { label: string; tone: "lime" | "neutral" }> = {
  available: { label: "Available", tone: "lime" },
  upcoming: { label: "Upcoming", tone: "neutral" },
};

export function ClassStatusPill({ index }: { index: number }) {
  const s = statusCopy[classStatus(index)];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function StatusNote() {
  return (
    <p className="text-xs text-ink/60">
      Status reflects course order only. Completion tracking is not available yet, and status does not restrict access.
    </p>
  );
}

/** Expandable module with its classes. Uses a button with aria-expanded (no extra dependency). */
export function ModuleAccordion({
  module,
  moduleIndex,
  courseId,
  startIndex,
  defaultOpen = false,
}: {
  module: CourseModule;
  moduleIndex: number;
  courseId: string;
  startIndex: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `module-${module.id}`;
  return (
    <section className="rounded-2xl border border-ink/15 bg-white/50">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start gap-4 p-5 text-left"
        >
          <span className="mt-1 font-mono text-xs text-ink/60">{String(moduleIndex + 1).padStart(2, "0")}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold tracking-tight">{module.title}</span>
            <span className="mt-1 block text-sm text-ink/70">{module.description}</span>
            <span className="mt-2 block font-mono text-xs text-ink/60">
              {module.classes.length} {module.classes.length === 1 ? "class" : "classes"} · {formatMinutes(module.estimated_duration_minutes)}
            </span>
          </span>
          <ChevronDown aria-hidden className={cn("mt-1 h-5 w-5 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="border-t border-ink/10 p-3 sm:p-4">
        <ol className="grid gap-2">
          {module.classes.map((klass, i) => (
            <li key={klass.id}>
              <Link
                to={classPath(courseId, klass.id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-paper px-4 py-3 hover:border-ink/40"
              >
                <span className="min-w-0">
                  <span className="font-mono text-xs text-ink/60">Class {String(startIndex + i + 1).padStart(2, "0")}</span>
                  <span className="block font-medium">{klass.title}</span>
                  <span className="block text-sm text-ink/70">{klass.description}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-ink/60">{formatMinutes(klass.estimated_duration_minutes)}</span>
                  <ClassStatusPill index={startIndex + i} />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-ink/80">
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}
