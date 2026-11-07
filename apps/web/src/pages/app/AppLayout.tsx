import * as D from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import { AccountMenu } from "../../components/auth/AccountMenu";
import { Breadcrumb } from "../../components/ui/Nav";
import { toast } from "../../components/ui/Toast";
import { messageForError } from "../../features/auth/api/auth";
import { useAuth } from "../../features/auth/context";
import { displayName } from "../../features/profile/api/profile";
import { useProfile } from "../../features/profile/hooks/useProfile";
import { SearchDialog } from "../../features/workspace/shell/SearchDialog";
import { SidebarBody } from "../../features/workspace/shell/SidebarBody";
import { useBreadcrumbs } from "../../features/workspace/shell/useBreadcrumbs";
import { useShellStore } from "../../features/workspace/shell/shellStore";
import { cn } from "../../lib/cn";

export default function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile(user);
  const collapsed = useShellStore((s) => s.collapsed);
  const toggle = useShellStore((s) => s.toggle);
  const crumbs = useBreadcrumbs();

  const name = displayName(profile, user);
  const email = user?.email ?? "";
  const avatarUrl = profile?.avatar_url ?? undefined;
  const pageTitle = crumbs[crumbs.length - 1]?.label ?? "FRIKHII Copilot";

  useEffect(() => setDrawer(false), [pathname]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      toast(`Could not sign out. ${messageForError(error)}`);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>

      <aside
        aria-label="Workspace"
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-ink/10 bg-paper transition-[width] duration-200 md:block",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <SidebarBody collapsed={collapsed} name={name} email={email} avatarUrl={avatarUrl} onToggle={toggle} />
      </aside>

      <D.Root open={drawer} onOpenChange={setDrawer}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-ink/50 md:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-paper shadow-xl md:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Move between sections of your learning workspace.</D.Description>
            <D.Close aria-label="Close navigation" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full hover:bg-ink/10">
              <X className="h-5 w-5" aria-hidden />
            </D.Close>
            <SidebarBody collapsed={false} name={name} email={email} avatarUrl={avatarUrl} />
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ink/10 bg-paper/90 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
              className="grid h-10 w-10 place-items-center rounded-full border border-ink/20 md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <div className="hidden min-w-0 sm:block">
              <Breadcrumb items={crumbs} />
            </div>
            <p className="truncate font-medium sm:hidden" aria-hidden>
              {pageTitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearch(true)}
              className="flex items-center gap-2 rounded-full border border-ink/20 px-3 py-2 text-sm text-ink/70 hover:bg-ink/5"
            >
              <Search className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded bg-ink/10 px-1.5 font-mono text-xs lg:inline">Ctrl K</kbd>
            </button>
            <AccountMenu name={name} email={email} signingOut={signingOut} onSignOut={() => void handleSignOut()} />
          </div>
        </header>
        <SearchDialog open={search} onOpenChange={setSearch} />

        <main id="app-main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
