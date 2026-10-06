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
  citation?: number;
  location?: string;
  snippet?: string;
};

export type TAIChatIssueDraft = {
  name: string;
  description: string;
  priority: "urgent" | "high" | "medium" | "low" | "none";
  assignee_id: string | null;
  start_date: string | null;
  target_date: string | null;
  label_ids: string[];
  clarifications: string[];
};

export type TAIChatIssueDraftOptions = {
  assignees: { id: string; name: string }[];
  labels: { id: string; name: string }[];
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
    data: { history: TAIChatMessage[]; message: string; project_id?: string; retrieval_mode?: "smart" | "all" },
    onProgress?: (phase: "understanding" | "retrieving" | "generating") => void
  ): Promise<{
    response: string;
    scope?: "project" | "workspace";
    sources: TAIChatSource[];
    retrieval?: { mode: "smart" | "all"; matched: number; read: number };
  }> {
    type Result = {
      response: string;
      sources: TAIChatSource[];
      retrieval?: { mode: "smart" | "all"; matched: number; read: number };
    };
    const response = await fetch(`${this.baseURL}/api/workspaces/${workspaceSlug}/ai-chat/`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, stream: true }),
    });
    if (response.status === 401) {
      window.location.replace(`/${window.location.pathname ? `?next_path=${window.location.pathname}` : ""}`);
    }
    if (!response.ok) throw { status: response.status, data: await response.json() };
    const reader = response.body?.getReader();
    if (!reader) throw new Error("AI 服务没有返回响应内容。");
    const decoder = new TextDecoder();
    let buffer = "";
    let result: Result | undefined;
    try {
      while (true) {
        // Stream chunks must be read in order from the same reader.
        // eslint-disable-next-line no-await-in-loop
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        if (done && buffer.trim()) lines.push(buffer);
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            phase?: "understanding" | "retrieving" | "generating";
            result?: Result & { error?: string };
            status?: number;
          };
          if (event.phase) onProgress?.(event.phase);
          if (event.result) {
            if ((event.status ?? 200) >= 400) throw { status: event.status, data: event.result };
            result = event.result;
          }
        }
        if (done) break;
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
    if (!result) throw new Error("AI 响应中断，请重试。");
    return result;
  }

  async draftIssue(
    workspaceSlug: string,
    data: {
      prompt: string;
      project_id: string;
      current_draft?: TAIChatIssueDraft;
      revision_instruction?: string;
    }
  ): Promise<{
    draft: TAIChatIssueDraft;
    project: { id: string; identifier: string; name: string };
    options: TAIChatIssueDraftOptions;
    sources: TAIChatSource[];
  }> {
    return this.post(`/api/workspaces/${workspaceSlug}/ai-chat/draft-issue/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response ?? { message: error?.message };
      });
  }
}
