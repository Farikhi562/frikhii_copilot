import * as D from "@radix-ui/react-dialog";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useCourses } from "../../course/hooks/useCourse";
import { mainNav, secondaryNav } from "./nav";

/** Quick navigation across app pages and the user's real courses. Opens with Ctrl/Cmd+K. */
export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [query, setQuery] = useState("");
  const courses = useCourses();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = [...mainNav, ...secondaryNav].map((n) => ({ key: n.to, label: n.label, to: n.to, kind: "Page" }));
    const own = (courses.data ?? []).map((c) => ({ key: c.id, label: c.title, to: `/app/courses/${c.id}`, kind: "Course" }));
    return [...own, ...pages].filter((r) => !q || r.label.toLowerCase().includes(q));
  }, [query, courses.data]);

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/50" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-lg -translate-x-1/2 rounded-2xl border border-ink/15 bg-paper p-3 shadow-xl">
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Find a page or one of your courses.</D.Description>
          <label className="flex items-center gap-2 rounded-xl border border-ink/20 px-3 py-2">
            <Search className="h-4 w-4 text-ink/60" aria-hidden />
            <span className="sr-only">Search pages and courses</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages and your courses"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <ul className="mt-2 max-h-72 overflow-y-auto">
            {results.length === 0 && <li className="px-3 py-4 text-sm text-ink/70">No matches.</li>}
            {results.map((r) => (
              <li key={`${r.kind}-${r.key}`}>
                <Link
                  to={r.to}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-lime"
                >
                  <span className="truncate">{r.label}</span>
                  <span className="ml-3 font-mono text-xs text-ink/60">{r.kind}</span>
                </Link>
              </li>
            ))}
          </ul>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
