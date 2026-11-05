import * as DM from "@radix-ui/react-dropdown-menu";
import * as PO from "@radix-ui/react-popover";
import * as TT from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
const panel = "z-50 rounded-xl border border-ink/15 bg-paper p-2 shadow-lg";
export function DropdownMenu({ trigger, items }: { trigger: ReactNode; items: { label: string; onSelect: () => void; disabled?: boolean }[] }) {
  return (<DM.Root><DM.Trigger asChild>{trigger}</DM.Trigger><DM.Portal><DM.Content align="start" sideOffset={6} className={panel}>
    {items.map((i) => <DM.Item key={i.label} disabled={i.disabled} onSelect={i.onSelect} className="cursor-pointer rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-lime data-[disabled]:opacity-50">{i.label}</DM.Item>)}</DM.Content></DM.Portal></DM.Root>);
}
export function Popover({ trigger, children }: { trigger: ReactNode; children: ReactNode }) {
  return (<PO.Root><PO.Trigger asChild>{trigger}</PO.Trigger><PO.Portal><PO.Content sideOffset={6} className={`${panel} w-64 p-4`}>{children}<PO.Arrow className="fill-paper" /></PO.Content></PO.Portal></PO.Root>);
}
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (<TT.Provider delayDuration={200}><TT.Root><TT.Trigger asChild>{children}</TT.Trigger><TT.Portal><TT.Content sideOffset={6} className="z-50 rounded-lg bg-ink px-3 py-1.5 text-sm text-paper">{text}</TT.Content></TT.Portal></TT.Root></TT.Provider>);
}
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Confirm", onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string; confirmLabel?: string; onConfirm: () => void }) {
  return (<Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
    <div className="flex justify-end gap-3"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => { onConfirm(); onOpenChange(false); }}>{confirmLabel}</Button></div></Dialog>);
}
