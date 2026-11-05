import { describe, expect, it } from "vitest";
import { safeRedirectTarget } from "./redirects";

describe("safeRedirectTarget", () => {
  it("keeps in-app paths, including query and hash", () => {
    expect(safeRedirectTarget("/app/settings")).toBe("/app/settings");
    expect(safeRedirectTarget("/app/courses?tab=active#top")).toBe("/app/courses?tab=active#top");
  });

  it("falls back when no redirect is present", () => {
    expect(safeRedirectTarget(null)).toBe("/app");
    expect(safeRedirectTarget("")).toBe("/app");
    expect(safeRedirectTarget(null, "/login")).toBe("/login");
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(safeRedirectTarget("https://evil.example/steal")).toBe("/app");
    expect(safeRedirectTarget("//evil.example/steal")).toBe("/app");
    expect(safeRedirectTarget("/\\evil.example")).toBe("/app");
    expect(safeRedirectTarget("javascript:alert(1)")).toBe("/app");
  });
});
