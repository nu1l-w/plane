import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReadonlyState } from "./state";

const stateData = vi.hoisted(() => ({ name: undefined as string | undefined }));

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({
    getProjectStateIds: () => ["state-1"],
    getStateById: () => (stateData.name === undefined ? undefined : { name: stateData.name }),
    fetchProjectStates: vi.fn(),
  }),
}));

describe("readonly state names", () => {
  it.each(["Backlog", "Todo", "In Progress", "Done", "Cancelled", "QA Review", "\u5f85\u9a8c\u6536"])(
    "renders %s without translating the configured name",
    (name) => {
      stateData.name = name;
      const html = renderToStaticMarkup(
        createElement(ReadonlyState, {
          value: "state-1",
          projectId: "project-1",
          workspaceSlug: "workspace",
          hideIcon: true,
        })
      );
      expect(html).toContain(`>${name}</span>`);
    }
  );

  it("shows the placeholder when the state is unavailable", () => {
    stateData.name = undefined;
    const html = renderToStaticMarkup(
      createElement(ReadonlyState, {
        value: null,
        projectId: "project-1",
        workspaceSlug: "workspace",
        hideIcon: true,
        placeholder: "No state",
      })
    );
    expect(html).toContain(">No state</span>");
  });
});
