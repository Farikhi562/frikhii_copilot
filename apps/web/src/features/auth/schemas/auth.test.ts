import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth";

describe("auth schemas", () => {
  it("accepts a valid registration and trims the name", () => {
    const result = registerSchema.safeParse({
      fullName: "  Ada Lovelace  ",
      email: "ada@example.com",
      password: "analytical1",
      confirmPassword: "analytical1",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Ada Lovelace");
    }
  });

  it("rejects a password confirmation mismatch on the confirm field", () => {
    const result = registerSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "analytical1",
      confirmPassword: "different1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["confirmPassword"],
            message: "Passwords do not match.",
          }),
        ]),
      );
    }
  });

  it("requires a strong enough password", () => {
    const result = registerSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "short",
      confirmPassword: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("Use at least 8 characters.");
      expect(messages).toContain("Include at least one number.");
    }
  });

  it("rejects malformed emails", () => {
    const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("keeps login passwords non-empty only, so older accounts can still sign in", () => {
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "x" }).success).toBe(true);
  });

  it("validates the reset form", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "newpassword1",
        confirmPassword: "newpassword1",
      }).success,
    ).toBe(true);

    expect(
      resetPasswordSchema.safeParse({
        password: "newpassword1",
        confirmPassword: "otherpassword1",
      }).success,
    ).toBe(false);
  });
});
