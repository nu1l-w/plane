/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { useTranslation } from "@plane/i18n";
import { ChevronRightIcon } from "@plane/propel/icons";
import type { IDashboardRiskItem } from "@/services/dashboard.service";

export function DashboardBlockedItems({
  workspaceSlug,
  items,
}: {
  workspaceSlug: string;
  items: IDashboardRiskItem[];
}) {
  const { t } = useTranslation();
  const assignees = (item: IDashboardRiskItem) =>
    item.assignees.map((member) => member.name || member.id).join(", ") || t("dashboard_overview.filters.unassigned");
  const href = (item: IDashboardRiskItem) => `/${workspaceSlug}/projects/${item.project_id}/issues/${item.id}`;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-subtle p-4">
          <Link
            href={href(item)}
            className="group flex items-start justify-between gap-3 rounded-sm outline-none hover:text-accent-primary focus-visible:ring-2 focus-visible:ring-accent-strong"
          >
            <div className="min-w-0">
              <p className="text-13 font-medium text-primary group-hover:text-accent-primary">
                <span className="mr-2 text-tertiary">
                  {item.project__identifier}-{item.sequence_id}
                </span>
                {item.name}
              </p>
              <p className="mt-1 text-12 text-tertiary">
                {item.project__name} · {t(item.priority)} · {assignees(item)}
              </p>
            </div>
            <ChevronRightIcon className="mt-1 size-3.5 shrink-0" />
          </Link>
          <h3 className="mt-4 mb-2 text-12 font-medium text-secondary">{t("dashboard_overview.blocked_by")}</h3>
          <ul className="space-y-1">
            {(item.blockers ?? []).map((blocker) => (
              <li key={blocker.id}>
                <Link
                  href={href(blocker)}
                  className="block rounded-md border-l-2 border-warning-subtle bg-layer-1 px-3 py-2 outline-none hover:bg-layer-2 focus-visible:ring-2 focus-visible:ring-accent-strong"
                >
                  <p className="text-13 text-primary">
                    <span className="mr-2 text-tertiary">
                      {blocker.project__identifier}-{blocker.sequence_id}
                    </span>
                    {blocker.name}
                  </p>
                  <p className="mt-1 text-12 text-tertiary">
                    {blocker.project__name} · {assignees(blocker)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
