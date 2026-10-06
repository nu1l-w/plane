import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PriorityIcon } from "../../../../../packages/propel/src/icons/priority-icon";

describe("priority flags", () => {
  it.each(["urgent", "high", "medium", "low", "none"] as const)(
    "renders the same flag in the %s color with and without a container",
    (priority) => {
      for (const withContainer of [false, true]) {
        const html = renderToStaticMarkup(createElement(PriorityIcon, { priority, withContainer, size: 16 }));
        expect(html).toContain("lucide-flag");
        expect(html).toContain('fill="currentColor"');
        expect(html).toContain(`text-priority-${priority}`);
        expect(html).toContain('width="16"');
        expect(html).not.toMatch(/P[0-4]|border-priority/);
      }
    }
  );

  it.each([null, undefined])("uses the neutral flag for an unset priority (%s)", (priority) => {
    const html = renderToStaticMarkup(createElement(PriorityIcon, { priority }));
    expect(html).toContain("lucide-flag");
    expect(html).toContain("text-priority-none");
  });
});
