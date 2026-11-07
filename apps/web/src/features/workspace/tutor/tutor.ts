import { Brain, Compass, Dumbbell, HelpCircle, Lightbulb, RotateCcw, type LucideIcon } from "lucide-react";

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
 * Service boundary for the tutor. No AI backend exists yet, so `available` is false and
 * `send` rejects. When a real endpoint ships, implement this interface against it and the
 * UI needs no changes. Nothing here ever fabricates a model response.
 */
export interface TutorService {
  available: boolean;
  send(input: { mode: TutorModeId; message: string; context: TutorContext }): Promise<{ text: string }>;
}

export const tutorService: TutorService = {
  available: false,
  send() {
    return Promise.reject(new TutorUnavailableError());
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
