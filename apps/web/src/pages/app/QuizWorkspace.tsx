import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, RotateCcw, Target } from "lucide-react";
import { Alert, Badge, ProgressBar, Skeleton } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Layout";
import { Breadcrumb } from "../../components/ui/Nav";
import { toast } from "../../components/ui/Toast";
import { messageForApiError } from "../../features/course/api/course";
import { QueryFailure } from "../../features/course/components/CourseBits";
import {
  useGenerateRemedialPlan,
  useQuiz,
  useRemedialPlan,
  useStartQuiz,
  useSubmitQuiz,
} from "../../features/course/hooks/useCourse";

export default function QuizWorkspace() {
  const { courseId, classId } = useParams<{ courseId: string; classId: string }>();
  const quizQuery = useQuiz(courseId, classId);
  const startQuiz = useStartQuiz(courseId ?? "", classId ?? "");
  const submitQuiz = useSubmitQuiz(courseId ?? "", classId ?? "");
  const generateRemedial = useGenerateRemedialPlan(courseId ?? "", classId ?? "");
  const remedialQuery = useRemedialPlan(courseId, classId);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const quiz = quizQuery.data;
  useEffect(() => {
    if (!quiz || quiz.status !== "ready") return;
    setAnswers((current) => {
      const next: Record<string, string> = {};
      for (const question of quiz.questions) {
        next[question.id] = current[question.id] ?? "";
      }
      return next;
    });
  }, [quiz?.id, quiz?.status, quiz?.questions]);

  if (quizQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading knowledge check">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (quizQuery.error) {
    return (
      <QueryFailure
        title="Could not load the knowledge check"
        message={messageForApiError(quizQuery.error)}
        onRetry={() => void quizQuery.refetch()}
      />
    );
  }

  async function handleStart() {
    try {
      await startQuiz.mutateAsync();
    } catch (error) {
      toast(messageForApiError(error));
    }
  }

  async function handleSubmit() {
    if (!quiz || quiz.status !== "ready") return;
    const missing = quiz.questions.filter((question) => !(answers[question.id] ?? "").trim());
    if (missing.length > 0) {
      toast(`Answer all ${quiz.questions.length} questions before submitting.`);
      return;
    }
    try {
      await submitQuiz.mutateAsync({
        attemptID: quiz.id,
        answers: quiz.questions.map((question) => ({
          question_id: question.id,
          response: answers[question.id].trim(),
        })),
      });
      toast("Knowledge check evaluated.");
    } catch (error) {
      toast(messageForApiError(error));
    }
  }

  async function handleRemedial() {
    try {
      await generateRemedial.mutateAsync();
      toast("Remedial plan generated.");
    } catch (error) {
      toast(messageForApiError(error));
    }
  }

  const remedial = remedialQuery.data;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Courses", to: "/app/courses" },
          { label: "Learning path", to: `/app/courses/${courseId}/learn` },
          { label: "Class", to: `/app/courses/${courseId}/classes/${classId}` },
          { label: "Knowledge check" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink/45">Assessment</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Knowledge check</h1>
          <p className="mt-2 max-w-2xl text-ink/65">
            Answer every question. A score at or above the passing threshold unlocks the next class.
          </p>
        </div>
        <Link
          to={`/app/courses/${courseId}/classes/${classId}`}
          className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-4 py-2 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to class
        </Link>
      </div>

      {!quiz ? (
        <Card className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Target className="h-5 w-5" aria-hidden /> Ready to check your understanding?
          </h2>
          <p className="text-sm text-ink/70">
            The assessment is generated from this class and usually contains 3–10 questions. You can
            retry after a failed attempt.
          </p>
          <Button loading={startQuiz.isPending} onClick={() => void handleStart()}>
            Start knowledge check
          </Button>
        </Card>
      ) : quiz.status === "ready" ? (
        <div className="space-y-4">
          <Card className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink/60">
                Attempt {quiz.attempt_number} · pass at {quiz.passing_score}%
              </p>
              <Badge tone="blue">{quiz.questions.length} questions</Badge>
            </div>
            <ProgressBar
              value={
                (Object.values(answers).filter((value) => value.trim().length > 0).length /
                  Math.max(1, quiz.questions.length)) *
                100
              }
            />
          </Card>

          {quiz.questions.map((question, index) => (
            <Card key={question.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-wide text-ink/45">
                  Question {index + 1} · {question.type.replaceAll("_", " ")}
                </p>
                <Badge tone="neutral">{question.competency}</Badge>
              </div>
              <p className="text-lg font-medium">{question.prompt}</p>
              {question.type === "multiple_choice" ? (
                <div className="grid gap-2">
                  {question.choices.map((choice) => {
                    const selected = answers[question.id] === choice.id;
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => setAnswers((current) => ({ ...current, [question.id]: choice.id }))}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          selected
                            ? "border-blue bg-blue/10 font-medium"
                            : "border-ink/15 bg-white/60 hover:border-blue/40"
                        }`}
                      >
                        <span className="mr-2 font-mono text-xs text-ink/45">{choice.id}</span>
                        {choice.text}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <label htmlFor={`answer-${question.id}`} className="sr-only">
                    Answer question {index + 1}
                  </label>
                  <textarea
                    id={`answer-${question.id}`}
                    rows={5}
                    value={answers[question.id] ?? ""}
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    className="w-full rounded-xl border border-ink/20 bg-white/70 p-3 text-sm outline-none focus:border-blue"
                    placeholder="Explain your answer and give a concrete example where relevant."
                  />
                </div>
              )}
            </Card>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink/55">
              {Object.values(answers).filter((value) => value.trim().length > 0).length} of{" "}
              {quiz.questions.length} answered
            </p>
            <Button loading={submitQuiz.isPending} onClick={() => void handleSubmit()}>
              Submit knowledge check
            </Button>
          </div>
        </div>
      ) : quiz.status === "evaluated" ? (
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-ink/55">Attempt {quiz.attempt_number}</p>
                <p className="mt-1 text-4xl font-semibold">{quiz.score ?? 0}%</p>
                <p className="text-sm text-ink/60">Passing score: {quiz.passing_score}%</p>
              </div>
              <Badge tone={quiz.passed ? "lime" : "warning"}>
                {quiz.passed ? "Passed" : "Not passed"}
              </Badge>
            </div>
            <ProgressBar value={quiz.score ?? 0} />
            {quiz.summary && <p className="text-sm text-ink/70">{quiz.summary}</p>}
          </Card>

          {quiz.strengths.length > 0 && (
            <Alert variant="success" title="What went well">
              {quiz.strengths.join(" · ")}
            </Alert>
          )}

          {quiz.gaps.length > 0 && (
            <Card className="space-y-2 border-amber-600/40 bg-amber-50/40">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <AlertTriangle className="h-5 w-5" aria-hidden /> Gaps to close
              </h2>
              {quiz.gaps.map((gap, index) => (
                <div key={index} className="rounded-xl border border-ink/10 bg-white/70 p-3">
                  <p className="text-sm font-medium">{gap.competency}</p>
                  <p className="text-sm text-ink/70">{gap.description}</p>
                  <p className="mt-1 text-xs text-ink/55">{gap.recommendation}</p>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <h2 className="text-xl font-semibold">Question feedback</h2>
            <div className="mt-3 space-y-3">
              {quiz.questions.map((question, index) => {
                const score = quiz.question_scores.find((item) => item.question_id === question.id);
                return (
                  <div key={question.id} className="rounded-xl border border-ink/10 bg-white/60 p-3">
                    <p className="text-sm font-medium">
                      {index + 1}. {question.prompt}
                    </p>
                    {score && (
                      <p className="mt-1 text-xs text-ink/55">
                        Score: {score.score}/100 · {score.feedback}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {quiz.passed ? (
              <Link
                to={`/app/courses/${courseId}/learn`}
                className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-medium text-ink"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Continue learning
              </Link>
            ) : (
              <Button
                variant="accent"
                loading={generateRemedial.isPending}
                onClick={() => void handleRemedial()}
              >
                Generate remedial plan
              </Button>
            )}
            <Button variant="ghost" loading={startQuiz.isPending} onClick={() => void handleStart()}>
              <RotateCcw className="h-4 w-4" aria-hidden /> New attempt
            </Button>
          </div>

          {remedial && (
            <Card className="space-y-3 border-amber-600/40 bg-amber-50/40">
              <h2 className="text-xl font-semibold">Remedial plan</h2>
              <p className="text-sm text-ink/70">{remedial.gap_summary}</p>
              <ol className="space-y-2">
                {remedial.plan.activities.map((activity) => (
                  <li key={activity.sequence} className="rounded-xl border border-ink/10 bg-white/70 p-3">
                    <p className="text-sm font-medium">
                      {activity.sequence}. {activity.title} · {activity.estimated_minutes} min
                    </p>
                    <p className="mt-1 text-sm text-ink/70">{activity.description}</p>
                    <p className="mt-1 text-xs text-ink/55">Target gap: {activity.target_gap}</p>
                  </li>
                ))}
              </ol>
              <p className="text-sm text-ink/70">{remedial.plan.encouragement}</p>
              <Link
                to={`/app/courses/${courseId}/classes/${classId}`}
                className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-4 py-2 text-sm font-medium"
              >
                Review class materials
              </Link>
            </Card>
          )}
        </div>
      ) : (
        <Card className="space-y-3">
          <p className="text-sm text-ink/70">
            The assessment is being generated. Refresh in a moment to continue.
          </p>
          <Button variant="ghost" onClick={() => void quizQuery.refetch()}>
            Refresh
          </Button>
        </Card>
      )}
    </div>
  );
}
