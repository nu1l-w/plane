/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TProjectWorkItemType, TWorkItemType } from "@plane/types";
import { APIService } from "@/services/api.service";

export class WorkItemTypeService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getWorkspaceTypes(workspaceSlug: string): Promise<TWorkItemType[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/work-item-types/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createWorkspaceType(workspaceSlug: string, data: Pick<TWorkItemType, "name">): Promise<TWorkItemType> {
    return this.post(`/api/workspaces/${workspaceSlug}/work-item-types/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getProjectTypes(workspaceSlug: string, projectId: string): Promise<TProjectWorkItemType[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/work-item-types/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async addProjectType(workspaceSlug: string, projectId: string, issueTypeId: string): Promise<TProjectWorkItemType> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/work-item-types/`, {
      issue_type_id: issueTypeId,
    })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateProjectType(
    workspaceSlug: string,
    projectId: string,
    projectTypeId: string,
    data: Partial<Pick<TProjectWorkItemType, "is_default" | "is_defect" | "level">>
  ): Promise<TProjectWorkItemType> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/work-item-types/${projectTypeId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async removeProjectType(workspaceSlug: string, projectId: string, projectTypeId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/work-item-types/${projectTypeId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
