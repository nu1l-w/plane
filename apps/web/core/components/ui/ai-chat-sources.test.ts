import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AIChatSources } from "./ai-chat-sources";

describe("AIChatSources", () => {
  it("collapses sources and excerpts by default while keeping citation targets and links", () => {
    const html = renderToStaticMarkup(
      createElement(AIChatSources, {
        messageId: "answer",
        sources: [{ id: "task", kind: "work_item", title: "Task", url: "/work/task", citation: 2, snippet: "Details" }],
      })
    );
    expect(html).toContain("引用来源 · 1 项");
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain('id="ai-chat-source-answer-2"');
    expect(html).toContain('href="/work/task"');
    expect(html).toContain("flex flex-col gap-2");
    expect(html).not.toContain("grid-cols");
    expect(html).not.toContain("line-clamp");
  });
});
