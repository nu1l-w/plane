/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
import { Flag } from "lucide-react";
import { cn } from "../utils";

export type TIssuePriorities = "urgent" | "high" | "medium" | "low" | "none";

interface IPriorityIcon {
  className?: string;
  containerClassName?: string;
  priority: TIssuePriorities | undefined | null;
  size?: number;
  withContainer?: boolean;
}

export function PriorityIcon(props: IPriorityIcon) {
  const { priority, className = "", containerClassName = "", size = 14, withContainer = false } = props;

  const priorityClasses = {
    urgent: "text-priority-urgent",
    high: "text-priority-high",
    medium: "text-priority-medium",
    low: "text-priority-low",
    none: "text-priority-none",
  };

  const icon = (
    <Flag
      size={size}
      fill="currentColor"
      className={cn("flex-shrink-0", priorityClasses[priority ?? "none"], className)}
      aria-hidden="true"
    />
  );

  return withContainer ? (
    <div
      className={cn("flex flex-shrink-0 items-center justify-center p-0.5", containerClassName)}
      style={{ width: size + 4, height: size + 4 }}
    >
      {icon}
    </div>
  ) : (
    icon
  );
}
