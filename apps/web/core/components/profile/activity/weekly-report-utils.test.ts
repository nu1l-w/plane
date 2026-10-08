import { describe, expect, it } from "vitest";
import type { IIssueActivity } from "@plane/types";
import { activityLabel, reportHtml, reportMarkdown, weekRange } from "./weekly-report-utils";

describe("weekly report", () => {
  it("uses a Monday to Sunday week across month boundaries", () => {
    expect(weekRange(new Date(2026, 9, 8))).toEqual({ start: "2026-10-05", end: "2026-10-11" });
    expect(weekRange(new Date(2026, 0, 1))).toEqual({ start: "2025-12-29", end: "2026-01-04" });
  });

  it("turns work item activity into an editable report without claiming completion", () => {
    const activity = {
      id: "activity-1",
      verb: "created",
      field: null,
      project_detail: { identifier: "PROJ" },
      issue_detail: { sequence_id: "7", name: "Prepare launch" },
    } as IIssueActivity;
    expect(activityLabel(activity)).toBe("创建 PROJ-7 Prepare launch");
    expect(
      reportMarkdown(
        "周报",
        "2026-10-05",
        "2026-10-11",
        "张三",
        [activity],
        [{ title: "本周完成", content: "上线准备" }]
      )
    ).toContain("## 本周完成\n上线准备");
  });

  it("escapes report content in the formatted export", () => {
    const html = reportHtml(
      "<周报>",
      "2026-10-05",
      "2026-10-11",
      "张三",
      [],
      [{ title: "问题", content: "<script>alert(1)</script>" }]
    );
    expect(html).toContain("&lt;周报&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
