import { z } from "zod";
import { learningLanguages, selfReportedLevels } from "./course";

export const learningFormats = ["explanations", "examples", "practice", "projects"] as const;
export const knowledgeConfidenceLevels = ["none", "some", "comfortable"] as const;

export const intakeFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters.")
    .max(160, "Keep the title under 160 characters."),
  goal_statement: z
    .string()
    .trim()
    .min(8, "Describe the goal in at least 8 characters.")
    .max(2000, "Keep the goal under 2000 characters."),
  intended_outcome: z
    .string()
    .trim()
    .min(8, "Describe the outcome in at least 8 characters.")
    .max(2000, "Keep the outcome under 2000 characters."),
  motivation: z
    .string()
    .trim()
    .min(3, "Add a short reason.")
    .max(1500, "Keep the reason under 1500 characters."),
  self_reported_level: z.enum(selfReportedLevels),
  prior_experience: z.string().trim().max(2000, "Keep this under 2000 characters."),
  known_topics: z.string().trim().max(1000, "Keep this under 1000 characters."),
  confidence: z.enum(knowledgeConfidenceLevels),
  weekly_study_minutes: z
    .number({ message: "Enter the weekly minutes as a number." })
    .int("Use whole minutes.")
    .min(30, "Plan at least 30 minutes per week.")
    .max(10080, "That is more minutes than a week contains."),
  learning_language: z.enum(learningLanguages),
  formats: z.array(z.enum(learningFormats)).min(1, "Choose at least one format."),
  notes: z.string().trim().max(1000, "Keep this under 1000 characters."),
  additional_context: z.string().trim().max(4000, "Keep this under 4000 characters."),
  target_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional()
    .or(z.literal("")),
});

export type IntakeForm = z.infer<typeof intakeFormSchema>;

export type CreateLearningGoalRequest = {
  title: string;
  goal_statement: string;
  intended_outcome: string;
  motivation: string;
  additional_context: string;
  self_reported_level: (typeof selfReportedLevels)[number];
  current_knowledge: Record<string, unknown>;
  weekly_study_minutes: number;
  learning_language: (typeof learningLanguages)[number];
  learning_preferences: Record<string, unknown>;
  target_date: string | null;
};

export function toCreateGoalRequest(values: IntakeForm): CreateLearningGoalRequest {
  return {
    title: values.title,
    goal_statement: values.goal_statement,
    intended_outcome: values.intended_outcome,
    motivation: values.motivation,
    additional_context: values.additional_context,
    self_reported_level: values.self_reported_level,
    current_knowledge: {
      prior_experience: values.prior_experience,
      known_topics: values.known_topics
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
      confidence: values.confidence,
    },
    weekly_study_minutes: values.weekly_study_minutes,
    learning_language: values.learning_language,
    learning_preferences: {
      formats: values.formats,
      notes: values.notes,
    },
    target_date: values.target_date ? values.target_date : null,
  };
}

export const intakeDefaults: IntakeForm = {
  title: "",
  goal_statement: "",
  intended_outcome: "",
  motivation: "",
  self_reported_level: "unsure",
  prior_experience: "",
  known_topics: "",
  confidence: "some",
  weekly_study_minutes: 300,
  learning_language: "en-US",
  formats: ["explanations", "practice"],
  notes: "",
  additional_context: "",
  target_date: "",
};

export const intakeSteps = [
  {
    title: "The goal",
    description: "What do you want to be able to do, and why now?",
    fields: ["title", "goal_statement", "intended_outcome", "motivation"] as const,
  },
  {
    title: "Where you are",
    description: "An honest starting point makes the diagnostic and curriculum more useful.",
    fields: ["self_reported_level", "prior_experience", "known_topics", "confidence"] as const,
  },
  {
    title: "Time and constraints",
    description: "The plan must fit your real week.",
    fields: [
      "weekly_study_minutes",
      "learning_language",
      "formats",
      "notes",
      "additional_context",
      "target_date",
    ] as const,
  },
  {
    title: "Review",
    description: "Check the details before the diagnostic.",
    fields: [] as const,
  },
] as const;
