/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// helpers
import { API_BASE_URL } from "@plane/constants";
// services
import { APIService } from "@/services/api.service";

type TAIServiceError = {
  data?: { error?: unknown };
  error?: unknown;
  message?: unknown;
  status?: number;
};

export const getAIServiceErrorMessage = (error: unknown): string => {
  const serviceError = (error ?? {}) as TAIServiceError;

  if (serviceError.status === 402) return "AI 服务账户余额不足或已达到使用额度，请到服务商控制台检查余额和限额。";
  if (serviceError.status === 401) return "AI API 密钥无效或无权访问所选模型，请检查服务商和密钥配置。";
  if (serviceError.status === 429) return "AI 服务请求过于频繁，请稍后重试；如果持续发生，请检查服务商的限流设置。";

  const message = serviceError.data?.error ?? serviceError.error ?? serviceError.message;
  if (message === "Network Error") return "无法连接 AI 服务，请检查服务器网络后重试。";
  if (typeof message === "string" && message.trim() && message !== "An internal error has occurred.") return message;
  if ([502, 503, 504].includes(serviceError.status ?? 0)) return "AI 服务暂时不可用，请检查服务器网络或稍后重试。";

  return "AI 生成失败，请稍后重试；如果问题持续，请联系实例管理员查看服务端日志。";
};

export type TAIChatMessage = {
  role: "assistant" | "user";
  content: string;
};

export type TAIChatSource = {
  id: string;
  kind: "page" | "work_item";
  title: string;
  url: string;
};

export class AIService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async createGptTask(
    workspaceSlug: string,
    data: { prompt: string; task: string }
  ): Promise<{ response: string; response_html: string }> {
    return this.post(`/api/workspaces/${workspaceSlug}/ai-assistant/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response ?? { message: error?.message };
      });
  }

  async askWorkspace(
    workspaceSlug: string,
    data: { history: TAIChatMessage[]; message: string; project_id?: string }
  ): Promise<{ response: string; scope: "project" | "workspace"; sources: TAIChatSource[] }> {
    return this.post(`/api/workspaces/${workspaceSlug}/ai-chat/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response ?? { message: error?.message };
      });
  }
}
