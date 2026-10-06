import type { TAIChatSource } from "@/services/ai.service";

export function AIChatSources({ sources, messageId }: { sources: TAIChatSource[]; messageId: string }) {
  return (
    <details className="mt-4 border-t border-subtle pt-3">
      <summary className="cursor-pointer text-12 font-medium text-tertiary hover:text-primary">
        引用来源 · {sources.length} 项
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        {sources.map((source) => (
          <details
            key={`${source.kind}-${source.id}`}
            id={source.citation !== undefined ? `ai-chat-source-${messageId}-${source.citation}` : undefined}
            className="min-w-0 rounded-md border border-subtle bg-layer-1 px-3 py-2"
          >
            <summary className="cursor-pointer text-12 text-primary">
              {source.citation !== undefined ? `[${source.citation}] ` : ""}
              {source.kind === "page" ? "页面 · " : "工作项 · "}
              {source.title}
            </summary>
            {source.location && <p className="mt-2 text-11 text-tertiary">{source.location}</p>}
            {source.snippet && <p className="mt-1 text-12 leading-5 break-words text-secondary">{source.snippet}</p>}
            <a href={source.url} className="mt-2 inline-block text-12 text-accent-primary hover:underline">
              {source.kind === "page" ? "打开页面" : "打开工作项"}
            </a>
          </details>
        ))}
      </div>
    </details>
  );
}
