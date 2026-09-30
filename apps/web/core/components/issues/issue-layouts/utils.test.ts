import { describe, expect, it } from "vitest";
import { ALL_ISSUES } from "@plane/constants";
import { getGroupByColumns } from "./utils";

describe("ungrouped work item columns", () => {
  it("uses the same key as the issue store for the list and profile views", () => {
    const groups = getGroupByColumns({ groupBy: null, includeNone: true, isWorkspaceLevel: false });
    const issueIdsByGroup: Record<string, string[]> = { [ALL_ISSUES]: ["issue-1", "issue-2"] };

    expect(groups?.[0].id).toBe(ALL_ISSUES);
    expect(issueIdsByGroup[groups![0].id]).toHaveLength(2);
  });

  it("uses the same key for ungrouped sub-work items and epics", () => {
    const groups = getGroupByColumns({ groupBy: null, includeNone: true, isWorkspaceLevel: false, isEpic: true });

    expect(groups?.[0].id).toBe(ALL_ISSUES);
  });
});
