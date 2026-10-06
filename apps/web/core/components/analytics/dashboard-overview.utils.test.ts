import { describe, expect, it } from "vitest";
import {
  getActionableTotal,
  getCompletionPercentage,
  getDashboardHref,
  getStateDistribution,
  sortDashboardProjects,
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

describe("project sorting", () => {
  const projects = [
    { name: "Alpha", total: 4, completed: 1, cancelled: 2, overdue: 0 },
    { name: "Beta", total: 8, completed: 2, cancelled: 0, overdue: 3 },
    { name: "Empty", total: 0, completed: 0, cancelled: 0, overdue: 0 },
  ];
  it("prioritizes overdue projects without mutating the response", () => {
    expect(sortDashboardProjects(projects, "overdue").map((p) => p.name)).toEqual(["Beta", "Alpha", "Empty"]);
    expect(projects[0].name).toBe("Alpha");
  });
  it("sorts completion using the actionable denominator and handles empty projects", () => {
    expect(sortDashboardProjects(projects, "completion").map((p) => p.name)).toEqual(["Alpha", "Beta", "Empty"]);
    expect(sortDashboardProjects(projects, "name").map((p) => p.name)).toEqual(["Alpha", "Beta", "Empty"]);
  });
  it("opens priority details without retaining a conflicting risk or page", () => {
    expect(
      getDashboardHref("team", new URLSearchParams("assignee_id=one&risk=stale&page=2"), {
        priority: "high",
        detail: "open",
        risk: null,
        page: null,
      })
    ).toBe("/team/dashboards?assignee_id=one&priority=high&detail=open");
  });
});
