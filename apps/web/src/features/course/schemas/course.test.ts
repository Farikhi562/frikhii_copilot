import { describe, expect, it } from "vitest";
import {
  courseDetailSchema,
  diagnosticAttemptSchema,
  learningGoalSchema,
} from "./course";
import { intakeFormSchema, intakeDefaults, toCreateGoalRequest } from "./intake";

function sampleGoal() {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Build production Go services",
    goal_statement: "I want to design and ship a production Go service.",
    intended_outcome: "I can build, test, deploy, and operate a Go API.",
    motivation: "My team is moving its backend to Go.",
    additional_context: "",
    self_reported_level: "basic",
    current_knowledge: { confidence: "some" },
    weekly_study_minutes: 360,
    learning_language: "en-US",
    learning_preferences: { formats: ["practice"] },
    target_date: null,
    status: "diagnostic_evaluated",
    last_error: null,
    course_id: null,
    course_status: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function sampleDiagnostic() {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    learning_goal_id: "11111111-1111-1111-1111-111111111111",
    status: "evaluated",
    attempt_number: 1,
    estimated_level: "beginner",
    confidence: "medium",
    evaluation_summary: "You have a usable foundation.",
    strengths: [{ competency: "basics", evidence: "Answered consistently." }],
    knowledge_gaps: [
      {
        competency: "testing",
        description: "Needs practice.",
        severity: "medium",
        recommendation: "Add tests.",
      },
    ],
    misconceptions: [],
    recommended_start: "Foundations",
    rationale: "The answers show baseline knowledge.",
    question_scores: [{ question_id: "q-1", score: 70, feedback: "Good." }],
    can_skip: [],
    questions: [
      {
        id: "q-1",
        sequence: 1,
        type: "short_answer",
        prompt: "Explain the execution model in your own words.",
        competency: "basics",
        difficulty: "foundation",
        choices: [],
      },
    ],
    answers: [{ question_id: "q-1", response: "A considered answer." }],
    submitted_at: "2026-01-01T00:00:00Z",
    evaluated_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  };
}

function sampleCourse() {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    learning_goal_id: "11111111-1111-1111-1111-111111111111",
    status: "approved",
    current_version_id: "44444444-4444-4444-4444-444444444444",
    approved_version_id: "44444444-4444-4444-4444-444444444444",
    version: {
      id: "44444444-4444-4444-4444-444444444444",
      course_id: "33333333-3333-3333-3333-333333333333",
      version_number: 1,
      status: "approved",
      title: "Go Foundations",
      short_description: "A practical course for building Go services.",
      description: "Learn the core practices.",
      learning_goal: "Build and operate a production Go service.",
      target_learner_level: "beginner",
      objectives: [{ id: "obj-1", description: "Explain the runtime.", competency: "go" }],
      target_competencies: [{ id: "comp-1", name: "Go", description: "Build Go programs." }],
      prerequisites: [],
      estimated_duration_minutes: 240,
      recommended_weekly_study_minutes: 180,
      methodology: "Practice first.",
      expected_outcome: "A tested service.",
      final_project: {
        title: "Project",
        description: "Build it.",
        competencies: ["go"],
        deliverable: "A service.",
        evaluation_criteria: ["Works."],
      },
      final_assessment: {
        title: "Assessment",
        description: "Show it.",
        format: "Review",
        competencies: ["go"],
        passing_criteria: ["Meets criteria."],
      },
      assumptions: [],
      suggested_search_topics: [],
      generation_metadata: {
        provider: "mock",
        model: "deterministic",
        generated_at: "2026-01-01T00:00:00Z",
        prompt_version: "v1",
        duration_ms: 5,
        repaired: false,
        fallback_used: false,
      },
      warnings: [],
      created_at: "2026-01-01T00:00:00Z",
      approved_at: "2026-01-01T00:00:00Z",
      modules: [
        {
          id: "55555555-5555-5555-5555-555555555555",
          source_id: "module-1",
          sequence: 1,
          title: "Foundations",
          description: "The execution model.",
          objectives: [{ id: "obj-m1", description: "Describe goroutines.", competency: "go" }],
          skills: ["writing Go"],
          estimated_duration_minutes: 240,
          required_previous_module_ids: [],
          required_previous_modules: [],
          classes: [
            {
              id: "66666666-6666-6666-6666-666666666666",
              source_id: "class-1",
              sequence: 1,
              title: "Goroutines",
              description: "Start concurrent work.",
              objectives: [{ id: "obj-c1", description: "Coordinate goroutines.", competency: "go" }],
              prerequisite_class_ids: [],
              prerequisites: [],
              estimated_duration_minutes: 120,
              key_concepts: ["goroutine"],
              lessons: [
                {
                  id: "77777777-7777-7777-7777-777777777777",
                  source_id: "lesson-1",
                  sequence: 1,
                  title: "Starting goroutines",
                  description: "Observe concurrency.",
                  estimated_duration_minutes: 45,
                  blueprint: {
                    introduction: "An introduction.",
                    objectives: ["Start a goroutine."],
                    prerequisite_concepts: [],
                    concept_outline: ["Concept"],
                    analogies: ["An analogy"],
                    demonstration: ["A demo"],
                    guided_practice: ["Guided practice"],
                    independent_practice: ["Independent practice"],
                    knowledge_check: ["A check"],
                    summary: "A summary.",
                  },
                },
              ],
              exercise: {
                title: "Practice",
                description: "Write a concurrent program.",
                difficulty: "foundation",
                competency: "go",
                instructions: ["Write it."],
                expected_deliverable: "A program.",
                evaluation_criteria: ["It runs."],
              },
              knowledge_check: {
                description: "Check understanding.",
                question_count: 2,
                competencies: ["go"],
              },
            },
          ],
        },
      ],
    },
    approved_version: null,
    counts: { modules: 1, classes: 1, lessons: 1, exercises: 1 },
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("course API schemas", () => {
  it("parses learning goals, diagnostics and course versions", () => {
    expect(learningGoalSchema.parse(sampleGoal()).status).toBe("diagnostic_evaluated");
    expect(diagnosticAttemptSchema.parse(sampleDiagnostic()).estimated_level).toBe("beginner");
    const course = courseDetailSchema.parse(sampleCourse());
    expect(course.version?.modules[0].classes[0].lessons).toHaveLength(1);
  });

  it("rejects an unexpected course shape instead of trusting it", () => {
    const invalid = { ...sampleCourse(), counts: { modules: 1 } };
    expect(courseDetailSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("intake form schema", () => {
  it("maps the form to the API payload without leaking form-only fields", () => {
    const values = intakeFormSchema.parse({
      ...intakeDefaults,
      title: "Learn Go",
      goal_statement: "Build a production service.",
      intended_outcome: "Ship a tested API.",
      motivation: "Work.",
      known_topics: "variables, functions",
      formats: ["practice"],
      target_date: "",
    });
    const request = toCreateGoalRequest(values);
    expect(request.current_knowledge).toEqual({
      prior_experience: "",
      known_topics: ["variables", "functions"],
      confidence: "some",
    });
    expect(request.learning_preferences).toEqual({
      formats: ["practice"],
      notes: "",
    });
    expect(request.target_date).toBeNull();
    expect(request).not.toHaveProperty("formats");
  });

  it("rejects impossible weekly plans and missing formats", () => {
    const result = intakeFormSchema.safeParse({
      ...intakeDefaults,
      weekly_study_minutes: 0,
      formats: [],
    });
    expect(result.success).toBe(false);
  });
});
