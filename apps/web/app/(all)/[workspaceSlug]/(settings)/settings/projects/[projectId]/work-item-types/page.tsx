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
import {
  getConfiguredWorkItemTypeIconPreset,
  getWorkItemTypeIconLogoProps,
  WorkItemTypeLogo,
  type TWorkItemTypeIconPreset,
} from "@/components/issues/work-item-type-logo";
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
  const [newTypeIcon, setNewTypeIcon] = useState<TWorkItemTypeIconPreset | "">("");
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
  const workItemTypeIconOptions: { value: TWorkItemTypeIconPreset; label: string }[] = [
    { value: "requirement", label: t("work_item_types.settings.icon_presets.requirement") },
    { value: "task", label: t("work_item_types.settings.icon_presets.task") },
    { value: "defect", label: t("work_item_types.settings.icon_presets.defect") },
  ];
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
    if (!workspaceSlug || !newTypeName.trim() || !newTypeIcon) return;
    try {
      const issueType = await workItemTypeService.createWorkspaceType(workspaceSlug, {
        name: newTypeName.trim(),
        logo_props: getWorkItemTypeIconLogoProps(newTypeIcon),
      });
      await workItemTypeService.addProjectType(workspaceSlug, projectId, issueType.id);
      setNewTypeName("");
      setNewTypeIcon("");
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

  const toggleDefectType = async (projectType: TProjectWorkItemType) => {
    if (!workspaceSlug || !projectId) return;
    try {
      await workItemTypeService.updateProjectType(workspaceSlug, projectId, projectType.id, {
        is_defect: !projectType.is_defect,
      });
      await mutateProjectTypes();
    } catch {
      showError();
    }
  };

  const updateTypeIcon = async (projectType: TProjectWorkItemType, icon: TWorkItemTypeIconPreset) => {
    if (!workspaceSlug) return;
    try {
      await workItemTypeService.updateWorkspaceType(workspaceSlug, projectType.work_item_type.id, {
        logo_props: getWorkItemTypeIconLogoProps(icon),
      });
      await refreshTypes();
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
            <p className="mt-1 text-caption-sm-regular text-tertiary">{t("work_item_types.settings.icon_scope")}</p>
          </div>

          <div className="rounded-lg border border-subtle bg-surface-1">
            {projectTypes?.length ? (
              <div className="divide-y divide-subtle">
                {projectTypes.map((projectType) => (
                  <div key={projectType.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <WorkItemTypeLogo workItemType={projectType.work_item_type} size={20} />
                      <div className="min-w-0">
                        <p className="truncate text-body-sm-medium">{projectType.work_item_type.name}</p>
                        {projectType.is_default && (
                          <p className="mt-0.5 text-caption-sm-regular text-tertiary">
                            {t("work_item_types.settings.set_as_default")}
                          </p>
                        )}
                        {projectType.is_defect && (
                          <p className="mt-0.5 text-caption-sm-regular text-tertiary">
                            {t("work_item_types.settings.defect_type")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <label className="flex items-center gap-1.5 text-caption-sm-regular text-tertiary">
                        {t("work_item_types.settings.icon_label")}
                        <select
                          aria-label={t("work_item_types.settings.icon_label")}
                          className="h-8 rounded-md border border-subtle bg-layer-1 px-2 text-caption-sm-regular text-secondary"
                          value={getConfiguredWorkItemTypeIconPreset(projectType.work_item_type) ?? ""}
                          disabled={!canManageProject}
                          onChange={(event) => {
                            const icon = event.target.value as TWorkItemTypeIconPreset;
                            if (icon) void updateTypeIcon(projectType, icon);
                          }}
                        >
                          <option value="">{t("work_item_types.settings.icon_placeholder")}</option>
                          {workItemTypeIconOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!canManageProject}
                        onClick={() => toggleDefectType(projectType)}
                      >
                        {t(
                          projectType.is_defect
                            ? "work_item_types.settings.unset_as_defect"
                            : "work_item_types.settings.set_as_defect"
                        )}
                      </Button>
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
            <label className="flex min-w-48 flex-col gap-1.5 text-caption-md-medium text-secondary">
              {t("work_item_types.settings.icon_label")}
              <select
                className="h-9 rounded-md border border-subtle bg-layer-1 px-3 text-body-sm-regular"
                value={newTypeIcon}
                disabled={!canManageProject}
                onChange={(event) => setNewTypeIcon(event.target.value as TWorkItemTypeIconPreset | "")}
              >
                <option value="">{t("work_item_types.settings.icon_placeholder")}</option>
                {workItemTypeIconOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="primary"
              size="base"
              disabled={!canManageProject || !newTypeName.trim() || !newTypeIcon}
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
