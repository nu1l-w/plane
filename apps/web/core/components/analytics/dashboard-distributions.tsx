/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { useTranslation } from "@plane/i18n";
import type { IWorkspaceDashboardOverview, TDashboardPriority } from "@/services/dashboard.service";
import { getDashboardHref } from "./dashboard-overview.utils";

const priorities: { key: TDashboardPriority; color: string }[] = [
  { key: "urgent", color: "bg-danger-primary" },
  { key: "high", color: "bg-warning-primary" },
  { key: "medium", color: "bg-accent-primary" },
  { key: "low", color: "bg-success-primary" },
  { key: "none", color: "bg-layer-3" },
];
const cardClass = "rounded-lg border border-subtle bg-surface-1 p-4 md:p-5 xl:row-span-2 xl:grid xl:grid-rows-subgrid";
const rowClass =
  "block h-20 rounded-md px-2 py-2.5 outline-none transition-colors hover:bg-layer-1 focus-visible:ring-2 focus-visible:ring-accent-strong";

export function DashboardDistributions({
  workspaceSlug,
  data,
  searchParams,
}: {
  workspaceSlug: string;
  data: IWorkspaceDashboardOverview;
  searchParams: URLSearchParams;
}) {
  const { t } = useTranslation();
  const priorityTotal = priorities.reduce((sum, { key }) => sum + data.priorities[key], 0);
  const memberPeak = Math.max(1, ...data.member_distribution.map((member) => member.total));
  return (
    <>
      <section className={cardClass}>
        <div className="mb-3 min-h-20 xl:mb-0">
          <h2 className="text-16 font-semibold text-primary">{t("dashboard_overview.priority_distribution")}</h2>
          <p className="mt-1 text-12 leading-5 text-tertiary">{t("dashboard_overview.open_work_hint")}</p>
        </div>
        {priorityTotal === 0 ? (
          <p className="py-10 text-center text-13 text-tertiary">{t("dashboard_overview.no_work_items")}</p>
        ) : (
          <div className="-mx-2 max-h-[400px] overflow-y-auto xl:h-[400px]">
            {priorities.map(({ key, color }) => (
              <Link
                key={key}
                className={rowClass}
                href={getDashboardHref(workspaceSlug, searchParams, {
                  priority: key,
                  risk: null,
                  detail: "open",
                  page: null,
                })}
                aria-current={searchParams.get("priority") === key ? "page" : undefined}
              >
                <div className="mb-2 flex items-center justify-between text-13">
                  <span className="flex items-center gap-2 text-secondary">
                    <span className={`size-2 rounded-full ${color}`} />
                    {t(key)}
                  </span>
                  <span className="font-medium text-primary">{data.priorities[key]}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-layer-1">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${(data.priorities[key] / priorityTotal) * 100}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className={cardClass}>
        <div className="mb-3 min-h-20 xl:mb-0">
          <h2 className="text-16 font-semibold text-primary">{t("dashboard_overview.member_distribution")}</h2>
          <p className="mt-1 text-12 leading-5 text-tertiary">{t("dashboard_overview.member_hint")}</p>
        </div>
        {data.member_distribution.length === 0 ? (
          <p className="py-10 text-center text-13 text-tertiary">{t("dashboard_overview.no_work_items")}</p>
        ) : (
          <div className="-mx-2 max-h-[400px] overflow-y-auto xl:h-[400px]">
            {data.member_distribution.map((member) => (
              <Link
                key={member.id}
                className={rowClass}
                href={getDashboardHref(workspaceSlug, searchParams, {
                  assignee_id: member.id,
                  detail: null,
                  risk: null,
                  page: null,
                })}
                aria-current={searchParams.get("assignee_id") === member.id ? "page" : undefined}
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-13">
                  <span className="truncate font-medium text-primary">
                    {member.id === "unassigned" ? t("dashboard_overview.filters.unassigned") : member.name || member.id}
                  </span>
                  <span className="shrink-0 text-secondary">{member.total}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-layer-1">
                  <div
                    className="h-full rounded-full bg-accent-primary"
                    style={{ width: `${(member.total / memberPeak) * 100}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-12 text-tertiary">
                  <span>{t("dashboard_overview.member_started", { count: member.in_progress })}</span>
                  {member.overdue > 0 && (
                    <span className="text-danger-primary">
                      {t("dashboard_overview.project_overdue", { count: member.overdue })}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
