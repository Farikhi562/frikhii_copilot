import { useCourse } from "../course/hooks/useCourse";
import type {
  CourseClass,
  CourseDetail,
  CourseModule,
  CourseVersion,
  Lesson,
} from "../course/schemas/course";
import { demoCourse, DEMO_COURSE_ID } from "./demo/demoCourse";

export { DEMO_COURSE_ID };

/**
 * Course source for workspace pages. The id "demo" resolves to a clearly labelled,
 * client-only sample (never stored). Any other id is a real course from the Core API.
 */
export function useCourseView(courseId: string | undefined) {
  const isDemo = courseId === DEMO_COURSE_ID;
  const query = useCourse(isDemo ? undefined : courseId);
  const course: CourseDetail | null = isDemo ? demoCourse : (query.data ?? null);
  return {
    isDemo,
    course,
    isLoading: !isDemo && query.isLoading,
    error: isDemo ? null : query.error,
    refetch: query.refetch,
  };
}

/** The approved curriculum if there is one, otherwise the current draft. */
export function displayVersion(course: CourseDetail): CourseVersion | null {
  return course.approved_version ?? course.version ?? null;
}

export type FlatClass = {
  klass: CourseClass;
  module: CourseModule;
  moduleIndex: number;
  /** 0-based position across the whole course. */
  index: number;
};

export function flattenClasses(version: CourseVersion): FlatClass[] {
  const out: FlatClass[] = [];
  version.modules.forEach((module, moduleIndex) => {
    module.classes.forEach((klass) => out.push({ klass, module, moduleIndex, index: out.length }));
  });
  return out;
}

export type FlatLesson = { lesson: Lesson; flat: FlatClass; lessonIndex: number; index: number };

export function flattenLessons(version: CourseVersion): FlatLesson[] {
  const out: FlatLesson[] = [];
  for (const flat of flattenClasses(version)) {
    flat.klass.lessons.forEach((lesson, lessonIndex) =>
      out.push({ lesson, flat, lessonIndex, index: out.length }),
    );
  }
  return out;
}

/**
 * Course order only. Lesson completion is not tracked yet, so the first class is
 * "available" and the rest are "upcoming". This is display, not access control;
 * progression enforcement belongs to the backend in a later phase.
 */
export type ClassStatus = "available" | "upcoming";
export const classStatus = (globalIndex: number): ClassStatus =>
  globalIndex === 0 ? "available" : "upcoming";

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round((minutes / 60) * 10) / 10} h`;
}

export const coursePath = (courseId: string) => `/app/courses/${courseId}`;
export const roadmapPath = (courseId: string) => `${coursePath(courseId)}/roadmap`;
export const classPath = (courseId: string, classId: string) => `${coursePath(courseId)}/classes/${classId}`;
export const lessonPath = (courseId: string, lessonId: string) => `${coursePath(courseId)}/lessons/${lessonId}`;
export const tutorPath = (courseId?: string, lessonId?: string) => {
  const params = new URLSearchParams();
  if (courseId) params.set("course", courseId);
  if (lessonId) params.set("lesson", lessonId);
  const q = params.toString();
  return q ? `/app/tutor?${q}` : "/app/tutor";
};

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
