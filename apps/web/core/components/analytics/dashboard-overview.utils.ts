/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const DASHBOARD_STATE_GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled"] as const;

export function getActionableTotal(total: number, cancelled: number): number {
  return Math.max(0, total - cancelled);
}

export function getCompletionPercentage(completed: number, total: number, cancelled = 0): number {
  const actionable = getActionableTotal(total, cancelled);
  return actionable > 0 ? Math.round((completed / actionable) * 100) : 0;
}

export function getStateDistribution(states: Record<string, number>) {
  return DASHBOARD_STATE_GROUPS.map((group) => ({
    group,
    count: states[group] ?? 0,
  }));
}

export function getDashboardHref(
  workspaceSlug: string,
  searchParams: URLSearchParams,
  changes: Record<string, string | null>
): string {
  const params = new URLSearchParams(searchParams);
  Object.entries(changes).forEach(([key, value]) => {
    if (value) params.set(key, value);
    else params.delete(key);
  });
  const query = params.toString();
  return `/${encodeURIComponent(workspaceSlug)}/dashboards${query ? `?${query}` : ""}`;
}

export type TProjectSort = "overdue" | "completion" | "name";

export function sortDashboardProjects<
  T extends { name: string; total: number; completed: number; cancelled: number; overdue: number },
>(projects: T[], sort: TProjectSort): T[] {
  // Sort a copy for compatibility with the app's ES2022 target.
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...projects].sort((a, b) => {
    const difference =
      sort === "overdue"
        ? b.overdue - a.overdue
        : sort === "completion"
          ? getCompletionPercentage(b.completed, b.total, b.cancelled) -
            getCompletionPercentage(a.completed, a.total, a.cancelled)
          : 0;
    return difference || a.name.localeCompare(b.name);
  });
}
