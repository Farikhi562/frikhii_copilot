import { Link, useParams } from "react-router-dom";
import { Flag, MapPin } from "lucide-react";
import { Badge } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Layout";
import { messageForApiError } from "../../features/course/api/course";
import { CourseSkeleton, QueryFailure } from "../../features/course/components/CourseBits";
import {
  ClassStatusPill,
  DemoBanner,
  ghostLink,
  PageHeader,
  StatusNote,
} from "../../features/workspace/components/WorkspaceBits";
import {
  classPath,
  coursePath,
  displayVersion,
  flattenClasses,
  formatMinutes,
  useCourseView,
} from "../../features/workspace/courseView";

export default function CourseRoadmap() {
  const { courseId } = useParams<{ courseId: string }>();
  const { course, isDemo, isLoading, error, refetch } = useCourseView(courseId);

  if (isLoading) return <CourseSkeleton />;
  if (error) return <QueryFailure title="Could not load the roadmap" message={messageForApiError(error)} onRetry={() => void refetch()} />;
  const version = course ? displayVersion(course) : null;
  if (!course || !version) return <QueryFailure title="Roadmap not found" message="This course does not exist or has no curriculum yet." />;

  const flat = flattenClasses(version);
  const start = flat[0];

  return (
    <div className="space-y-8">
      {isDemo && <DemoBanner />}
      <PageHeader
        eyebrow="Learning roadmap"
        title={version.title}
        description="The path from where you start to the final project, in order."
        actions={<Link to={coursePath(course.id)} className={ghostLink}>Course overview</Link>}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ol className="relative space-y-8 border-l-2 border-ink/20 pl-6 sm:pl-8">
          {version.modules.map((module, mi) => (
            <li key={module.id} className="relative">
              <span
                aria-hidden
                className="absolute -left-[2.15rem] top-0 grid h-8 w-8 place-items-center rounded-full bg-ink font-mono text-xs text-paper sm:-left-[2.65rem]"
              >
                {mi + 1}
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{module.title}</h2>
                <span className="font-mono text-xs text-ink/65">{formatMinutes(module.estimated_duration_minutes)}</span>
              </div>
              <p className="mt-1 text-ink/75">{module.description}</p>
              {module.required_previous_modules.length > 0 && (
                <p className="mt-2 text-sm text-ink/70">
                  <strong>Requires:</strong> {module.required_previous_modules.map((m) => m.title).join(", ")}
                </p>
              )}
              {module.skills.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2" aria-label="Skills developed">
                  {module.skills.map((skill) => (
                    <li key={skill}><Badge tone="blue">{skill}</Badge></li>
                  ))}
                </ul>
              )}
              <ol className="mt-4 grid gap-2">
                {module.classes.map((klass) => {
                  const f = flat.find((x) => x.klass.id === klass.id)!;
                  return (
                    <li key={klass.id}>
                      <Link
                        to={classPath(course.id, klass.id)}
                        className="block rounded-xl border border-ink/15 bg-white/60 p-4 hover:border-ink/40"
                      >
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs text-ink/65">Class {String(f.index + 1).padStart(2, "0")}</span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-xs text-ink/65">{formatMinutes(klass.estimated_duration_minutes)}</span>
                            <ClassStatusPill index={f.index} />
                          </span>
                        </span>
                        <span className="mt-1 block font-medium">{klass.title}</span>
                        {klass.objectives[0] && <span className="mt-1 block text-sm text-ink/70">{klass.objectives[0].description}</span>}
                        {klass.prerequisites.length > 0 && (
                          <span className="mt-2 block text-xs text-ink/65">Builds on: {klass.prerequisites.map((p) => p.title).join(", ")}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
          <li className="relative">
            <span aria-hidden className="absolute -left-[2.15rem] top-0 grid h-8 w-8 place-items-center rounded-full bg-lime sm:-left-[2.65rem]">
              <Flag className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-semibold tracking-tight">Final project and assessment</h2>
            <p className="mt-1 text-ink/75"><strong>{version.final_project.title}.</strong> {version.final_project.description}</p>
            <p className="mt-1 text-ink/75"><strong>{version.final_assessment.title}.</strong> {version.final_assessment.description}</p>
          </li>
        </ol>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start" aria-label="Roadmap summary">
          {start && (
            <Card className="space-y-2">
              <p className="flex items-center gap-2 font-mono text-xs text-ink/65"><MapPin className="h-4 w-4" aria-hidden /> Where to start</p>
              <p className="font-medium">Class 01: {start.klass.title}</p>
              <Link to={classPath(course.id, start.klass.id)} className={ghostLink}>Open class</Link>
            </Card>
          )}
          <Card className="space-y-2">
            <h2 className="font-semibold">Competencies you will develop</h2>
            <ul className="space-y-2 text-sm">
              {version.target_competencies.map((c) => (
                <li key={c.id}><span className="font-medium">{c.name}</span><span className="block text-ink/70">{c.description}</span></li>
              ))}
            </ul>
          </Card>
          <StatusNote />
        </aside>
      </div>
    </div>
  );
}
