import * as TB from "@radix-ui/react-tabs";
import { NavLink, Link } from "react-router-dom";
import { ChevronRight, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
export type NavEntry = { to: string; label: string; icon?: ReactNode };
export const NavItem = ({ to, label, icon, end }: NavEntry & { end?: boolean }) => (
  <NavLink to={to} end={end} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-2", isActive ? "bg-ink text-paper" : "hover:bg-ink/10")} aria-label={label}>{icon}{label}</NavLink>);
export const Sidebar = ({ items, className }: { items: NavEntry[]; className?: string }) => (
  <nav aria-label="Sidebar" className={cn("hidden w-56 shrink-0 space-y-1 md:block", className)}>{items.map((i) => <NavItem key={i.to} {...i} end={i.to === "/app"} />)}</nav>);
export const Topbar = ({ title, onMenu, actions }: { title: string; onMenu?: () => void; actions?: ReactNode }) => (
  <header className="flex items-center justify-between border-b border-ink/10 px-6 py-3">
    <div className="flex items-center gap-3">{onMenu && <button type="button" onClick={onMenu} aria-label="Open menu" className="md:hidden"><Menu /></button>}<h1 className="font-medium">{title}</h1></div>{actions}</header>);
export const Breadcrumb = ({ items }: { items: { label: string; to?: string }[] }) => (
  <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-1 text-sm">{items.map((c, i) => (
    <li key={c.label} className="flex items-center gap-1">{c.to && i < items.length - 1 ? <Link to={c.to} className="text-ink/65 hover:underline">{c.label}</Link> : <span aria-current="page">{c.label}</span>}{i < items.length - 1 && <ChevronRight className="h-4 w-4" aria-hidden />}</li>))}</ol></nav>);
export function Tabs({ tabs, value, onValueChange }: { tabs: { value: string; label: string; content: ReactNode }[]; value?: string; onValueChange?: (v: string) => void }) {
  return (<TB.Root value={value} onValueChange={onValueChange} defaultValue={value === undefined ? tabs[0]?.value : undefined}>
    <TB.List className="flex gap-1 overflow-x-auto border-b border-ink/15">{tabs.map((t) => <TB.Trigger key={t.value} value={t.value} className="shrink-0 whitespace-nowrap px-4 py-2 data-[state=active]:border-b-2 data-[state=active]:border-blue">{t.label}</TB.Trigger>)}</TB.List>
    {tabs.map((t) => <TB.Content key={t.value} value={t.value} className="pt-4">{t.content}</TB.Content>)}</TB.Root>);
}
