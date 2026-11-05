import { Link, useParams } from "react-router-dom";
import { ArrowRight, Clock, RefreshCw } from "lucide-react";
import { Alert, Badge } from "../../components/ui/Feedback";
import { Card } from "../../components/ui/Layout";
import { Breadcrumb } from "../../components/ui/Nav";
import { messageForApiError } from "../../features/course/api/course";
import { useCourse } from "../../features/course/hooks/useCourse";
import {
  CourseSkeleton,
  CourseStats,
  ProviderNotice,
  QueryFailure,
  VersionBadge,
} from "../../features/course/components/CourseBits";
import type {
  CourseClass,
  CourseModule,
  CourseVersion,
  Lesson,
} from "../../features/course/schemas/course";

function hours(minutes: number) {
  const value = Math.round((minutes / 60) * 10) / 10;
  return `${value}h`;
}

function TextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink/50">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/75">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function LessonPanel({ lesson, index }: { lesson: Lesson; index: number }) {
  const blueprint = lesson.blueprint;
  return (
    <details className="rounded-xl border border-ink/10 bg-white/50 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Lesson {index + 1}: {lesson.title}{" "}
        <span className="font-mono text-xs text-ink/45">· {hours(lesson.estimated_duration_minutes)}</span>
      </summary>
      <p className="mt-2 text-sm text-ink/65">{lesson.description}</p>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-ink/75">{blueprint.introduction}</p>
        <TextList title="Objectives" items={blueprint.objectives} />
        <TextList title="Prerequisite concepts" items={blueprint.prerequisite_concepts} />
        <TextList title="Concept outline" items={blueprint.concept_outline} />
        <TextList title="Analogies" items={blueprint.analogies} />
        <TextList title="Demonstration" items={blueprint.demonstration} />
        <TextList title="Guided practice" items={blueprint.guided_practice} />
        <TextList title="Independent practice" items={blueprint.independent_practice} />
        <TextList title="Knowledge check" items={blueprint.knowledge_check} />
        <p className="text-sm"><strong>Summary:</strong> {blueprint.summary}</p>
      </div>
    </details>
  );
}

function ClassPanel({ klass, index }: { klass: CourseClass; index: number }) {
  return (
    <details className="rounded-2xl border border-ink/15 bg-white/50 p-4">
      <summary className="cursor-pointer font-medium">
        Class {index + 1}: {klass.title}{" "}
        <span className="font-mono text-xs text-ink/45">· {hours(klass.estimated_duration_minutes)}</span>
      </summary>
      <div className="mt-3 space-y-4">
        <p className="text-sm text-ink/70">{klass.description}</p>
        <TextList title="Objectives" items={klass.objectives.map((objective) => objective.description)} />
        <TextList title="Key concepts" items={klass.key_concepts} />
        {klass.prerequisites.length > 0 && (
          <p className="text-sm text-ink/60">
            Builds on: {klass.prerequisites.map((item) => item.title).join(", ")}
          </p>
        )}

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Lessons</h4>
          {klass.lessons.map((lesson, lessonIndex) => (
            <LessonPanel key={lesson.id} lesson={lesson} index={lessonIndex} />
          ))}
        </div>

        {klass.exercise && (
          <div className="rounded-xl border border-blue/30 bg-blue/5 p-3">
            <h4 className="font-medium">{klass.exercise.title}</h4>
            <p className="mt-1 text-sm text-ink/70">{klass.exercise.description}</p>
            <TextList title="Instructions" items={klass.exercise.instructions} />
            <p className="mt-2 text-sm"><strong>Deliverable:</strong> {klass.exercise.expected_deliverable}</p>
            <TextList title="Evaluation criteria" items={klass.exercise.evaluation_criteria} />
          </div>
        )}

        <div className="rounded-xl border border-ink/10 bg-white/70 p-3">
          <h4 className="font-medium">Knowledge check</h4>
          <p className="text-sm text-ink/70">{klass.knowledge_check.description}</p>
          <p className="mt-1 text-sm text-ink/60">
            {klass.knowledge_check.question_count} questions ·{" "}
            {klass.knowledge_check.competencies.join(", ")}
          </p>
        </div>
      </div>
    </details>
  );
}

function ModulePanel({ module, index }: { module: CourseModule; index: number }) {
  return (
    <section className="rounded-2xl border border-ink/15 bg-white/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-ink/45">Module {index + 1}</p>
          <h3 className="mt-1 text-xl font-semibold">{module.title}</h3>
        </div>
        <Badge tone="neutral">
          <Clock className="mr-1 inline h-3 w-3" />
          {hours(module.estimated_duration_minutes)}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-ink/70">{module.description}</p>
      <TextList title="Skills" items={module.skills} />
      <TextList title="Objectives" items={module.objectives.map((objective) => objective.description)} />
      {module.required_previous_modules.length > 0 && (
        <p className="mt-2 text-sm text-ink/60">
          Requires: {module.required_previous_modules.map((item) => item.title).join(", ")}
        </p>
      )}
      <div className="mt-4 space-y-2">
        {module.classes.map((klass, classIndex) => (
          <ClassPanel key={klass.id} klass={klass} index={classIndex} />
        ))}
      </div>
    </section>
  );
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const courseQuery = useCourse(courseId);

  if (courseQuery.isLoading) return <CourseSkeleton />;
  if (courseQuery.error) {
    return (
      <QueryFailure
        title="Could not load the course"
        message={messageForApiError(courseQuery.error)}
        onRetry={() => void courseQuery.refetch()}
      />
    );
  }
  const course = courseQuery.data;
  if (!course) {
    return <QueryFailure title="Course not found" message="This course does not exist or is not yours." />;
  }

  const display = course.approved_version ?? course.version;
  if (!display) {
    return <QueryFailure title="No curriculum yet" message="This course has no generated version." />;
  }
  const hasUnapprovedDraft = Boolean(
    course.version &&
      course.version.status === "draft" &&
      course.version.id !== course.approved_version?.id,
  );

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[{ label: "Courses", to: "/app/courses" }, { label: display.title }]}
      />

      {hasUnapprovedDraft && (
        <Alert title="A newer draft is under review">
          You are reading the {course.approved_version ? "approved" : "current draft"} curriculum.
          The newer draft is not enrolled until you approve it.{" "}
          <Link to={`/app/courses/${course.id}/review`} className="font-medium underline">
            Review the draft
          </Link>
        </Alert>
      )}

      {!course.approved_version && (
        <Alert variant="warning" title="Draft preview">
          This curriculum is not approved yet. Review the draft and approve it to enroll.
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <VersionBadge version={course.approved_version ?? course.version} />
            <Badge tone={course.status === "approved" ? "lime" : "neutral"}>{course.status}</Badge>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{display.title}</h1>
          <p className="mt-2 max-w-2xl text-ink/65">{display.short_description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasUnapprovedDraft || !course.approved_version ? (
            <Link
              to={`/app/courses/${course.id}/review`}
              className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-medium text-ink"
            >
              Review and approve <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              to={`/app/courses/${course.id}/review`}
              className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-5 py-2.5 font-medium"
            >
              <RefreshCw className="h-4 w-4" /> Create a new draft
            </Link>
          )}
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink/60">
            {hours(display.estimated_duration_minutes)} total · {display.recommended_weekly_study_minutes}{" "}
            min/week · {display.target_learner_level}
          </p>
          <CourseStats course={{ ...course, counts: countsForVersion(display) }} />
        </div>
        <ProviderNotice metadata={display.generation_metadata} />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">What you will learn</h2>
          <p className="mt-2 text-sm text-ink/70">{display.description}</p>
          <p className="mt-3 text-sm"><strong>Outcome:</strong> {display.expected_outcome}</p>
          <p className="mt-2 text-sm text-ink/70"><strong>Method:</strong> {display.methodology}</p>
          <TextList
            title="Objectives"
            items={display.objectives.map((objective) => objective.description)}
          />
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">Competencies</h2>
          <ul className="mt-2 space-y-2">
            {display.target_competencies.map((competency) => (
              <li key={competency.id} className="rounded-xl border border-ink/10 bg-white/50 p-3">
                <p className="font-medium">{competency.name}</p>
                <p className="text-sm text-ink/65">{competency.description}</p>
              </li>
            ))}
          </ul>
          {display.prerequisites.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-ink/50">Prerequisites</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink/75">
                {display.prerequisites.map((item) => (
                  <li key={item.concept}>
                    <strong>{item.concept}</strong>: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Curriculum</h2>
        {display.modules.map((module, index) => (
          <ModulePanel key={module.id} module={module} index={index} />
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold">Final project</h2>
          <p className="mt-1 font-medium">{display.final_project.title}</p>
          <p className="mt-1 text-sm text-ink/70">{display.final_project.description}</p>
          <TextList title="Deliverable" items={[display.final_project.deliverable]} />
          <TextList title="Evaluation criteria" items={display.final_project.evaluation_criteria} />
        </Card>
        <Card>
          <h2 className="text-xl font-semibold">Final assessment</h2>
          <p className="mt-1 font-medium">{display.final_assessment.title}</p>
          <p className="mt-1 text-sm text-ink/70">{display.final_assessment.description}</p>
          <p className="mt-2 text-sm"><strong>Format:</strong> {display.final_assessment.format}</p>
          <TextList title="Passing criteria" items={display.final_assessment.passing_criteria} />
        </Card>
      </div>

      {(display.assumptions.length > 0 || display.suggested_search_topics.length > 0) && (
        <Card className="grid gap-4 md:grid-cols-2">
          <TextList title="Assumptions" items={display.assumptions} />
          <TextList title="Suggested search topics" items={display.suggested_search_topics} />
        </Card>
      )}

      {display.warnings.length > 0 && (
        <Alert variant="warning" title="Generation notes">
          {display.warnings.join(" · ")}
        </Alert>
      )}

      <p className="text-sm text-ink/55">
        Lesson playback and per-lesson progress are not part of Phase 03. The curriculum,
        enrollment and version history are real and persisted.
      </p>
    </div>
  );
}

function countsForVersion(version: CourseVersion) {
  let classes = 0;
  let lessons = 0;
  let exercises = 0;
  for (const module of version.modules) {
    classes += module.classes.length;
    for (const klass of module.classes) {
      lessons += klass.lessons.length;
      if (klass.exercise) exercises += 1;
    }
  }
  return {
    modules: version.modules.length,
    classes,
    lessons,
    exercises,
  };
}
