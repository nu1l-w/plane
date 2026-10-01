import { describe, expect, it, vi } from "vitest";
import type { TIssue } from "@plane/types";
import { ProjectIssues } from "./project/issue.store";

vi.mock("@/lib/store-context", () => ({ store: {} }));

const makeStore = (moduleIds: string[] = []) => {
  const issue = { id: "child", parent_id: null, module_ids: moduleIds } as TIssue;
  const root = {
    rootStore: { router: {}, projectRoot: { project: { fetchProjectDetails: vi.fn() } } },
    issues: {
      getIssueById: () => issue,
      updateIssue: vi.fn((_id: string, data: Partial<TIssue>) => Object.assign(issue, data)),
    },
  };
  const store = new ProjectIssues(
    root as unknown as ConstructorParameters<typeof ProjectIssues>[0],
    {} as ConstructorParameters<typeof ProjectIssues>[1]
  );
  const updateList = vi.spyOn(store, "updateIssueList").mockImplementation(() => {});
  const patch = vi.spyOn(store.issueService, "patchIssue").mockResolvedValue(undefined);
  const retrieve = vi
    .spyOn(store.issueService, "retrieveIssues")
    .mockResolvedValue([{ ...issue, parent_id: "parent", module_ids: ["inherited"] }]);
  return { store, issue, updateList, patch, retrieve };
};

describe("refreshing parent module defaults", () => {
  it("refreshes modules and re-groups the card after setting a parent", async () => {
    const { store, issue, patch, retrieve, updateList } = makeStore();
    await store.updateIssue("workspace", "project", "child", { parent_id: "parent" });

    expect(retrieve).toHaveBeenCalledWith("workspace", "project", ["child"]);
    expect(issue.module_ids).toEqual(["inherited"]);
    expect(updateList).toHaveBeenLastCalledWith(
      expect.objectContaining({ module_ids: ["inherited"] }),
      expect.objectContaining({ module_ids: [] })
    );
    expect(patch).toHaveBeenCalledTimes(1);
  });

  it("does not refresh module defaults when the child already has modules", async () => {
    const { store, retrieve } = makeStore(["own"]);
    await store.updateIssue("workspace", "project", "child", { parent_id: "parent" });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("preserves an explicit empty selection and skips defaults when unlinking", async () => {
    const { store, retrieve } = makeStore();
    await store.updateIssue("workspace", "project", "child", { parent_id: "parent", module_ids: [] });
    await store.updateIssue("workspace", "project", "child", { parent_id: null });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("does not roll back a saved parent when the refresh fails", async () => {
    const { store, issue, retrieve } = makeStore();
    retrieve.mockRejectedValue(new Error("Refresh unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await store.updateIssue("workspace", "project", "child", { parent_id: "parent" });
      expect(issue.parent_id).toBe("parent");
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
