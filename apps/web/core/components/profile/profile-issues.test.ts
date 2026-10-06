import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import { handleIssueQueryParamsByLayout } from "@plane/utils";
import { ProfileIssuesPage } from "./profile-issues";

const mocks = vi.hoisted(() => ({
  layout: "list",
  hydrateWorkspaceIssueProperties: vi.fn(),
  route: {
    workspaceSlug: "workspace-slug",
    userId: "user-id",
  },
}));

vi.mock("next/navigation", () => ({ useParams: () => mocks.route }));
vi.mock("swr", () => ({ default: vi.fn() }));
vi.mock("@/components/issues/issue-layouts/kanban/roots/profile-issues-root", () => ({
  ProfileIssuesKanBanLayout: () => "kanban-layout",
}));
vi.mock("@/components/issues/issue-layouts/list/roots/profile-issues-root", () => ({
  ProfileIssuesListLayout: () => "list-layout",
}));
vi.mock("@/components/issues/issue-layouts/spreadsheet/roots/profile-issues-root", () => ({
  ProfileIssuesSpreadsheetLayout: () => "spreadsheet-layout",
}));
vi.mock("@/components/issues/peek-overview", () => ({ IssuePeekOverview: () => null }));
vi.mock("@/components/work-item-filters/filters-hoc/workspace-level", () => ({
  WorkspaceLevelWorkItemFiltersHOC: ({ children }: { children: (value: object) => unknown }) => children({}),
}));
vi.mock("@/components/work-item-filters/filters-row", () => ({ WorkItemFiltersRow: () => null }));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({
    issues: { setViewId: vi.fn() },
    issuesFilter: {
      issueFilters: { displayFilters: { layout: mocks.layout } },
      fetchFilters: vi.fn(),
      updateFilterExpression: vi.fn(),
    },
  }),
}));
vi.mock("@/hooks/use-workspace-issue-properties", () => ({
  useWorkspaceIssueProperties: mocks.hydrateWorkspaceIssueProperties,
}));

describe("profile work item metadata", () => {
  it("hydrates workspace-level issue properties on a direct page load", () => {
    renderToStaticMarkup(createElement(ProfileIssuesPage, { type: "assigned" }));

    expect(mocks.hydrateWorkspaceIssueProperties).toHaveBeenCalledWith("workspace-slug");
  });
});

describe("profile work item layouts", () => {
  it.each(["assigned", "created", "subscribed", "defects"] as const)(
    "renders the spreadsheet for the %s tab",
    (type) => {
      mocks.layout = "spreadsheet";
      const markup = renderToStaticMarkup(createElement(ProfileIssuesPage, { type }));
      expect(markup).toContain("spreadsheet-layout");
      expect(markup).not.toContain("list-layout");
      expect(markup).not.toContain("kanban-layout");
    }
  );

  it.each(["list", "kanban"])("preserves the %s layout", (layout) => {
    mocks.layout = layout;
    expect(renderToStaticMarkup(createElement(ProfileIssuesPage, { type: "assigned" }))).toContain(`${layout}-layout`);
  });
});

it("requests an ungrouped profile spreadsheet while keeping sorting and sub-work-item filters", () => {
  const params = handleIssueQueryParamsByLayout(EIssueLayoutTypes.SPREADSHEET, "profile_issues");
  expect(params).toContain("order_by");
  expect(params).toContain("sub_issue");
  expect(params).not.toContain("group_by");
  expect(params).not.toContain("sub_group_by");
});
