import { z } from "zod";
import {
  apiRequest,
  isApiError,
} from "../../course/api/course";
import {
  conversationDetailEnvelopeSchema,
  conversationEnvelopeSchema,
  conversationsEnvelopeSchema,
  messageEnvelopeSchema,
  type Conversation,
  type ConversationDetail,
  type CreateConversationRequest,
  type Message,
  type SendMessageRequest,
  type UpdateConversationRequest,
} from "../schemas/conversation";

// ---------------------------------------------------------------------------
// Conversations CRUD
// ---------------------------------------------------------------------------

export async function createConversation(
  input: CreateConversationRequest,
): Promise<Conversation> {
  const response = await apiRequest("/api/v1/conversations", conversationEnvelopeSchema, {
    method: "POST",
    body: input,
  });
  return response.conversation;
}

export async function listConversations(): Promise<Conversation[]> {
  const response = await apiRequest("/api/v1/conversations", conversationsEnvelopeSchema);
  return response.conversations;
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const response = await apiRequest(
    `/api/v1/conversations/${encodeURIComponent(id)}`,
    conversationDetailEnvelopeSchema,
  );
  return response.conversation;
}

export async function updateConversation(
  id: string,
  patch: UpdateConversationRequest,
): Promise<Conversation> {
  const response = await apiRequest(
    `/api/v1/conversations/${encodeURIComponent(id)}`,
    conversationEnvelopeSchema,
    { method: "PATCH", body: patch },
  );
  return response.conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  await apiRequest(
    `/api/v1/conversations/${encodeURIComponent(id)}`,
    z.object({}).passthrough(),
    { method: "DELETE" },
  );
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function sendMessage(
  conversationId: string,
  input: SendMessageRequest,
): Promise<Message> {
  const response = await apiRequest(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
    messageEnvelopeSchema,
    {
      method: "POST",
      body: input,
      timeoutMs: 120_000, // AI response may take time
    },
  );
  return response.message;
}

// ---------------------------------------------------------------------------
// Progress API
// ---------------------------------------------------------------------------

export const progressSchema = z.object({
  courses: z.array(
    z.object({
      course_id: z.string(),
      title: z.string(),
      status: z.string(),
      completed_lessons: z.number(),
      total_lessons: z.number(),
    }),
  ),
  total_completed: z.number(),
  total_lessons: z.number(),
});

export type ProgressData = z.infer<typeof progressSchema>;

export const progressEnvelopeSchema = z.object({
  progress: progressSchema,
});

export async function getProgress(): Promise<ProgressData> {
  const response = await apiRequest("/api/v1/progress", progressEnvelopeSchema);
  return response.progress;
}

export async function completeLesson(
  courseId: string,
  lessonId: string,
): Promise<void> {
  await apiRequest(
    `/api/v1/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/complete`,
    z.object({}).passthrough(),
    { method: "POST" },
  );
}

// Re-export for convenience
export { isApiError };
