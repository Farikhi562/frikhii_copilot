import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ClipboardCheck, Dumbbell } from "lucide-react";
import { Badge } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Layout";
import { messageForApiError } from "../../features/course/api/course";
import { CourseSkeleton, QueryFailure } from "../../features/course/components/CourseBits";
import {
  BulletList,
  ClassStatusPill,
  DemoBanner,
  ghostLink,
  PageHeader,
  StatusNote,
} from "../../features/workspace/components/WorkspaceBits";
import {
  classPath,
  displayVersion,
  flattenClasses,
  formatMinutes,
  lessonPath,
  roadmapPath,
  tutorPath,
  useCourseView,
} from "../../features/workspace/courseView";

export default function ClassPage() {
  const { courseId, classId } = useParams<{ courseId: string; classId: string }>();
  const { course, isDemo, isLoading, error, refetch } = useCourseView(courseId);

  if (isLoading) return <CourseSkeleton />;
  if (error) return <QueryFailure title="Could not load the class" message={messageForApiError(error)} onRetry={() => void refetch()} />;
  const version = course ? displayVersion(course) : null;
  const flat = version ? flattenClasses(version) : [];
  const current = flat.find((f) => f.klass.id === classId);
  if (!course || !version || !current) {
    return <QueryFailure title="Class not found" message="This class does not exist in this course." />;
  }
  const { klass, module, index } = current;
  const prev = flat[index - 1];
  const next = flat[index + 1];

  return (
    <div className="space-y-8">
      {isDemo && <DemoBanner />}
      <PageHeader
        eyebrow={`Module ${current.moduleIndex + 1} · ${module.title}`}
        title={`Class ${String(index + 1).padStart(2, "0")}: ${klass.title}`}
        description={klass.description}
        actions={<Link to={tutorPath(course.id)} className={ghostLink}>Ask tutor</Link>}
      />
      <div className="flex flex-wrap items-center gap-2">
        <ClassStatusPill index={index} />
        <Badge tone="neutral">{formatMinutes(klass.estimated_duration_minutes)}</Badge>
        <Badge tone="neutral">{klass.lessons.length} lessons</Badge>
        {klass.prerequisites.length > 0 && <Badge tone="neutral">Builds on: {klass.prerequisites.map((p) => p.title).join(", ")}</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="lessons-h" className="space-y-3">
          <h2 id="lessons-h" className="text-xl font-semibold tracking-tight">Lessons</h2>
          <ol className="grid gap-2">
            {klass.lessons.map((lesson, i) => (
              <li key={lesson.id}>
                <Link to={lessonPath(course.id, lesson.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/15 bg-white/60 p-4 hover:border-ink/40">
                  <span className="min-w-0">
                    <span className="font-mono text-xs text-ink/65">Lesson {i + 1}</span>
                    <span className="block font-medium">{lesson.title}</span>
                    <span className="block text-sm text-ink/70">{lesson.description}</span>
                  </span>
                  <span className="font-mono text-xs text-ink/65">{formatMinutes(lesson.estimated_duration_minutes)}</span>
                </Link>
              </li>
            ))}
          </ol>

          {klass.exercise && (
            <Card className="mt-6 space-y-2 border-blue/40 bg-blue/5">
              <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Dumbbell className="h-5 w-5" aria-hidden /> Practice activity</h2>
              <p className="font-medium">{klass.exercise.title} <span className="font-mono text-xs text-ink/65">· {klass.exercise.difficulty}</span></p>
              <p className="text-ink/80">{klass.exercise.description}</p>
              <BulletList items={klass.exercise.instructions} />
              <p><strong>Deliverable:</strong> {klass.exercise.expected_deliverable}</p>
            </Card>
          )}

          <Card className="space-y-1">
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><ClipboardCheck className="h-5 w-5" aria-hidden /> Knowledge check preview</h2>
            <p className="text-ink/80">{klass.knowledge_check.description}</p>
            <p className="text-sm text-ink/70">{klass.knowledge_check.question_count} questions · {klass.knowledge_check.competencies.join(", ")}</p>
            <p className="text-xs text-ink/65">Taking knowledge checks is not available yet (planned).</p>
          </Card>
        </section>

        <aside className="space-y-4" aria-label="Class details">
          <Card className="space-y-2">
            <h2 className="font-semibold">Learning objectives</h2>
            <BulletList items={klass.objectives.map((o) => o.description)} />
          </Card>
          {klass.key_concepts.length > 0 && (
            <Card className="space-y-2">
              <h2 className="font-semibold">Key concepts</h2>
              <ul className="flex flex-wrap gap-2">{klass.key_concepts.map((c) => <li key={c}><Badge tone="blue">{c}</Badge></li>)}</ul>
            </Card>
          )}
          <StatusNote />
        </aside>
      </div>

      <nav aria-label="Class navigation" className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/15 pt-6">
        {prev ? (
          <Link to={classPath(course.id, prev.klass.id)} className={ghostLink}><ArrowLeft className="h-4 w-4" aria-hidden /> Class {prev.index + 1}: {prev.klass.title}</Link>
        ) : <Link to={roadmapPath(course.id)} className={ghostLink}><ArrowLeft className="h-4 w-4" aria-hidden /> Roadmap</Link>}
        {next ? (
          <Link to={classPath(course.id, next.klass.id)} className={ghostLink}>Class {next.index + 1}: {next.klass.title} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        ) : <Link to={roadmapPath(course.id)} className={ghostLink}>Final project on the roadmap <ArrowRight className="h-4 w-4" aria-hidden /></Link>}
      </nav>
    </div>
  );
}
