/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Send, Trash2 } from "lucide-react";
import { PiChatLogo } from "@plane/propel/icons";
import { EIssuesStoreType } from "@plane/types";
import { AlertModalCore, Button } from "@plane/ui";
import { AIChatSources } from "@/components/ui/ai-chat-sources";
import { AIChatMarkdown } from "@/components/ui/ai-markdown";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { useInstance } from "@/hooks/store/use-instance";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useUser } from "@/hooks/store/user";
import { AIService, getAIServiceErrorMessage } from "@/services/ai.service";
import type { TAIChatIssueDraft, TAIChatIssueDraftOptions, TAIChatMessage, TAIChatSource } from "@/services/ai.service";

const aiService = new AIService();
const activeChatRequestIds = new Set<string>();
const CHAT_MESSAGES_UPDATED_EVENT = "plane-ai-chat-messages-updated";

type TChatMessage = TAIChatMessage & {
  id: string;
  isLoading?: boolean;
  sources?: TAIChatSource[];
  retrieval?: { mode: "smart" | "all"; matched: number; read: number };
};

const SUGGESTIONS = ["总结这个工作区最近的进展", "哪些工作项还没有负责人？", "列出未完成工作项"];
const MAX_STORED_MESSAGES = 100;

type TChatState = {
  key: string;
  messages: TChatMessage[];
};

function loadStoredMessages(storageKey: string): TChatMessage[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
    if (!Array.isArray(value)) return [];

    return value.flatMap((item: unknown) => {
      if (typeof item !== "object" || item === null) return [];
      const message = item as Partial<TChatMessage>;
      if ((message.role !== "assistant" && message.role !== "user") || typeof message.content !== "string") return [];

      const sources = Array.isArray(message.sources)
        ? message.sources.filter(
            (source): source is TAIChatSource =>
              typeof source === "object" &&
              source !== null &&
              typeof source.id === "string" &&
              typeof source.title === "string" &&
              (source.kind === "page" || source.kind === "work_item") &&
              typeof source.url === "string" &&
              source.url.startsWith("/") &&
              !source.url.startsWith("//") &&
              (source.citation === undefined ||
                (typeof source.citation === "number" && Number.isInteger(source.citation) && source.citation > 0)) &&
              (source.location === undefined || typeof source.location === "string") &&
              (source.snippet === undefined || typeof source.snippet === "string")
          )
        : undefined;

      return [
        {
          id: typeof message.id === "string" ? message.id : `stored-${Date.now()}-${Math.random()}`,
          role: message.role,
          content:
            message.isLoading === true && !activeChatRequestIds.has(message.id ?? "")
              ? "当前请求已中断，请重新发送。"
              : message.content,
          sources,
          retrieval: message.retrieval,
          isLoading: message.isLoading === true && activeChatRequestIds.has(message.id ?? ""),
        },
      ];
    });
  } catch {
    return [];
  }
}

function saveStoredMessages(storageKey: string, messages: TChatMessage[]): void {
  try {
    const existingMessages = new Map(loadStoredMessages(storageKey).map((message) => [message.id, message] as const));
    const storedMessages = messages.slice(-MAX_STORED_MESSAGES).map((message) => {
      const existingMessage = existingMessages.get(message.id);
      const messageToStore =
        message.isLoading && existingMessage && !existingMessage.isLoading ? existingMessage : message;
      const { id, role, content, sources, isLoading, retrieval } = messageToStore;
      return { id, role, content, sources, isLoading, retrieval };
    });
    window.localStorage.setItem(storageKey, JSON.stringify(storedMessages));
  } catch {
    // Storage is a convenience; AI chat remains usable when browser storage is unavailable.
  }
}

function saveResolvedAssistantMessage(storageKey: string, message: TChatMessage): void {
  const messages = loadStoredMessages(storageKey);
  const existingMessageIndex = messages.findIndex((item) => item.id === message.id);
  if (existingMessageIndex >= 0) messages[existingMessageIndex] = message;
  else messages.push(message);

  const updatedMessages = messages.slice(-MAX_STORED_MESSAGES);
  saveStoredMessages(storageKey, updatedMessages);
  window.dispatchEvent(
    new CustomEvent(CHAT_MESSAGES_UPDATED_EVENT, { detail: { key: storageKey, messages: updatedMessages } })
  );
}

function getCitationAnchors(message: TChatMessage): Record<number, string> {
  const anchors: Record<number, string> = {};
  for (const source of message.sources ?? []) {
    if (source.citation !== undefined) {
      anchors[source.citation] = `#ai-chat-source-${message.id}-${source.citation}`;
    }
  }
  return anchors;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const PiChatPage = observer(function PiChatPage() {
  const { workspaceSlug } = useParams();
  const slug = workspaceSlug?.toString() ?? "";
  const { config } = useInstance();
  const { fetchProjects } = useProject();
  const { issues: projectIssues } = useIssues(EIssuesStoreType.PROJECT);
  const projectStateStore = useProjectState();
  const { data: currentUser } = useUser();
  const { data: projects, isLoading: isLoadingProjects } = useSWR(slug ? `AI_CHAT_PROJECTS_${slug}` : null, () =>
    fetchProjects(slug)
  );
  const [chatScope, setChatScope] = useState<{ key: string; projectId: string }>({ key: "", projectId: "" });
  const [retrievalMode, setRetrievalMode] = useState<"smart" | "all">("smart");
  const [input, setInput] = useState("");
  const [chatState, setChatState] = useState<TChatState>({ key: "", messages: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);
  const [issueDraft, setIssueDraft] = useState<TAIChatIssueDraft | null>(null);
  const [issueDraftOptions, setIssueDraftOptions] = useState<TAIChatIssueDraftOptions>({ assignees: [], labels: [] });
  const [issueDraftSources, setIssueDraftSources] = useState<TAIChatSource[]>([]);
  const [issueDraftPrompt, setIssueDraftPrompt] = useState("");
  const [issueDraftRevisionInput, setIssueDraftRevisionInput] = useState("");
  const [issueDraftProject, setIssueDraftProject] = useState<{ id: string; identifier: string; name: string } | null>(
    null
  );
  const [isDraftingIssue, setIsDraftingIssue] = useState(false);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [issueDraftError, setIssueDraftError] = useState("");
  const [issueCreateError, setIssueCreateError] = useState("");
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousChatStorageKeyRef = useRef("");
  const formRef = useRef<HTMLFormElement>(null);
  const scopeStorageKey =
    slug && currentUser?.id
      ? `plane_ai_chat_scope_v1:${encodeURIComponent(currentUser.id)}:${encodeURIComponent(slug)}`
      : "";
  const isScopeReady = Boolean(scopeStorageKey) && chatScope.key === scopeStorageKey;
  const projectId = isScopeReady ? chatScope.projectId : "";
  const chatStorageKey =
    isScopeReady && slug && currentUser?.id
      ? `plane_ai_chat_v1:${encodeURIComponent(currentUser.id)}:${encodeURIComponent(slug)}:${projectId || "workspace"}`
      : "";
  const issueDraftDisabledHint = !config?.has_llm_configured
    ? "请先由实例管理员配置 AI 服务。"
    : [!projectId ? "在右上角选择具体项目" : "", !input.trim() ? "输入工作项描述" : ""].filter(Boolean).join("；");
  const isChatReady = Boolean(chatStorageKey) && chatState.key === chatStorageKey;
  const messages = useMemo(() => (isChatReady ? chatState.messages : []), [chatState.messages, isChatReady]);
  const isChatSubmitting = isSubmitting || messages.some((message) => message.isLoading);
  const hasInvalidIssueDraftDateRange = Boolean(
    issueDraft && issueDraft.start_date && issueDraft.target_date && issueDraft.start_date > issueDraft.target_date
  );

  useEffect(() => {
    if (!scopeStorageKey) {
      setChatScope({ key: "", projectId: "" });
      return;
    }

    let storedProjectId = "";
    try {
      storedProjectId = window.localStorage.getItem(scopeStorageKey) ?? "";
    } catch {
      // Scope restoration is optional when browser storage is unavailable.
    }
    setChatScope({ key: scopeStorageKey, projectId: storedProjectId });
  }, [scopeStorageKey]);

  useEffect(() => {
    if (!isScopeReady || isLoadingProjects || !projects || !projectId) return;
    if (projects.some((project) => project.id === projectId)) return;

    try {
      window.localStorage.setItem(scopeStorageKey, "");
    } catch {
      // Keep the chat usable when browser storage is unavailable.
    }
    setChatScope({ key: scopeStorageKey, projectId: "" });
  }, [isLoadingProjects, isScopeReady, projectId, projects, scopeStorageKey]);

  useEffect(() => {
    if (!chatStorageKey) {
      setChatState({ key: "", messages: [] });
      return;
    }
    setChatState({ key: chatStorageKey, messages: loadStoredMessages(chatStorageKey) });
  }, [chatStorageKey]);

  useEffect(() => {
    if (!chatStorageKey || chatState.key !== chatStorageKey) return;
    saveStoredMessages(chatStorageKey, chatState.messages);
  }, [chatState, chatStorageKey]);

  useEffect(() => {
    if (!chatStorageKey) return;

    const reloadMessages = () => {
      setChatState({ key: chatStorageKey, messages: loadStoredMessages(chatStorageKey) });
    };
    const handleChatUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string; messages?: TChatMessage[] }>).detail;
      if (detail?.key !== chatStorageKey) return;
      setChatState({
        key: chatStorageKey,
        messages: Array.isArray(detail.messages) ? detail.messages : loadStoredMessages(chatStorageKey),
      });
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== chatStorageKey) return;
      reloadMessages();
    };
    window.addEventListener(CHAT_MESSAGES_UPDATED_EVENT, handleChatUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(CHAT_MESSAGES_UPDATED_EVENT, handleChatUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, [chatStorageKey]);

  useEffect(() => {
    if (!isChatReady || !chatStorageKey) return;

    if (previousChatStorageKeyRef.current !== chatStorageKey) {
      previousChatStorageKeyRef.current = chatStorageKey;
      const scrollContainer = chatScrollContainerRef.current;
      if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatStorageKey, isChatReady, messages]);

  const clearChat = () => {
    if (!chatStorageKey || !isChatReady || isChatSubmitting || isDraftingIssue || isCreatingIssue) return;

    try {
      window.localStorage.removeItem(chatStorageKey);
    } catch {
      // Keep the current chat usable when browser storage is unavailable.
    }
    setChatState({ key: chatStorageKey, messages: [] });
    setInput("");
    setIssueDraft(null);
    setIssueDraftOptions({ assignees: [], labels: [] });
    setIssueDraftSources([]);
    setIssueDraftPrompt("");
    setIssueDraftRevisionInput("");
    setIssueDraftProject(null);
    setIssueDraftError("");
    setIssueCreateError("");
    setIsClearChatModalOpen(false);
    window.dispatchEvent(
      new CustomEvent(CHAT_MESSAGES_UPDATED_EVENT, { detail: { key: chatStorageKey, messages: [] } })
    );
  };

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || isChatSubmitting || isDraftingIssue || isCreatingIssue || !slug || !isChatReady) return;

    const userMessage: TChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };
    const assistantMessage: TChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "正在理解你的问题…",
      isLoading: true,
    };
    const history = messages
      .filter((item) => !item.isLoading)
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));

    setInput("");
    setIsSubmitting(true);
    const pendingMessages = [
      ...(chatState.key === chatStorageKey ? chatState.messages : []),
      userMessage,
      assistantMessage,
    ];
    activeChatRequestIds.add(assistantMessage.id);
    saveStoredMessages(chatStorageKey, pendingMessages);
    setChatState({
      key: chatStorageKey,
      messages: pendingMessages,
    });

    try {
      const result = await aiService.askWorkspace(
        slug,
        {
          history,
          message,
          project_id: projectId || undefined,
          retrieval_mode: retrievalMode,
        },
        (phase) => {
          const content = {
            understanding: "正在理解你的问题…",
            retrieving: "正在检索工作区资料…",
            generating: "正在生成回答…",
          }[phase];
          setChatState((current) =>
            current.key !== chatStorageKey
              ? current
              : {
                  ...current,
                  messages: current.messages.map((item) =>
                    item.id === assistantMessage.id ? { ...item, content } : item
                  ),
                }
          );
        }
      );
      const resolvedMessage: TChatMessage = {
        ...assistantMessage,
        content: result.response,
        isLoading: false,
        sources: result.sources,
        retrieval: result.retrieval,
      };
      saveResolvedAssistantMessage(chatStorageKey, resolvedMessage);
      setChatState((current) =>
        current.key !== chatStorageKey
          ? current
          : {
              ...current,
              messages: current.messages.map((item) => (item.id === assistantMessage.id ? resolvedMessage : item)),
            }
      );
    } catch (error) {
      const resolvedMessage: TChatMessage = {
        ...assistantMessage,
        content: getAIServiceErrorMessage(error),
        isLoading: false,
      };
      saveResolvedAssistantMessage(chatStorageKey, resolvedMessage);
      setChatState((current) =>
        current.key !== chatStorageKey
          ? current
          : {
              ...current,
              messages: current.messages.map((item) => (item.id === assistantMessage.id ? resolvedMessage : item)),
            }
      );
    } finally {
      activeChatRequestIds.delete(assistantMessage.id);
      setIsSubmitting(false);
    }
  };

  const generateIssueDraft = async () => {
    const prompt = input.trim();
    if (!prompt || !projectId || !slug || !isChatReady || isChatSubmitting || isDraftingIssue || isCreatingIssue) {
      return;
    }

    setIsDraftingIssue(true);
    setIssueDraftError("");
    setIssueCreateError("");
    setIssueDraftSources([]);
    try {
      const result = await aiService.draftIssue(slug, { prompt, project_id: projectId });
      setIssueDraft(result.draft);
      setIssueDraftOptions(result.options);
      setIssueDraftProject(result.project);
      setIssueDraftSources(result.sources ?? []);
      setIssueDraftPrompt(prompt);
      setIssueDraftRevisionInput("");
    } catch (error) {
      setIssueDraftError(getAIServiceErrorMessage(error));
    } finally {
      setIsDraftingIssue(false);
    }
  };

  const reviseIssueDraft = async () => {
    const revisionInstruction = issueDraftRevisionInput.trim();
    if (
      !slug ||
      !issueDraft ||
      !issueDraftProject ||
      !issueDraftPrompt ||
      !revisionInstruction ||
      isChatSubmitting ||
      isDraftingIssue ||
      isCreatingIssue
    )
      return;

    setIsDraftingIssue(true);
    setIssueDraftError("");
    setIssueCreateError("");
    try {
      const result = await aiService.draftIssue(slug, {
        prompt: issueDraftPrompt,
        project_id: issueDraftProject.id,
        current_draft: issueDraft,
        revision_instruction: revisionInstruction,
      });
      setIssueDraft(result.draft);
      setIssueDraftOptions(result.options);
      setIssueDraftProject(result.project);
      setIssueDraftSources(result.sources ?? []);
      setIssueDraftRevisionInput("");
    } catch (error) {
      setIssueDraftError(getAIServiceErrorMessage(error));
    } finally {
      setIsDraftingIssue(false);
    }
  };

  const createDraftedIssue = async () => {
    if (!slug || !issueDraft || !issueDraftProject || isCreatingIssue) return;

    setIsCreatingIssue(true);
    setIssueCreateError("");
    try {
      let stateId = projectStateStore.getProjectDefaultStateId(issueDraftProject.id);
      if (!stateId) {
        const projectStates = await projectStateStore.fetchProjectStates(slug, issueDraftProject.id);
        stateId = projectStates.find((state) => state.default)?.id;
      }

      const description = issueDraft.description.trim();
      const createdIssue = await projectIssues.createIssue(slug, issueDraftProject.id, {
        name: issueDraft.name.trim(),
        description_html: description ? `<p>${escapeHtml(description).replace(/\n/g, "<br />")}</p>` : "<p></p>",
        priority: issueDraft.priority,
        state_id: stateId ?? null,
        assignee_ids: issueDraft.assignee_id ? [issueDraft.assignee_id] : [],
        start_date: issueDraft.start_date,
        target_date: issueDraft.target_date,
        label_ids: issueDraft.label_ids,
      });
      const issueUrl = `/${slug}/projects/${issueDraftProject.id}/issues/${createdIssue.id}`;
      const identifier = `${issueDraftProject.identifier}-${createdIssue.sequence_id}`;
      const resultMessage: TChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `工作项已创建：${identifier} · ${createdIssue.name}\n\n[打开工作项](${issueUrl})`,
      };
      setChatState((current) =>
        current.key === chatStorageKey ? { ...current, messages: [...current.messages, resultMessage] } : current
      );
      setInput("");
      setIssueDraft(null);
      setIssueDraftOptions({ assignees: [], labels: [] });
      setIssueDraftSources([]);
      setIssueDraftPrompt("");
      setIssueDraftRevisionInput("");
      setIssueDraftProject(null);
    } catch (error) {
      setIssueCreateError(getAIServiceErrorMessage(error));
    } finally {
      setIsCreatingIssue(false);
    }
  };

  return (
    <>
      <AppHeader
        header={
          <div className="flex w-full items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-2 text-13 font-medium text-primary">
              <PiChatLogo className="size-4 shrink-0 text-accent-primary" />
              <span className="truncate">星轴 AI（Beta）</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <label className="flex shrink-0 items-center gap-2 text-13 text-secondary">
                <span className="sr-only sm:not-sr-only">范围</span>
                <select
                  className="focus:border-accent-primary w-fit max-w-[45vw] min-w-0 rounded-md border border-subtle bg-layer-2 px-3 py-2 text-primary outline-none sm:max-w-56"
                  value={projectId}
                  onChange={(event) => {
                    const nextProjectId = event.target.value;
                    try {
                      window.localStorage.setItem(scopeStorageKey, nextProjectId);
                    } catch {
                      // Scope restoration is optional when browser storage is unavailable.
                    }
                    setChatScope({ key: scopeStorageKey, projectId: nextProjectId });
                    setIssueDraft(null);
                    setIssueDraftOptions({ assignees: [], labels: [] });
                    setIssueDraftSources([]);
                    setIssueDraftPrompt("");
                    setIssueDraftRevisionInput("");
                    setIssueDraftProject(null);
                    setIssueDraftError("");
                    setIssueCreateError("");
                  }}
                  disabled={
                    !isScopeReady || isLoadingProjects || isChatSubmitting || isDraftingIssue || isCreatingIssue
                  }
                >
                  <option value="">整个工作区</option>
                  {(projects ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.identifier} · {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <select
                aria-label="检索模式"
                title="全部工作项读取所选范围内所有工作项字段与描述摘要，单次最多 200 项"
                className="min-w-0 rounded-md border border-subtle bg-layer-2 px-3 py-2 text-13 text-primary"
                value={retrievalMode}
                disabled={isChatSubmitting || isDraftingIssue || isCreatingIssue}
                onChange={(event) => setRetrievalMode(event.target.value === "all" ? "all" : "smart")}
              >
                <option value="smart">智能检索</option>
                <option value="all">全部工作项</option>
              </select>
              <Button
                type="button"
                variant="neutral-primary"
                size="sm"
                onClick={() => setIsClearChatModalOpen(true)}
                disabled={
                  !isChatReady || messages.length === 0 || isChatSubmitting || isDraftingIssue || isCreatingIssue
                }
                aria-label="清空聊天"
                title="清空当前范围的聊天记录"
                className="shrink-0"
              >
                <Trash2 className="mr-1.5 size-3.5" />
                <span className="hidden sm:inline">清空聊天</span>
              </Button>
            </div>
          </div>
        }
      />
      <ContentWrapper className="!overflow-hidden">
        <PageHead title="星轴 AI（Beta）" />
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden px-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div ref={chatScrollContainerRef} className="flex-1 overflow-y-auto py-5 sm:py-8">
              {messages.length === 0 ? (
                <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-8">
                  <h2 className="text-20 font-semibold text-primary">问问你的工作区</h2>
                  <p className="mt-2 max-w-xl text-14 text-secondary">
                    我会搜索当前范围内你有权访问的工作项和页面。答案会附上来源；没有足够资料时会说明。
                  </p>
                  {config?.has_llm_configured ? (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setInput(suggestion)}
                          className="rounded-full border border-subtle bg-layer-1 px-3 py-2 text-13 text-secondary transition-colors hover:bg-layer-1-hover"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-6 rounded-md border border-subtle bg-layer-1 p-3 text-13 text-secondary">
                      请先由实例管理员在设置中配置 AI 服务商和 API 密钥。
                    </p>
                  )}
                </div>
              ) : (
                <div className="mx-auto flex max-w-5xl flex-col gap-5 px-1 pb-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`shadow-sm max-w-full rounded-xl border border-subtle px-4 py-4 sm:px-5 ${
                        message.role === "user"
                          ? "ml-auto max-w-[90%] bg-layer-1 sm:max-w-[80%]"
                          : "mr-auto w-full bg-surface-1"
                      }`}
                    >
                      <div className="mb-2 text-11 font-medium tracking-wide text-tertiary uppercase">
                        {message.role === "user" ? "你" : "星轴 AI（Beta）"}
                      </div>
                      <div className={`text-14 leading-6 text-primary ${message.isLoading ? "animate-pulse" : ""}`}>
                        {message.role === "assistant" && !message.isLoading ? (
                          <AIChatMarkdown markdown={message.content} citations={getCitationAnchors(message)} />
                        ) : (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        )}
                      </div>
                      {message.retrieval && (
                        <p className="mt-3 text-12 text-tertiary">
                          {message.retrieval.mode === "all" ? "全部工作项" : "智能检索"} · 匹配{" "}
                          {message.retrieval.matched} 项 · 已读取 {message.retrieval.read} 项
                        </p>
                      )}
                      {message.sources && message.sources.length > 0 && (
                        <AIChatSources sources={message.sources} messageId={message.id} />
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {issueDraft && issueDraftProject && (
              <div className="mx-auto mb-4 max-h-96 w-full max-w-5xl overflow-y-auto rounded-lg border border-subtle bg-layer-1 p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-14 font-semibold text-primary">AI 工作项草稿</h2>
                    <p className="mt-1 text-12 text-secondary">
                      {issueDraftProject.identifier} · {issueDraftProject.name}
                      。草稿不会自动保存；确认后才会创建工作项。
                    </p>
                  </div>
                </div>
                {issueDraftSources.length > 0 && (
                  <div className="mb-3 rounded-md border border-subtle bg-surface-1 px-3 py-2">
                    <p className="mb-1 text-11 font-medium text-secondary">参考的项目资料</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {issueDraftSources.map((source) => (
                        <a
                          key={`${source.kind}-${source.id}`}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-12 text-accent-primary hover:underline"
                        >
                          {source.kind === "page" ? "页面 · " : "工作项 · "}
                          {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <label className="mb-3 block text-12 text-secondary">
                  标题
                  <input
                    value={issueDraft.name}
                    onChange={(event) =>
                      setIssueDraft((current) => (current ? { ...current, name: event.target.value } : current))
                    }
                    maxLength={255}
                    disabled={isDraftingIssue || isCreatingIssue}
                    className="focus:border-accent-primary mt-1 w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary outline-none"
                  />
                </label>
                <label className="mb-3 block text-12 text-secondary">
                  描述
                  <textarea
                    value={issueDraft.description}
                    onChange={(event) =>
                      setIssueDraft((current) => (current ? { ...current, description: event.target.value } : current))
                    }
                    rows={7}
                    maxLength={5000}
                    disabled={isDraftingIssue || isCreatingIssue}
                    className="focus:border-accent-primary mt-1 w-full resize-y rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary outline-none"
                  />
                </label>
                <div className="mb-3 rounded-md border border-subtle bg-surface-1 p-3">
                  <label className="block text-12 text-secondary">
                    补充要求，让 AI 继续修改草稿
                    <textarea
                      value={issueDraftRevisionInput}
                      onChange={(event) => setIssueDraftRevisionInput(event.target.value)}
                      rows={2}
                      maxLength={4000}
                      disabled={isDraftingIssue || isCreatingIssue}
                      placeholder="例如：补充移动端兼容要求，或把验收标准写得更具体"
                      className="focus:border-accent-primary mt-1 w-full resize-y rounded-md border border-subtle bg-layer-1 px-3 py-2 text-13 text-primary outline-none placeholder:text-placeholder"
                    />
                  </label>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void reviseIssueDraft()}
                      disabled={
                        !issueDraftRevisionInput.trim() || isChatSubmitting || isDraftingIssue || isCreatingIssue
                      }
                      className="rounded-md border border-subtle px-3 py-1.5 text-12 font-medium text-secondary hover:bg-layer-1-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isDraftingIssue ? "AI 正在修改…" : "AI 根据补充要求修改"}
                    </button>
                  </div>
                </div>
                <label className="mb-3 block text-12 text-secondary">
                  负责人
                  <select
                    value={issueDraft.assignee_id ?? ""}
                    onChange={(event) =>
                      setIssueDraft((current) =>
                        current ? { ...current, assignee_id: event.target.value || null } : current
                      )
                    }
                    disabled={isDraftingIssue || isCreatingIssue}
                    className="focus:border-accent-primary mt-1 w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary outline-none"
                  >
                    <option value="">项目默认负责人（如有）</option>
                    {issueDraftOptions.assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mb-3 flex flex-wrap gap-4">
                  <label className="block text-12 text-secondary">
                    开始日期
                    <input
                      type="date"
                      value={issueDraft.start_date ?? ""}
                      onChange={(event) =>
                        setIssueDraft((current) =>
                          current ? { ...current, start_date: event.target.value || null } : current
                        )
                      }
                      disabled={isDraftingIssue || isCreatingIssue}
                      className="focus:border-accent-primary mt-1 block rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary outline-none"
                    />
                  </label>
                  <label className="block text-12 text-secondary">
                    截止日期
                    <input
                      type="date"
                      value={issueDraft.target_date ?? ""}
                      onChange={(event) =>
                        setIssueDraft((current) =>
                          current ? { ...current, target_date: event.target.value || null } : current
                        )
                      }
                      disabled={isDraftingIssue || isCreatingIssue}
                      className="focus:border-accent-primary mt-1 block rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary outline-none"
                    />
                  </label>
                </div>
                {issueDraft.clarifications.length > 0 && (
                  <div className="mb-3 rounded-md border border-subtle bg-surface-1 px-3 py-2">
                    <p className="mb-1 text-11 font-medium text-primary">待确认信息</p>
                    <ul className="list-inside list-disc space-y-1 text-12 text-secondary">
                      {issueDraft.clarifications.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {hasInvalidIssueDraftDateRange && (
                  <p className="text-danger mb-3 text-12">开始日期不能晚于截止日期，请调整日期后再创建。</p>
                )}
                <fieldset className="mb-3">
                  <legend className="mb-1 text-12 text-secondary">标签</legend>
                  {issueDraftOptions.labels.length > 0 ? (
                    <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                      {issueDraftOptions.labels.map((label) => (
                        <label
                          key={label.id}
                          className="flex items-center gap-1.5 rounded-md border border-subtle bg-surface-1 px-2 py-1 text-12 text-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={issueDraft.label_ids.includes(label.id)}
                            onChange={(event) =>
                              setIssueDraft((current) => {
                                if (!current) return current;
                                const labelIds = new Set(current.label_ids);
                                if (event.target.checked) labelIds.add(label.id);
                                else labelIds.delete(label.id);
                                return { ...current, label_ids: Array.from(labelIds) };
                              })
                            }
                            disabled={isDraftingIssue || isCreatingIssue}
                          />
                          {label.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-12 text-tertiary">该项目暂无标签</p>
                  )}
                </fieldset>
                <label className="mb-3 flex items-center gap-3 text-12 text-secondary">
                  <span>优先级</span>
                  <select
                    value={issueDraft.priority}
                    onChange={(event) =>
                      setIssueDraft((current) =>
                        current
                          ? { ...current, priority: event.target.value as TAIChatIssueDraft["priority"] }
                          : current
                      )
                    }
                    disabled={isDraftingIssue || isCreatingIssue}
                    className="focus:border-accent-primary rounded-md border border-subtle bg-surface-1 px-3 py-1.5 text-13 text-primary outline-none"
                  >
                    <option value="urgent">紧急</option>
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                    <option value="none">未设置</option>
                  </select>
                </label>
                {issueCreateError && <p className="text-danger mb-3 text-12">{issueCreateError}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIssueDraft(null);
                      setIssueDraftOptions({ assignees: [], labels: [] });
                      setIssueDraftSources([]);
                      setIssueDraftPrompt("");
                      setIssueDraftRevisionInput("");
                      setIssueDraftProject(null);
                      setIssueCreateError("");
                    }}
                    disabled={isCreatingIssue || isDraftingIssue}
                    className="rounded-md border border-subtle px-3 py-1.5 text-12 text-secondary hover:bg-layer-1-hover disabled:opacity-50"
                  >
                    取消
                  </button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={
                      !issueDraft.name.trim() || hasInvalidIssueDraftDateRange || isDraftingIssue || isCreatingIssue
                    }
                    loading={isCreatingIssue}
                    onClick={() => void createDraftedIssue()}
                  >
                    确认创建工作项
                  </Button>
                </div>
              </div>
            )}
            {issueDraftError && <p className="text-danger mx-auto mb-3 w-full max-w-5xl text-12">{issueDraftError}</p>}

            <form
              ref={formRef}
              className="mx-auto w-full max-w-5xl border-t border-subtle py-4"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(input);
              }}
            >
              <div className="focus-within:border-accent-primary rounded-lg border border-subtle bg-layer-1 p-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key !== "Enter" ||
                      event.shiftKey ||
                      event.nativeEvent.isComposing ||
                      event.nativeEvent.keyCode === 229
                    )
                      return;
                    event.preventDefault();
                    formRef.current?.requestSubmit();
                  }}
                  rows={3}
                  maxLength={4000}
                  placeholder="询问工作区的项目进展、工作项或页面…"
                  className="w-full resize-y border-0 bg-transparent px-2 py-1 text-14 text-primary outline-none placeholder:text-placeholder"
                  disabled={
                    !isChatReady ||
                    isChatSubmitting ||
                    isDraftingIssue ||
                    isCreatingIssue ||
                    !config?.has_llm_configured
                  }
                />
                <div className="flex flex-wrap items-end justify-between gap-3 px-2 pt-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-11 text-tertiary">
                    <span> </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void generateIssueDraft()}
                        disabled={
                          !input.trim() ||
                          !projectId ||
                          !isChatReady ||
                          isChatSubmitting ||
                          isDraftingIssue ||
                          isCreatingIssue ||
                          Boolean(issueDraft) ||
                          !config?.has_llm_configured
                        }
                        title={issueDraftDisabledHint || undefined}
                        className="rounded-md border border-subtle px-3 py-1.5 text-12 font-medium text-secondary hover:bg-layer-1-hover disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isDraftingIssue ? "正在生成…" : "AI 起草工作项"}
                      </button>
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={
                          !input.trim() ||
                          !isChatReady ||
                          isChatSubmitting ||
                          isDraftingIssue ||
                          isCreatingIssue ||
                          !config?.has_llm_configured
                        }
                        loading={isChatSubmitting}
                      >
                        <Send className="mr-1.5 size-3.5" />
                        发送
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </ContentWrapper>
      <AlertModalCore
        isOpen={isClearChatModalOpen}
        isSubmitting={false}
        handleClose={() => setIsClearChatModalOpen(false)}
        handleSubmit={clearChat}
        title="清空聊天记录？"
        content="这会清除当前范围下保存的所有聊天消息，且无法撤销。"
        variant="danger"
        primaryButtonText={{ loading: "正在清空…", default: "清空聊天" }}
      />
    </>
  );
});

export default PiChatPage;
