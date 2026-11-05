import { forwardRef, useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
const box = "w-full rounded-xl border bg-white/60 px-4 py-2.5 disabled:opacity-50";
const err = (e?: string) => (e ? "border-red-700" : "border-ink/25");
function Wrap({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (<div className="space-y-1.5"><label htmlFor={id} className="text-sm font-medium">{label}</label>{children}
    {error && <p id={id + "-e"} className="text-sm text-red-700">{error}</p>}</div>);
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }>(
  function Textarea({ label, error, className, ...p }, ref) {
    const id = useId();
    return (<Wrap id={id} label={label} error={error}><textarea id={id} ref={ref} rows={4} aria-invalid={!!error} aria-describedby={error ? id + "-e" : undefined} className={cn(box, err(error), className)} {...p} /></Wrap>);
  });
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; options: { value: string; label: string }[] }>(
  function Select({ label, error, options, className, ...p }, ref) {
    const id = useId();
    return (<Wrap id={id} label={label} error={error}><select id={id} ref={ref} aria-invalid={!!error} aria-describedby={error ? id + "-e" : undefined} className={cn(box, err(error), className)} {...p}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Wrap>);
  });
export function Checkbox({ label, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-blue" {...p} />{label}</label>;
}
export function Radio({ label, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="inline-flex items-center gap-2"><input type="radio" className="h-4 w-4 accent-blue" {...p} />{label}</label>;
}
export function Switch({ checked, onCheckedChange, label, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (<button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onCheckedChange(!checked)} className="inline-flex items-center gap-3 disabled:opacity-50">
    <span className={cn("relative h-6 w-11 rounded-full transition", checked ? "bg-blue" : "bg-ink/25")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-paper transition-all", checked ? "left-5" : "left-0.5")} /></span>{label}</button>);
}
export function Avatar({ name, src, size = 40 }: { name: string; src?: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return src ? <img src={src} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
    : <span role="img" aria-label={name} className="grid place-items-center rounded-full bg-lime font-medium" style={{ width: size, height: size }}>{initials}</span>;
}
