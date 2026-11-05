import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { StatusChip } from "./StatusChip";
import { DemoNote, Eyebrow, H2, ProgressBar, Section } from "./primitives";
import type { FaqStatus } from "./faqContent";

/* ---------------------------------------------------------------- Problem */

const pains = [
  "No roadmap to follow.",
  "Material scattered across dozens of places.",
  "Concepts that never quite click.",
  "No evaluation of what you actually know.",
  "No idea which skills to strengthen next.",
];

export function Problem() {
  return (
    <Section id="problem" labelledBy="problem-heading">
      <div className="grid gap-12 md:grid-cols-2 md:gap-16">
        <div>
          <Eyebrow>The problem</Eyebrow>
          <H2 id="problem-heading" className="mt-4">Learning without direction is just browsing.</H2>
          <p className="mt-6 max-w-md text-lg text-ink/70">
            People have access to countless learning resources but often lack structure, direction, and a way to measure real understanding.
          </p>
        </div>
        <ul className="self-end text-lg text-ink/80">
          {pains.map((t, i) => (
            <li key={t} className="flex gap-4 border-t border-ink/15 py-4 last:border-b">
              <span className="font-mono text-sm text-ink/60">{String(i + 1).padStart(2, "0")}</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- Solution */

const loop = [
  { name: "Understand", text: "Clarify the goal and where you start." },
  { name: "Explain", text: "Learn each concept in a structured order." },
  { name: "Practice", text: "Apply it with focused exercises." },
  { name: "Evaluate", text: "Check what you actually understood." },
  { name: "Master", text: "Build capability you can demonstrate." },
];

export function Solution() {
  return (
    <Section id="solution" tone="lime" labelledBy="solution-heading">
      <Eyebrow>The solution</Eyebrow>
      <H2 id="solution-heading" className="mt-4 max-w-3xl">Goals become personalized learning journeys.</H2>
      <p className="mt-6 max-w-xl text-lg text-ink/80">
        FRIKHII Copilot turns what you want to achieve into a structured path, rather than a pile of resources.
      </p>
      <ol className="mt-14 grid items-end gap-4 sm:grid-cols-5">
        {loop.map((l, i) => (
          <li key={l.name} className="flex flex-col justify-end">
            <div aria-hidden="true" style={{ height: `${(i + 1) * 28}px` }} className={cn("rounded-t-lg", i === loop.length - 1 ? "bg-blue" : "bg-ink")} />
            <div className="border-t-2 border-ink pt-3">
              <p className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 font-semibold">{l.name}</h3>
              <p className="mt-1 text-sm text-ink/80">{l.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 font-mono text-xs text-ink/70">The learning loop FRIKHII Copilot is designed around. Practice, evaluation and mastery tracking are planned.</p>
    </Section>
  );
}

/* -------------------------------------------------------- Course Architect */

const architectSteps = [
  {
    title: "Learning goal",
    body: "Describe what you want to learn, why, and how much time you have.",
    demo: <p className="rounded-xl bg-ink p-3 font-mono text-xs text-paper">&ldquo;I want to become a data scientist in a year.&rdquo;</p>,
  },
  {
    title: "Knowledge diagnosis",
    body: "A short diagnostic estimates your starting point and gaps.",
    demo: (
      <div className="space-y-1.5 text-xs">
        <p className="font-medium">Which error does least squares minimise?</p>
        {["Absolute", "Squared", "Not sure"].map((o) => (
          <p key={o} className="rounded-lg border border-ink/20 px-2.5 py-1.5">{o}</p>
        ))}
      </div>
    ),
  },
  {
    title: "Curriculum",
    body: "A structured draft of modules, classes and lesson blueprints to review.",
    demo: (
      <ul className="space-y-1 font-mono text-xs">
        <li>Module 01 · Foundations</li>
        <li className="pl-4 text-ink/70">Class 01 · Python basics</li>
        <li className="pl-4 text-ink/70">Class 02 · Data structures</li>
        <li>Module 02 · Data work</li>
      </ul>
    ),
  },
  {
    title: "Learning roadmap",
    body: "Edit, regenerate or approve it, then it becomes your course.",
    demo: (
      <div className="space-y-2">
        <ProgressBar value={33} />
        <p className="font-mono text-xs text-ink/70">Class 01 is your starting class; later classes are upcoming.</p>
      </div>
    ),
  },
];

export function Architect() {
  return (
    <Section id="architect" labelledBy="architect-heading">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow>AI Course Architect</Eyebrow>
        <StatusChip status="built" />
      </div>
      <H2 id="architect-heading" className="mt-4 max-w-3xl">From a goal to a curriculum you can review.</H2>
      <p className="mt-6 max-w-xl text-lg text-ink/70">
        Describe a goal in your own words. Get a structured curriculum shaped by your starting knowledge, which you can edit before approving.
      </p>
      <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {architectSteps.map((s, i) => (
          <li key={s.title} className="flex flex-col rounded-2xl border border-ink/15 p-5">
            <span className="font-mono text-xs text-ink/60">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-1 text-xl font-medium tracking-tight">{s.title}</h3>
            <p className="mt-2 text-sm text-ink/70">{s.body}</p>
            <div className="mt-5 flex-1 rounded-xl bg-ink/[0.04] p-3">{s.demo}</div>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <DemoNote>Illustrative example. Real curricula are generated from your own goal and diagnostic, and AI output can contain mistakes.</DemoNote>
        <Link to="/register" className="rounded-full bg-ink px-5 py-2.5 text-sm text-paper">Create your first goal</Link>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ AI Tutor */

const modes = [
  { name: "Explain", text: "Clear explanations of a concept, matched to your level." },
  { name: "Deep Dive", text: "Go further into the reasoning behind an idea." },
  { name: "Practice", text: "Focused exercises on what you are learning." },
  { name: "Socratic", text: "Guiding questions that help you reach the answer yourself." },
  { name: "Review", text: "Revisit and consolidate earlier material." },
  { name: "Project", text: "Apply skills to a realistic, goal-relevant project." },
];

export function Tutor() {
  const [active, setActive] = useState(0);
  return (
    <Section id="tutor" tone="ink" labelledBy="tutor-heading">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow onDark>AI Personal Tutor</Eyebrow>
        <StatusChip status="planned" onDark />
      </div>
      <H2 id="tutor-heading" className="mt-4 max-w-3xl">One companion, six ways to learn.</H2>
      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div role="group" aria-label="Learning modes" className="flex flex-wrap gap-2 self-start">
          {modes.map((m, i) => (
            <button
              key={m.name}
              type="button"
              aria-pressed={active === i}
              onClick={() => setActive(i)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                active === i ? "border-lime bg-lime text-ink" : "border-paper/30 text-paper hover:border-paper/60",
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
        <div className="rounded-3xl border border-paper/15 p-6">
          <p className="font-mono text-xs text-paper/65">Mode · {modes[active].name}</p>
          <p className="mt-3 text-xl" aria-live="polite">{modes[active].text}</p>
          <div className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <p className="rounded-xl bg-paper/10 p-4">Why does a line of best fit minimise squared error instead of absolute error?</p>
            <p className="rounded-xl bg-paper/10 p-4 text-paper/90">Squared error punishes large misses more and gives one smooth solution. Which error type is less sensitive to outliers?</p>
          </div>
        </div>
      </div>
      <p className="mt-6 font-mono text-xs text-paper/65">Scripted demonstration. The AI Personal Tutor is planned and not yet available.</p>
    </Section>
  );
}

/* ---------------------------------------------------------- Showcase */

type Preview = { id: string; title: string; status: FaqStatus; body: ReactNode };

const Row = ({ a, b, strong = false }: { a: string; b?: string; strong?: boolean }) => (
  <div className={cn("flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs", strong ? "border-ink bg-lime" : "border-ink/15")}>
    <span>{a}</span>
    {b && <span className="font-mono text-ink/65">{b}</span>}
  </div>
);

const previews: Preview[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    status: "built",
    body: (
      <div className="space-y-2">
        <Row a="Data Science Foundations" b="In progress" strong />
        <Row a="Modules" b="5" />
        <Row a="Classes" b="14" />
        <Row a="Estimated duration" b="~60 h" />
      </div>
    ),
  },
  {
    id: "course",
    title: "Course overview",
    status: "built",
    body: (
      <div className="space-y-2">
        <Row a="Class 01 · Python basics" b="Start here" strong />
        <Row a="Class 02 · Data structures" b="Upcoming" />
        <Row a="Class 03 · Data cleaning" b="Upcoming" />
      </div>
    ),
  },
  {
    id: "roadmap",
    title: "Learning roadmap",
    status: "built",
    body: (
      <div className="flex h-24 items-end gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} style={{ height: `${n * 18}%` }} className={cn("w-full rounded-t", n === 5 ? "bg-blue" : "bg-ink")} />
        ))}
      </div>
    ),
  },
  {
    id: "lesson",
    title: "Lesson workspace",
    status: "planned",
    body: (
      <ul className="space-y-1.5 text-xs text-ink/80">
        {["Introduction", "Concept explanation", "Guided practice", "Knowledge check", "Summary"].map((x) => (
          <li key={x} className="rounded-lg border border-ink/15 px-2.5 py-1.5">{x}</li>
        ))}
      </ul>
    ),
  },
  {
    id: "assessment",
    title: "Assessment",
    status: "planned",
    body: (
      <div className="space-y-1.5 text-xs">
        <p className="font-medium">Which metric suits an imbalanced dataset?</p>
        {["Accuracy", "F1 score", "Not sure"].map((o) => (
          <p key={o} className="rounded-lg border border-ink/15 px-2.5 py-1.5">{o}</p>
        ))}
      </div>
    ),
  },
  {
    id: "analytics",
    title: "Progress analytics",
    status: "planned",
    body: (
      <div className="space-y-2.5 text-xs">
        {[["Python", 80], ["Statistics", 45], ["Modelling", 20]].map(([k, v]) => (
          <div key={k as string}>
            <p className="mb-1 flex justify-between"><span>{k}</span><span className="font-mono text-ink/65">sample</span></p>
            <ProgressBar value={v as number} />
          </div>
        ))}
      </div>
    ),
  },
];

export function Showcase() {
  return (
    <Section id="showcase" labelledBy="showcase-heading">
      <Eyebrow>Product interface</Eyebrow>
      <H2 id="showcase-heading" className="mt-4 max-w-3xl">A look at the learning workspace.</H2>
      <p className="mt-6 max-w-xl text-lg text-ink/70">
        Concept previews built from the same interface components as the product. Each one says whether it exists today.
      </p>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {previews.map((p) => (
          <li key={p.id} className="flex flex-col rounded-2xl border border-ink/15 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-lg font-medium tracking-tight">{p.title}</h3>
              <StatusChip status={p.status} />
            </div>
            <div className="mt-4 flex-1 rounded-xl bg-ink/[0.04] p-3">{p.body}</div>
          </li>
        ))}
      </ul>
      <div className="mt-6"><DemoNote>Sample data for illustration. Previews marked Planned are concepts, not available features.</DemoNote></div>
    </Section>
  );
}

/* -------------------------------------------------------------- How it works */

const how = [
  { title: "Define your ambition", text: "Say what you want to learn and what you want to be able to do.", status: "built" as const },
  { title: "Discover your starting point", text: "Answer a short diagnostic so the plan fits what you already know.", status: "built" as const },
  { title: "Build your personalized curriculum", text: "Review, edit and approve a structured course draft.", status: "built" as const },
  { title: "Learn, practice, and grow", text: "Guided lessons, practice and evaluation follow the plan.", status: "planned" as const },
];

export function HowItWorks() {
  return (
    <Section id="how" tone="ink" labelledBy="how-heading">
      <Eyebrow onDark>How it works</Eyebrow>
      <H2 id="how-heading" className="mt-4">Learn with intent.</H2>
      <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {how.map((s, i) => (
          <li key={s.title} className="flex flex-col border-t-2 border-lime pt-4">
            <span className="font-mono text-sm text-lime">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-2 text-xl font-medium tracking-tight">{s.title}</h3>
            <p className="mt-2 flex-1 text-paper/75">{s.text}</p>
            <div className="mt-4"><StatusChip status={s.status} onDark /></div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ----------------------------------------------------------------- Why */

const why: { title: string; text: string; status: FaqStatus }[] = [
  { title: "Structured learning instead of isolated conversations", text: "Courses, modules and classes give every session a place in a larger plan.", status: "built" },
  { title: "Personalized learning paths", text: "Your goal, starting knowledge and available time shape the curriculum.", status: "built" },
  { title: "Learning objectives tied to competencies", text: "Each class states what you should be able to do, and which competency it serves.", status: "built" },
  { title: "Practice and evaluation", text: "Exercises and knowledge checks are planned for every class, with real assessment to follow.", status: "planned" },
  { title: "Progress designed around understanding", text: "Progress is meant to reflect what you understand, not how much content you opened.", status: "planned" },
];

export function WhyFrikhii() {
  return (
    <Section id="why" labelledBy="why-heading">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="self-start lg:sticky lg:top-28">
          <Eyebrow>Why FRIKHII</Eyebrow>
          <H2 id="why-heading" className="mt-4">Built around understanding, not content.</H2>
          <p className="mt-6 max-w-md text-lg text-ink/70">A learning companion is only useful if it gives your effort a direction and a way to check it.</p>
        </div>
        <ul>
          {why.map((w) => (
            <li key={w.title} className="border-t border-ink/80 py-6 last:border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="max-w-md text-xl font-medium leading-snug tracking-tight">{w.title}</h3>
                <StatusChip status={w.status} />
              </div>
              <p className="mt-2 max-w-prose text-ink/70">{w.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
