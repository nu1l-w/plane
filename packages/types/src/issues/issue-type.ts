/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TWorkItemType = {
  id: string;
  name: string;
  description: string;
  logo_props: Record<string, unknown>;
  is_epic: boolean;
  is_active: boolean;
  level: number;
  workspace: string;
};

export type TProjectWorkItemType = {
  id: string;
  issue_type: string;
  work_item_type: TWorkItemType;
  level: number;
  is_default: boolean;
};
