import { describe, expect, it } from "vitest";
import {
  getActionableTotal,
  getCompletionPercentage,
  getDashboardHref,
  getStateDistribution,
} from "./dashboard-overview.utils";

describe("dashboard overview", () => {
  it("avoids division by zero for projects without work items", () => {
    expect(getCompletionPercentage(0, 0)).toBe(0);
  });

  it("rounds completion percentage consistently", () => {
    expect(getCompletionPercentage(2, 3)).toBe(67);
  });

  it("excludes cancelled work from the progress denominator, even when all work is cancelled", () => {
    expect(getActionableTotal(5, 2)).toBe(3);
    expect(getCompletionPercentage(2, 5, 2)).toBe(67);
    expect(getCompletionPercentage(0, 2, 2)).toBe(0);
  });

  it("includes empty state groups in a stable order", () => {
    expect(getStateDistribution({ completed: 2, started: 1 })).toEqual([
      { group: "backlog", count: 0 },
      { group: "unstarted", count: 0 },
      { group: "started", count: 1 },
      { group: "completed", count: 2 },
      { group: "cancelled", count: 0 },
    ]);
  });

  it("preserves filters while opening a risk list or changing its page", () => {
    const filters = new URLSearchParams("project_id=one&created_range=last_30_days");
    const riskHref = getDashboardHref("team", filters, { risk: "overdue", page: null });
    expect(riskHref).toBe("/team/dashboards?project_id=one&created_range=last_30_days&risk=overdue");
    expect(getDashboardHref("team", new URLSearchParams(riskHref.split("?")[1]), { page: "2" })).toBe(
      "/team/dashboards?project_id=one&created_range=last_30_days&risk=overdue&page=2"
    );
  });

  it("removes a risk and its page when returning to overview", () => {
    expect(
      getDashboardHref("team", new URLSearchParams("project_id=one&risk=stale&page=3"), {
        risk: null,
        page: null,
      })
    ).toBe("/team/dashboards?project_id=one");
  });

  it("preserves filters while opening a metric detail and clears conflicting views", () => {
    const filters = new URLSearchParams("priority=high&risk=overdue&page=2");
    expect(getDashboardHref("team", filters, { detail: "completed", risk: null, page: null })).toBe(
      "/team/dashboards?priority=high&detail=completed"
    );
  });
});
