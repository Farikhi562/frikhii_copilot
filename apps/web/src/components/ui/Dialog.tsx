import * as D from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "lucide-react";
export function Dialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; children?: ReactNode }) {
  return (<D.Root open={open} onOpenChange={onOpenChange}><D.Portal>
    <D.Overlay className="fixed inset-0 bg-ink/50" />
    <D.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-paper p-6">
      <D.Title className="text-xl font-semibold">{title}</D.Title><D.Description className="mt-1 text-ink/70">{description}</D.Description>
      <div className="mt-5">{children}</div>
      <D.Close aria-label="Close" className="absolute right-4 top-4"><X /></D.Close></D.Content></D.Portal></D.Root>);
}
