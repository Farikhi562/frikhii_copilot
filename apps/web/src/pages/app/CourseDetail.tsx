import { Link, useParams } from "react-router-dom";
import { ArrowRight, Map as MapIcon, MessageSquare, RefreshCw } from "lucide-react";
import { Alert, Badge } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Layout";
import { Tabs } from "../../components/ui/Nav";
import { messageForApiError } from "../../features/course/api/course";
import {
  CourseSkeleton,
  ProviderNotice,
  QueryFailure,
  VersionBadge,
} from "../../features/course/components/CourseBits";
import {
  accentLink,
  BulletList,
  DemoBanner,
  ghostLink,
  ModuleAccordion,
  PageHeader,
  StatusNote,
} from "../../features/workspace/components/WorkspaceBits";
import {
  classPath,
  displayVersion,
  flattenClasses,
  formatMinutes,
  roadmapPath,
  tutorPath,
  useCourseView,
} from "../../features/workspace/courseView";

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const { course, isDemo, isLoading, error, refetch } = useCourseView(courseId);

  if (isLoading) return <CourseSkeleton />;
  if (error) {
    return <QueryFailure title="Could not load the course" message={messageForApiError(error)} onRetry={() => void refetch()} />;
  }
  if (!course || !courseId) {
    return <QueryFailure title="Course not found" message="This course does not exist or is not yours." />;
  }
  const display = displayVersion(course);
  if (!display) {
    return <QueryFailure title="No curriculum yet" message="This course has no generated version." />;
  }

  const classes = flattenClasses(display);
  const start = classes[0];
  const hasUnapprovedDraft = Boolean(
    course.version && course.version.status === "draft" && course.version.id !== course.approved_version?.id,
  );
  const lessonCount = classes.reduce((n, c) => n + c.klass.lessons.length, 0);

  const stats = [
    ["Modules", display.modules.length],
    ["Classes", classes.length],
    ["Lessons", lessonCount],
    ["Exercises", classes.filter((c) => c.klass.exercise).length],
  ] as const;

  return (
    <div className="space-y-8">
      {isDemo && <DemoBanner />}

      {hasUnapprovedDraft && (
        <Alert title="A newer draft is under review">
          You are reading the {course.approved_version ? "approved" : "current draft"} curriculum. The newer draft is not enrolled until you approve it.{" "}
          <Link to={`/app/courses/${course.id}/review`} className="font-medium underline">Review the draft</Link>
        </Alert>
      )}
      {!course.approved_version && !isDemo && (
        <Alert variant="warning" title="Draft preview">
          This curriculum is not approved yet. Review the draft and approve it to enroll.
        </Alert>
      )}

      <PageHeader
        eyebrow="Course"
        title={display.title}
        description={display.short_description}
        actions={
          <>
            {start && (
              <Link to={classPath(course.id, start.klass.id)} className={accentLink}>
                Start Class 01 <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
            <Link to={roadmapPath(course.id)} className={ghostLink}><MapIcon className="h-4 w-4" aria-hidden /> Roadmap</Link>
            <Link to={tutorPath(course.id)} className={ghostLink}><MessageSquare className="h-4 w-4" aria-hidden /> Ask tutor</Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {!isDemo && <VersionBadge version={display} />}
        {isDemo ? <Badge tone="warning">Demo</Badge> : <Badge tone={course.status === "approved" ? "lime" : "neutral"}>{course.status === "approved" ? "Enrolled" : course.status}</Badge>}
        <Badge tone="neutral">{display.target_learner_level}</Badge>
        <Badge tone="neutral">{formatMinutes(display.estimated_duration_minutes)} total</Badge>
        <Badge tone="neutral">{display.recommended_weekly_study_minutes} min/week suggested</Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-ink/10 bg-white/50 p-3">
            <dt className="text-xs text-ink/65">{label}</dt>
            <dd className="mt-1 font-mono text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      <Tabs
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="space-y-3">
                  <h2 className="text-xl font-semibold">What you will achieve</h2>
                  <p className="text-ink/80">{display.description}</p>
                  <p><strong>Outcome:</strong> {display.expected_outcome}</p>
                  <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink/60">Objectives</h3>
                  <BulletList items={display.objectives.map((o) => o.description)} />
                  <p className="text-sm text-ink/70"><strong>Method:</strong> {display.methodology}</p>
                </Card>
                <Card className="space-y-3">
                  <h2 className="text-xl font-semibold">Competencies</h2>
                  <ul className="space-y-2">
                    {display.target_competencies.map((c) => (
                      <li key={c.id} className="rounded-xl border border-ink/10 bg-white/60 p-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-sm text-ink/70">{c.description}</p>
                      </li>
                    ))}
                  </ul>
                  {display.prerequisites.length > 0 && (
                    <>
                      <h3 className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink/60">Prerequisites</h3>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-ink/80">
                        {display.prerequisites.map((p) => (
                          <li key={p.concept}><strong>{p.concept}</strong>: {p.reason}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
              </div>
            ),
          },
          {
            value: "curriculum",
            label: "Curriculum",
            content: (
              <div className="space-y-3">
                {display.modules.map((module, i) => (
                  <ModuleAccordion
                    key={module.id}
                    module={module}
                    moduleIndex={i}
                    courseId={course.id}
                    startIndex={classes.findIndex((c) => c.module.id === module.id)}
                    defaultOpen={i === 0}
                  />
                ))}
                <StatusNote />
              </div>
            ),
          },
          {
            value: "capstone",
            label: "Final project",
            content: (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="space-y-2">
                  <h2 className="text-xl font-semibold">{display.final_project.title}</h2>
                  <p className="text-ink/80">{display.final_project.description}</p>
                  <p><strong>Deliverable:</strong> {display.final_project.deliverable}</p>
                  <BulletList items={display.final_project.evaluation_criteria} />
                </Card>
                <Card className="space-y-2">
                  <h2 className="text-xl font-semibold">{display.final_assessment.title}</h2>
                  <p className="text-ink/80">{display.final_assessment.description}</p>
                  <p><strong>Format:</strong> {display.final_assessment.format}</p>
                  <BulletList items={display.final_assessment.passing_criteria} />
                </Card>
              </div>
            ),
          },
          {
            value: "notes",
            label: "Notes",
            content: (
              <div className="space-y-4">
                {!isDemo && <ProviderNotice metadata={display.generation_metadata} />}
                {display.assumptions.length > 0 && (
                  <Card><h2 className="font-semibold">Assumptions</h2><div className="mt-2"><BulletList items={display.assumptions} /></div></Card>
                )}
                {display.suggested_search_topics.length > 0 && (
                  <Card><h2 className="font-semibold">Suggested search topics</h2><p className="mt-1 text-sm text-ink/70">Starting points for your own research, not citations.</p><div className="mt-2"><BulletList items={display.suggested_search_topics} /></div></Card>
                )}
                {display.warnings.length > 0 && <Alert variant="warning" title="Generation notes">{display.warnings.join(" · ")}</Alert>}
                {!isDemo && (
                  <Link to={`/app/courses/${course.id}/review`} className={ghostLink}>
                    <RefreshCw className="h-4 w-4" aria-hidden /> {hasUnapprovedDraft || !course.approved_version ? "Review and approve draft" : "Create a new draft"}
                  </Link>
                )}
              </div>
            ),
          },
        ]}
      />

      <p className="text-sm text-ink/65">
        The curriculum, enrollment and version history are persisted. Lesson content is a blueprint outline for now, and progress tracking is planned.
      </p>
    </div>
  );
}
