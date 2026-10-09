import { describe, expect, it } from "vitest";
import { EIssueLayoutTypes } from "@plane/types";
import { IssueFilterHelperStore } from "./issue-filter-helper.store";

describe("issue layout relation expansion", () => {
  const store = new IssueFilterHelperStore();

  it("loads both relation directions with the kanban list", () => {
    const params = store.computedFilteredParams({}, { layout: EIssueLayoutTypes.KANBAN }, []);
    expect(params.expand).toBe("issue_relation,issue_related");
  });

  it.each([EIssueLayoutTypes.LIST, EIssueLayoutTypes.SPREADSHEET, EIssueLayoutTypes.CALENDAR, EIssueLayoutTypes.GANTT])(
    "loads both relation directions with the %s layout",
    (layout) => {
      const params = store.computedFilteredParams({}, { layout }, []);
      expect(params.expand).toBe("issue_relation,issue_related");
    }
  );
});
