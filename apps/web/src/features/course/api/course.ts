import type { z } from "zod";
import { requireSupabase } from "../../../lib/supabase";
import {
  courseEnvelopeSchema,
  coursesEnvelopeSchema,
  diagnosticEnvelopeSchema,
  learningGoalEnvelopeSchema,
  learningGoalsEnvelopeSchema,
  type CourseDetail,
  type DiagnosticAttempt,
  type LearningGoal,
} from "../schemas/course";
import type { CreateLearningGoalRequest } from "../schemas/intake";

const rawBaseURL = import.meta.env.VITE_CORE_API_URL?.trim();
export const coreAPIBaseURL = (rawBaseURL || "http://localhost:8080").replace(/\/+$/, "");
export const coreAPIConfigError =
  !rawBaseURL && import.meta.env.PROD
    ? "The Core API URL is not configured. Set VITE_CORE_API_URL before building the app."
    : null;

type ErrorDetails = { errors?: string[]; [key: string]: unknown };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetails;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    options?: { details?: ErrorDetails; requestId?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.requestId = options?.requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function messageForApiError(error: unknown): string {
  if (isApiError(error)) {
    if (error.details?.errors?.length) return error.details.errors.join(" ");
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

async function accessToken(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw new ApiError(401, "session_error", "Your session could not be read. Sign in again.");
  if (!data.session?.access_token) {
    throw new ApiError(401, "unauthorized", "Sign in again to continue.");
  }
  return data.session.access_token;
}

function requestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  if (coreAPIConfigError) {
    throw new ApiError(503, "api_not_configured", coreAPIConfigError);
  }
  const token = await accessToken();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  const requestID = requestId();
  try {
    const response = await fetch(coreAPIBaseURL + path, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        "X-Request-ID": requestID,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new ApiError(
          response.status,
          "invalid_response",
          "The server returned a response the app could not read.",
          { requestId: response.headers.get("X-Request-ID") ?? requestID },
        );
      }
    }
    if (!response.ok) {
      const envelope = payload as
        | { error?: { code?: string; message?: string; details?: ErrorDetails } }
        | undefined;
      throw new ApiError(
        response.status,
        envelope?.error?.code ?? "request_failed",
        envelope?.error?.message ?? "The request failed.",
        {
          details: envelope?.error?.details,
          requestId: response.headers.get("X-Request-ID") ?? requestID,
        },
      );
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        response.status,
        "invalid_response",
        "The server returned an unexpected response shape.",
        { requestId: response.headers.get("X-Request-ID") ?? requestID },
      );
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "timeout", "The request took too long. You can retry.", {
        requestId: requestID,
      });
    }
    throw new ApiError(0, "network_error", "Could not reach the Core API. Check that it is running.", {
      requestId: requestID,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function createLearningGoal(input: CreateLearningGoalRequest): Promise<LearningGoal> {
  const response = await apiRequest("/api/v1/learning-goals", learningGoalEnvelopeSchema, {
    method: "POST",
    body: input,
  });
  return response.learning_goal;
}

export async function listLearningGoals(): Promise<LearningGoal[]> {
  const response = await apiRequest("/api/v1/learning-goals", learningGoalsEnvelopeSchema);
  return response.learning_goals;
}

export async function getLearningGoal(goalID: string): Promise<LearningGoal> {
  const response = await apiRequest(
    `/api/v1/learning-goals/${encodeURIComponent(goalID)}`,
    learningGoalEnvelopeSchema,
  );
  return response.learning_goal;
}

export async function generateDiagnostic(goalID: string): Promise<DiagnosticAttempt> {
  const response = await apiRequest(
    `/api/v1/learning-goals/${encodeURIComponent(goalID)}/diagnostic`,
    diagnosticEnvelopeSchema,
    { method: "POST", timeoutMs: 150_000 },
  );
  return response.diagnostic;
}

export async function getLatestDiagnostic(goalID: string): Promise<DiagnosticAttempt | null> {
  try {
    const response = await apiRequest(
      `/api/v1/learning-goals/${encodeURIComponent(goalID)}/diagnostic`,
      diagnosticEnvelopeSchema,
    );
    return response.diagnostic;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function submitDiagnostic(
  goalID: string,
  attemptID: string,
  answers: { question_id: string; response: string }[],
): Promise<DiagnosticAttempt> {
  const response = await apiRequest(
    `/api/v1/learning-goals/${encodeURIComponent(goalID)}/diagnostic/submit`,
    diagnosticEnvelopeSchema,
    {
      method: "POST",
      body: { attempt_id: attemptID, answers },
      timeoutMs: 150_000,
    },
  );
  return response.diagnostic;
}

export async function generateCourse(
  goalID: string,
  learnerCorrections = "",
): Promise<CourseDetail> {
  const response = await apiRequest(
    `/api/v1/learning-goals/${encodeURIComponent(goalID)}/generate`,
    courseEnvelopeSchema,
    {
      method: "POST",
      body: { learner_corrections: learnerCorrections },
      timeoutMs: 260_000,
    },
  );
  return response.course;
}

export async function listCourses(): Promise<CourseDetailSummary[]> {
  const response = await apiRequest("/api/v1/courses", coursesEnvelopeSchema);
  return response.courses;
}

export type CourseDetailSummary = z.infer<typeof coursesEnvelopeSchema>["courses"][number];

export async function getCourse(courseID: string): Promise<CourseDetail> {
  const response = await apiRequest(
    `/api/v1/courses/${encodeURIComponent(courseID)}`,
    courseEnvelopeSchema,
  );
  return response.course;
}

export type DraftPatch = {
  version_id: string;
  title?: string;
  short_description?: string;
  description?: string;
  modules?: { id: string; title?: string; description?: string }[];
  classes?: { id: string; title?: string; description?: string }[];
};

export async function updateDraft(courseID: string, patch: DraftPatch): Promise<CourseDetail> {
  const response = await apiRequest(
    `/api/v1/courses/${encodeURIComponent(courseID)}/draft`,
    courseEnvelopeSchema,
    { method: "PATCH", body: patch },
  );
  return response.course;
}

export async function regenerateCourse(
  courseID: string,
  instructions: string,
): Promise<CourseDetail> {
  const response = await apiRequest(
    `/api/v1/courses/${encodeURIComponent(courseID)}/regenerate`,
    courseEnvelopeSchema,
    {
      method: "POST",
      body: { instructions },
      timeoutMs: 260_000,
    },
  );
  return response.course;
}

export async function approveCourse(courseID: string, versionID: string): Promise<CourseDetail> {
  const response = await apiRequest(
    `/api/v1/courses/${encodeURIComponent(courseID)}/approve`,
    courseEnvelopeSchema,
    { method: "POST", body: { version_id: versionID } },
  );
  return response.course;
}
