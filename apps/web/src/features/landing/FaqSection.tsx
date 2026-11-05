import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { faqItems, faqJsonLd, faqStatusMeta, type FaqStatus } from "./faqContent";
import { StatusChip } from "./StatusChip";

/**
 * Accordion following the WAI-ARIA disclosure/accordion pattern: each question is a
 * heading containing a button with aria-expanded/aria-controls. One panel is open at a
 * time and it can be collapsed again. Radix Accordion is not a dependency of this
 * project, so this is a small dependency-free implementation of the same pattern.
 * Closed panels stay in the DOM (crawlable, animatable) but are `inert`.
 */
export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = faqItems.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    triggers.current[next]?.focus();
  }

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 md:py-28"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd() }} />
      <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
        <div className="self-start lg:sticky lg:top-28">
          <p className="font-mono text-sm text-ink/60">
            FAQ <span aria-hidden="true">/</span>{" "}
            {String(faqItems.length).padStart(2, "0")} questions
          </p>
          <h2
            id="faq-heading"
            className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl"
          >
            Honest answers, before you begin.
          </h2>
          <p className="mt-6 max-w-md text-lg text-ink/70">
            What FRIKHII Copilot does today, what is still being built, and where you should
            keep using your own judgment.
          </p>

          <dl className="mt-10 max-w-md space-y-4 border-t border-ink/15 pt-6 text-sm">
            {(Object.keys(faqStatusMeta) as FaqStatus[]).map((status) => (
              <div key={status} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <dt>
                  <StatusChip status={status} />
                </dt>
                <dd className="text-ink/65">{faqStatusMeta[status].description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <ol className="border-b border-ink/80">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            const buttonId = `${baseId}-trigger-${item.id}`;
            const panelId = `${baseId}-panel-${item.id}`;
            return (
              <li key={item.id} className="group border-t border-ink/80">
                <h3>
                  <button
                    ref={(el) => {
                      triggers.current[index] = el;
                    }}
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                    className="flex w-full items-start gap-5 py-6 text-left md:gap-8 md:py-8"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 font-mono text-sm text-ink/60 tabular-nums"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-xl font-medium leading-snug tracking-tight transition-transform duration-300 ease-out md:text-2xl",
                        !isOpen && "group-hover:translate-x-1",
                      )}
                    >
                      {item.question}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                        isOpen ? "border-ink bg-ink text-paper" : "border-ink/30",
                      )}
                    >
                      <Plus
                        className={cn(
                          "h-4 w-4 transition-transform duration-300 ease-out",
                          isOpen && "rotate-45",
                        )}
                      />
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  inert={!isOpen}
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="pb-8 pl-0 md:pb-10 md:pl-[3.75rem]">
                      <p className="max-w-prose text-lg leading-relaxed text-ink/80">
                        {item.answer}
                      </p>
                      {item.note && (
                        <div className="mt-5 flex max-w-prose flex-col items-start gap-3 border-l-2 border-ink/20 pl-4">
                          {item.status && <StatusChip status={item.status} />}
                          <p className="text-sm leading-relaxed text-ink/65">{item.note}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
