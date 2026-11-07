import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LifeBuoy, LogOut, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar } from "../ui/Form";

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-lime data-[disabled]:opacity-50";

export function AccountMenu({
  name,
  email,
  signingOut,
  onSignOut,
}: {
  name: string;
  email: string;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-ink/10"
        >
          <Avatar name={name} size={32} />
          <span className="hidden max-w-40 truncate text-sm font-medium sm:block">{name}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-2xl border border-ink/15 bg-paper p-2 shadow-lg"
        >
          <div className="px-3 py-2">
            <p className="truncate font-medium">{name}</p>
            <p className="truncate text-xs text-ink/55">{email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-ink/10" />
          <DropdownMenu.Item asChild>
            <Link to="/app/settings" className={itemClass}>
              <Settings className="h-4 w-4" aria-hidden />
              Account settings
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link to="/app/help" className={itemClass}>
              <LifeBuoy className="h-4 w-4" aria-hidden />
              Help &amp; support
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={signingOut}
            onSelect={() => onSignOut()}
            className={itemClass}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
