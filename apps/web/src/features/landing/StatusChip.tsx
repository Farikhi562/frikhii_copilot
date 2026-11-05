import { cn } from "../../lib/cn";
import { faqStatusMeta, type FaqStatus } from "./faqContent";

const chipStyles: Record<FaqStatus, string> = {
  built: "bg-lime text-ink border-lime",
  partial: "border-ink/60 text-ink",
  planned: "border-dashed border-ink/50 text-ink/70",
};

const onDarkStyles: Record<FaqStatus, string> = {
  built: "bg-lime text-ink border-lime",
  partial: "border-paper/60 text-paper",
  planned: "border-dashed border-paper/50 text-paper/75",
};

/** Text-labelled status badge. Meaning never depends on colour alone. */
export function StatusChip({ status, onDark = false, className }: { status: FaqStatus; onDark?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-xs",
        onDark ? onDarkStyles[status] : chipStyles[status],
        className,
      )}
    >
      {faqStatusMeta[status].label}
    </span>
  );
}
