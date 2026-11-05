import { z } from "zod";

export const learningLanguages = ["en-US", "id-ID"] as const;
export const selfReportedLevels = [
  "beginner",
  "basic",
  "intermediate",
  "advanced",
  "unsure",
] as const;
export const goalStatuses = [
  "intake",
  "diagnostic_ready",
  "diagnostic_evaluated",
  "generating",
  "course_draft",
  "approved",
  "failed",
] as const;
export const diagnosticStatuses = [
  "generating",
  "ready",
  "submitted",
  "evaluating",
  "evaluated",
  "failed",
] as const;
export const courseStatuses = ["draft", "approved", "archived"] as const;
export const versionStatuses = ["draft", "approved", "superseded"] as const;

const timestamp = z.string().min(1);

export const choiceSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const strengthSchema = z.object({
  competency: z.string(),
  evidence: z.string(),
});

export const knowledgeGapSchema = z.object({
  competency: z.string(),
  description: z.string(),
  severity: z.string(),
  recommendation: z.string(),
});

export const questionScoreSchema = z.object({
  question_id: z.string(),
  score: z.number(),
  feedback: z.string(),
});

export const generationMetadataSchema = z.object({
  provider: z.string().default("unknown"),
  model: z.string().default("unknown"),
  generated_at: z.string().default(""),
  prompt_version: z.string().default(""),
  duration_ms: z.number().default(0),
  repaired: z.boolean().default(false),
  fallback_used: z.boolean().default(false),
  fallback_reason: z.string().optional().nullable(),
});

export const learningGoalSchema = z.object({
  id: z.string(),
  title: z.string(),
  goal_statement: z.string(),
  intended_outcome: z.string(),
  motivation: z.string(),
  additional_context: z.string(),
  self_reported_level: z.string(),
  current_knowledge: z.record(z.string(), z.unknown()).default({}),
  weekly_study_minutes: z.number(),
  learning_language: z.string(),
  learning_preferences: z.record(z.string(), z.unknown()).default({}),
  target_date: z.string().optional().nullable(),
  status: z.enum(goalStatuses),
  last_error: z.string().optional().nullable(),
  course_id: z.string().optional().nullable(),
  course_status: z.string().optional().nullable(),
  created_at: timestamp,
  updated_at: timestamp,
});

export const diagnosticQuestionSchema = z.object({
  id: z.string(),
  sequence: z.number(),
  type: z.string(),
  prompt: z.string(),
  competency: z.string(),
  difficulty: z.string(),
  choices: z.array(choiceSchema).default([]),
});

export const diagnosticAnswerSchema = z.object({
  question_id: z.string(),
  response: z.string(),
  score: z.number().optional().nullable(),
  feedback: z.string().optional().nullable(),
});

export const diagnosticAttemptSchema = z.object({
  id: z.string(),
  learning_goal_id: z.string(),
  status: z.enum(diagnosticStatuses),
  attempt_number: z.number(),
  estimated_level: z.string().optional().nullable(),
  confidence: z.string().optional().nullable(),
  evaluation_summary: z.string().optional().nullable(),
  strengths: z.array(strengthSchema).default([]),
  knowledge_gaps: z.array(knowledgeGapSchema).default([]),
  misconceptions: z.array(z.string()).default([]),
  recommended_start: z.string().optional().nullable(),
  rationale: z.string().optional().nullable(),
  question_scores: z.array(questionScoreSchema).default([]),
  can_skip: z.array(z.string()).default([]),
  questions: z.array(diagnosticQuestionSchema).default([]),
  answers: z.array(diagnosticAnswerSchema).default([]),
  submitted_at: timestamp.optional().nullable(),
  evaluated_at: timestamp.optional().nullable(),
  created_at: timestamp,
});

export const objectiveSchema = z.object({
  id: z.string(),
  description: z.string(),
  competency: z.string(),
});

export const competencySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

export const prerequisiteSchema = z.object({
  concept: z.string(),
  reason: z.string(),
});

export const referenceSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export const lessonBlueprintSchema = z.object({
  introduction: z.string(),
  objectives: z.array(z.string()).default([]),
  prerequisite_concepts: z.array(z.string()).default([]),
  concept_outline: z.array(z.string()).default([]),
  analogies: z.array(z.string()).default([]),
  demonstration: z.array(z.string()).default([]),
  guided_practice: z.array(z.string()).default([]),
  independent_practice: z.array(z.string()).default([]),
  knowledge_check: z.array(z.string()).default([]),
  summary: z.string(),
});

export const lessonSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  sequence: z.number(),
  title: z.string(),
  description: z.string(),
  estimated_duration_minutes: z.number(),
  blueprint: lessonBlueprintSchema,
});

export const exerciseSchema = z.object({
  title: z.string(),
  description: z.string(),
  difficulty: z.string(),
  competency: z.string(),
  instructions: z.array(z.string()).default([]),
  expected_deliverable: z.string(),
  evaluation_criteria: z.array(z.string()).default([]),
});

export const knowledgeCheckSchema = z.object({
  description: z.string(),
  question_count: z.number(),
  competencies: z.array(z.string()).default([]),
});

export const courseClassSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  sequence: z.number(),
  title: z.string(),
  description: z.string(),
  objectives: z.array(objectiveSchema).default([]),
  prerequisite_class_ids: z.array(z.string()).default([]),
  prerequisites: z.array(referenceSchema).default([]),
  estimated_duration_minutes: z.number(),
  key_concepts: z.array(z.string()).default([]),
  lessons: z.array(lessonSchema).default([]),
  exercise: exerciseSchema.optional().nullable(),
  knowledge_check: knowledgeCheckSchema,
});

export const courseModuleSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  sequence: z.number(),
  title: z.string(),
  description: z.string(),
  objectives: z.array(objectiveSchema).default([]),
  skills: z.array(z.string()).default([]),
  estimated_duration_minutes: z.number(),
  required_previous_module_ids: z.array(z.string()).default([]),
  required_previous_modules: z.array(referenceSchema).default([]),
  classes: z.array(courseClassSchema).default([]),
});

export const finalProjectSchema = z.object({
  title: z.string(),
  description: z.string(),
  competencies: z.array(z.string()).default([]),
  deliverable: z.string(),
  evaluation_criteria: z.array(z.string()).default([]),
});

export const finalAssessmentSchema = z.object({
  title: z.string(),
  description: z.string(),
  format: z.string(),
  competencies: z.array(z.string()).default([]),
  passing_criteria: z.array(z.string()).default([]),
});

export const courseVersionSchema = z.object({
  id: z.string(),
  course_id: z.string(),
  version_number: z.number(),
  status: z.enum(versionStatuses),
  title: z.string(),
  short_description: z.string(),
  description: z.string(),
  learning_goal: z.string(),
  target_learner_level: z.string(),
  objectives: z.array(objectiveSchema).default([]),
  target_competencies: z.array(competencySchema).default([]),
  prerequisites: z.array(prerequisiteSchema).default([]),
  estimated_duration_minutes: z.number(),
  recommended_weekly_study_minutes: z.number(),
  methodology: z.string(),
  expected_outcome: z.string(),
  final_project: finalProjectSchema,
  final_assessment: finalAssessmentSchema,
  assumptions: z.array(z.string()).default([]),
  suggested_search_topics: z.array(z.string()).default([]),
  generation_metadata: generationMetadataSchema,
  warnings: z.array(z.string()).default([]),
  created_at: timestamp,
  approved_at: timestamp.optional().nullable(),
  modules: z.array(courseModuleSchema).default([]),
});

export const courseCountsSchema = z.object({
  modules: z.number(),
  classes: z.number(),
  lessons: z.number(),
  exercises: z.number(),
});

export const courseDetailSchema = z.object({
  id: z.string(),
  learning_goal_id: z.string(),
  status: z.enum(courseStatuses),
  current_version_id: z.string().optional().nullable(),
  approved_version_id: z.string().optional().nullable(),
  version: courseVersionSchema.optional().nullable(),
  approved_version: courseVersionSchema.optional().nullable(),
  counts: courseCountsSchema,
  created_at: timestamp,
  updated_at: timestamp,
});

export const courseSummarySchema = z.object({
  id: z.string(),
  learning_goal_id: z.string(),
  status: z.enum(courseStatuses),
  current_version_id: z.string().optional().nullable(),
  approved_version_id: z.string().optional().nullable(),
  draft_version_id: z.string().optional().nullable(),
  has_draft: z.boolean().default(false),
  title: z.string(),
  short_description: z.string(),
  version_number: z.number(),
  version_status: z.string(),
  target_learner_level: z.string(),
  estimated_duration_minutes: z.number(),
  counts: courseCountsSchema,
  created_at: timestamp,
  updated_at: timestamp,
});

export const learningGoalEnvelopeSchema = z.object({ learning_goal: learningGoalSchema });
export const learningGoalsEnvelopeSchema = z.object({ learning_goals: z.array(learningGoalSchema) });
export const diagnosticEnvelopeSchema = z.object({ diagnostic: diagnosticAttemptSchema });
export const courseEnvelopeSchema = z.object({ course: courseDetailSchema });
export const coursesEnvelopeSchema = z.object({ courses: z.array(courseSummarySchema) });

export type LearningGoal = z.infer<typeof learningGoalSchema>;
export type DiagnosticAttempt = z.infer<typeof diagnosticAttemptSchema>;
export type DiagnosticQuestion = z.infer<typeof diagnosticQuestionSchema>;
export type CourseDetail = z.infer<typeof courseDetailSchema>;
export type CourseSummary = z.infer<typeof courseSummarySchema>;
export type CourseVersion = z.infer<typeof courseVersionSchema>;
export type CourseModule = z.infer<typeof courseModuleSchema>;
export type CourseClass = z.infer<typeof courseClassSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type GenerationMetadata = z.infer<typeof generationMetadataSchema>;
export type GoalStatus = (typeof goalStatuses)[number];
export type DiagnosticStatus = (typeof diagnosticStatuses)[number];
