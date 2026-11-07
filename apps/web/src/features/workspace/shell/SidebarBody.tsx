import { Link, useLocation } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, GraduationCap } from "lucide-react";
import { Mark } from "../../../components/brand/Mark";
import { Avatar } from "../../../components/ui/Form";
import { Tooltip } from "../../../components/ui/Overlay";
import { cn } from "../../../lib/cn";
import { useCourses } from "../../course/hooks/useCourse";
import { mainNav, secondaryNav, type AppNavItem } from "./nav";

function NavRow({ item, collapsed, current }: { item: AppNavItem; collapsed: boolean; current: boolean }) {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      aria-current={current ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        current ? "bg-ink text-paper" : "text-ink/80 hover:bg-ink/10 hover:text-ink",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  return collapsed ? <Tooltip text={item.label}>{link}</Tooltip> : link;
}

/**
 * Shared by the desktop sidebar and the mobile drawer. `collapsed` only applies on desktop;
 * the drawer always renders expanded.
 */
export function SidebarBody({
  collapsed,
  name,
  email,
  avatarUrl,
  onToggle,
}: {
  collapsed: boolean;
  name: string;
  email: string;
  avatarUrl?: string;
  onToggle?: () => void;
}) {
  const { pathname } = useLocation();
  const courses = useCourses();
  const enrolled = (courses.data ?? []).filter((c) => c.status === "approved").slice(0, 4);

  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-2 pt-1")}>
        <Link to="/app" aria-label="FRIKHII Copilot overview">
          {collapsed ? <span className="font-mono text-lg font-semibold">F</span> : <Mark />}
        </Link>
      </div>

      {!collapsed && (
        <p className="mx-2 rounded-xl bg-ink/5 px-3 py-2 font-mono text-xs text-ink/70">
          Personal workspace
        </p>
      )}

      <nav aria-label="Main" className="grid gap-1">
        {mainNav.map((item) => (
          <NavRow key={item.to} item={item} collapsed={collapsed} current={item.match(pathname)} />
        ))}
      </nav>

      {!collapsed && (
        <section aria-labelledby="sidebar-learning" className="min-h-0 flex-1 overflow-y-auto px-2">
          <h2 id="sidebar-learning" className="font-mono text-xs text-ink/60">
            Learning
          </h2>
          {enrolled.length > 0 ? (
            <ul className="mt-2 grid gap-1">
              {enrolled.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/app/courses/${c.id}`}
                    aria-current={pathname.startsWith(`/app/courses/${c.id}`) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink/10",
                      pathname.startsWith(`/app/courses/${c.id}`) && "bg-lime",
                    )}
                  >
                    <GraduationCap className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink/65">
              {courses.isLoading ? "Loading courses…" : "Approved courses appear here."}
            </p>
          )}
          <Link to="/app/courses/demo" className="mt-2 block rounded-lg px-2 py-1.5 text-sm text-ink/70 hover:bg-ink/10">
            Explore the demo course
          </Link>
        </section>
      )}
      {collapsed && <div className="flex-1" />}

      <nav aria-label="Secondary" className="grid gap-1 border-t border-ink/10 pt-3">
        {secondaryNav.map((item) => (
          <NavRow key={item.to} item={item} collapsed={collapsed} current={item.match(pathname)} />
        ))}
      </nav>

      <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "px-2")}>
        <Avatar name={name} src={avatarUrl} size={36} />
        {!collapsed && (
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{name}</p>
            <p className="truncate text-xs text-ink/65">{email}</p>
          </div>
        )}
      </div>

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink/70 hover:bg-ink/10",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" aria-hidden /> : <><ChevronsLeft className="h-4 w-4" aria-hidden /> Collapse</>}
        </button>
      )}
    </div>
  );
}
