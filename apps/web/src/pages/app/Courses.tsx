import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Alert, EmptyState, Skeleton } from "../../components/ui/Feedback";
import { Card, ContentGrid, SectionHeader } from "../../components/ui/Layout";
import { messageForApiError } from "../../features/course/api/course";
import { useCourses } from "../../features/course/hooks/useCourse";
import { CourseCard, QueryFailure } from "../../features/course/components/CourseBits";

export default function Courses() {
  const coursesQuery = useCourses();
  const courses = coursesQuery.data ?? [];
  const drafts = courses.filter((course) => course.has_draft).length;
  const approved = courses.filter((course) => course.status === "approved").length;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="My courses"
        description="Personalized curricula generated from your learning goals."
        action={
          <Link
            to="/app/courses/new"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-medium text-paper"
          >
            <Plus className="h-4 w-4" /> New course
          </Link>
        }
      />

      {coursesQuery.isLoading ? (
        <ContentGrid cols={3}>
          {[0, 1, 2].map((index) => (
            <Card key={index} className="space-y-3">
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
            <Link
              to="/app/courses/new"
              className="rounded-full bg-lime px-5 py-2.5 font-medium text-ink"
            >
              Create your first course
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Summary label="Courses" value={courses.length} />
            <Summary label="Enrolled" value={approved} />
            <Summary label="Drafts to review" value={drafts} />
          </div>
          {drafts > 0 && (
            <Alert title="You have drafts waiting">
              Drafts are not enrolled until you approve them. An approved older version stays live
              while a newer draft is under review.
            </Alert>
          )}
          <ContentGrid cols={3}>
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </ContentGrid>
        </>
      )}

      <p className="text-sm text-ink/55">
        Course content and versions are stored by the Core API. Lesson playback and progress
        tracking are outside Phase 03.
      </p>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm text-ink/65">{label}</p>
      <p className="mt-1 font-mono text-3xl">{value}</p>
    </Card>
  );
}
