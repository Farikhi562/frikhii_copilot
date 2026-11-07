import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Lightbulb } from "lucide-react";
import { Alert, Badge, Skeleton } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Layout";
import { Breadcrumb } from "../../components/ui/Nav";
import { toast } from "../../components/ui/Toast";
import { messageForApiError } from "../../features/course/api/course";
import { QueryFailure } from "../../features/course/components/CourseBits";
import { useCompleteLesson, useLesson, useRoadmap } from "../../features/course/hooks/useCourse";

const sectionLabel: Record<string, string> = {
  introduction: "Introduction",
  objective: "Objectives",
  concept: "Concept",
  analogy: "Analogy",
  demonstration: "Demonstration",
  guided_practice: "Guided practice",
  independent_practice: "Independent practice",
  knowledge_check: "Knowledge check",
  summary: "Summary",
};

export default function LessonWorkspace() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const lessonQuery = useLesson(courseId, lessonId);
  const roadmapQuery = useRoadmap(courseId);
  const completeLesson = useCompleteLesson(courseId ?? "");

  if (lessonQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading lesson">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (lessonQuery.error) {
    return (
      <QueryFailure
        title="Could not load the lesson"
        message={messageForApiError(lessonQuery.error)}
        onRetry={() => void lessonQuery.refetch()}
      />
    );
  }
  const data = lessonQuery.data;
  if (!data) {
    return <QueryFailure title="Lesson not found" message="This lesson is not available." />;
  }

  const roadmap = roadmapQuery.data;
  let currentStatus = "available";
  let classTitle = "";
  if (roadmap) {
    for (const module of roadmap.modules) {
      for (const klass of module.classes) {
        for (const lesson of klass.lessons) {
          if (lesson.id === data.lesson.id) {
            currentStatus = lesson.status;
            classTitle = klass.title;
          }
        }
      }
    }
  }
  const authored = data.authored;
  const completed = currentStatus === "completed";

  async function handleComplete() {
    if (!courseId || !lessonId) return;
    try {
      await completeLesson.mutateAsync(lessonId);
      toast("Lesson marked complete.");
      navigate(`/app/courses/${courseId}/learn`);
    } catch (error) {
      toast(messageForApiError(error));
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Courses", to: "/app/courses" },
          { label: "Learning path", to: `/app/courses/${courseId}/learn` },
          { label: data.lesson.title },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-ink/45">
            {classTitle || "Lesson"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{data.lesson.title}</h1>
          <p className="mt-2 max-w-3xl text-ink/65">{data.lesson.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink/55">
            <Clock className="h-4 w-4" aria-hidden />
            {data.lesson.estimated_duration_minutes} min
            {completed && (
              <Badge tone="lime">
                <CheckCircle2 className="mr-1 inline h-3 w-3" aria-hidden /> Completed
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/app/courses/${courseId}/learn`}
            className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-4 py-2 text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Learning path
          </Link>
          {!completed && (
            <Button loading={completeLesson.isPending} onClick={() => void handleComplete()}>
              Mark complete <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {data.generationError && (
        <Alert variant="warning" title="The authored lesson could not be generated">
          The lesson outline is still available below. {data.generationError}
        </Alert>
      )}

      {!authored ? (
        <Card>
          <h2 className="text-xl font-semibold">Lesson outline</h2>
          <p className="mt-2 text-sm text-ink/65">
            The expanded lesson is not available yet. Return to the learning path and try again.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {authored.sections.map((section, index) => (
            <Card key={`${section.type}-${index}`} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-wide text-ink/45">
                  {sectionLabel[section.type] ?? section.type.replaceAll("_", " ")}
                </p>
                <span className="font-mono text-xs text-ink/35">{index + 1}</span>
              </div>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="whitespace-pre-wrap text-ink/75">{section.body}</p>
              {section.items.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}

          {authored.key_takeaways.length > 0 && (
            <Card className="border-lime/60 bg-lime/10">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Lightbulb className="h-5 w-5" aria-hidden /> Key takeaways
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/75">
                {authored.key_takeaways.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </Card>
          )}

          {authored.further_search_topics.length > 0 && (
            <p className="text-sm text-ink/55">
              Further search topics: {authored.further_search_topics.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
