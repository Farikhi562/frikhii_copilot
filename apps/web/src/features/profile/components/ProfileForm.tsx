import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { User } from "@supabase/supabase-js";
import { Button } from "../../../components/ui/Button";
import { Alert } from "../../../components/ui/Feedback";
import { Field } from "../../../components/ui/Field";
import { Avatar } from "../../../components/ui/Form";
import { Card } from "../../../components/ui/Layout";
import { toast } from "../../../components/ui/Toast";
import { errorMessage } from "../../../lib/errors";
import type { Profile } from "../api/profile";
import { useUpdateProfileName } from "../hooks/useProfile";
import { profileSchema, type ProfileInput } from "../schemas/profile";

export function ProfileForm({ profile, user }: { profile: Profile; user: User }) {
  const mutation = useUpdateProfileName(user);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: profile.full_name ?? "" },
  });

  useEffect(() => {
    reset({ fullName: profile.full_name ?? "" });
  }, [profile.full_name, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false);
    setError(null);
    try {
      await mutation.mutateAsync(values.fullName);
      setSaved(true);
      toast("Profile updated.");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  });

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-ink/65">How you appear inside FRIKHII.</p>
      </div>

      <div className="flex items-center gap-4">
        <Avatar name={profile.full_name ?? user.email ?? "Learner"} size={56} />
        <div>
          <p className="text-sm font-medium">Avatar</p>
          <p className="text-sm text-ink/55">Initials are used for now. Uploads are planned.</p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {saved && (
          <Alert variant="success" title="Profile saved">
            Your name has been updated.
          </Alert>
        )}
        {error && (
          <Alert variant="error" title="Could not save profile">
            {error}
          </Alert>
        )}

        <Field
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register("fullName")}
        />

        <div className="space-y-1.5">
          <Field label="Email" type="email" value={user.email ?? ""} readOnly disabled />
          <p className="text-xs text-ink/55">
            Email changes are not available yet. It stays private and is only visible to you.
          </p>
        </div>

        <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Card>
  );
}
