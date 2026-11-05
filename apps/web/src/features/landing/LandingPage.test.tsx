import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Landing from "../../pages/Landing";

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

const SECTION_ORDER = ["trailer", "problem", "solution", "architect", "tutor", "showcase", "how", "why", "faq"];

describe("Landing page", () => {
  it("renders exactly one h1 with the main headline and the hero CTAs", () => {
    renderLanding();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "Your ambition deserves a better way to learn." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore the Product" })).toHaveAttribute("href", "#trailer");
  });

  it("orders the story sections as specified, with the FAQ before the final CTA", () => {
    renderLanding();
    const nodes = SECTION_ORDER.map((id) => document.getElementById(id));
    nodes.forEach((n, i) => expect(n, SECTION_ORDER[i]).not.toBeNull());
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i - 1]!.compareDocumentPosition(nodes[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    const cta = screen.getByRole("heading", { name: "Your next chapter starts with what you choose to learn." });
    expect(nodes[nodes.length - 1]!.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("points every Start Learning / Get started call to action at registration", () => {
    renderLanding();
    const hero = screen.getAllByRole("link", { name: "Start Learning" });
    expect(hero).toHaveLength(2);
    hero.forEach((l) => expect(l).toHaveAttribute("href", "/register"));
    expect(screen.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/register");
    expect(screen.getAllByRole("link", { name: "Sign in" })[0]).toHaveAttribute("href", "/login");
  });

  it("footer links resolve to real routes and anchors that exist on the page", () => {
    renderLanding();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(within(footer).getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
    document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
      const id = a.getAttribute("href")!.slice(1);
      expect(document.getElementById(id), `anchor #${id}`).not.toBeNull();
    });
  });

  it("labels planned features and demo content instead of presenting them as available", () => {
    renderLanding();
    expect(screen.getAllByText("Planned").length).toBeGreaterThan(0);
    expect(screen.getByText(/The AI Personal Tutor is planned and not yet available/)).toBeInTheDocument();
    expect(screen.getByText("Trailer coming soon")).toBeInTheDocument();
    expect(screen.getByText(/not an official Universitas Gunadarma platform\.$/i)).toBeInTheDocument();
  });

  it("does not mention pricing, plans or unsupported statistics", () => {
    renderLanding();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bpricing\b|\bsubscription\b|free trial|per month|\d+%|\$\d/i);
  });

  it("tutor mode selector is interactive and exposes pressed state", async () => {
    const user = userEvent.setup();
    renderLanding();
    const group = screen.getByRole("group", { name: "Learning modes" });
    const explain = within(group).getByRole("button", { name: "Explain" });
    const socratic = within(group).getByRole("button", { name: "Socratic" });
    expect(explain).toHaveAttribute("aria-pressed", "true");
    await user.click(socratic);
    expect(socratic).toHaveAttribute("aria-pressed", "true");
    expect(explain).toHaveAttribute("aria-pressed", "false");
  });

  it("mobile menu toggles, lists the anchors and closes on Escape", async () => {
    const user = userEvent.setup();
    renderLanding();
    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    const menu = document.getElementById("mobile-menu")!;
    expect(within(menu).getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "#faq");
    await user.keyboard("{Escape}");
    expect(document.getElementById("mobile-menu")).toBeNull();
  });

  it("shows no broken media: no <video> or <img> without a configured source", () => {
    renderLanding();
    expect(document.querySelector("video")).toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });
});
