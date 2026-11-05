import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Home, Settings } from "lucide-react";
import { AccountMenu } from "../../components/auth/AccountMenu";
import { Mark } from "../../components/brand/Mark";
import { Dialog } from "../../components/ui/Dialog";
import { Avatar } from "../../components/ui/Form";
import { LanguageToggle } from "../../components/ui/LanguageToggle";
import { NavItem, Sidebar, Topbar, type NavEntry } from "../../components/ui/Nav";
import { toast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { messageForError } from "../../features/auth/api/auth";
import { useAuth } from "../../features/auth/context";
import { displayName } from "../../features/profile/api/profile";
import { useProfile } from "../../features/profile/hooks/useProfile";

const items: NavEntry[] = [
  { to: "/app", label: "Dashboard", icon: <Home className="h-4 w-4" /> },
  { to: "/app/courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
  { to: "/app/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export default function AppLayout() {
  const [menu, setMenu] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile(user);

  const name = displayName(profile, user);
  const email = user?.email ?? "";

  useEffect(() => setMenu(false), [pathname]);

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
      <aside className="hidden w-60 shrink-0 flex-col justify-between border-r border-ink/10 p-5 md:flex">
        <div className="space-y-8">
          <Mark />
          <Sidebar items={items} className="block w-full" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Avatar name={name} size={36} />
            <div className="min-w-0">
              <p className="truncate font-medium">{name}</p>
              <p className="truncate text-xs text-ink/55">{email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full text-sm"
            loading={signingOut}
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <Topbar
          title="FRIKHII Copilot"
          onMenu={() => setMenu(true)}
          actions={
            <div className="flex items-center gap-3">
              <LanguageToggle />
              <span className="hidden font-mono text-xs text-ink/55 sm:inline">Phase 03</span>
              <AccountMenu
                name={name}
                email={email}
                signingOut={signingOut}
                onSignOut={() => void handleSignOut()}
              />
            </div>
          }
        />

        <Dialog
          open={menu}
          onOpenChange={setMenu}
          title="Menu"
          description="Navigate the app or manage your account."
        >
          <nav aria-label="Mobile" className="grid gap-1">
            {items.map((item) => (
              <NavItem key={item.to} {...item} end={item.to === "/app"} />
            ))}
          </nav>
          <div className="mt-4 border-t border-ink/10 pt-4">
            <div className="flex items-center gap-3 text-sm">
              <Avatar name={name} size={36} />
              <div className="min-w-0">
                <p className="truncate font-medium">{name}</p>
                <p className="truncate text-xs text-ink/55">{email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="mt-3 w-full"
              loading={signingOut}
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </Dialog>

        <main className="mx-auto max-w-5xl p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
