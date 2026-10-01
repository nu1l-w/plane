import { afterEach, describe, expect, it, vi } from "vitest";
import { ALL_ISSUES, STATE_GROUPS } from "@plane/constants";
import type { IState } from "@plane/types";
import { store } from "@/lib/store-context";
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

describe("state columns", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["Backlog", "Todo", "In Progress", "Done", "Cancelled", "QA Review", "\u5f85\u9a8c\u6536"])(
    "preserves the configured name %s and the state ID",
    (name) => {
      const state: IState = {
        id: "state-1",
        name,
        group: "started",
        color: "#f59e0b",
        default: false,
        description: "",
        project_id: "project-1",
        workspace_id: "workspace-1",
        sequence: 1,
        order: 1,
      };
      vi.spyOn(store.state, "getProjectStates").mockReturnValue([state]);

      const groups = getGroupByColumns({
        groupBy: "state",
        includeNone: false,
        isWorkspaceLevel: false,
        projectId: state.project_id,
      });

      expect(groups).toHaveLength(1);
      expect(groups?.[0]).toMatchObject({
        id: state.id,
        name,
        payload: { state_id: state.id },
      });
    }
  );

  it("keeps system group labels separate from their internal keys", () => {
    const groups = getGroupByColumns({
      groupBy: "state_detail.group",
      includeNone: false,
      isWorkspaceLevel: false,
    });

    expect(groups?.map(({ id, name }) => ({ id, name }))).toEqual(
      Object.values(STATE_GROUPS).map(({ key, label }) => ({ id: key, name: label }))
    );
  });
});
