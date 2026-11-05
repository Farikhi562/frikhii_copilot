import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Spinner } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Layout";
import { Breadcrumb } from "../../components/ui/Nav";
import { isApiError, messageForApiError } from "../../features/course/api/course";
import { useGenerateCourse, useLearningGoal } from "../../features/course/hooks/useCourse";
import { GoalStatusBadge, QueryFailure } from "../../features/course/components/CourseBits";

export default function Generating() {
  const { goalId } = useParams<{ goalId: string }>();
  const navigate = useNavigate();
  const goalQuery = useLearningGoal(goalId);
  const generate = useGenerateCourse(goalId ?? "");
  const started = useRef(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const goal = goalQuery.data;

  function startGeneration() {
    if (started.current || generate.isPending) return;
    started.current = true;
    setLocalError(null);
    generate.mutate("", {
      onSuccess: (course) => {
        navigate(`/app/courses/${course.id}/review`, { replace: true });
      },
      onError: (error) => {
        if (!isApiError(error) || error.code !== "generation_in_progress") {
          setLocalError(messageForApiError(error));
        } else {
          // Another request owns the generation lock. Pick up its status (and
          // let the query's polling continue) instead of showing a false error.
          void goalQuery.refetch();
        }
      },
    });
  }

  useEffect(() => {
    if (!goal) return;
    if (goal.course_id && (goal.status === "course_draft" || goal.status === "approved")) {
      const path =
        goal.status === "approved"
          ? `/app/courses/${goal.course_id}`
          : `/app/courses/${goal.course_id}/review`;
      navigate(path, { replace: true });
      return;
    }
    if (goal.status === "diagnostic_evaluated") {
      startGeneration();
    }
    // startGeneration is intentionally guarded by a ref; the mutation object is
    // not a stable dependency for this one-shot trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal?.status, goal?.course_id, navigate]);

  if (goalQuery.isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center" aria-busy="true">
        <Spinner />
      </div>
    );
  }
  if (goalQuery.error) {
    return (
      <QueryFailure
        title="Could not check the generation"
        message={messageForApiError(goalQuery.error)}
        onRetry={() => void goalQuery.refetch()}
      />
    );
  }
  if (!goal) {
    return <QueryFailure title="Learning goal not found" message="This goal does not exist or is not yours." />;
  }

  const failed = goal.status === "failed" || Boolean(localError && !generate.isPending);
  const waiting = goal.status === "generating" || generate.isPending;

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Courses", to: "/app/courses" },
          { label: goal.title, to: `/app/goals/${goal.id}/result` },
          { label: "Generating curriculum" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">AI Course Architect</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Drafting your curriculum.</h1>
          <p className="mt-2 max-w-2xl text-ink/65">
            The architect is turning your goal and diagnostic into modules, classes and lessons.
            Nothing is enrolled yet; you will review the draft first.
          </p>
        </div>
        <GoalStatusBadge status={goal.status} />
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          {waiting ? <Spinner /> : null}
          <div>
            <p className="font-medium">
              {waiting ? "Generation is running" : failed ? "Generation stopped" : "Preparing generation"}
            </p>
            <p className="text-sm text-ink/65">
              {waiting
                ? "You can leave this page and come back; the server keeps working and the draft will be waiting."
                : "Review the error below and retry."}
            </p>
          </div>
        </div>

        <ol className="grid gap-2 text-sm sm:grid-cols-3">
          {[
            "Read the goal and diagnostic",
            "Design modules, classes and lessons",
            "Validate structure and references",
          ].map((label, index) => (
            <li key={label} className="rounded-xl border border-ink/10 bg-white/50 p-3">
              <span className="font-mono text-xs text-ink/45">0{index + 1}</span>
              <p className="mt-1">{label}</p>
            </li>
          ))}
        </ol>

        {(goal.last_error || localError) && (
          <Alert variant="error" title="The curriculum could not be generated">
            {localError ?? goal.last_error}
          </Alert>
        )}

        {failed && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              loading={generate.isPending}
              onClick={() => {
                started.current = false;
                startGeneration();
              }}
            >
              Retry generation
            </Button>
            <Link
              to={`/app/goals/${goal.id}/result`}
              className="rounded-full border border-ink/25 px-5 py-2.5 font-medium"
            >
              Back to the result
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
