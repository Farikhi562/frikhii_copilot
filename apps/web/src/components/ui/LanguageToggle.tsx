import { cn } from "../../lib/cn";
import { useI18n, type Language } from "../../lib/i18n";

const options: Array<{ value: Language; label: string; title: string }> = [
  { value: "en", label: "EN", title: "English" },
  { value: "id", label: "ID", title: "Bahasa Indonesia" },
];

export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage } = useI18n();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        "inline-flex items-center rounded-full border border-ink/20 bg-white/40 p-0.5 text-xs font-medium",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={language === option.value}
          onClick={() => setLanguage(option.value)}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            language === option.value
              ? "bg-ink text-paper"
              : "text-ink/65 hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
