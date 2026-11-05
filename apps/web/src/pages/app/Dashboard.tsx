import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Plus, Target } from "lucide-react";
import { Alert, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { Card, ContentGrid, SectionHeader, StatCard } from "../../components/ui/Layout";
import { useAuth } from "../../features/auth/context";
import { displayName, firstName } from "../../features/profile/api/profile";
import { useProfile } from "../../features/profile/hooks/useProfile";
import { messageForApiError } from "../../features/course/api/course";
import { useCourses, useLearningGoals } from "../../features/course/hooks/useCourse";
import { CourseCard, GoalStatusBadge } from "../../features/course/components/CourseBits";
import type { LearningGoal } from "../../features/course/schemas/course";

function goalAction(goal: LearningGoal): { label: string; to: string } {
  if (goal.status === "approved" && goal.course_id) {
    return { label: "Continue course", to: `/app/courses/${goal.course_id}` };
  }
  if (goal.status === "course_draft" && goal.course_id) {
    return { label: "Review draft", to: `/app/courses/${goal.course_id}/review` };
  }
  if (goal.status === "generating") {
    return { label: "View generation", to: `/app/goals/${goal.id}/generating` };
  }
  if (goal.status === "diagnostic_evaluated") {
    return { label: "See diagnostic result", to: `/app/goals/${goal.id}/result` };
  }
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
  const activeGoal = goals[0];
  const drafts = courses.filter((course) => course.has_draft).length;
  const approved = courses.filter((course) => course.status === "approved").length;
  const latestEnrolled = courses.find((course) => course.status === "approved");
  const action = activeGoal ? goalAction(activeGoal) : null;
  const loading = goalsQuery.isLoading || coursesQuery.isLoading;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            Welcome back, {firstName(name)}.
          </h1>
          <p className="mt-2 text-ink/65">Your goals, drafts and enrolled curricula.</p>
        </div>
        <Link
          to="/app/courses/new"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper"
        >
          <Plus className="h-4 w-4" /> New course
        </Link>
      </div>

      {(goalsQuery.error || coursesQuery.error) && (
        <Alert variant="error" title="Some dashboard data could not be loaded">
          {messageForApiError(goalsQuery.error ?? coursesQuery.error)}
        </Alert>
      )}

      {loading ? (
        <ContentGrid cols={4}>
          {[0, 1, 2, 3].map((index) => (
            <Card key={index} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-12" />
            </Card>
          ))}
        </ContentGrid>
      ) : (
        <ContentGrid cols={4}>
          <StatCard label="Learning goals" value={String(goals.length)} />
          <StatCard label="Courses" value={String(courses.length)} />
          <StatCard label="Enrolled" value={String(approved)} />
          <StatCard label="Drafts to review" value={String(drafts)} />
        </ContentGrid>
      )}

      {activeGoal && action ? (
        <Card className="flex flex-wrap items-center justify-between gap-6 bg-ink text-paper">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs text-paper/60">Most recent goal</p>
              <GoalStatusBadge status={activeGoal.status} />
            </div>
            <h2 className="mt-2 text-2xl font-semibold">{activeGoal.title}</h2>
            <p className="mt-1 text-paper/70">{activeGoal.goal_statement}</p>
            <p className="mt-2 text-sm text-paper/55">
              {activeGoal.weekly_study_minutes} minutes/week · {activeGoal.learning_language}
              {activeGoal.target_date ? ` · target ${activeGoal.target_date}` : ""}
            </p>
          </div>
          <Link
            to={action.to}
            className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 font-medium text-ink"
          >
            {action.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      ) : (
        <EmptyState
          title="Start with a learning goal"
          hint="Describe what you want to achieve. The AI Course Architect will run a short diagnostic and draft a curriculum for you to review."
          action={
            <Link
              to="/app/courses/new"
              className="rounded-full bg-lime px-5 py-2.5 font-medium text-ink"
            >
              Create a learning goal
            </Link>
          }
        />
      )}

      {goals.length > 0 && (
        <section className="space-y-4">
          <SectionHeader title="Your goal pipeline" description="Every goal, its real status, and the next action." />
          <div className="grid gap-3">
            {goals.slice(0, 5).map((goal) => {
              const next = goalAction(goal);
              return (
                <Card key={goal.id} className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Target className="mt-1 h-5 w-5 shrink-0 text-blue" aria-hidden />
                    <div>
                      <p className="font-medium">{goal.title}</p>
                      <p className="text-sm text-ink/60">{goal.goal_statement}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GoalStatusBadge status={goal.status} />
                    <Link to={next.to} className="rounded-full border border-ink/25 px-4 py-2 text-sm">
                      {next.label}
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <SectionHeader
          title="Courses"
          description={latestEnrolled ? "Open your enrolled curriculum or review a draft." : "Drafted curricula appear here."}
          action={
            courses.length > 0 ? (
              <Link to="/app/courses" className="text-sm font-medium underline">
                View all
              </Link>
            ) : undefined
          }
        />
        {loading ? (
          <ContentGrid cols={3}>
            {[0, 1, 2].map((index) => (
              <Card key={index} className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-16 w-full" />
              </Card>
            ))}
          </ContentGrid>
        ) : courses.length === 0 ? (
          <Card className="flex flex-wrap items-center gap-3">
            <BookOpen aria-hidden />
            <p className="text-sm text-ink/65">No courses yet. Complete a diagnostic to generate your first draft.</p>
          </Card>
        ) : (
          <ContentGrid cols={3}>
            {courses.slice(0, 3).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </ContentGrid>
        )}
      </section>

      <Card>
        <p className="text-sm text-ink/60">
          Dashboard counts come from the Core API. Lesson completion and study-time progress are
          not tracked in Phase 03, so no completion percentage is shown.
        </p>
      </Card>
    </div>
  );
}
