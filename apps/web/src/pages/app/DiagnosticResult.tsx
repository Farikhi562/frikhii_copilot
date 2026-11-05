import { Link, useParams } from "react-router-dom";
import { ArrowRight, RefreshCw, Sparkles, Target } from "lucide-react";
import { Alert, Badge, Spinner } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Layout";
import { Breadcrumb } from "../../components/ui/Nav";
import { messageForApiError } from "../../features/course/api/course";
import { useDiagnostic, useLearningGoal } from "../../features/course/hooks/useCourse";
import { GoalStatusBadge, QueryFailure } from "../../features/course/components/CourseBits";

export default function DiagnosticResult() {
  const { goalId } = useParams<{ goalId: string }>();
  const goalQuery = useLearningGoal(goalId);
  const diagnosticQuery = useDiagnostic(goalId);

  if (goalQuery.isLoading || diagnosticQuery.isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center" aria-busy="true">
        <Spinner />
      </div>
    );
  }
  if (goalQuery.error) {
    return (
      <QueryFailure
        title="Could not load the result"
        message={messageForApiError(goalQuery.error)}
        onRetry={() => void goalQuery.refetch()}
      />
    );
  }
  if (diagnosticQuery.error) {
    return (
      <QueryFailure
        title="Could not load the diagnostic"
        message={messageForApiError(diagnosticQuery.error)}
        onRetry={() => void diagnosticQuery.refetch()}
      />
    );
  }

  const goal = goalQuery.data;
  const diagnostic = diagnosticQuery.data ?? null;
  if (!goal) {
    return <QueryFailure title="Learning goal not found" message="This goal does not exist or is not yours." />;
  }
  if (!diagnostic) {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-semibold">No diagnostic yet</h1>
        <p className="text-ink/65">Start with a short diagnostic before the curriculum is generated.</p>
        <Link
          to={`/app/goals/${goal.id}/diagnostic`}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper"
        >
          Start diagnostic <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>
    );
  }
  if (diagnostic.status !== "evaluated") {
    return (
      <Card className="space-y-4">
        <h1 className="text-2xl font-semibold">The evaluation is not ready</h1>
        <p className="text-ink/65">
          The diagnostic is currently <strong>{diagnostic.status.replace(/_/g, " ")}</strong>.
        </p>
        <Link
          to={`/app/goals/${goal.id}/diagnostic`}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper"
        >
          Return to the diagnostic <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>
    );
  }

  const canGenerate = goal.status === "diagnostic_evaluated" || goal.status === "failed";
  const hasCourse = Boolean(goal.course_id);
  const reviewPath = goal.course_id ? `/app/courses/${goal.course_id}/review` : null;
  const coursePath = goal.course_id ? `/app/courses/${goal.course_id}` : null;

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Courses", to: "/app/courses" },
          { label: goal.title },
          { label: "Diagnostic result" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Evaluated starting point</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{goal.title}</h1>
          <p className="mt-2 max-w-2xl text-ink/65">{goal.goal_statement}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GoalStatusBadge status={goal.status} />
          <Badge tone="neutral">Attempt {diagnostic.attempt_number}</Badge>
        </div>
      </div>

      <Card className="space-y-4 bg-ink text-paper">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="lime">{diagnostic.estimated_level ?? "estimated level"}</Badge>
          <span className="font-mono text-xs text-paper/60">
            confidence: {diagnostic.confidence ?? "unknown"}
          </span>
        </div>
        <p className="text-lg text-paper/90">{diagnostic.evaluation_summary}</p>
        {diagnostic.recommended_start && (
          <p className="flex items-center gap-2 text-sm text-paper/70">
            <Target className="h-4 w-4" /> Recommended start: {diagnostic.recommended_start}
          </p>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">Strengths</h2>
          {diagnostic.strengths.length === 0 ? (
            <p className="text-sm text-ink/60">No strengths were identified yet. That is a starting point, not a judgment.</p>
          ) : (
            <ul className="space-y-2">
              {diagnostic.strengths.map((strength) => (
                <li key={`${strength.competency}-${strength.evidence}`} className="rounded-xl border border-ink/10 bg-white/50 p-3">
                  <p className="font-medium">{strength.competency}</p>
                  <p className="text-sm text-ink/65">{strength.evidence}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-xl font-semibold">Knowledge gaps</h2>
          {diagnostic.knowledge_gaps.length === 0 ? (
            <p className="text-sm text-ink/60">No specific gaps were identified. The curriculum will still build from the goal.</p>
          ) : (
            <ul className="space-y-2">
              {diagnostic.knowledge_gaps.map((gap) => (
                <li key={`${gap.competency}-${gap.description}`} className="rounded-xl border border-ink/10 bg-white/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{gap.competency}</p>
                    <Badge tone={gap.severity === "high" ? "danger" : gap.severity === "medium" ? "warning" : "neutral"}>
                      {gap.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink/65">{gap.description}</p>
                  <p className="mt-1 text-sm"><strong>Next:</strong> {gap.recommendation}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {diagnostic.misconceptions.length > 0 && (
        <Alert variant="warning" title="Possible misconceptions">
          {diagnostic.misconceptions.join(" · ")}
        </Alert>
      )}

      {diagnostic.rationale && (
        <Card>
          <h2 className="text-xl font-semibold">Why this evaluation</h2>
          <p className="mt-2 text-sm text-ink/70">{diagnostic.rationale}</p>
        </Card>
      )}

      {diagnostic.question_scores.length > 0 && (
        <details className="rounded-2xl border border-ink/15 bg-white/40 p-5">
          <summary className="cursor-pointer font-medium">Question feedback</summary>
          <ul className="mt-3 space-y-2">
            {diagnostic.question_scores.map((score) => (
              <li key={score.question_id} className="rounded-xl border border-ink/10 bg-white/50 p-3 text-sm">
                <span className="font-mono text-xs text-ink/50">{score.score}/100</span>
                <p className="mt-1 text-ink/70">{score.feedback}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Alert title="This is an AI estimate, not a certification">
        The evaluation is generated from your written answers. It can be wrong, and it is not a
        formal assessment. You can still review and revise the curriculum.
      </Alert>

      <div className="flex flex-wrap gap-3">
        {canGenerate && (
          <Link
            to={`/app/goals/${goal.id}/generating`}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-medium text-ink"
          >
            <Sparkles className="h-4 w-4" /> Generate my curriculum
          </Link>
        )}
        {goal.status === "generating" && (
          <Link
            to={`/app/goals/${goal.id}/generating`}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper"
          >
            <RefreshCw className="h-4 w-4" /> Generation is in progress
          </Link>
        )}
        {hasCourse && goal.course_status === "draft" && reviewPath && (
          <Link
            to={reviewPath}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper"
          >
            Review the draft <ArrowRight className="h-4 w-4" />
          </Link>
        )}
        {hasCourse && goal.course_status === "approved" && coursePath && (
          <Link
            to={coursePath}
            className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-5 py-2.5 font-medium"
          >
            Open the enrolled course <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
