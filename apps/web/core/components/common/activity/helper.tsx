/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BRAND_NAME } from "@plane/constants";

import type { FC, ReactNode } from "react";
import {
  RotateCcw,
  Network,
  Inbox,
  AlignLeft,
  Paperclip,
  Type,
  FileText,
  Hash,
  Clock,
  Bell,
  GitBranch,
  Timer,
  ListTodo,
  Layers,
} from "lucide-react";
// components

import {
  LinkIcon,
  ArchiveIcon,
  CycleIcon,
  GlobeIcon,
  DueDatePropertyIcon,
  EstimatePropertyIcon,
  GridLayoutIcon,
  IntakeIcon,
  LabelPropertyIcon,
  MembersPropertyIcon,
  ModuleIcon,
  PriorityPropertyIcon,
  StartDatePropertyIcon,
  StatePropertyIcon,
} from "@plane/propel/icons";
import { store } from "@/lib/store-context";
import type { TProjectActivity } from "@plane/types";

type ActivityIconMap = {
  [key: string]: FC<{ className?: string }>;
};
export const iconsMap: ActivityIconMap = {
  priority: PriorityPropertyIcon,
  archived_at: ArchiveIcon,
  restored: RotateCcw,
  link: LinkIcon,
  start_date: StartDatePropertyIcon,
  target_date: DueDatePropertyIcon,
  label: LabelPropertyIcon,
  inbox: Inbox,
  description: AlignLeft,
  assignee: MembersPropertyIcon,
  attachment: Paperclip,
  name: Type,
  state: StatePropertyIcon,
  estimate: EstimatePropertyIcon,
  cycle: CycleIcon,
  module: ModuleIcon,
  page: FileText,
  network: GlobeIcon,
  identifier: Hash,
  timezone: Clock,
  is_project_updates_enabled: Bell,
  is_epic_enabled: GridLayoutIcon,
  is_workflow_enabled: GitBranch,
  is_time_tracking_enabled: Timer,
  is_issue_type_enabled: ListTodo,
  default: Network,
  module_view: ModuleIcon,
  cycle_view: CycleIcon,
  issue_views_view: Layers,
  page_view: FileText,
  intake_view: IntakeIcon,
};

export const messages = (activity: TProjectActivity): { message: string | ReactNode; customUserName?: string } => {
  const activityType = activity.field;
  const newValue = activity.new_value;
  const oldValue = activity.old_value;
  const verb = activity.verb;
  const workspaceDetail = store.workspaceRoot.getWorkspaceById(activity.workspace);

  const getBooleanActionText = (value: string | undefined) => {
    if (value === "true") return "已启用";
    if (value === "false") return "已禁用";
    return verb;
  };

  switch (activityType) {
    case "priority":
      const priorityMap: Record<string, string> = {
        urgent: "P0",
        high: "P1",
        medium: "P2",
        low: "P3",
        none: "P4",
      };
      const translatedPriority =
        newValue && priorityMap[newValue.toLowerCase()] ? priorityMap[newValue.toLowerCase()] : newValue || "无";
      return {
        message: (
          <>
            将优先级设置为 <span className="font-medium text-primary">{translatedPriority}</span>
          </>
        ),
      };
    case "archived_at":
      return {
        message: newValue === "restore" ? "已恢复项目" : "已归档项目",
        customUserName: newValue === "archive" ? BRAND_NAME : undefined,
      };
    case "name":
      return {
        message: (
          <>
            将项目重命名为 <span className="font-medium text-primary">{newValue}</span>
          </>
        ),
      };
    case "description":
      return {
        message: newValue ? "已更新项目描述" : "已移除项目描述",
      };
    case "start_date":
      return {
        message: (
          <>
            {newValue ? (
              <>
                将开始日期设置为 <span className="font-medium text-primary">{newValue}</span>
              </>
            ) : (
              "已移除开始日期"
            )}
          </>
        ),
      };
    case "target_date":
      return {
        message: (
          <>
            {newValue ? (
              <>
                将目标日期设置为 <span className="font-medium text-primary">{newValue}</span>
              </>
            ) : (
              "已移除目标日期"
            )}
          </>
        ),
      };
    case "state":
      return {
        message: (
          <>
            将状态设置为 <span className="font-medium text-primary">{newValue || "无"}</span>
          </>
        ),
      };
    case "estimate":
      return {
        message: (
          <>
            {newValue ? (
              <>
                将估时点设置为 <span className="font-medium text-primary">{newValue}</span>
              </>
            ) : (
              <>
                已移除估时点
                {oldValue && (
                  <>
                    {" "}
                    <span className="font-medium text-primary">{oldValue}</span>
                  </>
                )}
              </>
            )}
          </>
        ),
      };
    case "cycles":
      return {
        message: (
          <>
            <span>{verb === "removed" ? "已从周期" : "已将此项目添加到周期"} </span>
            {verb !== "removed" ? (
              <a
                href={`/${workspaceDetail?.slug}/projects/${activity.project}/cycles/${activity.new_identifier}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex font-medium text-primary"
              >
                {activity.new_value}
              </a>
            ) : (
              <span className="font-medium text-primary">{activity.old_value || "未知周期"}</span>
            )}
            {verb === "removed" ? "中移除" : ""}
          </>
        ),
      };
    case "modules":
      return {
        message: (
          <>
            <span>{verb === "removed" ? "已从模块" : "已将此项目添加到模块"} </span>
            <span className="font-medium text-primary">{verb === "removed" ? oldValue : newValue || "未知模块"}</span>
            {verb === "removed" ? "中移除" : ""}
          </>
        ),
      };
    case "labels":
      return {
        message: (
          <>
            {verb === "removed" ? "已移除标签" : "已添加标签"}{" "}
            <span className="font-medium text-primary">{newValue || oldValue || "未命名标签"}</span>
          </>
        ),
      };
    case "inbox":
      return {
        message: <>{newValue ? "已启用" : "已禁用"} 收集</>,
      };
    case "page":
      return {
        message: (
          <>
            {newValue ? "已创建" : "已移除"} 项目页面{" "}
            <span className="font-medium text-primary">{newValue || oldValue || "未命名页面"}</span>
          </>
        ),
      };
    case "network":
      return {
        message: <>{newValue ? "已启用" : "已禁用"} 网络访问</>,
      };
    case "identifier":
      return {
        message: (
          <>
            已将项目标识符更新为 <span className="font-medium text-primary">{newValue || "无"}</span>
          </>
        ),
      };
    case "timezone":
      return {
        message: (
          <>
            已将项目时区更改为 <span className="font-medium text-primary">{newValue || "默认"}</span>
          </>
        ),
      };
    case "module_view":
    case "cycle_view":
    case "issue_views_view":
    case "page_view":
    case "intake_view":
      return {
        message: (
          <>
            {getBooleanActionText(newValue)} {activityType.replace(/_view$/, "").replace(/_/g, " ")} 视图
          </>
        ),
      };
    case "is_project_updates_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} 项目更新</>,
      };
    case "is_epic_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} 史诗</>,
      };
    case "is_workflow_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} 自定义工作流</>,
      };
    case "is_time_tracking_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} 时间跟踪</>,
      };
    case "is_issue_type_enabled":
      return {
        message: <>{getBooleanActionText(newValue)} 工作项类型</>,
      };
    default:
      return {
        message: `${verb} ${activityType?.replace(/_/g, " ")} `,
      };
  }
};
