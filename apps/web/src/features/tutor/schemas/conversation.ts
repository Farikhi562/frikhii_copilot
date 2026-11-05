import { z } from "zod";

// ---------------------------------------------------------------------------
// Tutor modes
// ---------------------------------------------------------------------------

export const tutorModes = [
  "explain",
  "deep_dive",
  "practice",
  "socratic",
  "review",
  "project",
] as const;

export type TutorMode = (typeof tutorModes)[number];

export const tutorModeLabels: Record<TutorMode, string> = {
  explain: "Explain",
  deep_dive: "Deep Dive",
  practice: "Practice",
  socratic: "Socratic",
  review: "Review",
  project: "Project",
};

export const tutorModeDescriptions: Record<TutorMode, string> = {
  explain: "Get clear explanations of concepts at your level",
  deep_dive: "Explore a topic in depth with full technical detail",
  practice: "Work through exercises with guided feedback",
  socratic: "Be guided to discover answers through questions",
  review: "Revisit and reinforce what you have already learned",
  project: "Apply knowledge to a real-world project scenario",
};

// ---------------------------------------------------------------------------
// Message schemas
// ---------------------------------------------------------------------------

export const messageRoleSchema = z.enum(["user", "assistant"]);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const usageSchema = z.object({
  input_tokens: z.number().nullable().optional(),
  output_tokens: z.number().nullable().optional(),
});

export const messageSchema = z.object({
  id: z.string(),
  conversation_id: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  model: z.string().nullable().optional(),
  usage: usageSchema.nullable().optional(),
  created_at: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

// ---------------------------------------------------------------------------
// Conversation schemas
// ---------------------------------------------------------------------------

export const tutorModeSchema = z.enum(tutorModes);

export const conversationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  title: z.string(),
  mode: tutorModeSchema,
  course_id: z.string().nullable().optional(),
  lesson_id: z.string().nullable().optional(),
  message_count: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Conversation = z.infer<typeof conversationSchema>;

export const conversationDetailSchema = conversationSchema.extend({
  messages: z.array(messageSchema),
});

export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

// ---------------------------------------------------------------------------
// API envelope schemas
// ---------------------------------------------------------------------------

export const conversationEnvelopeSchema = z.object({
  conversation: conversationSchema,
});

export const conversationDetailEnvelopeSchema = z.object({
  conversation: conversationDetailSchema,
});

export const conversationsEnvelopeSchema = z.object({
  conversations: z.array(conversationSchema),
});

export const messageEnvelopeSchema = z.object({
  message: messageSchema,
});

// ---------------------------------------------------------------------------
// Request payload types
// ---------------------------------------------------------------------------

export type CreateConversationRequest = {
  title?: string;
  mode: TutorMode;
  course_id?: string;
  lesson_id?: string;
};

export type UpdateConversationRequest = {
  title?: string;
  mode?: TutorMode;
};

export type SendMessageRequest = {
  content: string;
  course_id?: string;
  lesson_id?: string;
};
