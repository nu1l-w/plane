/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import type { Placement } from "@popperjs/core";
import { useTranslation } from "@plane/i18n";
import { ChevronDownIcon } from "@plane/propel/icons";
import { CustomSelect } from "@plane/ui";
import { cn } from "@plane/utils";
import { WorkItemTypeLogo } from "@/components/issues/work-item-type-logo";
import { useProject } from "@/hooks/store/use-project";
import { WorkItemTypeService } from "@/services/issue/work-item-type.service";
import { DropdownButton } from "./buttons";
import { BUTTON_VARIANTS_WITH_TEXT } from "./constants";
import type { TButtonVariants } from "./types";

const workItemTypeService = new WorkItemTypeService();

type Props = {
  workspaceSlug: string | undefined;
  projectId: string | null | undefined;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  applyDefault?: boolean;
  onClose?: () => void;
  buttonVariant?: TButtonVariants;
  buttonClassName?: string;
  buttonContainerClassName?: string;
  className?: string;
  hideIcon?: boolean;
  placeholder?: string;
  placement?: Placement;
  showTooltip?: boolean;
  tabIndex?: number;
  dropdownArrow?: boolean;
  dropdownArrowClassName?: string;
};

export const WorkItemTypeDropdown = observer(function WorkItemTypeDropdown(props: Props) {
  const {
    workspaceSlug,
    projectId,
    value,
    onChange,
    disabled = false,
    applyDefault = false,
    onClose,
    buttonVariant,
    buttonClassName,
    buttonContainerClassName,
    className,
    hideIcon = false,
    placeholder,
    placement,
    showTooltip = false,
    tabIndex,
    dropdownArrow = false,
    dropdownArrowClassName,
  } = props;
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
  const selectedProjectType = activeProjectTypes.find((projectType) => projectType.issue_type === value);
  const emptyPlaceholder = placeholder ?? t("work_item_types.select_placeholder");

  useEffect(() => {
    if (!applyDefault || value || !activeProjectTypes.length) return;
    const defaultType = activeProjectTypes.find((projectType) => projectType.is_default);
    if (defaultType) onChange(defaultType.issue_type);
  }, [activeProjectTypes, applyDefault, onChange, value]);

  if (!isEnabled || activeProjectTypes.length === 0) return null;

  if (buttonVariant) {
    return (
      <CustomSelect
        className={cn("min-w-0", className)}
        customButtonClassName={cn("h-full min-w-0", buttonContainerClassName)}
        customButton={
          <DropdownButton
            className={cn("min-w-0", buttonClassName)}
            isActive={false}
            tooltipHeading={t("work_item_types.label")}
            tooltipContent={selectedProjectType?.work_item_type.name ?? emptyPlaceholder}
            showTooltip={showTooltip}
            variant={buttonVariant}
          >
            {!hideIcon && selectedProjectType && (
              <WorkItemTypeLogo workItemType={selectedProjectType.work_item_type} size={12} />
            )}
            {BUTTON_VARIANTS_WITH_TEXT.includes(buttonVariant) && (
              <span className="min-w-0 flex-grow truncate text-left">
                {selectedProjectType?.work_item_type.name ?? emptyPlaceholder}
              </span>
            )}
            {dropdownArrow && (
              <ChevronDownIcon className={cn("h-2.5 w-2.5 flex-shrink-0", dropdownArrowClassName)} aria-hidden="true" />
            )}
          </DropdownButton>
        }
        value={value}
        onChange={(typeId: string | null) => {
          onChange(typeId);
          onClose?.();
        }}
        disabled={disabled}
        placement={placement}
        tabIndex={tabIndex}
      >
        {activeProjectTypes.map((projectType) => (
          <CustomSelect.Option key={projectType.issue_type} value={projectType.issue_type}>
            <div className="flex items-center gap-2">
              <WorkItemTypeLogo workItemType={projectType.work_item_type} size={12} />
              <span className="truncate">{projectType.work_item_type.name}</span>
            </div>
          </CustomSelect.Option>
        ))}
      </CustomSelect>
    );
  }

  return (
    <select
      aria-label={t("work_item_types.label")}
      className="h-7 max-w-48 rounded-md border border-subtle bg-layer-1 px-2 text-caption-sm-regular text-secondary"
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
      onBlur={onClose}
    >
      <option value="">{emptyPlaceholder}</option>
      {activeProjectTypes.map((projectType) => (
        <option key={projectType.issue_type} value={projectType.issue_type}>
          {projectType.work_item_type.name}
        </option>
      ))}
    </select>
  );
});
