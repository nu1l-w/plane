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
