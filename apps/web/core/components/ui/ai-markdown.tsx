/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createElement } from "react";
import type { ReactNode } from "react";

function isSafeHref(href: string): boolean {
  const value = href.trim();
  return (
    /^(https?:|mailto:)/i.test(value) || (value.startsWith("/") && !value.startsWith("//")) || value.startsWith("#")
  );
}

function renderInline(markdown: string, keyPrefix: string, citations?: Record<number, string>): ReactNode[] {
  const tokenPattern =
    /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\*(.+?)\*|_(.+?)_|!?\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|(\[(\d+)\])/g;
  const result: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(markdown)) !== null) {
    if (match.index > lastIndex) result.push(markdown.slice(lastIndex, match.index));

    const key = `${keyPrefix}-${match.index}`;
    if (match[1] !== undefined) {
      result.push(
        <code key={key} className="font-mono rounded bg-layer-2 px-1 py-0.5 text-12">
          {match[1]}
        </code>
      );
    } else if (match[2] !== undefined || match[3] !== undefined) {
      result.push(<strong key={key}>{match[2] ?? match[3]}</strong>);
    } else if (match[4] !== undefined) {
      result.push(<del key={key}>{match[4]}</del>);
    } else if (match[5] !== undefined || match[6] !== undefined) {
      result.push(<em key={key}>{match[5] ?? match[6]}</em>);
    } else if (match[10] !== undefined) {
      const citation = Number(match[11]);
      const href = citations?.[citation];
      result.push(
        href ? (
          <a
            key={key}
            href={href}
            onClick={() => {
              if (!href.startsWith("#")) return;
              let element: HTMLElement | null = document.getElementById(href.slice(1));
              while (element) {
                if (element instanceof HTMLDetailsElement) element.open = true;
                element = element.parentElement;
              }
            }}
            className="text-accent-primary underline hover:no-underline"
          >
            {match[10]}
          </a>
        ) : (
          match[10]
        )
      );
    } else {
      const label = match[7];
      const href = match[8];
      const title = match[9];
      if (href && isSafeHref(href)) {
        result.push(
          <a
            key={key}
            href={href}
            title={title}
            className="text-accent-primary underline hover:no-underline"
            target={/^(https?:|mailto:)/i.test(href) ? "_blank" : undefined}
            rel={/^(https?:|mailto:)/i.test(href) ? "noopener noreferrer" : undefined}
          >
            {label}
          </a>
        );
      } else {
        result.push(label);
      }
    }
    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < markdown.length) result.push(markdown.slice(lastIndex));
  return result;
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? "";
  return (
    /^\s*```/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*(?:[-*+]\s+|\d+\.\s+)/.test(line) ||
    /^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    (line.includes("|") &&
      (lines[index + 1] ?? "").match(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/) !== null)
  );
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderBlocks(markdown: string, keyPrefix: string, citations?: Record<number, string>): ReactNode[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const key = `${keyPrefix}-${index}`;
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !/^\s*```/.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={key} className="my-3 overflow-x-auto rounded-md bg-layer-2 p-3 text-12 leading-5">
          <code className="font-mono">{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const headingClasses = "my-3 font-semibold text-primary";
      blocks.push(
        createElement(
          `h${level}`,
          { key, className: `${headingClasses} ${level <= 2 ? "text-16" : "text-14"}` },
          renderInline(heading[2], key)
        )
      );
      index += 1;
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key} className="my-4 border-subtle" />);
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote key={key} className="my-3 border-l-2 border-subtle pl-3 text-secondary">
          {renderBlocks(quoteLines.join("\n"), key, citations)}
        </blockquote>
      );
      continue;
    }

    const listMatch = line.match(/^\s*(?:([-*+])|(\d+)\.)\s+(.*)$/);
    if (listMatch) {
      const isOrdered = listMatch[2] !== undefined;
      const items: string[] = [];
      while (index < lines.length) {
        const itemMatch = (lines[index] ?? "").match(/^\s*(?:([-*+])|(\d+)\.)\s+(.*)$/);
        if (!itemMatch || (itemMatch[2] !== undefined) !== isOrdered) break;
        items.push(itemMatch[3]);
        index += 1;
      }
      const ListTag = isOrdered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key} className={`my-3 ${isOrdered ? "list-decimal" : "list-disc"} space-y-1 pl-6 text-primary`}>
          {items.map((item) => (
            <li key={`${key}-${item}`}>{renderInline(item, `${key}-${item}`, citations)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    if (line.includes("|") && (lines[index + 1] ?? "").match(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/)) {
      const headers = splitTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(splitTableRow(lines[index] ?? ""));
        index += 1;
      }
      blocks.push(
        <div key={key} className="my-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-13">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={`${key}-head-${header}`} className="border border-subtle px-2 py-1.5 font-semibold">
                    {renderInline(header, `${key}-head-${header}`, citations)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${key}-row-${row.join("|")}`}>
                  {row.map((cell, cellIndex) => {
                    const header = headers[cellIndex] ?? "";
                    return (
                      <td key={`${key}-cell-${header}-${cell}`} className="border border-subtle px-2 py-1.5">
                        {renderInline(cell, `${key}-cell-${header}`, citations)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index]?.trim() && !isBlockStart(lines, index)) {
      paragraphLines.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(
      <p key={key} className="my-2 whitespace-pre-wrap text-primary">
        {renderInline(paragraphLines.join("\n"), key, citations)}
      </p>
    );
  }

  return blocks;
}

export function AIChatMarkdown({ markdown, citations }: { markdown: string; citations?: Record<number, string> }) {
  return (
    <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{renderBlocks(markdown, "markdown", citations)}</div>
  );
}
