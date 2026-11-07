import { Lightbulb, Quote } from "lucide-react";
import type { LessonBlock } from "../lessonBlocks";

const h = "text-sm font-semibold uppercase tracking-wide text-ink/60";

function List({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={ordered ? "list-decimal space-y-2 pl-5" : "list-disc space-y-2 pl-5"}>
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </Tag>
  );
}

export function LessonBlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "intro":
      return <p className="text-xl leading-relaxed text-ink/85">{block.body}</p>;
    case "explanation":
      return (
        <div className="space-y-2">
          {block.title && <h2 className="text-2xl font-semibold tracking-tight">{block.title}</h2>}
          <p>{block.body}</p>
        </div>
      );
    case "objectives":
      return (
        <section className="rounded-2xl border border-ink/15 bg-white/50 p-5">
          <h2 className={h}>Learning objectives</h2>
          <div className="mt-3"><List items={block.items} /></div>
        </section>
      );
    case "outline":
      return (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">{block.title}</h2>
          <div className="mt-2"><List items={block.items} /></div>
        </section>
      );
    case "key_concept":
      return (
        <aside className="rounded-2xl bg-lime p-5 text-ink">
          <p className="flex items-center gap-2 font-mono text-xs"><Lightbulb className="h-4 w-4" aria-hidden /> Key concept</p>
          <p className="mt-2 text-lg font-semibold">{block.title}</p>
          <p className="mt-1">{block.body}</p>
        </aside>
      );
    case "analogy":
      return (
        <blockquote className="border-l-4 border-blue pl-4">
          <p className="flex items-center gap-2 font-mono text-xs text-ink/60"><Quote className="h-3 w-3" aria-hidden /> Analogy</p>
          <p className="mt-1 text-lg italic">{block.body}</p>
        </blockquote>
      );
    case "example":
      return (
        <section className="rounded-2xl border border-ink/15 p-5">
          <h2 className="text-xl font-semibold tracking-tight">{block.title}</h2>
          <div className="mt-3"><List items={block.steps} ordered /></div>
        </section>
      );
    case "demonstration":
      return (
        <section>
          <h2 className="text-xl font-semibold tracking-tight">{block.title}</h2>
          <div className="mt-2"><List items={block.items} /></div>
        </section>
      );
    case "code":
      return (
        <figure>
          <pre className="overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-sm leading-6 text-paper" tabIndex={0} aria-label={`${block.language} code`}>
            <code>{block.code}</code>
          </pre>
          {block.caption && <figcaption className="mt-2 text-sm text-ink/70">{block.caption}</figcaption>}
        </figure>
      );
    case "math":
      return (
        <figure className="rounded-2xl border border-ink/15 bg-white/50 p-5 text-center">
          <p className="overflow-x-auto font-mono text-lg" role="math" aria-label={block.expression}>{block.expression}</p>
          {block.caption && <figcaption className="mt-2 text-sm text-ink/70">{block.caption}</figcaption>}
        </figure>
      );
    case "table":
      return (
        <figure className="overflow-x-auto">
          <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
            {block.caption && <caption className="mb-2 text-left text-sm text-ink/70">{block.caption}</caption>}
            <thead>
              <tr>{block.headers.map((x) => <th key={x} scope="col" className="border-b-2 border-ink px-3 py-2 font-semibold">{x}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j} className="border-b border-ink/15 px-3 py-2 font-mono">{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </figure>
      );
    case "image":
      return (
        <figure>
          <img src={block.src} alt={block.alt} width={640} height={360} loading="lazy" className="h-auto w-full rounded-2xl border border-ink/15" />
          {block.caption && <figcaption className="mt-2 text-sm text-ink/70">{block.caption}</figcaption>}
        </figure>
      );
    case "practice":
      return (
        <section className="rounded-2xl border border-blue/40 bg-blue/5 p-5">
          <h2 className="text-xl font-semibold tracking-tight">{block.title}</h2>
          <div className="mt-2"><List items={block.items} /></div>
        </section>
      );
    case "knowledge_check":
      return (
        <section className="rounded-2xl border border-ink/15 bg-white/50 p-5">
          <h2 className="text-xl font-semibold tracking-tight">Knowledge check</h2>
          <p className="mt-1 text-sm text-ink/70">Questions to think through. Answers are not graded in this version.</p>
          <div className="mt-3"><List items={block.items} /></div>
        </section>
      );
    case "summary":
      return (
        <section className="border-t border-ink/20 pt-6">
          <h2 className={h}>Summary</h2>
          <p className="mt-2 text-lg">{block.body}</p>
        </section>
      );
  }
}

export function LessonBlocks({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <div className="space-y-8 text-lg leading-relaxed">
      {blocks.map((block, i) => (
        <LessonBlockView key={i} block={block} />
      ))}
    </div>
  );
}
