import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, CalendarDays, CheckCircle2, Target } from "lucide-react";
import { Alert, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { Card, ContentGrid, SectionHeader, StatCard } from "../../components/ui/Layout";
import { getCourse, messageForApiError } from "../../features/course/api/course";
import { courseKeys } from "../../features/course/api/keys";
import { useCourses, useLearningGoals } from "../../features/course/hooks/useCourse";
import { accentLink, PageHeader } from "../../features/workspace/components/WorkspaceBits";
import { formatMinutes } from "../../features/workspace/courseView";
import { deriveHistory, deriveTargetedCompetencies } from "../../features/workspace/progress/derive";

export default function Progress() {
  const goalsQuery = useLearningGoals();
  const coursesQuery = useCourses();
  const courses = coursesQuery.data ?? [];
  const goals = goalsQuery.data ?? [];
  const enrolled = courses.filter((c) => c.status === "approved");

  const detailQueries = useQueries({
    queries: enrolled.slice(0, 6).map((c) => ({
      queryKey: courseKeys.course(c.id),
      queryFn: () => getCourse(c.id),
      staleTime: 10_000,
    })),
  });
  const details = detailQueries.flatMap((q) => (q.data ? [q.data] : []));
  const competencies = deriveTargetedCompetencies(details);
  const history = deriveHistory(goals, courses);
  const loading = goalsQuery.isLoading || coursesQuery.isLoading;
  const error = goalsQuery.error ?? coursesQuery.error;

  const classes = enrolled.reduce((n, c) => n + c.counts.classes, 0);
  const lessons = enrolled.reduce((n, c) => n + c.counts.lessons, 0);
  const minutes = enrolled.reduce((n, c) => n + c.estimated_duration_minutes, 0);

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Learning Progress"
        title="Learning progress"
        description="What FRIKHII can truthfully show today, and what it will track once you start learning."
      />

      {error && <Alert variant="error" title="Could not load your data">{messageForApiError(error)}</Alert>}

      <section>
        <SectionHeader title="Overall progress" description="Your plan, from saved courses." />
        {loading ? (
          <ContentGrid cols={4}>{[0, 1, 2, 3].map((i) => <Card key={i}><Skeleton className="h-4 w-20" /><Skeleton className="mt-2 h-9 w-12" /></Card>)}</ContentGrid>
        ) : enrolled.length === 0 ? (
          <EmptyState
            title="No enrolled courses yet"
            hint="Approve a course to see its plan here. Completion percentages will appear once lesson progress is tracked."
            action={<Link to="/app/courses/new" className={accentLink}>Create a course</Link>}
          />
        ) : (
          <ContentGrid cols={4}>
            <StatCard label="Enrolled courses" value={String(enrolled.length)} />
            <StatCard label="Classes planned" value={String(classes)} />
            <StatCard label="Lessons planned" value={String(lessons)} />
            <StatCard label="Estimated study time" value={formatMinutes(minutes)} />
          </ContentGrid>
        )}
        <p className="mt-3 text-sm text-ink/65">These are plan figures, not completion. Lesson completion is not tracked yet (planned).</p>
      </section>

      <section>
        <SectionHeader title="Competency tracking" description="Competencies your enrolled courses aim to develop." />
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-3 lg:col-span-1">
            <h3 className="flex items-center gap-2 font-semibold"><Target className="h-4 w-4" aria-hidden /> Targeted</h3>
            {competencies.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {competencies.map((c) => (
                  <li key={c.id}><span className="font-medium">{c.name}</span><span className="block text-ink/70">{c.description}</span><span className="block font-mono text-xs text-ink/60">{c.course}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink/70">Targeted competencies appear once you enroll in a course.</p>}
          </Card>
          <Card className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" aria-hidden /> Developed</h3>
            <p className="text-sm text-ink/70">Nothing recorded yet. A competency is shown here only after assessed practice supports it, which is planned.</p>
          </Card>
          <Card className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4" aria-hidden /> Needs more practice</h3>
            <p className="text-sm text-ink/70">Once knowledge checks exist, weaker areas are listed here from your actual results.</p>
          </Card>
        </div>
      </section>

      <section>
        <SectionHeader title="Study consistency" description="Sessions, weekly activity and lessons completed over time." />
        <EmptyState
          title="No study activity recorded"
          hint="When lesson progress ships, weekly study time and lessons completed will be charted here from your real activity. No sample chart or streak is shown in the meantime."
        />
      </section>

      <section>
        <SectionHeader title="Learning history" description="Real events from your account." />
        {history.length === 0 ? (
          <EmptyState title="Nothing here yet" hint="Create a learning goal and its history starts appearing." />
        ) : (
          <ol className="divide-y divide-ink/10 rounded-2xl border border-ink/15 bg-white/50">
            {history.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-ink/60" aria-hidden />{e.text}</span>
                <time dateTime={e.at} className="font-mono text-xs text-ink/65">
                  {new Date(e.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </time>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-sm text-ink/65">Only setup events are recorded today. Lesson activity will be added with progress tracking.</p>
      </section>
    </div>
  );
}
