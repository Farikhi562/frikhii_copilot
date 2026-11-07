import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, CheckCircle2, Layers, Target } from "lucide-react";
import { ProgressBar, ProgressRing, Skeleton } from "../../components/ui/Feedback";
import { Card, StatCard } from "../../components/ui/Layout";
import { messageForApiError } from "../../features/course/api/course";
import { QueryFailure } from "../../features/course/components/CourseBits";
import { useProgress } from "../../features/course/hooks/useCourse";

export default function ProgressPage() {
  const progressQuery = useProgress();

  if (progressQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading progress">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (progressQuery.error) {
    return (
      <QueryFailure
        title="Could not load progress"
        message={messageForApiError(progressQuery.error)}
        onRetry={() => void progressQuery.refetch()}
      />
    );
  }
  const progress = progressQuery.data;
  if (!progress) return null;
  const percent = progress.total_lessons
    ? Math.round((progress.completed_lessons / progress.total_lessons) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink/45">Progress</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your learning dashboard</h1>
          <p className="mt-2 max-w-2xl text-ink/65">
            Track lessons, classes and course completion across everything you are enrolled in.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-ink/15 bg-white/50 p-4">
          <ProgressRing value={percent} label="Overall progress" />
          <div>
            <p className="text-sm font-medium">Overall progress</p>
            <p className="text-xs text-ink/55">
              {progress.completed_lessons}/{progress.total_lessons} lessons
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Enrolled courses" value={String(progress.enrolled_courses.length)} />
        <StatCard label="Modules" value={String(progress.total_modules)} />
        <StatCard label="Classes" value={String(progress.total_classes)} />
        <StatCard
          label="Lessons completed"
          value={`${progress.completed_lessons}/${progress.total_lessons}`}
          progress={percent}
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Enrolled courses</h2>
        {progress.enrolled_courses.length === 0 ? (
          <Card>
            <p className="text-sm text-ink/65">
              You are not enrolled in a course yet.{" "}
              <Link to="/app/courses/new" className="font-medium underline">
                Create a learning goal
              </Link>{" "}
              to generate your first curriculum.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {progress.enrolled_courses.map((course) => (
              <Card key={course.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold">{course.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-ink/65">{course.short_description}</p>
                  </div>
                  <BookOpen className="h-5 w-5 shrink-0 text-ink/35" aria-hidden />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-ink/55">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" aria-hidden /> {course.counts.modules} modules
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" aria-hidden /> {course.counts.classes} classes
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" aria-hidden /> {course.counts.lessons} lessons
                  </span>
                </div>
                <ProgressBar
                  value={
                    progress.completed_lesson_ids.length > 0 && course.counts.lessons > 0
                      ? Math.min(
                          100,
                          Math.round(
                            (progress.completed_lesson_ids.length / course.counts.lessons) * 100,
                          ),
                        )
                      : 0
                  }
                />
                <Link
                  to={`/app/courses/${course.id}/learn`}
                  className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
                >
                  Continue <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
