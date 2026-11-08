import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Mark } from "../../../components/brand/Mark";
import { LanguageToggle } from "../../../components/ui/LanguageToggle";

/**
 * Split editorial layout shared by every auth screen. Deliberately light on
 * interaction so the form stays the focus.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden flex-col justify-between bg-ink p-12 text-paper lg:flex">
        <Link to="/" aria-label="FRIKHII home" className="w-fit">
          <Mark />
        </Link>
        <div className="max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-lime">Learn with intent</p>
          <h2 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight">
            Turn ambition into capability.
          </h2>
          <ol className="mt-10 space-y-4 text-paper/70">
            {["Define your goal", "Build your roadmap", "Learn with AI", "Practice and prove it"].map(
              (step, index) => (
                <li key={step} className="flex items-baseline gap-4 border-t border-paper/15 pt-3">
                  <span className="font-mono text-xs text-paper/45">0{index + 1}</span>
                  <span>{step}</span>
                </li>
              ),
            )}
          </ol>
        </div>
        <p className="max-w-sm text-sm text-paper/45">
          FRIKHII Copilot is a personal AI learning companion. Your learning data belongs to you.
        </p>
      </section>

      <section className="relative flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-16">
        <div className="absolute right-6 top-8 hidden sm:block lg:right-16">
          <LanguageToggle />
        </div>
        <div className="flex items-center justify-between lg:hidden">
          <Link to="/" aria-label="FRIKHII home">
            <Mark />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link to="/" className="text-sm text-ink/65 hover:underline">
              Home
            </Link>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-ink/65">{description}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-ink/65">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
