import { describe, expect, it } from "vitest";
import { ENABLE_ISSUE_DEPENDENCIES } from "@plane/constants";
import { EIssueLayoutTypes } from "@plane/types";
import { IssueFilterHelperStore } from "./issue-filter-helper.store";

describe("kanban relation expansion", () => {
  const store = new IssueFilterHelperStore();

  it("loads both relation directions with the kanban list", () => {
    const params = store.computedFilteredParams({}, { layout: EIssueLayoutTypes.KANBAN }, []);
    expect(params.expand).toBe("issue_relation,issue_related");
  });

  it("does not expand relations for other layouts", () => {
    const params = store.computedFilteredParams({}, { layout: EIssueLayoutTypes.LIST }, []);
    expect(params.expand).toBeUndefined();
  });

  it("preserves the gantt dependency feature flag", () => {
    const params = store.computedFilteredParams({}, { layout: EIssueLayoutTypes.GANTT }, []);
    expect(params.expand).toBe(ENABLE_ISSUE_DEPENDENCIES ? "issue_relation,issue_related" : undefined);
  });
});
