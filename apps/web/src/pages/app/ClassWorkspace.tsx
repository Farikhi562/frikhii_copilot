import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardList, Target } from "lucide-react";
import { Alert, Badge, ProgressBar, Skeleton } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Layout";
import { Breadcrumb } from "../../components/ui/Nav";
import { toast } from "../../components/ui/Toast";
import { messageForApiError } from "../../features/course/api/course";
import { QueryFailure } from "../../features/course/components/CourseBits";
import {
  useCourse,
  useExercise,
  useQuiz,
  useRemedialPlan,
  useRoadmap,
  useSubmitExercise,
} from "../../features/course/hooks/useCourse";

export default function ClassWorkspace() {
  const { courseId, classId } = useParams<{ courseId: string; classId: string }>();
  const courseQuery = useCourse(courseId);
  const roadmapQuery = useRoadmap(courseId);
  const exerciseQuery = useExercise(courseId, classId);
  const quizQuery = useQuiz(courseId, classId);
  const remedialQuery = useRemedialPlan(courseId, classId);
  const submitExercise = useSubmitExercise(courseId ?? "", classId ?? "");
  const [response, setResponse] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (courseQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading class">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (courseQuery.error) {
    return (
      <QueryFailure
        title="Could not load the class"
        message={messageForApiError(courseQuery.error)}
        onRetry={() => void courseQuery.refetch()}
      />
    );
  }
  const course = courseQuery.data;
  const version = course?.approved_version ?? course?.version;
  let klass = null;
  let moduleTitle = "";
  if (version) {
    for (const module of version.modules) {
      for (const candidate of module.classes) {
        if (candidate.id === classId) {
          klass = candidate;
          moduleTitle = module.title;
        }
      }
    }
  }
  if (!course || !klass || !courseId || !classId) {
    return <QueryFailure title="Class not found" message="This class is not part of the course." />;
  }

  let roadmapClass = null;
  if (roadmapQuery.data) {
    for (const module of roadmapQuery.data.modules) {
      for (const candidate of module.classes) {
        if (candidate.id === classId) roadmapClass = candidate;
      }
    }
  }
  const quiz = quizQuery.data;
  const exerciseData = exerciseQuery.data;
  const authored = exerciseData?.authored ?? null;
  const remedial = remedialQuery.data;
  const progress = roadmapClass?.total_lessons
    ? Math.round((roadmapClass.completed_lessons / roadmapClass.total_lessons) * 100)
    : 0;

  async function handleExerciseSubmit() {
    if (response.trim().length < 10) {
      toast("Write at least 10 characters before submitting.");
      return;
    }
    try {
      await submitExercise.mutateAsync(response.trim());
      setSubmitted(true);
      toast("Exercise submitted.");
    } catch (error) {
      toast(messageForApiError(error));
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Courses", to: "/app/courses" },
          { label: "Learning path", to: `/app/courses/${courseId}/learn` },
          { label: klass.title },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink/45">{moduleTitle}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{klass.title}</h1>
          <p className="mt-2 max-w-3xl text-ink/65">{klass.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {roadmapClass && (
              <Badge
                tone={
                  roadmapClass.status === "completed"
                    ? "lime"
                    : roadmapClass.status === "needs_review"
                      ? "warning"
                      : roadmapClass.status === "in_progress"
                        ? "blue"
                        : "neutral"
                }
              >
                {roadmapClass.status.replaceAll("_", " ")}
              </Badge>
            )}
            {quiz?.status === "evaluated" && (
              <Badge tone={quiz.passed ? "lime" : "warning"}>
                Knowledge check {quiz.score ?? 0}%
              </Badge>
            )}
          </div>
        </div>
        <Link
          to={`/app/courses/${courseId}/learn`}
          className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-4 py-2 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Learning path
        </Link>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Class progress</p>
          <p className="font-mono text-sm">
            {roadmapClass?.completed_lessons ?? 0}/{roadmapClass?.total_lessons ?? klass.lessons.length}{" "}
            lessons
          </p>
        </div>
        <ProgressBar value={progress} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <BookOpen className="h-5 w-5" aria-hidden /> Lessons
          </h2>
          <div className="mt-3 space-y-2">
            {klass.lessons.map((lesson, index) => {
              const roadmapLesson = roadmapClass?.lessons.find((item) => item.id === lesson.id);
              const completed = roadmapLesson?.status === "completed";
              return (
                <Link
                  key={lesson.id}
                  to={`/app/courses/${courseId}/lessons/${lesson.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-ink/10 bg-white/60 px-3 py-2 text-sm transition hover:border-blue/40 hover:bg-blue/5"
                >
                  <span className="flex items-center gap-2">
                    {completed ? (
                      <CheckCircle2 className="h-4 w-4 text-lime-700" aria-hidden />
                    ) : (
                      <span className="font-mono text-xs text-ink/40">{index + 1}</span>
                    )}
                    {lesson.title}
                  </span>
                  <ArrowRight className="h-4 w-4 text-ink/40" aria-hidden />
                </Link>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Target className="h-5 w-5" aria-hidden /> Knowledge check
          </h2>
          {quizQuery.isLoading ? (
            <Skeleton className="mt-3 h-20 w-full" />
          ) : quiz ? (
            <div className="mt-3 space-y-2 text-sm text-ink/70">
              <p>
                Status: <strong>{quiz.status.replaceAll("_", " ")}</strong>
                {quiz.status === "evaluated" && (
                  <>
                    {" "}
                    · Score <strong>{quiz.score ?? 0}%</strong> (pass {quiz.passing_score}%)
                  </>
                )}
              </p>
              {quiz.status === "evaluated" && quiz.summary && <p>{quiz.summary}</p>}
              {quiz.status === "ready" && <p>You have an assessment in progress. Finish it to unlock the next class.</p>}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/65">
              Complete the lessons, then take the knowledge check to unlock the next class.
            </p>
          )}
          <Link
            to={`/app/courses/${courseId}/classes/${classId}/quiz`}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
          >
            {quiz?.status === "ready" ? "Continue check" : quiz?.status === "evaluated" ? "Review result" : "Start knowledge check"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Card>
      </div>

      <Card>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <ClipboardList className="h-5 w-5" aria-hidden /> Practice exercise
        </h2>
        {exerciseQuery.isLoading ? (
          <Skeleton className="mt-3 h-40 w-full" />
        ) : exerciseQuery.error ? (
          <Alert variant="warning" title="The exercise could not be loaded">
            {messageForApiError(exerciseQuery.error)}
          </Alert>
        ) : authored ? (
          <div className="mt-3 space-y-4">
            <div>
              <h3 className="text-lg font-medium">{authored.title}</h3>
              <p className="mt-1 text-sm text-ink/70">{authored.context}</p>
            </div>
            <ol className="space-y-2">
              {authored.steps.map((step) => (
                <li key={step.step_number} className="rounded-xl border border-ink/10 bg-white/60 p-3">
                  <p className="text-sm font-medium">
                    Step {step.step_number}. {step.instruction}
                  </p>
                  {step.hint && <p className="mt-1 text-xs text-ink/55">Hint: {step.hint}</p>}
                </li>
              ))}
            </ol>
            <div>
              <p className="text-sm font-medium">Expected deliverable</p>
              <p className="text-sm text-ink/70">{authored.expected_deliverable}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Evaluation criteria</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/70">
                {authored.evaluation_criteria.map((criterion, index) => (
                  <li key={index}>{criterion}</li>
                ))}
              </ul>
            </div>
            {submitted ? (
              <Alert variant="success" title="Exercise submitted">
                Your response is saved. Compare it with the criteria above and note one improvement
                before the knowledge check.
              </Alert>
            ) : (
              <div className="space-y-2">
                <label htmlFor="exercise-response" className="text-sm font-medium">
                  Your response
                </label>
                <textarea
                  id="exercise-response"
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-ink/20 bg-white/70 p-3 text-sm outline-none focus:border-blue"
                  placeholder="Describe your deliverable, the choices you made, and one limitation."
                />
                <Button loading={submitExercise.isPending} onClick={() => void handleExerciseSubmit()}>
                  Submit exercise
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/65">
            The exercise is being prepared. Refresh in a moment if it does not appear.
          </p>
        )}
      </Card>

      {remedial && (
        <Card className="border-amber-600/40 bg-amber-50/40">
          <h2 className="text-xl font-semibold">Remedial plan</h2>
          <p className="mt-1 text-sm text-ink/70">{remedial.gap_summary}</p>
          <ol className="mt-3 space-y-2">
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
          <p className="mt-3 text-sm text-ink/70">{remedial.plan.encouragement}</p>
        </Card>
      )}
    </div>
  );
}
