import { describe, expect, it, vi } from "vitest";
import type { TIssue, TIssuesResponse } from "@plane/types";
import { ProjectIssues } from "./project/issue.store";
import { ProjectViewIssues } from "./project-views/issue.store";
import { ProfileIssues } from "./profile/issue.store";

vi.mock("@/lib/store-context", () => ({ store: {} }));

const response = { results: [], total_count: 0 } as unknown as TIssuesResponse;
const options = { canGroup: false, perPageCount: 100 };
const makeRootStore = () => ({
  rootStore: { router: {}, projectRoot: { project: { fetchProjectDetails: vi.fn() } } },
  issues: { addIssue: vi.fn(), getIssuesByIds: vi.fn(() => []) },
  issueDetail: { relation: { extractRelationsFromIssues: vi.fn() } },
});

describe("work item request cancellation", () => {
  it("ignores an obsolete project request without hiding the replacement response", async () => {
    const root = makeRootStore();
    const store = new ProjectIssues(
      root as unknown as ConstructorParameters<typeof ProjectIssues>[0],
      { getFilterParams: () => ({}) } as unknown as ConstructorParameters<typeof ProjectIssues>[1]
    );
    let rejectFirst!: (error: Error) => void;
    const getIssues = vi
      .spyOn(store.issueService, "getIssues")
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          })
      )
      .mockResolvedValueOnce(response);

    const first = store.fetchIssues("workspace", "project", "init-loader", options);
    const second = store.fetchIssues("workspace", "project", "init-loader", options);
    rejectFirst(new Error("canceled"));

    expect(await first).toBeUndefined();
    expect(await second).toBe(response);
    expect(getIssues).toHaveBeenCalledTimes(2);
    expect(root.issues.addIssue).toHaveBeenCalledTimes(1);
  });

  it("ignores an obsolete profile request", async () => {
    const root = makeRootStore();
    const store = new ProfileIssues(
      root as unknown as ConstructorParameters<typeof ProfileIssues>[0],
      { getFilterParams: () => ({}) } as unknown as ConstructorParameters<typeof ProfileIssues>[1]
    );
    let rejectFirst!: (error: Error) => void;
    vi.spyOn(store.userService, "getUserProfileIssues")
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          })
      )
      .mockResolvedValueOnce(response);

    const first = store.fetchIssues("workspace", "user", "init-loader", options, "assigned");
    const second = store.fetchIssues("workspace", "user", "init-loader", options, "assigned");
    rejectFirst(new Error("canceled"));

    expect(await first).toBeUndefined();
    expect(await second).toBe(response);
    expect(root.issues.addIssue).toHaveBeenCalledTimes(1);
  });

  it("ignores an obsolete project view request", async () => {
    const root = makeRootStore();
    const store = new ProjectViewIssues(
      root as unknown as ConstructorParameters<typeof ProjectViewIssues>[0],
      { getFilterParams: () => ({}) } as unknown as ConstructorParameters<typeof ProjectViewIssues>[1]
    );
    let rejectFirst!: (error: Error) => void;
    const getIssues = vi
      .spyOn(store.issueService, "getIssues")
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectFirst = reject;
          })
      )
      .mockResolvedValueOnce(response);

    const first = store.fetchIssues("workspace", "project", "view", "init-loader", options);
    const second = store.fetchIssues("workspace", "project", "view", "init-loader", options);
    rejectFirst(new Error("canceled"));

    expect(await first).toBeUndefined();
    expect(await second).toBe(response);
    expect(getIssues).toHaveBeenCalledTimes(2);
    expect(root.issues.addIssue).toHaveBeenCalledTimes(1);
  });

  it("requests the assigned open defects profile view", async () => {
    const store = new ProfileIssues(
      makeRootStore() as unknown as ConstructorParameters<typeof ProfileIssues>[0],
      { getFilterParams: () => ({}) } as unknown as ConstructorParameters<typeof ProfileIssues>[1]
    );
    const getProfileIssues = vi.spyOn(store.userService, "getUserProfileIssues").mockResolvedValue(response);

    await store.fetchIssues("workspace", "user", "init-loader", options, "defects");

    expect(getProfileIssues).toHaveBeenCalledWith(
      "workspace",
      "user",
      expect.objectContaining({ assignees: "user", assigned_defects: "true" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("still reports a real project request failure", async () => {
    const store = new ProjectIssues(
      makeRootStore() as unknown as ConstructorParameters<typeof ProjectIssues>[0],
      { getFilterParams: () => ({}) } as unknown as ConstructorParameters<typeof ProjectIssues>[1]
    );
    const error = new Error("server unavailable");
    vi.spyOn(store.issueService, "getIssues").mockRejectedValueOnce(error);

    await expect(store.fetchIssues("workspace", "project", "init-loader", options)).rejects.toBe(error);
  });
});

describe("defect profile board updates", () => {
  const createProfileStore = () => {
    const store = new ProfileIssues(
      makeRootStore() as unknown as ConstructorParameters<typeof ProfileIssues>[0],
      {
        getFilterParams: () => ({}),
        issueFilters: {
          displayFilters: { layout: "kanban", group_by: "priority", sub_issue: false },
        },
      } as unknown as ConstructorParameters<typeof ProfileIssues>[1]
    );
    vi.spyOn(store, "issuesSortWithOrderBy").mockImplementation((issueIds) => issueIds);
    return store;
  };

  it("moves an assigned defect into its new priority group immediately", () => {
    const store = createProfileStore();
    store.setViewId("defects");

    const defect = { id: "defect-1", parent_id: "parent-1", priority: "urgent" } as TIssue;
    store.groupedIssueIds = { urgent: [defect.id] };
    store.groupedIssueCount = { urgent: 1 };

    store.updateIssueList({ ...defect, priority: "high" }, defect);

    expect(store.getIssueIds("urgent")).toEqual([]);
    expect(store.getIssueIds("high")).toEqual([defect.id]);
    expect(store.groupedIssueCount).toMatchObject({ urgent: 0, high: 1 });
  });

  it("keeps hiding child work items in profile views other than defects", () => {
    const store = createProfileStore();
    const childIssue = { id: "child-1", parent_id: "parent-1", priority: "urgent" } as TIssue;
    store.groupedIssueIds = {};

    store.updateIssueList(childIssue);

    expect(store.getIssueIds("urgent")).toBeUndefined();
  });
});
