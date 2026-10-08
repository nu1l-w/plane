/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IIssueActivity } from "@plane/types";

export type WeeklyReportTemplate = {
  id: string;
  name: string;
  sections: string[];
};

export const WEEKLY_REPORT_TEMPLATES: WeeklyReportTemplate[] = [
  { id: "classic", name: "经典周报", sections: ["本周完成", "当前进度", "遇到问题", "下周计划"] },
  { id: "professional", name: "专业汇报", sections: ["本周成果", "关键进展与数据", "风险与所需支持", "下周重点"] },
  { id: "brief", name: "简洁版", sections: ["本周亮点", "待解决事项", "下周重点"] },
];

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function weekRange(reference: Date): { start: string; end: string } {
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: formatDate(start), end: formatDate(end) };
}

export function activityLabel(activity: IIssueActivity): string {
  const issue = activity.issue_detail;
  const identifier = activity.project_detail?.identifier;
  const issueLabel = issue ? `${identifier ? `${identifier}-` : ""}${issue.sequence_id} ${issue.name}` : "工作项";
  if (activity.verb === "created" && !activity.field) return `创建 ${issueLabel}`;
  const fieldNames: Record<string, string> = {
    name: "标题",
    state: "状态",
    priority: "优先级",
    assignees: "负责人",
    target_date: "截止日期",
    description: "描述",
    labels: "标签",
  };
  const field = activity.field ? (fieldNames[activity.field] ?? activity.field) : "内容";
  const value = activity.new_value && activity.new_value.length <= 80 ? `：${activity.new_value}` : "";
  return `更新 ${issueLabel} 的${field}${value}`;
}

export function reportMarkdown(
  title: string,
  start: string,
  end: string,
  author: string,
  activities: IIssueActivity[],
  sections: { title: string; content: string }[]
): string {
  const activityLines = activities.length
    ? activities.map((activity) => `- ${activityLabel(activity)}`).join("\n")
    : "- 本周暂无可记录的工作项活动";
  return (
    [
      `# ${title}`,
      `报告人：${author}  |  周期：${start} 至 ${end}`,
      "## 系统记录的工作",
      activityLines,
      ...sections.map((section) => `## ${section.title}\n${section.content.trim() || "待补充"}`),
    ].join("\n\n") + "\n"
  );
}

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function reportHtml(
  title: string,
  start: string,
  end: string,
  author: string,
  activities: IIssueActivity[],
  sections: { title: string; content: string }[]
): string {
  const items = activities.length
    ? activities.map((activity) => `<li>${escapeHtml(activityLabel(activity))}</li>`).join("")
    : "<li>本周暂无可记录的工作项活动</li>";
  const content = sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.content.trim() || "待补充")}</p></section>`
    )
    .join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{max-width:820px;margin:56px auto;padding:0 32px;color:#202936;font:16px/1.75 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
    header{border-bottom:2px solid #1d4ed8;padding-bottom:24px;margin-bottom:32px}h1{font-size:32px;margin:0 0 8px}h2{font-size:19px;margin:28px 0 12px;color:#173b78}
    .meta{color:#697586;font-size:14px}section{break-inside:avoid}p{white-space:pre-wrap;margin:0}li{padding:4px 0}ul{padding-left:24px}
    @media print{body{margin:0;max-width:none;padding:0}header{margin-top:0}}
  </style></head><body><header><h1>${escapeHtml(title)}</h1><div class="meta">${escapeHtml(author)} · ${escapeHtml(start)} 至 ${escapeHtml(end)}</div></header><section><h2>系统记录的工作</h2><ul>${items}</ul></section>${content}</body></html>`;
}
