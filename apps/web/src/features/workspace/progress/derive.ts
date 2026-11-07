import type { CourseDetail, CourseSummary, LearningGoal } from "../../course/schemas/course";
import { displayVersion } from "../courseView";

export type HistoryEvent = { id: string; at: string; text: string };

/**
 * Real, persisted setup events only (goals created, drafts created). Lesson activity is
 * not recorded anywhere yet, so none is invented.
 */
export function deriveHistory(goals: LearningGoal[], courses: CourseSummary[], limit = 10): HistoryEvent[] {
  const events: HistoryEvent[] = [
    ...goals.map((g) => ({ id: `goal-${g.id}`, at: g.created_at, text: `Created learning goal “${g.title}”` })),
    ...courses.map((c) => ({ id: `course-${c.id}`, at: c.created_at, text: `Generated a course draft “${c.title}”` })),
  ];
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export type TargetedCompetency = { id: string; name: string; description: string; course: string };

/** Competencies that enrolled courses aim to develop. These are targets, not achievements. */
export function deriveTargetedCompetencies(details: CourseDetail[]): TargetedCompetency[] {
  const seen = new Set<string>();
  const out: TargetedCompetency[] = [];
  for (const detail of details) {
    if (detail.status !== "approved") continue;
    const version = displayVersion(detail);
    if (!version) continue;
    for (const c of version.target_competencies) {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `${detail.id}-${c.id}`, name: c.name, description: c.description, course: version.title });
    }
  }
  return out;
}
