/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TLogoProps } from "../common";

export type TWorkItemType = {
  id: string;
  name: string;
  description: string;
  logo_props: Partial<TLogoProps>;
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
  is_defect: boolean;
};
