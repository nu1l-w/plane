import { describe, expect, it, vi } from "vitest";
import { EIssueServiceType, type TIssue } from "@plane/types";
import { IssueSubIssuesStore } from "./sub_issues.store";

vi.mock("@/lib/store-context", () => ({ store: {} }));

const makeStore = () =>
  new IssueSubIssuesStore({} as ConstructorParameters<typeof IssueSubIssuesStore>[0], EIssueServiceType.ISSUES);

describe("sub-work item visibility", () => {
  it("keeps the root list visible when loading completes twice", () => {
    const store = makeStore();

    store.setSubIssueHelpers("parent_root", "issue_visibility", "parent", true);
    store.setSubIssueHelpers("parent_root", "issue_visibility", "parent", true);

    expect(store.subIssueHelpersByIssueId("parent_root").issue_visibility).toEqual(["parent"]);
  });

  it("sets and clears loading explicitly without affecting other work items", () => {
    const store = makeStore();

    store.setSubIssueHelpers("parent_root", "preview_loader", "other", true);
    store.setSubIssueHelpers("parent_root", "preview_loader", "parent", true);
    store.setSubIssueHelpers("parent_root", "preview_loader", "parent", true);
    expect(store.subIssueHelpersByIssueId("parent_root").preview_loader).toEqual(["other", "parent"]);

    store.setSubIssueHelpers("parent_root", "preview_loader", "parent", false);
    store.setSubIssueHelpers("parent_root", "preview_loader", "parent", false);
    expect(store.subIssueHelpersByIssueId("parent_root").preview_loader).toEqual(["other"]);
  });

  it("preserves toggle behavior for manually expanding nested work items", () => {
    const store = makeStore();

    store.setSubIssueHelpers("parent", "issue_visibility", "child");
    expect(store.subIssueHelpersByIssueId("parent").issue_visibility).toEqual(["child"]);

    store.setSubIssueHelpers("parent", "issue_visibility", "child");
    expect(store.subIssueHelpersByIssueId("parent").issue_visibility).toEqual([]);
  });
});

describe("linking sub-work items with module defaults", () => {
  it("moves visible cards to inherited module groups before replacing cached data", async () => {
    const previous = { id: "child", project_id: "project", parent_id: null, module_ids: [] } as unknown as TIssue;
    const linked = { ...previous, parent_id: "parent", module_ids: ["module"] };
    const visibleList = { groupedIssueIds: { state: { none: ["child"] } }, updateIssueList: vi.fn() };
    const hiddenList = { groupedIssueIds: { none: ["other"] }, updateIssueList: vi.fn() };
    const addIssue = vi.fn();
    const root = {
      issues: { addIssue, getIssueById: () => previous, issuesMap: { parent: { sub_issues_count: 0 } } },
      projectIssues: visibleList,
      projectViewIssues: hiddenList,
      cycleIssues: hiddenList,
      moduleIssues: hiddenList,
      workspaceIssues: hiddenList,
      profileIssues: hiddenList,
      teamIssues: hiddenList,
      teamViewIssues: hiddenList,
      teamProjectWorkItems: hiddenList,
    };
    const store = new IssueSubIssuesStore(
      { rootIssueStore: root } as unknown as ConstructorParameters<typeof IssueSubIssuesStore>[0],
      EIssueServiceType.ISSUES
    );
    vi.spyOn(store.issueService, "addSubIssues").mockResolvedValue({
      sub_issues: [linked],
      state_distribution: { started: ["child"] },
    } as Awaited<ReturnType<typeof store.issueService.addSubIssues>>);

    await store.createSubIssues("workspace", "project", "parent", ["child"]);

    expect(visibleList.updateIssueList).toHaveBeenCalledWith(linked, previous);
    expect(hiddenList.updateIssueList).not.toHaveBeenCalled();
    expect(visibleList.updateIssueList.mock.invocationCallOrder[0]).toBeLessThan(addIssue.mock.invocationCallOrder[0]);
    expect(addIssue).toHaveBeenCalledWith([linked]);
  });
});
