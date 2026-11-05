import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "accent" | "ghost"; loading?: boolean };
const v = { primary: "bg-ink text-paper", accent: "bg-lime text-ink", ghost: "border border-ink/25" };
export function Button({ variant = "primary", loading, disabled, className, children, ...p }: Props) {
  return (<button {...p} disabled={disabled || loading} aria-busy={loading}
    className={cn("inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed", v[variant], className)}>
    {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{children}</button>);
}
