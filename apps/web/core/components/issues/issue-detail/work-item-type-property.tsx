/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { DropdownPropertyIcon } from "@plane/propel/icons";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
import { WorkItemTypeDropdown } from "@/components/dropdowns/work-item-type";
import { useProject } from "@/hooks/store/use-project";

type Props = {
  workspaceSlug: string;
  projectId: string;
  value: string | null | undefined;
  disabled: boolean;
  onChange: (typeId: string | null) => void;
};

export const IssueWorkItemTypeProperty = observer(function IssueWorkItemTypeProperty(props: Props) {
  const { workspaceSlug, projectId, value, disabled, onChange } = props;
  const { t } = useTranslation();
  const { getProjectById } = useProject();
  const project = getProjectById(projectId);

  if (!project?.is_issue_type_enabled) return null;

  return (
    <SidebarPropertyListItem icon={DropdownPropertyIcon} label={t("work_item_types.label")}>
      <WorkItemTypeDropdown
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        buttonVariant="transparent-with-text"
        className="group w-full grow"
        buttonContainerClassName="w-full text-left h-7.5"
        buttonClassName="text-body-xs-medium justify-between"
        dropdownArrow
        dropdownArrowClassName="h-3.5 w-3.5 hidden group-hover:inline"
      />
    </SidebarPropertyListItem>
  );
});
