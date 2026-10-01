/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";
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
    urgent: "bg-layer-2 text-priority-urgent border-priority-urgent",
    high: "bg-layer-2 text-priority-high border-priority-high",
    medium: "bg-layer-2 text-priority-medium border-priority-medium",
    low: "bg-layer-2 text-priority-low border-priority-low",
    none: "bg-layer-2 text-priority-none border-priority-none",
  };

  // priority labels
  const priorityLabels = {
    urgent: "P0",
    high: "P1",
    medium: "P2",
    low: "P3",
    none: "P4",
  };

  const label = priorityLabels[priority ?? "none"];

  return (
    <>
      {withContainer ? (
        <div
          className={cn(
            "flex flex-shrink-0 items-center justify-center rounded-sm border p-0.5 font-bold",
            priorityClasses[priority ?? "none"],
            containerClassName
          )}
          style={{ width: size + 4, height: size + 4 }}
        >
          <span style={{ fontSize: `${size * 0.7}px`, lineHeight: 1 }} className={cn("flex-shrink-0", className)}>
            {label}
          </span>
        </div>
      ) : (
        <span
          style={{ fontSize: `${size * 0.8}px`, width: size, height: size, lineHeight: 1 }}
          className={cn(
            "flex flex-shrink-0 items-center justify-center font-bold",
            {
              "text-priority-urgent": priority === "urgent",
              "text-priority-high": priority === "high",
              "text-priority-medium": priority === "medium",
              "text-priority-low": priority === "low",
              "text-priority-none": priority === "none",
            },
            className
          )}
        >
          {label}
        </span>
      )}
    </>
  );
}
