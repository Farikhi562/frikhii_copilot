import { z } from "zod";

// Go encodes empty slices as [] or null depending on where they came from.
const list = <T extends z.ZodTypeAny>(item: T) => z.array(item).nullish().transform((v) => v ?? []);

export const competencyStatus = z.enum(["not_started", "learning", "developing", "proficient", "mastered"]);
export type CompetencyStatus = z.infer<typeof competencyStatus>;

export const competencySchema = z.object({
  competency: z.string(),
  status: competencyStatus,
  mastery: z.number(),
  peak_mastery: z.number(),
  confidence: z.number(),
  attempts: z.number(),
  correct_attempts: z.number(),
  common_mistakes: list(z.object({ tag: z.string(), count: z.number() })),
  regression: z.boolean(),
  last_demonstrated_at: z.string().nullish(),
  accuracy_history: list(z.object({ at: z.string(), score: z.number(), mastery: z.number() })),
});
export type CompetencyRecord = z.infer<typeof competencySchema>;

export const gapSchema = z.object({
  id: z.string(),
  competency: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  confidence: z.number(),
  cause: z.enum(["current_lesson", "prerequisite", "retention"]),
  prerequisites: list(z.string()),
  unverified_prerequisites: list(z.string()),
  evidence_event_ids: list(z.string()),
  evidence_summary: z.string(),
  recommendation: z.string(),
  status: z.enum(["open", "improving", "resolved"]),
  opened_at: z.string(),
  resolved_at: z.string().nullish(),
});
export type KnowledgeGap = z.infer<typeof gapSchema>;

export const recommendationSchema = z.object({
  kind: z.string(),
  competency: z.string(),
  title: z.string(),
  reason: z.string(),
  priority: z.number(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const insightSchema = z.object({
  id: z.string(),
  kind: z.enum(["strength", "weakness", "pattern", "misconception", "strategy"]),
  statement: z.string(),
  rationale: z.string(),
  evidence_event_ids: list(z.string()),
  confidence: z.enum(["low", "medium", "high"]),
  source: z.enum(["rules", "ai"]),
  status: z.enum(["active", "corrected", "dismissed"]),
  user_note: z.string().nullish(),
  created_at: z.string(),
});
export type Insight = z.infer<typeof insightSchema>;

export const preferencesSchema = z.object({
  explanation_style: z.enum(["simple", "balanced", "technical"]),
  example_style: z.enum(["practical", "visual", "analogy", "mixed"]),
  pace: z.enum(["slow", "steady", "fast"]),
  preferred_language: z.enum(["id-ID", "en-US"]),
  daily_study_minutes: z.number().nullish(),
  short_term_target: z.string(),
  long_term_target: z.string(),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export const courseIntelligenceSchema = z.object({
  course_id: z.string(),
  competencies: list(competencySchema),
  knowledge_gaps: list(gapSchema),
  recommendations: list(recommendationSchema),
  reviews: list(z.object({ competency: z.string(), due_at: z.string(), interval_days: z.number() })),
  insights: list(insightSchema),
  prerequisites: z.record(z.string(), list(z.string())).nullish().transform((v) => v ?? {}),
});
export type CourseIntelligence = z.infer<typeof courseIntelligenceSchema>;

export const overviewSchema = z.object({
  courses: list(courseIntelligenceSchema),
  preferences: preferencesSchema,
});
export type IntelligenceOverview = z.infer<typeof overviewSchema>;

export const preferencesEnvelope = z.object({ preferences: preferencesSchema });
export const statusEnvelope = z.object({ status: z.string() });
export const generateEnvelope = z.object({
  stored: z.number(),
  rejected: z.number().optional(),
  message: z.string().optional(),
});
