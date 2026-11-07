import type { Lesson } from "../course/schemas/course";

/** Reusable lesson content blocks. Real lessons currently supply blueprints only. */
export type LessonBlock =
  | { type: "intro" | "explanation" | "summary"; title?: string; body: string }
  | { type: "objectives"; items: string[] }
  | { type: "outline"; title: string; items: string[] }
  | { type: "key_concept"; title: string; body: string }
  | { type: "analogy"; body: string }
  | { type: "example"; title: string; steps: string[] }
  | { type: "demonstration"; title: string; items: string[] }
  | { type: "code"; language: string; code: string; caption?: string }
  | { type: "math"; expression: string; caption?: string }
  | { type: "table"; caption?: string; headers: string[]; rows: string[][] }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "practice"; title: string; items: string[] }
  | { type: "knowledge_check"; items: string[] };

/** Maps the persisted lesson blueprint onto blocks. Empty sections are omitted. */
export function blueprintToBlocks(lesson: Lesson): LessonBlock[] {
  const bp = lesson.blueprint;
  const blocks: LessonBlock[] = [{ type: "intro", body: bp.introduction }];
  if (bp.objectives.length) blocks.push({ type: "objectives", items: bp.objectives });
  if (bp.prerequisite_concepts.length) {
    blocks.push({ type: "outline", title: "Before you start", items: bp.prerequisite_concepts });
  }
  if (bp.concept_outline.length) {
    blocks.push({ type: "outline", title: "Explanation outline", items: bp.concept_outline });
  }
  for (const analogy of bp.analogies) blocks.push({ type: "analogy", body: analogy });
  if (bp.demonstration.length) {
    blocks.push({ type: "demonstration", title: "Demonstration outline", items: bp.demonstration });
  }
  if (bp.guided_practice.length) {
    blocks.push({ type: "practice", title: "Guided practice", items: bp.guided_practice });
  }
  if (bp.independent_practice.length) {
    blocks.push({ type: "practice", title: "Independent practice", items: bp.independent_practice });
  }
  if (bp.knowledge_check.length) blocks.push({ type: "knowledge_check", items: bp.knowledge_check });
  blocks.push({ type: "summary", body: bp.summary });
  return blocks;
}

export function wordCount(blocks: LessonBlock[]): number {
  const text = JSON.stringify(blocks);
  return text.split(/\s+/).filter(Boolean).length;
}
