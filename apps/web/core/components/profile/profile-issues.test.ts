import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProfileIssuesPage } from "./profile-issues";

const mocks = vi.hoisted(() => ({
  hydrateWorkspaceIssueProperties: vi.fn(),
  route: {
    workspaceSlug: "workspace-slug",
    userId: "user-id",
  },
}));

vi.mock("next/navigation", () => ({ useParams: () => mocks.route }));
vi.mock("swr", () => ({ default: vi.fn() }));
vi.mock("@/components/issues/issue-layouts/kanban/roots/profile-issues-root", () => ({
  ProfileIssuesKanBanLayout: () => null,
}));
vi.mock("@/components/issues/issue-layouts/list/roots/profile-issues-root", () => ({
  ProfileIssuesListLayout: () => null,
}));
vi.mock("@/components/issues/peek-overview", () => ({ IssuePeekOverview: () => null }));
vi.mock("@/components/work-item-filters/filters-hoc/workspace-level", () => ({
  WorkspaceLevelWorkItemFiltersHOC: () => null,
}));
vi.mock("@/components/work-item-filters/filters-row", () => ({ WorkItemFiltersRow: () => null }));
vi.mock("@/hooks/store/use-issues", () => ({
  useIssues: () => ({
    issues: { setViewId: vi.fn() },
    issuesFilter: {
      issueFilters: undefined,
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
