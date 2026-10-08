/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BRAND_NAME } from "@plane/constants";

import { useState, useRef } from "react";
import { observer } from "mobx-react";
import { HelpCircle, MoveLeft } from "lucide-react";
import { Transition } from "@headlessui/react";
// plane internal packages
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
// hooks
import { useInstance, useTheme } from "@/hooks/store";
// assets

export const AdminSidebarHelpSection = observer(function AdminSidebarHelpSection() {
  // states
  const [isNeedHelpOpen, setIsNeedHelpOpen] = useState(false);
  // store
  const { instance } = useInstance();
  const { isSidebarCollapsed, toggleSidebar } = useTheme();
  // refs
  const helpOptionsRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      className={cn(
        "flex h-14 w-full flex-shrink-0 items-center justify-between gap-1 self-baseline border-t border-subtle bg-surface-1 px-4",
        {
          "h-auto flex-col py-1.5": isSidebarCollapsed,
        }
      )}
    >
      <div className={`flex items-center gap-1 ${isSidebarCollapsed ? "flex-col justify-center" : "w-full"}`}>
        <Tooltip tooltipContent="帮助" position={isSidebarCollapsed ? "right" : "top"} className="ml-4">
          <button
            type="button"
            aria-label="帮助"
            className={`ml-auto grid place-items-center rounded-md p-1.5 text-secondary outline-none hover:bg-layer-1-hover hover:text-primary ${
              isSidebarCollapsed ? "w-full" : ""
            }`}
            onClick={() => setIsNeedHelpOpen((prev) => !prev)}
          >
            <HelpCircle className="size-4" />
          </button>
        </Tooltip>
        <Tooltip tooltipContent="折叠或展开侧边栏" position={isSidebarCollapsed ? "right" : "top"} className="ml-4">
          <button
            type="button"
            aria-label="折叠或展开侧边栏"
            className={`grid place-items-center rounded-md p-1.5 text-secondary outline-none hover:bg-layer-1-hover hover:text-primary ${
              isSidebarCollapsed ? "w-full" : ""
            }`}
            onClick={() => toggleSidebar(!isSidebarCollapsed)}
          >
            <MoveLeft className={`size-4 duration-300 ${isSidebarCollapsed ? "rotate-180" : ""}`} />
          </button>
        </Tooltip>
      </div>

      <div className="relative">
        <Transition
          show={isNeedHelpOpen}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <div
            className={`absolute bottom-2 z-[15] min-w-[10rem] ${
              isSidebarCollapsed ? "left-full" : "-left-[75px]"
            } divide-y divide-subtle-1 rounded-sm bg-surface-1 p-1 whitespace-nowrap shadow-raised-100`}
            ref={helpOptionsRef}
          >
            <div className="space-y-1 pb-2">
              <div className="px-2 py-1 text-11 text-secondary">{`${BRAND_NAME}研发管理平台`}</div>
            </div>
            <div className="px-2 pt-2 pb-1 text-10">版本：v{instance?.current_version}</div>
          </div>
        </Transition>
      </div>
    </div>
  );
});
