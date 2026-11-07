import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Alert, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { Card, ContentGrid } from "../../components/ui/Layout";
import { cn } from "../../lib/cn";
import { messageForApiError } from "../../features/course/api/course";
import { useCourses } from "../../features/course/hooks/useCourse";
import { CourseCard, QueryFailure } from "../../features/course/components/CourseBits";
import { accentLink, ghostLink, PageHeader, primaryLink } from "../../features/workspace/components/WorkspaceBits";

const filters = [
  { id: "all", label: "All" },
  { id: "enrolled", label: "Enrolled" },
  { id: "draft", label: "Draft review" },
] as const;
type FilterId = (typeof filters)[number]["id"];

export default function Courses() {
  const coursesQuery = useCourses();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (filter === "enrolled" && c.status !== "approved") return false;
      if (filter === "draft" && !c.has_draft && c.version_status !== "draft") return false;
      if (!q) return true;
      return `${c.title} ${c.short_description}`.toLowerCase().includes(q);
    });
  }, [courses, query, filter]);

  const counts: Record<FilterId, number> = {
    all: courses.length,
    enrolled: courses.filter((c) => c.status === "approved").length,
    draft: courses.filter((c) => c.has_draft || c.version_status === "draft").length,
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Library"
        title="My Learning"
        description="Personalized curricula generated from your learning goals."
        actions={
          <Link to="/app/courses/new" className={primaryLink}>
            <Plus className="h-4 w-4" aria-hidden /> Create Course
          </Link>
        }
      />

      {courses.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-ink/25 bg-white/60 px-4 py-2 sm:max-w-sm">
            <Search className="h-4 w-4 shrink-0 text-ink/60" aria-hidden />
            <span className="sr-only">Search courses</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your courses"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium",
                  filter === f.id ? "border-ink bg-ink text-paper" : "border-ink/25 hover:bg-ink/5",
                )}
              >
                {f.label} <span className="font-mono text-xs opacity-70">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {coursesQuery.isLoading ? (
        <ContentGrid cols={3}>
          {[0, 1, 2].map((i) => (
            <Card key={i} className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </ContentGrid>
      ) : coursesQuery.error ? (
        <QueryFailure
          title="Could not load your courses"
          message={messageForApiError(coursesQuery.error)}
          onRetry={() => void coursesQuery.refetch()}
        />
      ) : courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          hint="Describe a learning goal and the AI Course Architect will draft a curriculum. You review and approve it before enrollment."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/app/courses/new" className={accentLink}>Create your first course</Link>
              <Link to="/app/courses/demo" className={ghostLink}>Explore the demo course</Link>
            </div>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matching courses"
          hint="Try a different search or filter."
          action={
            <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className={ghostLink}>
              Clear search and filters
            </button>
          }
        />
      ) : (
        <>
          {counts.draft > 0 && filter === "all" && !query && (
            <Alert title="You have drafts waiting">
              Drafts are not enrolled until you approve them. An approved older version stays live while a newer draft is under review.
            </Alert>
          )}
          <p className="sr-only" role="status">{visible.length} {visible.length === 1 ? "course" : "courses"} shown</p>
          <ContentGrid cols={3}>
            {visible.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </ContentGrid>
        </>
      )}

      <p className="text-sm text-ink/65">
        Completion progress and last-activity times appear here once lesson progress is tracked (planned). Course content and versions are stored by the Core API.
      </p>
    </div>
  );
}
