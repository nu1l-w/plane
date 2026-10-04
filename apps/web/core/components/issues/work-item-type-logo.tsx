/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TLogoProps, TWorkItemType } from "@plane/types";
import { Logo } from "@plane/propel/emoji-icon-picker";

export const WORK_ITEM_TYPE_ICON_PRESETS = ["requirement", "task", "defect"] as const;
export type TWorkItemTypeIconPreset = (typeof WORK_ITEM_TYPE_ICON_PRESETS)[number];

const ICON_PRESET_PREFIX = "work-item-type:";

const WORK_ITEM_TYPE_ICON_ASSETS: Record<TWorkItemTypeIconPreset, string> = {
  requirement: "/work-item-type-icons/requirement.svg",
  task: "/work-item-type-icons/task.svg",
  defect: "/work-item-type-icons/defect.svg",
};

const LEGACY_ICON_PRESET_BY_NAME: Record<string, TWorkItemTypeIconPreset> = {
  task: "task",
  任务: "task",
  requirement: "requirement",
  需求: "requirement",
  defect: "defect",
  bug: "defect",
  缺陷: "defect",
};

export function getConfiguredWorkItemTypeIconPreset(
  workItemType: Pick<TWorkItemType, "logo_props">
): TWorkItemTypeIconPreset | undefined {
  const iconName = workItemType.logo_props?.icon?.name;
  if (!iconName?.startsWith(ICON_PRESET_PREFIX)) return undefined;

  const preset = iconName.slice(ICON_PRESET_PREFIX.length);
  return WORK_ITEM_TYPE_ICON_PRESETS.includes(preset as TWorkItemTypeIconPreset)
    ? (preset as TWorkItemTypeIconPreset)
    : undefined;
}

export function getWorkItemTypeIconPreset(
  workItemType: Pick<TWorkItemType, "name" | "logo_props">
): TWorkItemTypeIconPreset | undefined {
  const configuredPreset = getConfiguredWorkItemTypeIconPreset(workItemType);
  if (configuredPreset) return configuredPreset;

  // Keep existing types working until their icon is explicitly selected in settings.
  return LEGACY_ICON_PRESET_BY_NAME[workItemType.name.trim().toLowerCase()];
}

export function getWorkItemTypeIconLogoProps(preset: TWorkItemTypeIconPreset): Partial<TLogoProps> {
  return {
    in_use: "icon",
    icon: { name: `${ICON_PRESET_PREFIX}${preset}` },
  };
}

type Props = {
  workItemType: TWorkItemType;
  size?: number;
};

export function WorkItemTypeLogo({ workItemType, size = 16 }: Props) {
  const logo = workItemType.logo_props;
  const preset = getWorkItemTypeIconPreset(workItemType);
  const defaultIcon = preset ? WORK_ITEM_TYPE_ICON_ASSETS[preset] : undefined;

  if (defaultIcon) {
    return (
      <img
        src={defaultIcon}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return <Logo logo={logo} size={size} />;
}
