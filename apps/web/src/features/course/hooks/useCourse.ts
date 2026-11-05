import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveCourse,
  createLearningGoal,
  generateCourse,
  generateDiagnostic,
  getCourse,
  getLatestDiagnostic,
  getLearningGoal,
  listCourses,
  listLearningGoals,
  regenerateCourse,
  submitDiagnostic,
  updateDraft,
  type DraftPatch,
} from "../api/course";
import { courseKeys } from "../api/keys";
import type { CreateLearningGoalRequest } from "../schemas/intake";

export function useLearningGoals() {
  return useQuery({
    queryKey: courseKeys.goals,
    queryFn: listLearningGoals,
    staleTime: 30_000,
  });
}

export function useLearningGoal(goalID: string | undefined) {
  return useQuery({
    queryKey: courseKeys.goal(goalID ?? "unknown"),
    queryFn: () => {
      if (!goalID) throw new Error("Missing learning goal id.");
      return getLearningGoal(goalID);
    },
    enabled: Boolean(goalID),
    staleTime: 10_000,
    refetchInterval: (query) =>
      query.state.data?.status === "generating" ? 2_500 : false,
  });
}

export function useDiagnostic(goalID: string | undefined) {
  return useQuery({
    queryKey: courseKeys.diagnostic(goalID ?? "unknown"),
    queryFn: () => {
      if (!goalID) throw new Error("Missing learning goal id.");
      return getLatestDiagnostic(goalID);
    },
    enabled: Boolean(goalID),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "generating" ? 2_000 : false;
    },
  });
}

export function useCourses() {
  return useQuery({
    queryKey: courseKeys.courses,
    queryFn: listCourses,
    staleTime: 30_000,
  });
}

export function useCourse(courseID: string | undefined) {
  return useQuery({
    queryKey: courseKeys.course(courseID ?? "unknown"),
    queryFn: () => {
      if (!courseID) throw new Error("Missing course id.");
      return getCourse(courseID);
    },
    enabled: Boolean(courseID),
    staleTime: 10_000,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLearningGoalRequest) => createLearningGoal(input),
    onSuccess: (goal) => {
      queryClient.setQueryData(courseKeys.goal(goal.id), goal);
      void queryClient.invalidateQueries({ queryKey: courseKeys.goals });
    },
  });
}

export function useGenerateDiagnostic(goalID: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateDiagnostic(goalID),
    onSuccess: (diagnostic) => {
      queryClient.setQueryData(courseKeys.diagnostic(goalID), diagnostic);
      void queryClient.invalidateQueries({ queryKey: courseKeys.goal(goalID) });
      void queryClient.invalidateQueries({ queryKey: courseKeys.goals });
    },
  });
}

export function useSubmitDiagnostic(goalID: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      attemptID: string;
      answers: { question_id: string; response: string }[];
    }) => submitDiagnostic(goalID, input.attemptID, input.answers),
    onSuccess: (diagnostic) => {
      queryClient.setQueryData(courseKeys.diagnostic(goalID), diagnostic);
      void queryClient.invalidateQueries({ queryKey: courseKeys.goal(goalID) });
      void queryClient.invalidateQueries({ queryKey: courseKeys.goals });
    },
  });
}

export function useGenerateCourse(goalID: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (learnerCorrections: string) => generateCourse(goalID, learnerCorrections),
    onSuccess: (course) => {
      queryClient.setQueryData(courseKeys.course(course.id), course);
      void queryClient.invalidateQueries({ queryKey: courseKeys.goal(goalID) });
      void queryClient.invalidateQueries({ queryKey: courseKeys.goals });
      void queryClient.invalidateQueries({ queryKey: courseKeys.courses });
    },
  });
}

export function useUpdateDraft(courseID: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: DraftPatch) => updateDraft(courseID, patch),
    onSuccess: (course) => {
      queryClient.setQueryData(courseKeys.course(courseID), course);
      void queryClient.invalidateQueries({ queryKey: courseKeys.courses });
    },
  });
}

export function useRegenerateCourse(courseID: string, goalID: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instructions: string) => regenerateCourse(courseID, instructions),
    onSuccess: (course) => {
      queryClient.setQueryData(courseKeys.course(courseID), course);
      if (goalID) {
        void queryClient.invalidateQueries({ queryKey: courseKeys.goal(goalID) });
      }
      void queryClient.invalidateQueries({ queryKey: courseKeys.courses });
      void queryClient.invalidateQueries({ queryKey: courseKeys.goals });
    },
  });
}

export function useApproveCourse(courseID: string, goalID: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionID: string) => approveCourse(courseID, versionID),
    onSuccess: (course) => {
      queryClient.setQueryData(courseKeys.course(courseID), course);
      if (goalID) {
        void queryClient.invalidateQueries({ queryKey: courseKeys.goal(goalID) });
      }
      void queryClient.invalidateQueries({ queryKey: courseKeys.courses });
      void queryClient.invalidateQueries({ queryKey: courseKeys.goals });
    },
  });
}
