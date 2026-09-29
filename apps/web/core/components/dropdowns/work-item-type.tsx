/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { useProject } from "@/hooks/store/use-project";
import { WorkItemTypeService } from "@/services/issue/work-item-type.service";

const workItemTypeService = new WorkItemTypeService();

type Props = {
  workspaceSlug: string | undefined;
  projectId: string | null | undefined;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  applyDefault?: boolean;
};

export const WorkItemTypeDropdown = observer(function WorkItemTypeDropdown(props: Props) {
  const { workspaceSlug, projectId, value, onChange, disabled = false, applyDefault = false } = props;
  const { t } = useTranslation();
  const { getProjectById } = useProject();
  const isEnabled = !!getProjectById(projectId)?.is_issue_type_enabled;
  const { data: projectTypes } = useSWR(
    workspaceSlug && projectId && isEnabled ? `PROJECT_WORK_ITEM_TYPES_${workspaceSlug}_${projectId}` : null,
    workspaceSlug && projectId ? () => workItemTypeService.getProjectTypes(workspaceSlug, projectId) : null
  );
  const activeProjectTypes = useMemo(
    () => projectTypes?.filter((projectType) => projectType.work_item_type.is_active) ?? [],
    [projectTypes]
  );

  useEffect(() => {
    if (!applyDefault || value || !activeProjectTypes.length) return;
    const defaultType = activeProjectTypes.find((projectType) => projectType.is_default);
    if (defaultType) onChange(defaultType.issue_type);
  }, [activeProjectTypes, applyDefault, onChange, value]);

  if (!isEnabled || activeProjectTypes.length === 0) return null;

  return (
    <select
      aria-label={t("work_item_types.label")}
      className="h-7 max-w-48 rounded-md border border-subtle bg-layer-1 px-2 text-caption-sm-regular text-secondary"
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">{t("work_item_types.label")}</option>
      {activeProjectTypes.map((projectType) => (
        <option key={projectType.issue_type} value={projectType.issue_type}>
          {projectType.work_item_type.name}
        </option>
      ))}
    </select>
  );
});
