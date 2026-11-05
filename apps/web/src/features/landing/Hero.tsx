import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ProgressBar } from "./primitives";

const roadmap = [
  { title: "Foundations", state: "Completed", done: true },
  { title: "Data work", state: "In progress", done: false, current: true },
  { title: "Modelling", state: "Upcoming", done: false },
];

/** Built from design-system tokens. Sample data only; clearly labelled as a demonstration. */
function HeroPreview() {
  return (
    <figure aria-label="Product demonstration with sample data" className="mx-auto w-full max-w-xl lg:mx-0">
      <div className="overflow-hidden rounded-3xl border border-ink/15 bg-paper shadow-xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
          <span className="font-mono text-xs text-ink/65">Course overview</span>
          <span className="rounded-full border border-dashed border-ink/50 px-2.5 py-0.5 font-mono text-xs text-ink/70">Demo · sample data</span>
        </div>
        <div className="grid gap-5 p-5 sm:p-6">
          <div>
            <p className="font-mono text-xs text-ink/60">Current course</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">Data Science Foundations</p>
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={40} />
              <span className="shrink-0 whitespace-nowrap font-mono text-xs text-ink/70">2 / 5</span>
            </div>
            <p className="mt-1 font-mono text-xs text-ink/60">modules reviewed (sample)</p>
          </div>

          <ol className="grid gap-2" aria-label="Learning roadmap">
            {roadmap.map((m, i) => (
              <li
                key={m.title}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${m.current ? "border-ink bg-lime" : "border-ink/15"}`}
              >
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-ink/60">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-medium">{m.title}</span>
                </span>
                <span className="font-mono text-xs text-ink/70">{m.state}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-2xl bg-ink p-4 text-paper">
            <p className="font-mono text-xs text-paper/65">AI tutor · scripted example</p>
            <p className="mt-2 text-sm">Why does a line of best fit minimise squared error instead of absolute error?</p>
            <p className="mt-3 rounded-xl bg-paper/10 p-3 text-sm text-paper/90">
              Squared error punishes large misses more and gives one smooth solution. Try predicting the fit for three points.
            </p>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 font-mono text-xs text-ink/60">
        Product demonstration. Sample data, not a live account. The AI tutor is planned.
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-20 pt-14 md:pb-28 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
      <div>
        <p className="font-mono text-sm text-ink/60">FRIKHII Copilot · Personal AI learning companion</p>
        <motion.h1
          id="hero-heading"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-5 text-4xl font-semibold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
        >
          Your ambition deserves a better way to learn.
        </motion.h1>
        <p className="mt-7 max-w-xl text-lg text-ink/70 md:text-xl">
          Turn your learning goals into structured courses, guided lessons, and measurable progress with your personal AI learning companion.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link to="/register" className="rounded-full bg-lime px-6 py-3 font-medium text-ink ring-1 ring-ink/10">
            Start Learning
          </Link>
          <a href="#trailer" className="rounded-full border border-ink/30 px-6 py-3">
            Explore the Product
          </a>
        </div>
      </div>
      <HeroPreview />
    </section>
  );
}
