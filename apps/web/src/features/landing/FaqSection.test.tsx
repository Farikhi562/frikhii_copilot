import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FaqSection } from "./FaqSection";
import { faqItems, faqJsonLd } from "./faqContent";

function triggers() {
  return screen.getAllByRole("button", { name: /\?$/ });
}

describe("FaqSection", () => {
  it("renders a section heading and every question as an h3 button", () => {
    render(<FaqSection />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Honest answers, before you begin." }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(faqItems.length);
    expect(triggers()).toHaveLength(8);
    expect(screen.getByRole("button", { name: "What is FRIKHII Copilot?" })).toBeInTheDocument();
  });

  it("opens the first item and keeps only one item open at a time", async () => {
    const user = userEvent.setup();
    render(<FaqSection />);
    const [first, second] = triggers();
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(second).toHaveAttribute("aria-expanded", "false");

    await user.click(second);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
  });

  it("can collapse the open item and links each trigger to its panel", async () => {
    const user = userEvent.setup();
    render(<FaqSection />);
    const [first] = triggers();
    const panel = document.getElementById(first.getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveAttribute("inert");

    await user.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("inert");
  });

  it("supports Enter and Space on the trigger", async () => {
    const user = userEvent.setup();
    render(<FaqSection />);
    const second = triggers()[1];
    second.focus();
    await user.keyboard("{Enter}");
    expect(second).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(second).toHaveAttribute("aria-expanded", "false");
  });

  it("moves focus between questions with arrow, Home and End keys", async () => {
    const user = userEvent.setup();
    render(<FaqSection />);
    const all = triggers();
    all[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(all[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(all[all.length - 1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(all[0]).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(all[all.length - 1]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(all[0]).toHaveFocus();
  });

  it("states the Gunadarma non-affiliation and labels planned features", () => {
    render(<FaqSection />);
    expect(
      screen.getByText(/not an official Universitas Gunadarma platform or partnership/),
    ).toBeInTheDocument();
    const section = document.getElementById("faq")!;
    expect(within(section).getAllByText("Partly built").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("Planned").length).toBeGreaterThan(0);
  });

  it("does not mention pricing or plans", () => {
    render(<FaqSection />);
    const text = document.getElementById("faq")!.textContent ?? "";
    expect(text).not.toMatch(/\$|price|pricing|subscription|free trial|per month/i);
  });

  it("emits FAQPage JSON-LD that matches the rendered questions", () => {
    render(<FaqSection />);
    const script = document.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(script?.textContent ?? "{}");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity.map((q: { name: string }) => q.name)).toEqual(
      faqItems.map((i) => i.question),
    );
    expect(faqJsonLd([{ id: "x", question: "q", answer: "</script><b>" }])).not.toContain("</script>");
  });
});
