import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import NewCourse from "./NewCourse";
import { CourseCard } from "../../features/course/components/CourseBits";

function renderPage(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NewCourse intake", () => {
  it("renders the first step and blocks an empty continuation", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage(<NewCourse />);

    expect(screen.getByRole("heading", { name: "What do you want to master?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Use at least 3 characters.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The goal" })).toBeInTheDocument();
  });

  it("advances after valid goal fields", async () => {
    const user = userEvent.setup({ delay: null });
    renderPage(<NewCourse />);

    await user.type(screen.getByLabelText("Course title"), "Learn Go");
    await user.type(
      screen.getByLabelText("What is the goal?"),
      "Build and ship a production Go service.",
    );
    await user.type(
      screen.getByLabelText("What will success look like?"),
      "I can build, test and deploy a small API.",
    );
    await user.type(screen.getByLabelText("Why now?"), "I am changing roles.");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Where you are" })).toBeInTheDocument();
  });
});

describe("CourseCard", () => {
  it("links a draft course to review instead of pretending it is enrolled", () => {
    renderPage(
      <CourseCard
        course={{
          id: "course-1",
          learning_goal_id: "goal-1",
          status: "approved",
          current_version_id: "version-2",
          approved_version_id: "version-1",
          draft_version_id: "version-2",
          has_draft: true,
          title: "Go Foundations",
          short_description: "A practical course for building Go services.",
          version_number: 2,
          version_status: "draft",
          target_learner_level: "beginner",
          estimated_duration_minutes: 240,
          counts: { modules: 1, classes: 2, lessons: 4, exercises: 2 },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }}
      />,
    );

    expect(screen.getByText("New draft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review draft" })).toHaveAttribute(
      "href",
      "/app/courses/course-1/review",
    );
  });
});
