/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@plane/ui";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { useInstance } from "@/hooks/store/use-instance";
import { useProject } from "@/hooks/store/use-project";
import { AIService, getAIServiceErrorMessage } from "@/services/ai.service";
import type { TAIChatMessage, TAIChatSource } from "@/services/ai.service";

const aiService = new AIService();

type TChatMessage = TAIChatMessage & {
  id: string;
  isLoading?: boolean;
  sources?: TAIChatSource[];
};

const SUGGESTIONS = ["总结这个工作区最近的进展", "哪些工作项还没有负责人？", "列出未完成工作项"];

const PiChatPage = observer(function PiChatPage() {
  const { workspaceSlug } = useParams();
  const slug = workspaceSlug?.toString() ?? "";
  const { config } = useInstance();
  const { fetchProjects } = useProject();
  const { data: projects, isLoading: isLoadingProjects } = useSWR(slug ? `AI_CHAT_PROJECTS_${slug}` : null, () =>
    fetchProjects(slug)
  );
  const [projectId, setProjectId] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<TChatMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const sendMessage = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || isSubmitting || !slug) return;

    const userMessage: TChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };
    const assistantMessage: TChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "正在查找工作区资料并生成回答…",
      isLoading: true,
    };
    const history = messages.map(({ role, content }) => ({ role, content }));

    setInput("");
    setIsSubmitting(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const result = await aiService.askWorkspace(slug, {
        history,
        message,
        project_id: projectId || undefined,
      });
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: result.response, isLoading: false, sources: result.sources }
            : item
        )
      );
    } catch (error) {
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: getAIServiceErrorMessage(error), isLoading: false }
            : item
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <AppHeader
        header={
          <div className="flex items-center gap-2 px-4 text-13 font-medium text-primary">
            <Sparkles className="size-4 text-accent-primary" />
            Plane AI
          </div>
        }
      />
      <ContentWrapper className="!overflow-hidden">
        <PageHead title="Plane AI" />
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle py-4">
            <div>
              <h1 className="text-18 font-semibold text-primary">Plane AI</h1>
              <p className="mt-1 text-13 text-tertiary">基于你有权访问的工作项和页面回答，并显示参考来源。</p>
            </div>
            <label className="flex items-center gap-2 text-13 text-secondary">
              <span>范围</span>
              <select
                className="focus:border-accent-primary rounded-md border border-subtle bg-layer-2 px-3 py-2 text-primary outline-none"
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setMessages([]);
                }}
                disabled={isLoadingProjects || isSubmitting}
              >
                <option value="">整个工作区</option>
                {(projects ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.identifier} · {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto py-5">
              {messages.length === 0 ? (
                <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-8">
                  <div className="mb-5 grid size-12 place-items-center rounded-xl border border-subtle bg-layer-1 text-accent-primary">
                    <Sparkles className="size-6" />
                  </div>
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
                <div className="mx-auto flex max-w-3xl flex-col gap-5">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-full rounded-lg border border-subtle px-4 py-3 ${
                        message.role === "user" ? "ml-auto max-w-[85%] bg-layer-1" : "mr-auto w-full bg-surface-1"
                      }`}
                    >
                      <div className="mb-2 text-11 font-medium tracking-wide text-tertiary uppercase">
                        {message.role === "user" ? "你" : "Plane AI"}
                      </div>
                      <div className={`text-14 leading-6 text-primary ${message.isLoading ? "animate-pulse" : ""}`}>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      </div>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 border-t border-subtle pt-3">
                          <div className="mb-2 text-12 font-medium text-tertiary">参考资料</div>
                          <div className="flex flex-wrap gap-2">
                            {message.sources.map((source) => (
                              <a
                                key={`${source.kind}-${source.id}`}
                                href={source.url}
                                className="max-w-full truncate rounded-md border border-subtle bg-layer-1 px-2.5 py-1.5 text-12 text-secondary hover:text-primary"
                                title={source.title}
                              >
                                {source.kind === "page" ? "页面 · " : "工作项 · "}
                                {source.title}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form
              ref={formRef}
              className="mx-auto w-full max-w-3xl border-t border-subtle py-4"
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
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      formRef.current?.requestSubmit();
                    }
                  }}
                  rows={3}
                  maxLength={4000}
                  placeholder="询问工作区的项目进展、工作项或页面…"
                  className="w-full resize-y border-0 bg-transparent px-2 py-1 text-14 text-primary outline-none placeholder:text-placeholder"
                  disabled={isSubmitting || !config?.has_llm_configured}
                />
                <div className="flex items-center justify-between px-2 pt-2">
                  <span className="text-11 text-tertiary">
                    AI 将根据所选范围内你有权访问的资料回答；资料会发送给当前配置的 AI 服务商。Enter 换行 · ⌘/Ctrl +
                    Enter 发送
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!input.trim() || isSubmitting || !config?.has_llm_configured}
                    loading={isSubmitting}
                  >
                    <Send className="mr-1.5 size-3.5" />
                    发送
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </ContentWrapper>
    </>
  );
});

export default PiChatPage;
