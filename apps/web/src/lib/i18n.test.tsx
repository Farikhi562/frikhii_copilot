import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "./i18n";

function Probe() {
  const { setLanguage } = useI18n();
  return (
    <div>
      <p>Sign in</p>
      <button type="button" onClick={() => setLanguage("id")}>
        Switch
      </button>
    </div>
  );
}

describe("I18nProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
    document.body.innerHTML = "";
  });

  it("translates rendered copy when Indonesian is selected", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Switch" }));
    expect(await screen.findByText("Masuk")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("id");
    expect(localStorage.getItem("frikhii.language")).toBe("id");
  });
});
