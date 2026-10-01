/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import type { IIssueDisplayProperties, TIssue } from "@plane/types";
import { useProject } from "@/hooks/store/use-project";
import { WorkItemTypeService } from "@/services/issue/work-item-type.service";

const workItemTypeService = new WorkItemTypeService();

type Props = {
  issue: TIssue;
  workspaceSlug: string | undefined;
  displayProperties: IIssueDisplayProperties | undefined;
};

export const WorkItemSummary = observer(function WorkItemSummary(props: Props) {
  const { issue, workspaceSlug, displayProperties } = props;
  const { t } = useTranslation();
  const { getProjectById, getProjectIdentifierById } = useProject();
  const project = getProjectById(issue.project_id);
  const shouldShowType = displayProperties?.issue_type ?? true;
  const shouldShowParent = displayProperties?.parent ?? true;
  const parent = issue.parent;
  const hasDefectSummary = (issue.defect_count ?? 0) > 0;

  const { data: projectTypes } = useSWR(
    shouldShowType && workspaceSlug && issue.project_id && project?.is_issue_type_enabled
      ? `PROJECT_WORK_ITEM_TYPES_${workspaceSlug}_${issue.project_id}`
      : null,
    workspaceSlug && issue.project_id
      ? () => workItemTypeService.getProjectTypes(workspaceSlug, issue.project_id as string)
      : null
  );
  const workItemType = projectTypes?.find(
    (projectType) => projectType.issue_type === issue.type_id && projectType.work_item_type.is_active
  );
  const parentIdentifier = parent?.project_id
    ? `${getProjectIdentifierById(parent.project_id) ?? ""}-${parent.sequence_id ?? ""}`
    : "";
  const hasSummary = (shouldShowType && !!workItemType) || (shouldShowParent && !!parent?.name) || hasDefectSummary;

  if (!hasSummary) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-11 text-tertiary">
      {shouldShowType && workItemType && (
        <span className="shrink-0 rounded-sm border border-subtle bg-layer-1 px-1.5 py-0.5">
          {workItemType.work_item_type.name}
        </span>
      )}
      {shouldShowParent && parent?.name && (
        <span className="flex min-w-0 items-center gap-1 truncate">
          <span className="shrink-0 text-placeholder">{t("issue.display.properties.parent")}:</span>
          {parentIdentifier && <span className="shrink-0 text-placeholder">{parentIdentifier}</span>}
          <span className="truncate text-secondary">{parent.name}</span>
        </span>
      )}
      {hasDefectSummary && (
        <span className="shrink-0 rounded-sm border border-subtle bg-layer-1 px-1.5 py-0.5">
          {t("issue.display.properties.defect_summary", {
            total: issue.defect_count,
            open: issue.open_defect_count ?? 0,
            mine: issue.my_open_defect_count ?? 0,
          })}
        </span>
      )}
    </div>
  );
});
