/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Image, BrainCog, Cog, Mail } from "lucide-react";
// plane imports
import { LockIcon, WorkspaceIcon } from "@plane/propel/icons";
// types
import type { TSidebarMenuItem } from "./types";

export type TCoreSidebarMenuKey = "general" | "email" | "workspace" | "authentication" | "ai" | "image";

export const coreSidebarMenuLinks: Record<TCoreSidebarMenuKey, TSidebarMenuItem> = {
  general: {
    Icon: Cog,
    name: "常规设置",
    description: "查看并管理实例基本信息。",
    href: `/general/`,
  },
  email: {
    Icon: Mail,
    name: "邮件",
    description: "配置 SMTP 邮件服务。",
    href: `/email/`,
  },
  workspace: {
    Icon: WorkspaceIcon,
    name: "工作区",
    description: "管理此实例中的所有工作区。",
    href: `/workspace/`,
  },
  authentication: {
    Icon: LockIcon,
    name: "身份验证",
    description: "配置登录与注册方式。",
    href: `/authentication/`,
  },
  ai: {
    Icon: BrainCog,
    name: "人工智能",
    description: "配置 OpenAI 凭据。",
    href: `/ai/`,
  },
  image: {
    Icon: Image,
    name: "图片服务",
    description: "配置第三方图片素材库。",
    href: `/image/`,
  },
};
