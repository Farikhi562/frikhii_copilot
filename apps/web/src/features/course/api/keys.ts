export const courseKeys = {
  goals: ["learning-goals"] as const,
  goal: (goalID: string) => ["learning-goals", goalID] as const,
  diagnostic: (goalID: string) => ["learning-goals", goalID, "diagnostic"] as const,
  courses: ["courses"] as const,
  course: (courseID: string) => ["courses", courseID] as const,
};
