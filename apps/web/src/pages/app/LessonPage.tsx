import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, MessageSquare, PanelRightClose } from "lucide-react";
import { Alert, ProgressBar } from "../../components/ui/Feedback";
import { cn } from "../../lib/cn";
import { messageForApiError } from "../../features/course/api/course";
import { CourseSkeleton, QueryFailure } from "../../features/course/components/CourseBits";
import { DEMO_RICH_LESSON_ID, demoRichLesson } from "../../features/workspace/demo/demoLesson";
import { DemoBanner, ghostLink } from "../../features/workspace/components/WorkspaceBits";
import { LessonBlocks } from "../../features/workspace/components/LessonBlocks";
import { blueprintToBlocks } from "../../features/workspace/lessonBlocks";
import {
  classPath,
  coursePath,
  displayVersion,
  flattenLessons,
  formatMinutes,
  lessonPath,
  tutorPath,
  useCourseView,
} from "../../features/workspace/courseView";

export default function LessonPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { course, isDemo, isLoading, error, refetch } = useCourseView(courseId);
  const [tutorOpen, setTutorOpen] = useState(false);

  if (isLoading) return <CourseSkeleton />;
  if (error) return <QueryFailure title="Could not load the lesson" message={messageForApiError(error)} onRetry={() => void refetch()} />;
  const version = course ? displayVersion(course) : null;
  const lessons = version ? flattenLessons(version) : [];
  const current = lessons.find((l) => l.lesson.id === lessonId);
  if (!course || !version || !current) {
    return <QueryFailure title="Lesson not found" message="This lesson does not exist in this course." />;
  }

  const { lesson, flat } = current;
  const prev = lessons[current.index - 1];
  const next = lessons[current.index + 1];
  const authored = isDemo && lesson.id === DEMO_RICH_LESSON_ID;
  const blocks = authored ? demoRichLesson : blueprintToBlocks(lesson);
  const position = Math.round(((current.index + 1) / lessons.length) * 100);

  return (
    <div className="space-y-6">
      {isDemo && <DemoBanner what="lesson" />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-xl flex-1">
          <p className="font-mono text-xs text-ink/65">
            Lesson {current.index + 1} of {lessons.length} · position in the course, not completion
          </p>
          <div className="mt-2"><ProgressBar value={position} /></div>
        </div>
        <button
          type="button"
          onClick={() => setTutorOpen((v) => !v)}
          aria-expanded={tutorOpen}
          aria-controls="lesson-tutor"
          className={ghostLink}
        >
          {tutorOpen ? <PanelRightClose className="h-4 w-4" aria-hidden /> : <MessageSquare className="h-4 w-4" aria-hidden />}
          {tutorOpen ? "Hide tutor panel" : "Tutor panel"}
        </button>
      </div>

      <div className={cn("grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]", tutorOpen && "xl:grid-cols-[15rem_minmax(0,1fr)_18rem]")}>
        {/* Course navigation */}
        <nav aria-label="Course navigation" className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:self-start lg:overflow-y-auto">
          <details className="rounded-2xl border border-ink/15 bg-white/50 p-3 lg:border-0 lg:bg-transparent lg:p-0" open={false}>
            <summary className="cursor-pointer font-medium lg:hidden">Course navigation</summary>
            <div className="mt-3 space-y-4 lg:mt-0">
              <Link to={coursePath(course.id)} className="block text-sm font-semibold hover:underline">{version.title}</Link>
              {version.modules.map((module, mi) => (
                <div key={module.id}>
                  <p className="font-mono text-xs text-ink/65">Module {mi + 1} · {module.title}</p>
                  <ul className="mt-1 space-y-1">
                    {module.classes.map((klass) => (
                      <li key={klass.id}>
                        <Link to={classPath(course.id, klass.id)} className="block rounded-lg px-2 py-1 text-sm font-medium hover:bg-ink/10">{klass.title}</Link>
                        <ul className="ml-2 border-l border-ink/15 pl-2">
                          {klass.lessons.map((l) => (
                            <li key={l.id}>
                              <Link
                                to={lessonPath(course.id, l.id)}
                                aria-current={l.id === lesson.id ? "page" : undefined}
                                className={cn("block rounded-lg px-2 py-1 text-sm hover:bg-ink/10", l.id === lesson.id && "bg-lime font-medium")}
                              >
                                {l.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        </nav>

        {/* Reading column */}
        <article className="min-w-0 max-w-[44rem]">
          <header className="mb-8">
            <p className="font-mono text-xs text-ink/65">
              <Link to={classPath(course.id, flat.klass.id)} className="underline">Class {flat.index + 1}: {flat.klass.title}</Link>
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{lesson.title}</h1>
            <p className="mt-2 text-ink/70">Estimated study time: {formatMinutes(lesson.estimated_duration_minutes)}</p>
          </header>

          {!authored && (
            <div className="mb-8">
              <Alert variant="warning" title="Lesson blueprint, not a full lesson">
                This is the structured outline for the lesson. Fully authored lesson content and interactive practice are planned for a later phase.
              </Alert>
            </div>
          )}
          {authored && (
            <p className="mb-8 font-mono text-xs text-ink/65">Demonstration content showing every lesson block type.</p>
          )}

          <LessonBlocks blocks={blocks} />

          <nav aria-label="Lesson navigation" className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 pt-6">
            {prev ? (
              <Link to={lessonPath(course.id, prev.lesson.id)} className={ghostLink}><ArrowLeft className="h-4 w-4" aria-hidden /> {prev.lesson.title}</Link>
            ) : <span />}
            {next ? (
              <Link to={lessonPath(course.id, next.lesson.id)} className={ghostLink}>{next.lesson.title} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            ) : (
              <Link to={coursePath(course.id)} className={ghostLink}>Back to course</Link>
            )}
          </nav>
        </article>

        {tutorOpen && (
          <aside id="lesson-tutor" aria-label="Tutor panel" className="space-y-3 rounded-2xl border border-ink/15 bg-white/50 p-4 xl:sticky xl:top-24 xl:self-start">
            <h2 className="font-semibold">Tutor context</h2>
            <dl className="space-y-1 text-sm">
              <div><dt className="font-mono text-xs text-ink/65">Course</dt><dd>{version.title}{isDemo ? " (demo)" : ""}</dd></div>
              <div><dt className="font-mono text-xs text-ink/65">Class</dt><dd>{flat.klass.title}</dd></div>
              <div><dt className="font-mono text-xs text-ink/65">Lesson</dt><dd>{lesson.title}</dd></div>
            </dl>
            <p className="rounded-xl bg-ink/5 p-3 text-sm text-ink/75">
              The AI Tutor is not connected yet, so it cannot answer questions about this lesson. This panel shows the context it will receive.
            </p>
            <Link to={tutorPath(course.id, lesson.id)} className={ghostLink}>Open tutor workspace</Link>
          </aside>
        )}
      </div>
    </div>
  );
}
