import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { ProgressBar } from "./Feedback";
export const PageContainer = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn("mx-auto w-full max-w-6xl px-6 py-10", className)}>{children}</div>;
export const SectionHeader = ({ title, description, action }: { title: string; description?: string; action?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-semibold tracking-tight">{title}</h2>{description && <p className="mt-1 text-ink/65">{description}</p>}</div>{action}</div>);
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn("rounded-2xl border border-ink/15 bg-white/50 p-5", className)}>{children}</div>;
export const StatCard = ({ label, value, progress }: { label: string; value: string; progress?: number }) => (
  <Card><p className="text-sm text-ink/65">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p>{progress !== undefined && <div className="mt-3"><ProgressBar value={progress} /></div>}</Card>);
export const ContentGrid = ({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) => (
  <div className={cn("grid gap-4 sm:grid-cols-2", cols === 3 && "lg:grid-cols-3", cols === 4 && "lg:grid-cols-4")}>{children}</div>);
