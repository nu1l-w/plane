/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { THomeDashboardResponse, TWidget, TWidgetStatsResponse, TWidgetStatsRequestParams } from "@plane/types";
import { APIService } from "@/services/api.service";
// helpers
// types

export type TDashboardRisk = "blocked" | "overdue" | "due_soon" | "stale" | "high_priority_unassigned";
export type TDashboardDetail = "open" | "total" | "backlog" | "unstarted" | "in_progress" | "completed" | "cancelled";
export type TDashboardPriority = "urgent" | "high" | "medium" | "low" | "none";
export interface IWorkspaceDashboardFilters {
  project_id?: string;
  assignee_id?: string;
  created_range?: string;
  priority?: TDashboardPriority;
  risk?: TDashboardRisk;
  detail?: TDashboardDetail;
  page?: number;
}

export interface IDashboardRiskItem {
  id: string;
  name: string;
  sequence_id: number;
  priority: TDashboardPriority;
  assignees: { id: string; name: string }[];
  overdue_days: number;
  blockers?: IDashboardRiskItem[];
  target_date: string | null;
  updated_at: string;
  project_id: string;
  project__name: string;
  project__identifier: string;
}

export interface IWorkspaceDashboardOverview {
  summary: {
    projects: number;
    total: number;
    completed: number;
    in_progress: number;
    cancelled: number;
    overdue: number;
    blocked: number;
    due_soon: number;
    stale: number;
    high_priority_unassigned: number;
  };
  states: Record<string, number>;
  priorities: Record<TDashboardPriority, number>;
  member_distribution: { id: string; name: string; total: number; in_progress: number; overdue: number }[];
  available_projects: { id: string; name: string }[];
  assignees: { member_id: string; member__display_name: string }[];
  projects: {
    id: string;
    name: string;
    identifier: string;
    total: number;
    completed: number;
    cancelled: number;
    overdue: number;
  }[];
  weekly_trends: {
    week_start: string;
    created: number;
    completed: number;
    overdue: number;
  }[];
  overdue_items: IDashboardRiskItem[];
  risk_items: IDashboardRiskItem[];
  risk_total: number;
  risk_page: number;
  detail_items: IDashboardRiskItem[];
  detail_total: number;
  detail_page: number;
}

export class DashboardService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getWorkspaceOverview(
    workspaceSlug: string,
    filters: IWorkspaceDashboardFilters = {}
  ): Promise<IWorkspaceDashboardOverview> {
    const response = await this.get(`/api/workspaces/${encodeURIComponent(workspaceSlug)}/dashboard-overview/`, {
      params: filters,
    });
    return response.data;
  }

  async getHomeDashboardWidgets(workspaceSlug: string): Promise<THomeDashboardResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/dashboard/`, {
      params: {
        dashboard_type: "home",
      },
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getWidgetStats(
    workspaceSlug: string,
    dashboardId: string,
    params: TWidgetStatsRequestParams
  ): Promise<TWidgetStatsResponse> {
    return this.get(`/api/workspaces/${workspaceSlug}/dashboard/${dashboardId}/`, {
      params,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getDashboardDetails(dashboardId: string): Promise<TWidgetStatsResponse> {
    return this.get(`/api/dashboard/${dashboardId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateDashboardWidget(dashboardId: string, widgetId: string, data: Partial<TWidget>): Promise<TWidget> {
    return this.patch(`/api/dashboard/${dashboardId}/widgets/${widgetId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
