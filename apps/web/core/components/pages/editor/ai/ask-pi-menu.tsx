/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { CircleArrowUp, CornerDownRight, RefreshCcw, Sparkles } from "lucide-react";
// ui
import { Tooltip } from "@plane/propel/tooltip";
// components
import { cn } from "@plane/utils";
import { RichTextEditor } from "@/components/editor/rich-text";
// helpers
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";

type Props = {
  handleAsk: (query: string) => Promise<void>;
  handleInsertText: (insertOnNextLine: boolean) => void;
  handleRegenerate: () => Promise<void>;
  isRegenerating: boolean;
  response: string | undefined;
  workspaceSlug: string;
};

export function AskPiMenu(props: Props) {
  const { handleAsk, handleInsertText, handleRegenerate, isRegenerating, response, workspaceSlug } = props;
  // states
  const [query, setQuery] = useState("");
  // store hooks
  const { getWorkspaceBySlug } = useWorkspace();
  // derived values
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id ?? "";

  return (
    <>
      <div
        className={cn("flex items-center gap-3 px-4 py-3.5", {
          "items-start": response,
        })}
      >
        <span className="grid size-7 flex-shrink-0 place-items-center rounded-full border border-subtle text-secondary">
          <Sparkles className="size-3" />
        </span>
        {response ? (
          <div>
            <RichTextEditor
              editable={false}
              displayConfig={{
                fontSize: "small-font",
              }}
              id="editor-ai-response"
              initialValue={response}
              containerClassName="!p-0 border-none"
              editorClassName="!pl-0"
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
            />
            <div className="mt-3 flex items-center gap-4">
              <button
                type="button"
                className="rounded-sm p-1 text-13 font-medium text-tertiary outline-none hover:bg-layer-1"
                onClick={() => handleInsertText(false)}
              >
                替换选中内容
              </button>
              <Tooltip tooltipContent="添加到下一行">
                <button
                  type="button"
                  className="grid size-6 flex-shrink-0 place-items-center rounded-sm outline-none hover:bg-layer-1"
                  onClick={() => handleInsertText(true)}
                >
                  <CornerDownRight className="size-4 text-tertiary" />
                </button>
              </Tooltip>
              <Tooltip tooltipContent="重新生成回复">
                <button
                  type="button"
                  className="grid size-6 flex-shrink-0 place-items-center rounded-sm outline-none hover:bg-layer-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRegenerate();
                  }}
                  disabled={isRegenerating}
                >
                  <RefreshCcw
                    className={cn("size-4 text-tertiary", {
                      "animate-spin": isRegenerating,
                    })}
                  />
                </button>
              </Tooltip>
            </div>
          </div>
        ) : (
          <p className="text-13 text-secondary">
            {isRegenerating ? "AI 正在回答..." : "输入指令后，AI 会根据选中的内容生成建议。"}
          </p>
        )}
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 rounded-md border border-subtle p-2">
          <span className="grid size-3 flex-shrink-0 place-items-center">
            <Sparkles className="size-3 text-secondary" />
          </span>
          <input
            type="text"
            className="w-full border-none bg-transparent text-13 outline-none placeholder:text-placeholder"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (query.trim() && !isRegenerating) {
                  void handleAsk(query.trim());
                  setQuery("");
                }
              }
            }}
            placeholder="告诉 AI 要做什么..."
            disabled={isRegenerating}
          />
          <button
            type="button"
            className="grid size-6 flex-shrink-0 place-items-center rounded-sm text-secondary transition-colors hover:bg-layer-1 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              if (query.trim() && !isRegenerating) {
                void handleAsk(query.trim());
                setQuery("");
              }
            }}
            disabled={!query.trim() || isRegenerating}
            aria-label="发送问题给 AI"
          >
            <CircleArrowUp className="size-4 text-secondary" />
          </button>
        </div>
      </div>
    </>
  );
}
