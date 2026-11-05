import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, RefreshCw, Save } from "lucide-react";
import { Alert, Badge, Spinner } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";
import { Textarea } from "../../components/ui/Form";
import { Card } from "../../components/ui/Layout";
import { Breadcrumb } from "../../components/ui/Nav";
import { toast } from "../../components/ui/Toast";
import {
  isApiError,
  messageForApiError,
  type DraftPatch,
} from "../../features/course/api/course";
import {
  useApproveCourse,
  useCourse,
  useRegenerateCourse,
  useUpdateDraft,
} from "../../features/course/hooks/useCourse";
import {
  CourseSkeleton,
  CourseStats,
  CourseTimeline,
  ProviderNotice,
  QueryFailure,
  VersionBadge,
} from "../../features/course/components/CourseBits";
import type { CourseVersion } from "../../features/course/schemas/course";

type DraftState = {
  title: string;
  short_description: string;
  description: string;
  modules: {
    id: string;
    title: string;
    description: string;
    classes: { id: string; title: string; description: string }[];
  }[];
};

function fromVersion(version: CourseVersion): DraftState {
  return {
    title: version.title,
    short_description: version.short_description,
    description: version.description,
    modules: version.modules.map((module) => ({
      id: module.id,
      title: module.title,
      description: module.description,
      classes: module.classes.map((klass) => ({
        id: klass.id,
        title: klass.title,
        description: klass.description,
      })),
    })),
  };
}

function validateDraft(draft: DraftState): string[] {
  const problems: string[] = [];
  if (draft.title.trim().length < 3 || draft.title.trim().length > 160) {
    problems.push("The title must be between 3 and 160 characters.");
  }
  if (draft.short_description.trim().length < 10 || draft.short_description.trim().length > 400) {
    problems.push("The short description must be between 10 and 400 characters.");
  }
  if (draft.description.trim().length < 3 || draft.description.trim().length > 4000) {
    problems.push("The description must be between 3 and 4000 characters.");
  }
  for (const module of draft.modules) {
    if (module.title.trim().length < 2 || module.title.trim().length > 200) {
      problems.push("Every module title must be between 2 and 200 characters.");
      break;
    }
  }
  for (const module of draft.modules) {
    for (const klass of module.classes) {
      if (klass.title.trim().length < 2 || klass.title.trim().length > 200) {
        problems.push("Every class title must be between 2 and 200 characters.");
        break;
      }
    }
  }
  return problems;
}

export default function CourseReview() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const courseQuery = useCourse(courseId);
  const course = courseQuery.data;
  const version = course?.version ?? null;
  const goalID = course?.learning_goal_id;
  const updateDraft = useUpdateDraft(courseId ?? "");
  const regenerate = useRegenerateCourse(courseId ?? "", goalID);
  const approve = useApproveCourse(courseId ?? "", goalID);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [initializedVersion, setInitializedVersion] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    if (!version || version.id === initializedVersion) return;
    setDraft(fromVersion(version));
    setInitializedVersion(version.id);
    setFormError(null);
  }, [version, initializedVersion]);

  const baseline = useMemo(() => (version ? fromVersion(version) : null), [version]);
  const dirty = Boolean(draft && baseline && JSON.stringify(draft) !== JSON.stringify(baseline));

  if (courseQuery.isLoading) {
    return <CourseSkeleton />;
  }
  if (courseQuery.error) {
    return (
      <QueryFailure
        title="Could not load the draft"
        message={messageForApiError(courseQuery.error)}
        onRetry={() => void courseQuery.refetch()}
      />
    );
  }
  if (!course || !version || !draft) {
    return <QueryFailure title="Draft not found" message="This course has no curriculum to review." />;
  }

  async function createNewDraft() {
    setRegenerateError(null);
    if (instructions.trim().length < 10) {
      setRegenerateError("Describe what should change in at least 10 characters.");
      return;
    }
    try {
      await regenerate.mutateAsync(instructions.trim());
      setInstructions("");
      toast("A new draft was generated. Your approved curriculum is still live.");
    } catch (error) {
      setRegenerateError(messageForApiError(error));
    }
  }

  if (version.status !== "draft") {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Courses", to: "/app/courses" },
            { label: version.title },
            { label: "Review" },
          ]}
        />
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <VersionBadge version={version} />
            <Badge tone={course.status === "approved" ? "lime" : "neutral"}>{course.status}</Badge>
          </div>
          <h1 className="text-2xl font-semibold">This curriculum is approved.</h1>
          <p className="text-ink/65">
            There is no draft under review. You can read the enrolled curriculum, or ask the
            architect for a new draft. A new draft does not replace this version until you approve
            it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/app/courses/${course.id}`}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper"
            >
              Open the course <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Create a new draft</h2>
          <Textarea
            label="What should change?"
            rows={3}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="e.g. Make the second half more project-based and add a testing module."
            maxLength={2000}
          />
          {regenerateError && (
            <Alert variant="error" title="Could not create a draft">{regenerateError}</Alert>
          )}
          <Button onClick={() => void createNewDraft()} loading={regenerate.isPending} variant="accent">
            <RefreshCw className="h-4 w-4" /> Generate a new draft
          </Button>
        </Card>
      </div>
    );
  }

  async function saveChanges() {
    if (!draft || !version) return;
    const problems = validateDraft(draft);
    if (problems.length > 0) {
      setFormError(problems.join(" "));
      return;
    }
    setFormError(null);
    const patch: DraftPatch = {
      version_id: version.id,
      title: draft.title,
      short_description: draft.short_description,
      description: draft.description,
      modules: draft.modules.map((module) => ({
        id: module.id,
        title: module.title,
        description: module.description,
      })),
      classes: draft.modules.flatMap((module) =>
        module.classes.map((klass) => ({
          id: klass.id,
          title: klass.title,
          description: klass.description,
        })),
      ),
    };
    try {
      const updated = await updateDraft.mutateAsync(patch);
      if (updated.version) setDraft(fromVersion(updated.version));
      toast("Draft saved.");
    } catch (error) {
      setFormError(messageForApiError(error));
    }
  }

  async function regenerateDraft() {
    setRegenerateError(null);
    if (instructions.trim().length < 10) {
      setRegenerateError("Describe what should change in at least 10 characters.");
      return;
    }
    try {
      await regenerate.mutateAsync(instructions.trim());
      setInstructions("");
      toast("A new draft was generated. The previous approved version is untouched.");
    } catch (error) {
      setRegenerateError(messageForApiError(error));
    }
  }

  async function approveDraft() {
    if (!version) return;
    setApproveError(null);
    try {
      const approved = await approve.mutateAsync(version.id);
      setApproveOpen(false);
      toast("Curriculum approved. You are enrolled.");
      navigate(`/app/courses/${approved.id}`, { replace: true });
    } catch (error) {
      if (isApiError(error) && error.code === "version_not_draft") {
        setApproveError("This draft changed. Reload the page and review the latest version.");
      } else {
        setApproveError(messageForApiError(error));
      }
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Courses", to: "/app/courses" },
          { label: draft.title || "Course", to: `/app/courses/${course.id}` },
          { label: "Review draft" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Curriculum review</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review before you enroll.</h1>
          <p className="mt-2 max-w-2xl text-ink/65">
            Edit the framing, module names, or class descriptions. Regenerate for a different
            approach. Approve only when the plan is right for you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CourseTimeline course={course} />
          {dirty && <Badge tone="warning">Unsaved changes</Badge>}
        </div>
      </div>

      {course.approved_version && (
        <Alert title={`Approved version ${course.approved_version.version_number} is still live`}>
          You are reviewing a newer draft. Your enrolled curriculum does not change until you
          approve this draft.
        </Alert>
      )}

      {version.warnings.length > 0 && (
        <Alert variant="warning" title="Validation warnings">
          {version.warnings.join(" · ")}
        </Alert>
      )}

      <ProviderNotice metadata={version.generation_metadata} />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Course at a glance</h2>
          <span className="text-sm text-ink/60">
            {Math.round(version.estimated_duration_minutes / 60)}h total ·{" "}
            {version.recommended_weekly_study_minutes} min/week · {version.target_learner_level}
          </span>
        </div>
        <CourseStats course={course} />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/50">Methodology</p>
            <p className="mt-1 text-sm text-ink/75">{version.methodology}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-ink/50">Expected outcome</p>
            <p className="mt-1 text-sm text-ink/75">{version.expected_outcome}</p>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-xl font-semibold">Framing</h2>
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Title</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              className="w-full rounded-xl border border-ink/25 bg-white/60 px-4 py-2.5"
              maxLength={160}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Short description</span>
            <textarea
              value={draft.short_description}
              onChange={(event) => setDraft({ ...draft, short_description: event.target.value })}
              rows={2}
              maxLength={400}
              className="w-full rounded-xl border border-ink/25 bg-white/60 px-4 py-2.5"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Description</span>
            <textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              rows={4}
              maxLength={4000}
              className="w-full rounded-xl border border-ink/25 bg-white/60 px-4 py-2.5"
            />
          </label>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Modules and classes</h2>
        {draft.modules.map((module, moduleIndex) => (
          <details
            key={module.id}
            open={moduleIndex === 0}
            className="rounded-2xl border border-ink/15 bg-white/40 p-5"
          >
            <summary className="cursor-pointer text-lg font-medium">
              Module {moduleIndex + 1}: {module.title}
            </summary>
            <div className="mt-4 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Module title</span>
                <input
                  value={module.title}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      modules: draft.modules.map((item) =>
                        item.id === module.id ? { ...item, title: event.target.value } : item,
                      ),
                    })
                  }
                  className="w-full rounded-xl border border-ink/25 bg-white/60 px-4 py-2.5"
                  maxLength={200}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Module description</span>
                <textarea
                  value={module.description}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      modules: draft.modules.map((item) =>
                        item.id === module.id
                          ? { ...item, description: event.target.value }
                          : item,
                      ),
                    })
                  }
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-xl border border-ink/25 bg-white/60 px-4 py-2.5"
                />
              </label>

              <div className="space-y-2">
                {module.classes.map((klass, classIndex) => (
                  <div key={klass.id} className="rounded-xl border border-ink/10 bg-white/60 p-3">
                    <p className="font-mono text-xs text-ink/45">
                      Class {classIndex + 1}
                    </p>
                    <div className="mt-2 space-y-2">
                      <input
                        aria-label={`Class ${classIndex + 1} title`}
                        value={klass.title}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            modules: draft.modules.map((item) =>
                              item.id === module.id
                                ? {
                                    ...item,
                                    classes: item.classes.map((candidate) =>
                                      candidate.id === klass.id
                                        ? { ...candidate, title: event.target.value }
                                        : candidate,
                                    ),
                                  }
                                : item,
                            ),
                          })
                        }
                        className="w-full rounded-xl border border-ink/25 bg-white/60 px-3 py-2"
                        maxLength={200}
                      />
                      <textarea
                        aria-label={`Class ${classIndex + 1} description`}
                        value={klass.description}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            modules: draft.modules.map((item) =>
                              item.id === module.id
                                ? {
                                    ...item,
                                    classes: item.classes.map((candidate) =>
                                      candidate.id === klass.id
                                        ? { ...candidate, description: event.target.value }
                                        : candidate,
                                    ),
                                  }
                                : item,
                            ),
                          })
                        }
                        rows={2}
                        maxLength={2000}
                        className="w-full rounded-xl border border-ink/25 bg-white/60 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        ))}
      </section>

      {formError && <Alert variant="error" title="Could not save the draft">{formError}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/15 bg-white/50 p-4">
        <p className="text-sm text-ink/60">
          {dirty ? "Save your edits before approving." : "All edits are saved."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => setDraft(fromVersion(version))}
            disabled={!dirty || updateDraft.isPending}
          >
            Discard changes
          </Button>
          <Button onClick={() => void saveChanges()} loading={updateDraft.isPending} disabled={!dirty}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        </div>
      </div>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Not quite right? Regenerate.</h2>
          <p className="mt-1 text-sm text-ink/65">
            Describe what should change. The architect creates a new draft; the previous approved
            version stays live and untouched.
          </p>
        </div>
        <Textarea
          label="What should change?"
          rows={3}
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="e.g. Add more hands-on exercises and reduce the theory. Keep the final project."
          maxLength={2000}
        />
        {regenerateError && (
          <Alert variant="error" title="Could not regenerate">{regenerateError}</Alert>
        )}
        <Button onClick={() => void regenerateDraft()} loading={regenerate.isPending} variant="ghost">
          <RefreshCw className="h-4 w-4" /> {regenerate.isPending ? "Regenerating…" : "Regenerate draft"}
        </Button>
        {regenerate.isPending && (
          <p className="text-sm text-ink/60">
            This can take up to a couple of minutes. You can leave this page; the server continues.
          </p>
        )}
      </Card>

      <Card className="space-y-4 border-lime bg-lime/10">
        <div>
          <h2 className="text-xl font-semibold">Approve this curriculum</h2>
          <p className="mt-1 text-sm text-ink/65">
            Approval enrolls you and makes version {version.version_number} the live curriculum.
          </p>
        </div>
        {approveError && <Alert variant="error" title="Could not approve">{approveError}</Alert>}
        <Button
          variant="accent"
          onClick={() => setApproveOpen(true)}
          disabled={dirty || approve.isPending}
        >
          <CheckCircle2 className="h-4 w-4" /> Approve and enroll
        </Button>
      </Card>

      <Dialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve this curriculum?"
        description="This becomes your enrolled curriculum. You can still create a newer draft later without losing this version."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setApproveOpen(false)} disabled={approve.isPending}>
            Cancel
          </Button>
          <Button variant="accent" onClick={() => void approveDraft()} loading={approve.isPending}>
            Approve version {version.version_number}
          </Button>
        </div>
      </Dialog>

      {approve.isPending && (
        <div className="grid place-items-center p-4">
          <Spinner />
        </div>
      )}
    </div>
  );
}
