import { createElement } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TIssue, TStateGroups } from "@plane/types";
import { BlockedBadge } from "./blocked-badge";

const data = vi.hoisted(() => ({
  blockerIds: [] as string[],
  issues: {} as Record<string, Partial<TIssue>>,
  states: {} as Record<string, { group: TStateGroups }>,
}));

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => (key === "issue.relation.blocked" ? "Blocked" : "Blocked by") }),
}));
vi.mock("@plane/propel/tooltip", () => ({
  Tooltip: ({ children, tooltipContent }: { children: ReactNode; tooltipContent: ReactNode }) =>
    createElement("div", null, children, createElement("div", { role: "tooltip" }, tooltipContent)),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectIdentifierById: () => "IKFPC" }),
}));
vi.mock("@/hooks/store/use-project-state", () => ({
  useProjectState: () => ({ getStateById: (id: string) => data.states[id] }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    relation: { getRelationByIssueIdRelationType: () => data.blockerIds },
    issue: { getIssueById: (id: string) => data.issues[id] },
  }),
}));

const issue = {
  id: "blocked",
  issue_relation: [
    { id: "blocker", project_id: "project", sequence_id: 6, name: "Firmware", relation_type: "blocked_by" },
  ],
} as TIssue;
const render = (value = issue, variant: "badge" | "compact" | "icon" = "badge") =>
  renderToStaticMarkup(createElement(BlockedBadge, { issue: value, variant }));

describe("kanban blocked badge", () => {
  beforeEach(() => {
    data.blockerIds = [];
    data.issues = {};
    data.states = {};
  });

  it("renders nothing without blocking relations", () => {
    expect(render()).toBe("");
  });

  it("shows the count and an expanded blocker outside the current page", () => {
    data.blockerIds = ["blocker"];
    const html = render();
    expect(html).toContain("Blocked \u00b7 1");
    expect(html).toContain("IKFPC-6: Firmware");
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("bg-danger-subtle");
  });

  it("uses a compact label while keeping the full accessible description", () => {
    data.blockerIds = ["blocker"];
    const html = render(issue, "compact");
    expect(html).toContain('aria-label="Blocked · 1: IKFPC-6: Firmware"');
    expect(html).toContain("Blocked · 1</span>");
  });

  it("uses an icon in narrow layouts while keeping the full accessible label", () => {
    data.blockerIds = ["blocker"];
    const html = render(issue, "icon");
    expect(html).toContain('aria-label="Blocked · 1: IKFPC-6: Firmware"');
    expect(html).not.toContain("Blocked · 1</span>");
  });

  it("reads blocker details from reverse relations too", () => {
    data.blockerIds = ["blocker"];
    expect(render({ ...issue, issue_relation: [], issue_related: issue.issue_relation })).toContain(
      "IKFPC-6: Firmware"
    );
  });

  it("prefers the latest loaded name and shows multiple blockers", () => {
    data.blockerIds = ["blocker", "another"];
    data.issues = {
      blocker: { project_id: "project", sequence_id: 6, name: "Updated firmware" },
      another: { project_id: "project", sequence_id: 7, name: "Hardware" },
    };
    const html = render();
    expect(html).toContain("Blocked \u00b7 2");
    expect(html).toContain("IKFPC-6: Updated firmware");
    expect(html).toContain("IKFPC-7: Hardware");
  });

  it("hides a removed relation even if the original list payload still includes it", () => {
    data.blockerIds = ["blocker"];
    expect(render()).toContain("Blocked");
    data.blockerIds = [];
    expect(render()).toBe("");
  });

  it.each(["issue_relation", "issue_related"] as const)(
    "hides a completed blocker outside the current page in %s without removing the relation",
    (field) => {
      data.blockerIds = ["blocker"];
      const completed = { ...issue.issue_relation![0], state_id: "done", state__group: "completed" as const };
      expect(render({ ...issue, issue_relation: [], [field]: [completed] })).toBe("");
      expect(data.blockerIds).toEqual(["blocker"]);
    }
  );

  it("counts and lists only unfinished blockers", () => {
    data.blockerIds = ["blocker", "another"];
    data.issues = {
      blocker: { project_id: "project", sequence_id: 6, name: "Firmware", state__group: "completed" },
      another: { project_id: "project", sequence_id: 7, name: "Hardware", state__group: "started" },
    };
    const html = render();
    expect(html).toContain("Blocked \u00b7 1");
    expect(html).toContain("IKFPC-7: Hardware");
    expect(html).not.toContain("Firmware");
  });

  it("hides on completion and returns on reopening using the latest state ID", () => {
    data.blockerIds = ["blocker"];
    data.states = { active: { group: "started" }, done: { group: "completed" } };
    data.issues.blocker = { ...issue.issue_relation![0], state_id: "active", state__group: "started" };
    expect(render()).toContain("Blocked");
    data.issues.blocker.state_id = "done";
    expect(render()).toBe("");
    data.issues.blocker.state__group = "completed";
    data.issues.blocker.state_id = "active";
    expect(render()).toContain("Blocked \u00b7 1");
  });

  it("uses expanded state data when a loaded cross-project item has no state group", () => {
    data.blockerIds = ["blocker"];
    data.issues.blocker = { ...issue.issue_relation![0], state_id: "done" };
    expect(
      render({
        ...issue,
        issue_relation: [{ ...issue.issue_relation![0], state_id: "done", state__group: "completed" }],
      })
    ).toBe("");
  });

  it("keeps unknown or cancelled blockers visible instead of treating them as completed", () => {
    data.blockerIds = ["unknown", "blocker"];
    data.issues.blocker = { ...issue.issue_relation![0], state__group: "cancelled" };
    expect(render()).toContain("Blocked \u00b7 2");
  });
});
