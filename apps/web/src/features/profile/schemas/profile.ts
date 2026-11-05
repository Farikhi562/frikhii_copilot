import { z } from "zod";
import { SUPPORTED_LANGUAGES, SUPPORTED_THEMES } from "../api/profile";

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(120, "Keep your name under 120 characters."),
});

export const learningPreferencesSchema = z.object({
  learningLanguage: z.enum(SUPPORTED_LANGUAGES, {
    message: "Choose a supported learning language.",
  }),
});

export const appearanceSchema = z.object({
  preferredTheme: z.enum(SUPPORTED_THEMES, {
    message: "Choose a supported theme.",
  }),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type LearningPreferencesInput = z.infer<typeof learningPreferencesSchema>;
export type AppearanceInput = z.infer<typeof appearanceSchema>;
