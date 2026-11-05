import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { Alert, Badge, Spinner } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Form";
import { Card } from "../../components/ui/Layout";
import { Breadcrumb } from "../../components/ui/Nav";
import {
  messageForApiError,
  isApiError,
} from "../../features/course/api/course";
import {
  useDiagnostic,
  useGenerateDiagnostic,
  useLearningGoal,
  useSubmitDiagnostic,
} from "../../features/course/hooks/useCourse";
import type { DiagnosticAttempt } from "../../features/course/schemas/course";
import { QueryFailure } from "../../features/course/components/CourseBits";

export default function Diagnostic() {
  const { goalId } = useParams<{ goalId: string }>();
  const navigate = useNavigate();
  const goalQuery = useLearningGoal(goalId);
  const diagnosticQuery = useDiagnostic(goalId);
  const generate = useGenerateDiagnostic(goalId ?? "");
  const submit = useSubmitDiagnostic(goalId ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const initializedAttempt = useRef<string | null>(null);

  const diagnostic = diagnosticQuery.data ?? null;

  useEffect(() => {
    if (!diagnostic || initializedAttempt.current === diagnostic.id) return;
    initializedAttempt.current = diagnostic.id;
    const next: Record<string, string> = {};
    for (const answer of diagnostic.answers) {
      next[answer.question_id] = answer.response;
    }
    setAnswers(next);
  }, [diagnostic]);

  useEffect(() => {
    if (diagnostic?.status === "evaluated" && goalId) {
      navigate(`/app/goals/${goalId}/result`, { replace: true });
    }
  }, [diagnostic?.status, goalId, navigate]);

  const answered = useMemo(() => {
    if (!diagnostic) return 0;
    return diagnostic.questions.filter((question) => (answers[question.id] ?? "").trim().length > 0)
      .length;
  }, [answers, diagnostic]);

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
        title="Could not load this learning goal"
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
  if (!goal) {
    return <QueryFailure title="Learning goal not found" message="This goal does not exist or is not yours." />;
  }

  async function start() {
    setFormError(null);
    try {
      await generate.mutateAsync();
    } catch (error) {
      if (!isApiError(error) || error.code !== "generation_in_progress") {
        setFormError(messageForApiError(error));
      }
    }
  }

  async function submitAnswers(attempt: DiagnosticAttempt) {
    setFormError(null);
    if (attempt.status === "ready") {
      const missing = attempt.questions.filter(
        (question) => !(answers[question.id] ?? "").trim(),
      );
      if (missing.length > 0) {
        setFormError(`Answer all ${attempt.questions.length} questions before submitting.`);
        return;
      }
    }
    try {
      const payload =
        attempt.status === "ready"
          ? attempt.questions.map((question) => ({
              question_id: question.id,
              response: (answers[question.id] ?? "").trim(),
            }))
          : attempt.answers.map((answer) => ({
              question_id: answer.question_id,
              response: answer.response,
            }));
      const evaluated = await submit.mutateAsync({
        attemptID: attempt.id,
        answers: payload,
      });
      if (evaluated.status === "evaluated") {
        navigate(`/app/goals/${goalId}/result`);
      }
    } catch (error) {
      setFormError(messageForApiError(error));
    }
  }

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Courses", to: "/app/courses" },
          { label: goal.title, to: `/app/goals/${goal.id}/result` },
          { label: "Diagnostic" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50">Starting point</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">A short diagnostic.</h1>
          <p className="mt-2 max-w-2xl text-ink/65">
            Answer in your own words. This is not a pass/fail test; it helps the architect avoid
            repeating what you already know and target the real gaps.
          </p>
        </div>
        {diagnostic && (
          <Badge tone={diagnostic.status === "evaluated" ? "lime" : "blue"}>
            {diagnostic.status === "ready"
              ? `${answered}/${diagnostic.questions.length} answered`
              : diagnostic.status.replace(/_/g, " ")}
          </Badge>
        )}
      </div>

      {!diagnostic && (
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Generate the diagnostic</h2>
          <p className="text-sm text-ink/65">
            The AI Engine will design {goal.title ? "questions for this goal" : "questions"} based on
            your goal and current knowledge. The answer key stays on the server.
          </p>
          {goal.status === "failed" && goal.last_error && (
            <Alert variant="warning" title="The previous attempt failed">
              {goal.last_error}
            </Alert>
          )}
          {formError && (
            <Alert variant="error" title="Could not generate the diagnostic">
              {formError}
            </Alert>
          )}
          <Button onClick={() => void start()} loading={generate.isPending} variant="accent">
            <Sparkles className="h-4 w-4" /> Generate diagnostic
          </Button>
        </Card>
      )}

      {diagnostic?.status === "generating" && (
        <Card className="flex items-center gap-3">
          <Spinner />
          <div>
            <p className="font-medium">Designing questions</p>
            <p className="text-sm text-ink/65">This page refreshes automatically.</p>
          </div>
        </Card>
      )}

      {diagnostic?.status === "ready" && (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitAnswers(diagnostic);
          }}
        >
          {diagnostic.questions.map((question) => (
            <Card key={question.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">Question {question.sequence}</Badge>
                <Badge tone="blue">{question.type.replace(/_/g, " ")}</Badge>
                <Badge tone="neutral">{question.difficulty}</Badge>
                <span className="text-xs text-ink/50">{question.competency}</span>
              </div>
              <fieldset>
                <legend className="text-lg font-medium">{question.prompt}</legend>
                {question.choices.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {question.choices.map((choice) => (
                      <label
                        key={choice.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink/20 bg-white/50 p-3"
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={choice.id}
                          checked={answers[question.id] === choice.id}
                          onChange={() =>
                            setAnswers((current) => ({ ...current, [question.id]: choice.id }))
                          }
                          className="mt-1"
                        />
                        <span>{choice.text}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <Textarea
                    label="Your answer"
                    rows={4}
                    value={answers[question.id] ?? ""}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    placeholder="Explain your reasoning, or say what you would do."
                  />
                )}
              </fieldset>
            </Card>
          ))}

          {formError && (
            <Alert variant="error" title="Could not submit the diagnostic">
              {formError}
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink/60">
              {answered} of {diagnostic.questions.length} answered
            </p>
            <Button type="submit" variant="accent" loading={submit.isPending}>
              Submit for evaluation <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}

      {diagnostic?.status === "submitted" && (
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold">Your answers are saved.</h2>
          <p className="text-sm text-ink/65">
            The evaluation did not complete. You can retry without retyping your answers.
          </p>
          {formError && (
            <Alert variant="error" title="Evaluation failed">
              {formError}
            </Alert>
          )}
          <Button
            onClick={() => void submitAnswers(diagnostic)}
            loading={submit.isPending}
            variant="accent"
          >
            <RefreshCw className="h-4 w-4" /> Retry evaluation
          </Button>
        </Card>
      )}

      {diagnostic?.status === "evaluating" && (
        <Card className="flex items-center gap-3">
          <Spinner />
          <p className="font-medium">Evaluating your answers…</p>
        </Card>
      )}

      {diagnostic?.status === "failed" && (
        <Card className="space-y-4">
          <Alert variant="warning" title="The diagnostic could not be generated">
            Retry to create a fresh question set.
          </Alert>
          {formError && <Alert variant="error" title="Retry failed">{formError}</Alert>}
          <Button onClick={() => void start()} loading={generate.isPending} variant="accent">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {diagnostic?.status === "evaluated" && (
        <Card className="space-y-3">
          <p className="font-medium">This diagnostic is already evaluated.</p>
          <Link
            to={`/app/goals/${goal.id}/result`}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper"
          >
            Open the result <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      )}
    </div>
  );
}
