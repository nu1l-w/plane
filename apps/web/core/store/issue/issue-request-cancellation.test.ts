import { describe, expect, it, vi } from "vitest";
import type { TIssuesResponse } from "@plane/types";
import { ProjectIssues } from "./project/issue.store";
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
