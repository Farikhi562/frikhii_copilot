import type { ReactNode } from "react";
import { Loader2, Inbox, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";
export const Spinner = () => <Loader2 className="h-5 w-5 animate-spin" role="status" aria-label="Loading" />;
export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn("animate-pulse rounded-xl bg-ink/10", className)} />;
const badgeTone = {
  lime: "bg-lime text-ink",
  neutral: "bg-ink/10 text-ink",
  blue: "bg-blue/15 text-blue",
  warning: "bg-amber-200 text-amber-950",
  danger: "bg-red-200 text-red-950",
};
export const Badge = ({
  children,
  tone = "lime",
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTone;
}) => (
  <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-xs", badgeTone[tone])}>
    {children}
  </span>
);
export const ProgressBar = ({ value }: { value: number }) => (
  <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="h-2 rounded-full bg-ink/10">
    <div className="h-2 rounded-full bg-blue" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>);
export const EmptyState = ({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) => (
  <div className="grid place-items-center gap-2 rounded-2xl border border-dashed border-ink/25 p-10 text-center">
    <Inbox aria-hidden /><h3 className="font-medium">{title}</h3><p className="text-ink/65">{hint}</p>{action}</div>);
export const ErrorState = ({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) => (
  <div role="alert" className="grid place-items-center gap-2 rounded-2xl border border-red-700/40 p-10 text-center">
    <AlertTriangle aria-hidden /><h3 className="font-medium">{title}</h3><p className="text-ink/65">{hint}</p>{action}</div>);
const tone = { info: "border-blue/50", success: "border-lime", warning: "border-amber-600", error: "border-red-700" };
export function Alert({ variant = "info", title, children }: { variant?: keyof typeof tone; title: string; children?: ReactNode }) {
  return (<div role={variant === "error" ? "alert" : "status"} className={cn("rounded-xl border-l-4 bg-white/60 p-4", tone[variant])}><p className="font-medium">{title}</p>{children && <p className="text-ink/70">{children}</p>}</div>);
}
export function ProgressRing({ value, size = 72, label }: { value: number; size?: number; label?: string }) {
  const v = Math.min(100, Math.max(0, value)); const r = 30; const c = 2 * Math.PI * r;
  return (<div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"} className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
    <svg viewBox="0 0 72 72" className="-rotate-90" aria-hidden><circle cx="36" cy="36" r={r} fill="none" strokeWidth="6" className="stroke-ink/10" />
      <circle cx="36" cy="36" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="stroke-blue transition-all" /></svg>
    <span className="absolute font-mono text-sm">{v}%</span></div>);
}
