import { describe, expect, it, vi } from "vitest";
import { EIssueServiceType } from "@plane/types";
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
