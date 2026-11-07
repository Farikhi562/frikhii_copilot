import { useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Alert } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Field } from "../../components/ui/Field";
import { Select, Textarea } from "../../components/ui/Form";
import { Card } from "../../components/ui/Layout";
import { messageForApiError } from "../../features/course/api/course";
import { useCreateGoal } from "../../features/course/hooks/useCourse";
import {
  intakeDefaults,
  intakeFormSchema,
  intakeSteps,
  learningFormats,
  knowledgeConfidenceLevels,
  toCreateGoalRequest,
  type IntakeForm,
} from "../../features/course/schemas/intake";
const levelOptions = [
  { value: "unsure", label: "I am not sure yet" },
  { value: "beginner", label: "Beginner — new to the topic" },
  { value: "basic", label: "Basic — I know some pieces" },
  { value: "intermediate", label: "Intermediate — I can build small things" },
  { value: "advanced", label: "Advanced — I want depth and polish" },
];

const languageOptions = [
  { value: "en-US", label: "English" },
  { value: "id-ID", label: "Bahasa Indonesia" },
];

const formatLabels: Record<(typeof learningFormats)[number], string> = {
  explanations: "Clear explanations",
  examples: "Worked examples",
  practice: "Guided practice",
  projects: "Projects",
};

const confidenceLabels: Record<(typeof knowledgeConfidenceLevels)[number], string> = {
  none: "Starting from scratch",
  some: "I have some foundation",
  comfortable: "I am comfortable with the basics",
};

export default function NewCourse() {
  const navigate = useNavigate();
  const createGoal = useCreateGoal();
  const [step, setStep] = useState(0);
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<IntakeForm>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: intakeDefaults,
    mode: "onTouched",
  });

  // getValues() does not subscribe to every keystroke. The review step is
  // rendered after a step change, so it always reads the current values.
  const values = getValues();
  const current = intakeSteps[step];
  const fields = current.fields as unknown as FieldPath<IntakeForm>[];

  async function next() {
    if (fields.length > 0 && !(await trigger(fields))) return;
    setStep((value) => Math.min(value + 1, intakeSteps.length - 1));
  }

  function back() {
    setStep((value) => Math.max(value - 1, 0));
  }

  const onSubmit = handleSubmit(async (formValues) => {
    try {
      const goal = await createGoal.mutateAsync(toCreateGoalRequest(formValues));
      navigate(`/app/goals/${goal.id}/diagnostic`);
    } catch {
      // The mutation's error is rendered below the form.
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">AI Course Architect</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">What do you want to master?</h1>
        <p className="mt-3 max-w-2xl text-ink/65">
          Start with an ambition. FRIKHII Copilot will help turn it into a structured learning
          journey: a short diagnostic checks your starting point, then the architect drafts a
          curriculum you review before anything is enrolled.
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Intake progress">
        {intakeSteps.map((item, index) => (
          <li
            key={item.title}
            aria-current={index === step ? "step" : undefined}
            className={`rounded-xl border p-3 ${
              index === step
                ? "border-ink bg-ink text-paper"
                : index < step
                  ? "border-lime bg-lime/20"
                  : "border-ink/15 bg-white/40 text-ink/60"
            }`}
          >
            <p className="font-mono text-xs opacity-70">Step {index + 1}</p>
            <p className="mt-1 text-sm font-medium">{item.title}</p>
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{current.title}</h2>
            <p className="mt-1 text-sm text-ink/65">{current.description}</p>
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <Field
                label="Course title"
                placeholder="e.g. Build production Go services"
                error={errors.title?.message}
                {...register("title")}
              />
              <Textarea
                label="What is the goal?"
                placeholder="Describe what you want to be able to do. Be specific about the real-world result."
                error={errors.goal_statement?.message}
                rows={4}
                {...register("goal_statement")}
              />
              <Textarea
                label="What will success look like?"
                placeholder="e.g. I can design, build, test and deploy a small API on my own."
                error={errors.intended_outcome?.message}
                rows={3}
                {...register("intended_outcome")}
              />
              <Textarea
                label="Why now?"
                placeholder="e.g. I am moving into a backend role next quarter."
                error={errors.motivation?.message}
                rows={2}
                {...register("motivation")}
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Select
                label="How would you describe your current level?"
                options={levelOptions}
                error={errors.self_reported_level?.message}
                {...register("self_reported_level")}
              />
              <Textarea
                label="Relevant experience"
                placeholder="Courses, projects, jobs, or anything you have already tried. It is fine to have none."
                error={errors.prior_experience?.message}
                rows={3}
                {...register("prior_experience")}
              />
              <Textarea
                label="Topics you already know"
                placeholder="Comma-separated, e.g. variables, functions, basic SQL"
                error={errors.known_topics?.message}
                rows={2}
                {...register("known_topics")}
              />
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">How confident do you feel?</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {knowledgeConfidenceLevels.map((level) => (
                    <label
                      key={level}
                      className="flex cursor-pointer items-start gap-2 rounded-xl border border-ink/20 bg-white/50 p-3 text-sm"
                    >
                      <input
                        type="radio"
                        value={level}
                        className="mt-1"
                        {...register("confidence")}
                      />
                      <span>{confidenceLabels[level]}</span>
                    </label>
                  ))}
                </div>
                {errors.confidence && (
                  <p className="text-sm text-red-700">{errors.confidence.message}</p>
                )}
              </fieldset>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field
                label="Weekly study time (minutes)"
                type="number"
                min={30}
                max={10080}
                step={15}
                error={errors.weekly_study_minutes?.message}
                {...register("weekly_study_minutes", { valueAsNumber: true })}
              />
              <Select
                label="Learning language"
                options={languageOptions}
                error={errors.learning_language?.message}
                {...register("learning_language")}
              />
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Preferred formats</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {learningFormats.map((format) => (
                    <label
                      key={format}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink/20 bg-white/50 p-3 text-sm"
                    >
                      <input type="checkbox" value={format} {...register("formats")} />
                      <span>{formatLabels[format]}</span>
                    </label>
                  ))}
                </div>
                {errors.formats && <p className="text-sm text-red-700">{errors.formats.message}</p>}
              </fieldset>
              <Textarea
                label="Learning preferences"
                placeholder="Anything that helps you learn: short sessions, more practice, no videos, etc."
                error={errors.notes?.message}
                rows={2}
                {...register("notes")}
              />
              <Textarea
                label="Constraints or extra context"
                placeholder="Equipment, accessibility needs, topics to avoid, or a deadline."
                error={errors.additional_context?.message}
                rows={3}
                {...register("additional_context")}
              />
              <Field
                label="Target date (optional)"
                type="date"
                error={errors.target_date?.message}
                {...register("target_date")}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Alert title="Ready to start the diagnostic">
                The diagnostic is short and untimed. Its answer key is never sent to your browser.
                You will see an evaluated starting point before the curriculum is generated.
              </Alert>
              <dl className="grid gap-3 sm:grid-cols-2">
                <ReviewItem label="Title" value={values.title} />
                <ReviewItem label="Weekly time" value={`${values.weekly_study_minutes || 0} minutes`} />
                <ReviewItem label="Goal" value={values.goal_statement} />
                <ReviewItem label="Success" value={values.intended_outcome} />
                <ReviewItem label="Why now" value={values.motivation} />
                <ReviewItem label="Level" value={levelOptions.find((o) => o.value === values.self_reported_level)?.label ?? values.self_reported_level} />
                <ReviewItem label="Experience" value={values.prior_experience || "Not provided"} />
                <ReviewItem label="Known topics" value={values.known_topics || "Not provided"} />
                <ReviewItem label="Formats" value={values.formats.map((f) => formatLabels[f]).join(", ") || "Not provided"} />
                <ReviewItem label="Language" value={values.learning_language} />
                <ReviewItem label="Target date" value={values.target_date || "No deadline"} />
                <ReviewItem label="Context" value={values.additional_context || "Not provided"} />
              </dl>
            </div>
          )}

          {createGoal.error && (
            <Alert variant="error" title="Could not create the learning goal">
              {messageForApiError(createGoal.error)}
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
            <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || isSubmitting}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {step < intakeSteps.length - 1 ? (
              <Button type="button" onClick={() => void next()} disabled={isSubmitting}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" variant="accent" loading={isSubmitting || createGoal.isPending}>
                <Sparkles className="h-4 w-4" /> Create goal and start diagnostic
              </Button>
            )}
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="space-y-3">
            <h3 className="font-medium">What happens next</h3>
            <ol className="space-y-3 text-sm text-ink/70">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" /> A short diagnostic checks your starting point.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" /> You see the evaluated gaps, not a hidden score.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" /> The architect drafts modules, classes and lessons.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-blue" /> You review, edit, regenerate, and approve it.</li>
            </ol>
          </Card>
          <Card>
            <p className="text-sm text-ink/65">
              Nothing is enrolled until you approve the curriculum. Regeneration keeps the previous
              approved version intact.
            </p>
          </Card>
        </aside>
      </form>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white/40 p-3">
      <dt className="text-xs uppercase tracking-wide text-ink/50">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm">{value || "Not provided"}</dd>
    </div>
  );
}
