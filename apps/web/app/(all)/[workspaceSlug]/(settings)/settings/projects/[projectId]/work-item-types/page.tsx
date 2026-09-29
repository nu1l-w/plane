/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/propel/input";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TProjectWorkItemType } from "@plane/types";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
import { ProjectSettingsFeatureControlItem } from "@/components/settings/project/content/feature-control-item";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// services
import { WorkItemTypeService } from "@/services/issue/work-item-type.service";
// local imports
import type { Route } from "./+types/page";
import { WorkItemTypesProjectSettingsHeader } from "./header";

const workItemTypeService = new WorkItemTypeService();

function WorkItemTypesSettingsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const { t } = useTranslation();
  const { allowPermissions, workspaceUserInfo } = useUserPermissions();
  const { currentProjectDetails, getProjectById } = useProject();
  const [newTypeName, setNewTypeName] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const project = getProjectById(projectId) ?? currentProjectDetails;
  const canManageProject = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);

  const { data: workspaceTypes, mutate: mutateWorkspaceTypes } = useSWR(
    workspaceSlug ? `WORKSPACE_WORK_ITEM_TYPES_${workspaceSlug}` : null,
    workspaceSlug ? () => workItemTypeService.getWorkspaceTypes(workspaceSlug) : null
  );
  const { data: projectTypes, mutate: mutateProjectTypes } = useSWR(
    workspaceSlug && projectId ? `PROJECT_WORK_ITEM_TYPES_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => workItemTypeService.getProjectTypes(workspaceSlug, projectId) : null
  );

  const pageTitle = currentProjectDetails?.name
    ? `${currentProjectDetails.name} - ${t("project_settings.work_item_types.heading")}`
    : undefined;
  const projectTypeIds = new Set(projectTypes?.map((projectType) => projectType.issue_type) ?? []);
  const availableTypes = workspaceTypes?.filter((type) => type.is_active && !projectTypeIds.has(type.id)) ?? [];

  if (workspaceUserInfo && !canManageProject) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  const refreshTypes = async () => {
    await Promise.all([mutateWorkspaceTypes(), mutateProjectTypes()]);
  };

  const showError = () =>
    setToast({
      type: TOAST_TYPE.ERROR,
      title: t("error"),
      message: t("something_went_wrong"),
    });

  const addTypeToProject = async (issueTypeId: string) => {
    if (!workspaceSlug || !projectId || !issueTypeId) return;
    try {
      await workItemTypeService.addProjectType(workspaceSlug, projectId, issueTypeId);
      setSelectedTypeId("");
      await refreshTypes();
    } catch {
      showError();
    }
  };

  const createType = async () => {
    if (!workspaceSlug || !newTypeName.trim()) return;
    try {
      const issueType = await workItemTypeService.createWorkspaceType(workspaceSlug, { name: newTypeName.trim() });
      await workItemTypeService.addProjectType(workspaceSlug, projectId, issueType.id);
      setNewTypeName("");
      await refreshTypes();
    } catch {
      showError();
    }
  };

  const setDefaultType = async (projectType: TProjectWorkItemType) => {
    if (!workspaceSlug || !projectId) return;
    try {
      await workItemTypeService.updateProjectType(workspaceSlug, projectId, projectType.id, { is_default: true });
      await mutateProjectTypes();
    } catch {
      showError();
    }
  };

  const removeType = async (projectType: TProjectWorkItemType) => {
    if (!workspaceSlug || !projectId) return;
    try {
      await workItemTypeService.removeProjectType(workspaceSlug, projectId, projectType.id);
      await refreshTypes();
    } catch {
      showError();
    }
  };

  return (
    <SettingsContentWrapper header={<WorkItemTypesProjectSettingsHeader />}>
      <PageHead title={pageTitle} />
      <div className="w-full space-y-8">
        <section>
          <SettingsHeading
            title={t("project_settings.work_item_types.heading")}
            description={t("project_settings.work_item_types.description")}
          />
          <div className="mt-6">
            <ProjectSettingsFeatureControlItem
              title={t("work_item_types.label")}
              description={t("work_item_types.settings.description")}
              featureProperty="is_issue_type_enabled"
              projectId={projectId}
              value={!!project?.is_issue_type_enabled}
              workspaceSlug={workspaceSlug}
              disabled={!canManageProject}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-heading-sm">{t("work_item_types.label")}</h2>
            <p className="mt-1 text-body-sm-regular text-tertiary">
              {t("project_settings.work_item_types.description")}
            </p>
          </div>

          <div className="rounded-lg border border-subtle bg-surface-1">
            {projectTypes?.length ? (
              <div className="divide-y divide-subtle">
                {projectTypes.map((projectType) => (
                  <div key={projectType.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm-medium">{projectType.work_item_type.name}</p>
                      {projectType.is_default && (
                        <p className="mt-0.5 text-caption-sm-regular text-tertiary">
                          {t("work_item_types.settings.set_as_default")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!projectType.is_default && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canManageProject}
                          onClick={() => setDefaultType(projectType)}
                        >
                          {t("work_item_types.settings.set_as_default")}
                        </Button>
                      )}
                      <Button
                        variant="tertiary"
                        size="sm"
                        disabled={!canManageProject}
                        onClick={() => removeType(projectType)}
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-body-sm-regular text-tertiary">
                {t("work_item_types.settings.description")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-caption-md-medium text-secondary">
              {t("work_item_types.label")}
              <select
                className="h-9 rounded-md border border-subtle bg-layer-1 px-3 text-body-sm-regular"
                value={selectedTypeId}
                disabled={!canManageProject || availableTypes.length === 0}
                onChange={(event) => setSelectedTypeId(event.target.value)}
              >
                <option value="">{t("work_item_types.label")}</option>
                {availableTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              size="base"
              disabled={!canManageProject || !selectedTypeId}
              onClick={() => addTypeToProject(selectedTypeId)}
            >
              {t("add")}
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-caption-md-medium text-secondary">
              {t("work_item_types.label")}
              <Input
                value={newTypeName}
                disabled={!canManageProject}
                onChange={(event) => setNewTypeName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createType();
                  }
                }}
              />
            </label>
            <Button
              variant="primary"
              size="base"
              disabled={!canManageProject || !newTypeName.trim()}
              onClick={createType}
            >
              {t("create")}
            </Button>
          </div>
        </section>
      </div>
    </SettingsContentWrapper>
  );
}

export default observer(WorkItemTypesSettingsPage);
