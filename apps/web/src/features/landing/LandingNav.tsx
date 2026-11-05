import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Mark } from "../../components/brand/Mark";
import { LanguageToggle } from "../../components/ui/LanguageToggle";

export const navLinks = [
  { href: "#trailer", label: "Product" },
  { href: "#architect", label: "Course Architect" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5" aria-label="Main">
        <a href="#top" aria-label="FRIKHII Copilot, back to top">
          <Mark />
        </a>
        <ul className="hidden items-center gap-8 text-sm md:flex">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-ink/75 hover:text-ink">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 text-sm sm:gap-5">
          <LanguageToggle />
          <Link to="/login" className="hidden text-ink/75 hover:text-ink sm:inline">
            Sign in
          </Link>
          <Link to="/register" className="rounded-full bg-ink px-4 py-2 text-paper">
            Get started
          </Link>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-ink/20 md:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </nav>
      {open && (
        <div id="mobile-menu" className="border-t border-ink/10 bg-paper md:hidden">
          <ul className="mx-auto grid max-w-6xl gap-1 px-6 py-4 text-base">
            {navLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 hover:bg-ink/5">
                  {l.label}
                </a>
              </li>
            ))}
            <li className="sm:hidden">
              <Link to="/login" className="block rounded-xl px-3 py-3 hover:bg-ink/5">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
