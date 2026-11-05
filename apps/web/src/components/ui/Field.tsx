import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const Field = forwardRef<HTMLInputElement, Props>(function Field(
  { label, error, className, ...props },
  ref,
) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        aria-invalid={!!error}
        aria-describedby={error ? id + "-e" : undefined}
        className={cn(
          "w-full rounded-xl border bg-white/60 px-4 py-2.5",
          error ? "border-red-600" : "border-ink/25",
          className,
        )}
        {...props}
      />
      {error && (
        <p id={id + "-e"} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
});
