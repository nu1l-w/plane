import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { IDashboardRiskItem } from "@/services/dashboard.service";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/propel/icons", () => ({ ChevronRightIcon: () => null }));
vi.mock("next/link", () => ({ default: "a" }));
import { DashboardBlockedItems } from "./dashboard-blocked-items";

const task: IDashboardRiskItem = {
  id: "delivery",
  name: "Ship feature",
  sequence_id: 10,
  priority: "high",
  target_date: null,
  updated_at: "2026-10-06T00:00:00Z",
  project_id: "delivery-project",
  project__name: "Delivery",
  project__identifier: "DLV",
  assignees: [{ id: "owner", name: "Delivery owner" }],
  overdue_days: 0,
};

describe("blocked task details", () => {
  it("links the blocked task and every cross-project prerequisite separately with their owners", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardBlockedItems, {
        workspaceSlug: "team",
        items: [
          {
            ...task,
            blockers: [
              {
                ...task,
                id: "first",
                name: "Prepare API",
                project_id: "upstream-project",
                project__identifier: "UPS",
                assignees: [{ id: "other", name: "API owner" }],
              },
              { ...task, id: "second", name: "Review spec", assignees: [] },
            ],
          },
        ],
      })
    );
    expect(html).toContain('href="/team/projects/delivery-project/issues/delivery"');
    expect(html).toContain('href="/team/projects/upstream-project/issues/first"');
    expect(html).toContain('href="/team/projects/delivery-project/issues/second"');
    expect(html).toContain("Delivery owner");
    expect(html).toContain("API owner");
    expect(html).toContain("dashboard_overview.filters.unassigned");
    expect(html.match(/<a /g)).toHaveLength(3);
    expect(html).not.toMatch(/<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /);
  });
});
