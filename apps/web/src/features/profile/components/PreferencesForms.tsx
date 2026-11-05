import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/ui/Feedback";
import { Select } from "../../../components/ui/Form";
import { Card } from "../../../components/ui/Layout";
import { toast } from "../../../components/ui/Toast";
import { errorMessage } from "../../../lib/errors";
import {
  SUPPORTED_LANGUAGES,
  SUPPORTED_THEMES,
  type SupportedLanguage,
  type SupportedTheme,
  type UserPreferences,
} from "../api/profile";
import { useUpdatePreferences } from "../hooks/useProfile";
import {
  appearanceSchema,
  learningPreferencesSchema,
  type AppearanceInput,
  type LearningPreferencesInput,
} from "../schemas/profile";

const languageOptions = [
  { value: "id-ID", label: "Bahasa Indonesia" },
  { value: "en-US", label: "English" },
];

const themeOptions = [
  { value: "system", label: "System (light for now)" },
  { value: "light", label: "Light" },
];

function asLanguage(value: string): SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
    ? (value as SupportedLanguage)
    : "id-ID";
}

function asTheme(value: string): SupportedTheme {
  return (SUPPORTED_THEMES as readonly string[]).includes(value)
    ? (value as SupportedTheme)
    : "system";
}

export function LearningPreferencesForm({
  preferences,
  userId,
}: {
  preferences: UserPreferences;
  userId: string;
}) {
  const mutation = useUpdatePreferences(userId);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<LearningPreferencesInput>({
    resolver: zodResolver(learningPreferencesSchema),
    defaultValues: { learningLanguage: asLanguage(preferences.learning_language) },
  });

  useEffect(() => {
    reset({ learningLanguage: asLanguage(preferences.learning_language) });
  }, [preferences.learning_language, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    setError(null);
    try {
      await mutation.mutateAsync({ learning_language: values.learningLanguage });
      setSaved(true);
      toast("Learning language saved.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  });

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="font-semibold">Learning preferences</h2>
        <p className="mt-1 text-sm text-ink/65">
          Used later to pick the language for generated lessons and the tutor.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {saved && (
          <Alert variant="success" title="Preferences saved">
            New lessons will use this language.
          </Alert>
        )}
        {error && (
          <Alert variant="error" title="Could not save preferences">
            {error}
          </Alert>
        )}

        <Select
          label="Learning language"
          options={languageOptions}
          error={errors.learningLanguage?.message}
          {...register("learningLanguage")}
        />

        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          {isSubmitting ? "Saving…" : "Save preferences"}
        </Button>
      </form>
    </Card>
  );
}

export function AppearanceForm({
  preferences,
  userId,
}: {
  preferences: UserPreferences;
  userId: string;
}) {
  const mutation = useUpdatePreferences(userId);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AppearanceInput>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: { preferredTheme: asTheme(preferences.preferred_theme) },
  });

  useEffect(() => {
    reset({ preferredTheme: asTheme(preferences.preferred_theme) });
  }, [preferences.preferred_theme, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    setError(null);
    try {
      await mutation.mutateAsync({ preferred_theme: values.preferredTheme });
      setSaved(true);
      toast("Appearance preference saved.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  });

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-ink/65">
          A dark theme is not implemented yet, so every option currently renders the light theme.
          Your choice is stored for when themes arrive.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {saved && (
          <Alert variant="success" title="Appearance saved">
            Your theme preference has been stored.
          </Alert>
        )}
        {error && (
          <Alert variant="error" title="Could not save appearance">
            {error}
          </Alert>
        )}

        <Select
          label="Theme"
          options={themeOptions}
          error={errors.preferredTheme?.message}
          {...register("preferredTheme")}
        />

        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          {isSubmitting ? "Saving…" : "Save appearance"}
        </Button>
      </form>
    </Card>
  );
}
