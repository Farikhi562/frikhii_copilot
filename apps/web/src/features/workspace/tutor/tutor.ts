import { z } from "zod";
import { Brain, Compass, Dumbbell, HelpCircle, Lightbulb, RotateCcw, type LucideIcon } from "lucide-react";
import { apiRequest, isApiError } from "../../course/api/course";

export type TutorModeId = "explain" | "deep-dive" | "practice" | "socratic" | "review" | "project";

export type TutorMode = { id: TutorModeId; name: string; summary: string; icon: LucideIcon };

export const tutorModes: TutorMode[] = [
  { id: "explain", name: "Explain", summary: "Clear explanations matched to your level.", icon: Lightbulb },
  { id: "deep-dive", name: "Deep Dive", summary: "Go further into the reasoning behind an idea.", icon: Brain },
  { id: "practice", name: "Practice", summary: "Focused exercises on what you are learning.", icon: Dumbbell },
  { id: "socratic", name: "Socratic", summary: "Guiding questions so you reach the answer yourself.", icon: HelpCircle },
  { id: "review", name: "Review", summary: "Revisit and consolidate earlier material.", icon: RotateCcw },
  { id: "project", name: "Project", summary: "Apply skills to a realistic, goal-relevant project.", icon: Compass },
];

export const suggestedPrompts = [
  "Explain this concept from the beginning.",
  "Give me a practical example.",
  "Test my understanding.",
  "Help me identify what I don't understand.",
  "Guide me through a small project.",
];

export type TutorContext = { courseTitle?: string; className?: string; lessonTitle?: string; isDemo?: boolean };

export type TutorMessage = {
  id: string;
  role: "user" | "tutor" | "system";
  text: string;
  /** "preview" marks scripted content that must never be read as an AI response. */
  kind?: "preview" | "error";
};

export class TutorUnavailableError extends Error {
  constructor() {
    super("The AI Tutor is not connected yet.");
    this.name = "TutorUnavailableError";
  }
}

/**
 * Service boundary for the tutor. Messages go through the Core API conversation
 * endpoints (`POST /conversations` + `POST /conversations/{id}/messages`), which call the
 * AI Engine's chat task. Nothing here ever fabricates a model response: when the API or
 * the engine cannot answer, the error propagates to the UI.
 */
export interface TutorService {
  available: boolean;
  send(input: { mode: TutorModeId; message: string; context: TutorContext }): Promise<{ text: string }>;
}

const conversationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  tutor_mode: z.string(),
});
const conversationsEnvelopeSchema = z.object({ conversations: z.array(conversationSchema) });
const conversationEnvelopeSchema = z.object({ conversation: conversationSchema });
const messageEnvelopeSchema = z.object({
  assistant_message: z.object({ content: z.string().min(1) }),
});

/** One conversation per mode + course, reused across sends and page reloads. */
const conversationCache = new Map<string, string>();

function conversationTitle(mode: TutorModeId, context: TutorContext): string {
  const modeName = tutorModes.find((m) => m.id === mode)?.name ?? mode;
  const course = context.courseTitle?.trim();
  return course ? `${modeName} - ${course}` : `${modeName} tutor`;
}

async function ensureConversation(mode: TutorModeId, context: TutorContext): Promise<string> {
  const title = conversationTitle(mode, context);
  const cacheKey = `${mode}|${title}`;
  const cached = conversationCache.get(cacheKey);
  if (cached) return cached;

  const list = await apiRequest("/api/v1/conversations", conversationsEnvelopeSchema);
  const existing = list.conversations.find((c) => c.tutor_mode === mode && c.title === title);
  const conversation = existing
    ? existing
    : (
        await apiRequest("/api/v1/conversations", conversationEnvelopeSchema, {
          method: "POST",
          body: { title, tutor_mode: mode },
        })
      ).conversation;

  conversationCache.set(cacheKey, conversation.id);
  return conversation.id;
}

export const tutorService: TutorService = {
  available: true,
  async send({ mode, message, context }) {
    try {
      const conversationId = await ensureConversation(mode, context);

      const requestContext: Record<string, string> = {};
      if (context.courseTitle) requestContext.course_title = context.courseTitle;
      if (context.className) requestContext.class_title = context.className;
      if (context.lessonTitle) requestContext.lesson_title = context.lessonTitle;

      const response = await apiRequest(
        `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
        messageEnvelopeSchema,
        {
          method: "POST",
          body: {
            content: message,
            ...(Object.keys(requestContext).length ? { context: requestContext } : {}),
          },
          timeoutMs: 60_000,
        },
      );
      return { text: response.assistant_message.content };
    } catch (error) {
      // No API reachable, not configured, or no such endpoint: the tutor is not connected.
      if (isApiError(error) && (error.status === 0 || error.status === 503 || error.status === 404)) {
        throw new TutorUnavailableError();
      }
      throw error;
    }
  },
};

/** Static example of a Socratic exchange, shown only when the learner asks for a preview. */
export const previewExchange: TutorMessage[] = [
  { id: "preview-1", role: "user", kind: "preview", text: "Why does a fitted line not pass through every point?" },
  {
    id: "preview-2",
    role: "tutor",
    kind: "preview",
    text: "Good question. Before I explain: if real measurements always carry some noise, what would a line that hit every point be doing with that noise?",
  },
];
