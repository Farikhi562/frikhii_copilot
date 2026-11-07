import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, BookOpen, Compass, MessageSquare, Plus, Target } from "lucide-react";
import { Alert, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { Card, ContentGrid, SectionHeader, StatCard } from "../../components/ui/Layout";
import { useAuth } from "../../features/auth/context";
import { displayName, firstName } from "../../features/profile/api/profile";
import { useProfile } from "../../features/profile/hooks/useProfile";
import { messageForApiError } from "../../features/course/api/course";
import { useCourse, useCourses, useLearningGoals } from "../../features/course/hooks/useCourse";
import { CourseCard, GoalStatusBadge } from "../../features/course/components/CourseBits";
import type { LearningGoal } from "../../features/course/schemas/course";
import { accentLink, ghostLink, PageHeader, primaryLink } from "../../features/workspace/components/WorkspaceBits";
import {
  classPath,
  coursePath,
  displayVersion,
  flattenClasses,
  formatMinutes,
  greeting,
  lessonPath,
  roadmapPath,
} from "../../features/workspace/courseView";

function goalAction(goal: LearningGoal): { label: string; to: string } {
  if (goal.status === "approved" && goal.course_id) return { label: "Open course", to: `/app/courses/${goal.course_id}` };
  if (goal.status === "course_draft" && goal.course_id) return { label: "Review draft", to: `/app/courses/${goal.course_id}/review` };
  if (goal.status === "generating") return { label: "View generation", to: `/app/goals/${goal.id}/generating` };
  if (goal.status === "diagnostic_evaluated") return { label: "See diagnostic result", to: `/app/goals/${goal.id}/result` };
  if (goal.status === "failed") {
    return goal.course_id
      ? { label: "Retry generation", to: `/app/goals/${goal.id}/generating` }
      : { label: "Retry diagnostic", to: `/app/goals/${goal.id}/diagnostic` };
  }
  return { label: "Open diagnostic", to: `/app/goals/${goal.id}/diagnostic` };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user);
  const goalsQuery = useLearningGoals();
  const coursesQuery = useCourses();
  const name = displayName(profile, user);

  const goals = goalsQuery.data ?? [];
  const courses = coursesQuery.data ?? [];
  const enrolled = courses.filter((c) => c.status === "approved");
  const drafts = courses.filter((c) => c.has_draft);
  const active = enrolled[0];
  const detail = useCourse(active?.id);
  const version = detail.data ? displayVersion(detail.data) : null;
  const firstClass = version ? flattenClasses(version)[0] : undefined;
  const firstLesson = firstClass?.klass.lessons[0];
  const pendingGoals = goals.filter((g) => g.status !== "approved").slice(0, 3);
  const loading = goalsQuery.isLoading || coursesQuery.isLoading;
  const loadError = goalsQuery.error ?? coursesQuery.error;

  const totalClasses = enrolled.reduce((n, c) => n + c.counts.classes, 0);
  const totalMinutes = enrolled.reduce((n, c) => n + c.estimated_duration_minutes, 0);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Overview"
        title={`${greeting()}, ${firstName(name)}.`}
        description="Every skill begins with a decision to learn. Let's make today's progress count."
        actions={
          <Link to="/app/courses/new" className={primaryLink}>
            <Plus className="h-4 w-4" aria-hidden /> New course
          </Link>
        }
      />

      {loadError && (
        <Alert variant="error" title="Some dashboard data could not be loaded">
          {messageForApiError(loadError)}
        </Alert>
      )}

      {/* Continue learning */}
      <section aria-labelledby="continue-heading">
        <h2 id="continue-heading" className="sr-only">Continue learning</h2>
        {loading ? (
          <Card className="space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-9 w-2/3" /><Skeleton className="h-16 w-full" /></Card>
        ) : active ? (
          <div className="rounded-3xl bg-ink p-6 text-paper md:p-8">
            <p className="font-mono text-xs text-paper/70">Continue learning</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{active.title}</h3>
            <p className="mt-2 max-w-2xl text-paper/80">{active.short_description}</p>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-mono text-xs text-paper/65">Current module</dt>
                <dd className="mt-0.5">{firstClass ? `Module ${firstClass.moduleIndex + 1} · ${firstClass.module.title}` : detail.isLoading ? "Loading…" : "—"}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-paper/65">Current class</dt>
                <dd className="mt-0.5">{firstClass ? `Class ${firstClass.index + 1} · ${firstClass.klass.title}` : detail.isLoading ? "Loading…" : "—"}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to={firstClass ? classPath(active.id, firstClass.klass.id) : coursePath(active.id)} className={accentLink}>
                Continue learning <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to={roadmapPath(active.id)} className="rounded-full border border-paper/40 px-5 py-2.5 font-medium hover:bg-paper/10">
                View roadmap
              </Link>
            </div>
            <p className="mt-4 font-mono text-xs text-paper/65">
              Lesson progress is not tracked yet, so no completion percentage is shown. Your starting point is the first class.
            </p>
          </div>
        ) : drafts[0] ? (
          <EmptyState
            title="Your course draft is ready to review"
            hint={`"${drafts[0].title}" is not enrolled until you approve it.`}
            action={<Link to={`/app/courses/${drafts[0].id}/review`} className={accentLink}>Review draft</Link>}
          />
        ) : (
          <EmptyState
            title="Start with an ambition"
            hint="Describe what you want to learn. The Course Architect runs a short diagnostic and drafts a curriculum for you to review."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/app/courses/new" className={accentLink}>Create your first course</Link>
                <Link to="/app/courses/demo" className={ghostLink}>Explore the demo course</Link>
              </div>
            }
          />
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Today's focus */}
        <section>
          <SectionHeader title="Today's learning focus" description="Suggested from your actual course, not a schedule." />
          <Card className="space-y-3">
            {active && firstClass ? (
              <>
                <p className="font-medium">
                  Start Class {firstClass.index + 1}: {firstClass.klass.title}
                </p>
                <p className="text-sm text-ink/70">
                  {firstClass.klass.lessons.length} lessons · about {formatMinutes(firstClass.klass.estimated_duration_minutes)} of study.
                </p>
                <div className="flex flex-wrap gap-2">
                  {firstLesson && (
                    <Link to={lessonPath(active.id, firstLesson.id)} className={ghostLink}>
                      Open first lesson
                    </Link>
                  )}
                  <Link to={classPath(active.id, firstClass.klass.id)} className={ghostLink}>Class overview</Link>
                </div>
              </>
            ) : pendingGoals[0] ? (
              <>
                <p className="font-medium">Next step for &ldquo;{pendingGoals[0].title}&rdquo;</p>
                <Link to={goalAction(pendingGoals[0]).to} className={ghostLink}>{goalAction(pendingGoals[0]).label}</Link>
              </>
            ) : (
              <p className="text-sm text-ink/70">Nothing suggested yet. Once you approve a course, your next class appears here.</p>
            )}
          </Card>
        </section>

        {/* Quick actions */}
        <section>
          <SectionHeader title="Quick actions" />
          <ul className="grid gap-3">
            {[
              { to: "/app/courses/new", label: "Create a Course", icon: Compass },
              { to: "/app/tutor", label: "Ask AI Tutor", icon: MessageSquare },
              { to: "/app/progress", label: "View Learning Progress", icon: BarChart3 },
            ].map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link to={to} className="flex items-center justify-between rounded-2xl border border-ink/15 bg-white/50 px-4 py-3 font-medium hover:border-ink/40">
                  <span className="flex items-center gap-3"><Icon className="h-4 w-4" aria-hidden /> {label}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* My learning */}
      <section>
        <SectionHeader
          title="My Learning"
          description={courses.length ? "Your courses and drafts." : "Courses you create appear here."}
          action={courses.length > 0 ? <Link to="/app/courses" className="text-sm font-medium underline">View all</Link> : undefined}
        />
        {loading ? (
          <ContentGrid cols={3}>{[0, 1, 2].map((i) => <Card key={i} className="space-y-3"><Skeleton className="h-5 w-24" /><Skeleton className="h-7 w-full" /><Skeleton className="h-16 w-full" /></Card>)}</ContentGrid>
        ) : courses.length === 0 ? (
          <Card className="flex flex-wrap items-center gap-3"><BookOpen aria-hidden /><p className="text-sm text-ink/70">No courses yet. Complete a diagnostic to generate your first draft.</p></Card>
        ) : (
          <ContentGrid cols={3}>{courses.slice(0, 3).map((c) => <CourseCard key={c.id} course={c} />)}</ContentGrid>
        )}
      </section>

      {/* Learning insights */}
      <section>
        <SectionHeader title="Learning insights" description="Only figures that come from your saved courses." />
        {enrolled.length > 0 ? (
          <ContentGrid cols={4}>
            <StatCard label="Enrolled courses" value={String(enrolled.length)} />
            <StatCard label="Classes planned" value={String(totalClasses)} />
            <StatCard label="Estimated study time" value={formatMinutes(totalMinutes)} />
            <Card>
              <p className="text-sm text-ink/70">Study time, lessons completed and active days</p>
              <p className="mt-1 font-medium">Not tracked yet</p>
              <p className="mt-1 text-xs text-ink/65">These appear once lesson progress is available (planned).</p>
            </Card>
          </ContentGrid>
        ) : (
          <EmptyState title="No insights yet" hint="Approve a course and your plan figures appear here. Study activity will be added once progress tracking ships." />
        )}
      </section>

      {pendingGoals.length > 0 && (
        <section>
          <SectionHeader title="Goals in progress" description="Goals that still need a step from you." />
          <div className="grid gap-3">
            {pendingGoals.map((goal) => {
              const next = goalAction(goal);
              return (
                <Card key={goal.id} className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Target className="mt-1 h-5 w-5 shrink-0 text-blue" aria-hidden />
                    <div><p className="font-medium">{goal.title}</p><p className="text-sm text-ink/70">{goal.goal_statement}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GoalStatusBadge status={goal.status} />
                    <Link to={next.to} className="rounded-full border border-ink/25 px-4 py-2 text-sm">{next.label}</Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
