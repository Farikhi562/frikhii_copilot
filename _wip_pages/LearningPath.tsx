import { Link, useParams } from "react-router-dom";
import { ArrowRight, BookOpen, CheckCircle2, Clock, Lock, PlayCircle, Target } from "lucide-react";
import { Alert, Badge, ProgressBar, ProgressRing, Skeleton } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Layout";
import { Breadcrumb } from "../../components/ui/Nav";
import { messageForApiError } from "../../features/course/api/course";
import { QueryFailure } from "../../features/course/components/CourseBits";
import { useRoadmap } from "../../features/course/hooks/useCourse";
import type { RoadmapClass, RoadmapLesson } from "../../features/course/schemas/course";

const classStatusTone: Record<string, "lime" | "blue" | "warning" | "danger" | "neutral"> = {
  completed: "lime",
  in_progress: "blue",
  available: "neutral",
  needs_review: "warning",
  locked: "neutral",
};

const classStatusLabel: Record<string, string> = {
  completed: "Completed",
  in_progress: "In progress",
  available: "Ready",
  needs_review: "Needs review",
  locked: "Locked",
};

function findLesson(roadmap: ReturnType<typeof useRoadmap>["data"], lessonID?: string | null) {
  if (!roadmap || !lessonID) return null;
  for (const module of roadmap.modules) {
    for (const klass of module.classes) {
      for (const lesson of klass.lessons) {
        if (lesson.id === lessonID) return { lesson, klass };
      }
    }
  }
  return null;
}

function LessonRow({
  courseID,
  lesson,
  index,
}: {
  courseID: string;
  lesson: RoadmapLesson;
  index: number;
}) {
  const content = (
    <>
      <span className="flex items-center gap-2">
        {lesson.status === "completed" ? (
          <CheckCircle2 className="h-4 w-4 text-lime-700" aria-hidden />
        ) : lesson.status === "locked" ? (
          <Lock className="h-4 w-4 text-ink/35" aria-hidden />
        ) : (
          <PlayCircle className="h-4 w-4 text-blue" aria-hidden />
        )}
        <span className={lesson.status === "locked" ? "text-ink/45" : "font-medium"}>
          Lesson {index + 1}: {lesson.title}
        </span>
      </span>
      <span className="flex items-center gap-2 text-xs text-ink/45">
        <Clock className="h-3 w-3" aria-hidden /> {lesson.estimated_duration_minutes} min
      </span>
    </>
  );
  const className =
    "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-white/60 px-3 py-2 text-sm";
  if (lesson.status === "locked") {
    return <div className={`${className} opacity-70`}>{content}</div>;
  }
  return (
    <Link
      to={`/app/courses/${courseID}/lessons/${lesson.id}`}
      className={`${className} transition hover:border-blue/40 hover:bg-blue/5`}
    >
      {content}
    </Link>
  );
}

function ClassCard({ courseID, klass }: { courseID: string; klass: RoadmapClass }) {
  const progress = klass.total_lessons
    ? Math.round((klass.completed_lessons / klass.total_lessons) * 100)
    : 0;
  const quizLabel =
    klass.quiz_status === "evaluated"
      ? `Knowledge check ${klass.quiz_score ?? 0}%`
      : klass.quiz_status === "ready"
        ? "Knowledge check ready"
        : "Knowledge check not started";

  return (
    <section className="rounded-2xl border border-ink/15 bg-white/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={classStatusTone[klass.status] ?? "neutral"}>
              {classStatusLabel[klass.status] ?? klass.status}
            </Badge>
            {!klass.unlocked && (
              <span className="flex items-center gap-1 text-xs text-ink/50">
                <Lock className="h-3 w-3" aria-hidden /> Locked
              </span>
            )}
          </div>
          <h3 className="mt-2 text-lg font-semibold">{klass.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-ink/65">{klass.description}</p>
        </div>
        <div className="text-right text-xs text-ink/55">
          <p className="font-mono">
            {klass.completed_lessons}/{klass.total_lessons} lessons
          </p>
          <p className="mt-1">{quizLabel}</p>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar value={progress} />
      </div>

      <div className="mt-3 space-y-1.5">
        {klass.lessons.map((lesson, index) => (
          <LessonRow key={lesson.id} courseID={courseID} lesson={lesson} index={index} />
        ))}
      </div>

      {klass.unlocked ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to={`/app/courses/${courseID}/classes/${klass.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
          >
            Open class <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            to={`/app/courses/${courseID}/classes/${klass.id}/quiz`}
            className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-4 py-2 text-sm font-medium"
          >
            <Target className="h-4 w-4" aria-hidden /> Knowledge check
          </Link>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink/55">
          <Lock className="h-4 w-4" aria-hidden /> Pass the previous class assessment to unlock this
          class.
        </p>
      )}
    </section>
  );
}

export default function LearningPath() {
  const { courseId } = useParams<{ courseId: string }>();
  const roadmapQuery = useRoadmap(courseId);

  if (roadmapQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading learning path">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (roadmapQuery.error) {
    return (
      <QueryFailure
        title="Could not load the learning path"
        message={messageForApiError(roadmapQuery.error)}
        onRetry={() => void roadmapQuery.refetch()}
      />
    );
  }
  const roadmap = roadmapQuery.data;
  if (!roadmap || !courseId) {
    return <QueryFailure title="Learning path not found" message="This course is not available." />;
  }
  if (!roadmap.approved) {
    return (
      <Alert variant="warning" title="Approve the curriculum first">
        This course is still a draft.{" "}
        <Link to={`/app/courses/${courseId}/review`} className="font-medium underline">
          Review and approve it
        </Link>{" "}
        before starting the learning path.
      </Alert>
    );
  }

  const next = findLesson(roadmap, roadmap.next_lesson_id);

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: "Courses", to: "/app/courses" },
          { label: roadmap.title, to: `/app/courses/${courseId}` },
          { label: "Learn" },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-wide text-ink/45">Learning path</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{roadmap.title}</h1>
          <p className="mt-2 text-ink/65">{roadmap.short_description}</p>
          <p className="mt-3 text-sm text-ink/55">
            {roadmap.completed_lessons} of {roadmap.total_lessons} lessons complete ·{" "}
            {roadmap.completed_classes} of {roadmap.total_classes} classes passed
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-ink/15 bg-white/50 p-4">
          <ProgressRing value={roadmap.progress_percent} label="Course progress" />
          <div>
            <p className="text-sm font-medium">Course progress</p>
            <p className="text-xs text-ink/55">Lessons completed</p>
          </div>
        </div>
      </div>

      {next && (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink/45">
              <BookOpen className="h-3 w-3" aria-hidden /> Next up
            </p>
            <p className="mt-1 text-lg font-semibold">{next.lesson.title}</p>
            <p className="text-sm text-ink/60">
              {next.klass.title} · {next.lesson.estimated_duration_minutes} min
            </p>
          </div>
          <Link
            to={`/app/courses/${courseId}/lessons/${next.lesson.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-medium text-ink"
          >
            Continue lesson <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Card>
      )}

      <div className="space-y-5">
        {roadmap.modules.map((module, moduleIndex) => (
          <section key={module.id} className="rounded-2xl border border-ink/15 bg-white/30 p-5">
            <p className="font-mono text-xs text-ink/45">Module {moduleIndex + 1}</p>
            <h2 className="mt-1 text-xl font-semibold">{module.title}</h2>
            <p className="mt-1 text-sm text-ink/65">{module.description}</p>
            <div className="mt-4 space-y-3">
              {module.classes.map((klass) => (
                <ClassCard key={klass.id} courseID={courseId} klass={klass} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
