/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssueActivity } from "@plane/types";

export const getRelationActivityContent = (activity: TIssueActivity | undefined): string | undefined => {
  if (!activity) return;

  switch (activity.field) {
    case "blocking":
      return activity.old_value === "" ? `已标记此工作项正在阻塞工作项 ` : `已移除阻塞工作项 `;
    case "blocked_by":
      return activity.old_value === "" ? `已标记此工作项被 ` : `已移除此工作项被工作项 `;
    case "duplicate":
      return activity.old_value === "" ? `已标记此工作项为` : `已移除此工作项作为`;
    case "relates_to":
      return activity.old_value === "" ? `已标记此工作项关联到 ` : `已移除与`;
  }

  return;
};
