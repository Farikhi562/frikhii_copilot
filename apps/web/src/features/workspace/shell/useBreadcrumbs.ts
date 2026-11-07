import { matchPath, useLocation } from "react-router-dom";
import { displayVersion, flattenClasses, flattenLessons, useCourseView } from "../courseView";

export type Crumb = { label: string; to?: string };

const LEARNING: Crumb = { label: "My Learning", to: "/app/courses" };

/** Derives breadcrumbs from the URL, using real (or demo) course data for titles. */
export function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const course =
    matchPath("/app/courses/:courseId/*", pathname) ?? matchPath("/app/courses/:courseId", pathname);
  const rawId = course?.params.courseId;
  const courseId = rawId && rawId !== "new" ? rawId : undefined;
  const view = useCourseView(courseId);
  const version = view.course ? displayVersion(view.course) : null;
  const title = version?.title ?? "Course";

  if (pathname === "/app" || pathname === "/app/") return [{ label: "Overview" }];
  if (pathname.startsWith("/app/tutor")) return [{ label: "AI Tutor" }];
  if (pathname.startsWith("/app/progress")) return [{ label: "Learning Progress" }];
  if (pathname.startsWith("/app/settings")) return [{ label: "Settings" }];
  if (pathname.startsWith("/app/help")) return [{ label: "Help & Support" }];
  if (pathname.startsWith("/app/goals") || pathname.startsWith("/app/courses/new")) {
    return [LEARNING, { label: "Course Architect" }];
  }
  if (pathname === "/app/courses") return [{ label: "My Learning" }];
  if (!courseId) return [{ label: "Overview" }];

  const base: Crumb[] = [LEARNING, { label: title, to: `/app/courses/${courseId}` }];
  if (pathname.endsWith("/review")) return [...base.slice(0, 2), { label: "Review draft" }];
  if (pathname.endsWith("/roadmap")) return [...base, { label: "Roadmap" }];

  const classMatch = matchPath("/app/courses/:courseId/classes/:classId", pathname);
  if (classMatch && version) {
    const flat = flattenClasses(version).find((f) => f.klass.id === classMatch.params.classId);
    return [...base, { label: flat?.klass.title ?? "Class" }];
  }
  const lessonMatch = matchPath("/app/courses/:courseId/lessons/:lessonId", pathname);
  if (lessonMatch && version) {
    const found = flattenLessons(version).find((l) => l.lesson.id === lessonMatch.params.lessonId);
    if (found) {
      return [
        ...base,
        { label: found.flat.klass.title, to: `/app/courses/${courseId}/classes/${found.flat.klass.id}` },
        { label: found.lesson.title },
      ];
    }
    return [...base, { label: "Lesson" }];
  }
  return base;
}
