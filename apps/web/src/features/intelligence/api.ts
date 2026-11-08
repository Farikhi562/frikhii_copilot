import { apiRequest } from "../course/api/course";
import {
  generateEnvelope,
  overviewSchema,
  preferencesEnvelope,
  statusEnvelope,
  type Preferences,
} from "./schemas";

export const intelligenceKeys = { overview: ["intelligence", "overview"] as const };

export const getIntelligence = () => apiRequest("/api/v1/intelligence/overview", overviewSchema);

// POST rather than PUT: the Core API's CORS policy allows GET, POST and PATCH.
export const savePreferences = (preferences: Preferences) =>
  apiRequest("/api/v1/intelligence/preferences", preferencesEnvelope, { method: "POST", body: preferences });

export const correctInsight = (id: string, status: "corrected" | "dismissed" | "active", note: string) =>
  apiRequest("/api/v1/intelligence/insights", statusEnvelope, { method: "PATCH", body: { id, status, note } });

export const generateInsights = (courseId: string) =>
  apiRequest("/api/v1/intelligence/insights/generate", generateEnvelope, {
    method: "POST",
    body: { course_id: courseId },
    timeoutMs: 90_000,
  });

export const resetIntelligence = () =>
  apiRequest("/api/v1/intelligence/reset", statusEnvelope, { method: "POST", body: { confirm: "RESET" } });
