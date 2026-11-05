import { Link } from "react-router-dom";
import { Mark } from "../../components/brand/Mark";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="bg-blue py-24 text-center text-paper md:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <h2 id="cta-heading" className="text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl md:text-6xl">
          Your next chapter starts with what you choose to learn.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-xl font-semibold md:text-2xl">
          Start with an ambition. Build the knowledge, skills, and confidence to make it real.
        </p>
        <Link to="/register" className="mt-10 inline-block rounded-full bg-lime px-8 py-3.5 font-medium text-ink">
          Start Learning
        </Link>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-6 py-14 text-sm">
      <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Mark />
          <p className="mt-4 max-w-sm text-ink/70">
            FRIKHII Copilot is a personal AI learning companion that turns learning goals into structured, reviewable courses.
          </p>
          <p className="mt-3 max-w-sm text-ink/60">Learn with intent. Become capable.</p>
        </div>
        <nav aria-label="Product">
          <h2 className="font-mono text-xs text-ink/60">Product</h2>
          <ul className="mt-4 space-y-2.5">
            <li><a href="#architect">Course Architect</a></li>
            <li><a href="#how">How it works</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><Link to="/login">Sign in</Link></li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <h2 className="font-mono text-xs text-ink/60">Legal</h2>
          <ul className="mt-4 space-y-2.5">
            <li><Link to="/privacy">Privacy</Link></li>
            <li><Link to="/terms">Terms</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </nav>
      </div>
      <div className="mt-12 flex flex-wrap justify-between gap-3 border-t border-ink/10 pt-6 text-ink/60">
        <p>&copy; {new Date().getFullYear()} FRIKHII. All rights reserved.</p>
        <p>An independent product. Not an official Universitas Gunadarma platform.</p>
      </div>
    </footer>
  );
}
