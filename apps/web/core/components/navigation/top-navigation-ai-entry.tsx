/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams, usePathname } from "next/navigation";
import { Link } from "react-router";
import { PiChatLogo } from "@plane/propel/icons";
import { Tooltip } from "@plane/propel/tooltip";

export function TopNavigationAIEntry() {
  const { workspaceSlug } = useParams();
  const pathname = usePathname();
  const workspacePath = workspaceSlug?.toString();
  const isActive = workspacePath ? (pathname?.includes(`/${workspacePath}/pi-chat`) ?? false) : false;

  return (
    <Tooltip tooltipHeading="StarAxis AI" tooltipContent="总结项目进展 · 查询工作项 · 起草任务" position="bottom">
      <Link
        to={workspacePath ? `/${workspacePath}/pi-chat/` : "/"}
        aria-label="打开 StarAxis AI：总结项目进展、查询工作项、起草任务"
        aria-current={isActive ? "page" : undefined}
        className={`top-navigation-ai-entry focus-visible:ring-accent-primary/40 relative flex h-7 items-center gap-2 overflow-hidden rounded-lg border px-2.5 text-13 font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none ${
          isActive
            ? "border-subtle-1 bg-accent-primary/10 text-primary"
            : "hover:border-accent-primary/20 border-subtle-1 bg-layer-2/60 text-secondary hover:bg-layer-2 hover:text-primary"
        }`}
      >
        <span className="from-violet-400/20 via-indigo-400/20 to-sky-400/20 relative z-[1] flex size-[18px] shrink-0 items-center justify-center rounded-md bg-gradient-to-br">
          <PiChatLogo className="top-navigation-ai-mark text-violet-500 dark:text-violet-300 size-4" />
        </span>
        <span className="relative z-[1]">StarAxis AI</span>
      </Link>
    </Tooltip>
  );
}
