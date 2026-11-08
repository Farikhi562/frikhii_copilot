import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/overview.json";
import { overviewSchema } from "./schemas";

// overview.json is real output of the Go engine (scenario: repeated weakness, prerequisite
// chain and a retention regression), so this test guards the API/UI contract.
describe("intelligence overview contract", () => {
  it("parses the Go engine output, including null slices", () => {
    const parsed = overviewSchema.parse(fixture);
    const course = parsed.courses[0];
    expect(course.competencies).toHaveLength(3);
    expect(course.knowledge_gaps.map((g) => g.cause).sort()).toEqual(["current_lesson", "prerequisite", "retention"]);
    expect(course.knowledge_gaps.every((g) => Array.isArray(g.prerequisites))).toBe(true);
    expect(course.prerequisites["Gradient descent"]).toEqual(["Derivatives"]);
  });

  it("accepts an account with no evidence", () => {
    const empty = overviewSchema.parse({ courses: null, preferences: fixture.preferences });
    expect(empty.courses).toEqual([]);
  });

  it("rejects out-of-vocabulary statuses", () => {
    const bad = JSON.parse(JSON.stringify(fixture));
    bad.courses[0].competencies[0].status = "genius";
    expect(overviewSchema.safeParse(bad).success).toBe(false);
  });
});
