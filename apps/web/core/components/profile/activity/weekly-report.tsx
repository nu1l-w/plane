/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { IIssueActivity } from "@plane/types";
import { Button } from "@plane/propel/button";
import { useUser } from "@/hooks/store/user";
import { UserService } from "@/services/user.service";
import {
  activityLabel,
  reportHtml,
  reportMarkdown,
  WEEKLY_REPORT_TEMPLATES,
  weekRange,
  type WeeklyReportTemplate,
} from "./weekly-report-utils";

const userService = new UserService();
const CUSTOM_TEMPLATES_KEY = "plane-weekly-report-templates";

type Section = { title: string; content: string };

export function WeeklyReport() {
  const { workspaceSlug, userId } = useParams();
  const { data: currentUser } = useUser();
  const [range, setRange] = useState(() => weekRange(new Date()));
  const [title, setTitle] = useState("个人工作周报");
  const [templateId, setTemplateId] = useState("classic");
  const [customTemplates, setCustomTemplates] = useState<WeeklyReportTemplate[]>([]);
  const [customName, setCustomName] = useState("");
  const [customHeadings, setCustomHeadings] = useState("");
  const [sections, setSections] = useState<Section[]>(
    WEEKLY_REPORT_TEMPLATES[0].sections.map((section) => ({ title: section, content: "" }))
  );
  const [activities, setActivities] = useState<IIssueActivity[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const hasSavedSelection = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const templates = [...WEEKLY_REPORT_TEMPLATES, ...customTemplates];
  const draftKey = `plane-weekly-report:${workspaceSlug}:${userId}:${range.start}`;

  useEffect(() => {
    hasSavedSelection.current = false;
    try {
      const saved = window.localStorage.getItem(CUSTOM_TEMPLATES_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed))
          setCustomTemplates(
            parsed.filter(
              (item): item is WeeklyReportTemplate =>
                !!item &&
                typeof item.id === "string" &&
                typeof item.name === "string" &&
                Array.isArray(item.sections) &&
                item.sections.every((section: unknown) => typeof section === "string")
            )
          );
      }
    } catch {
      // A damaged local preference should not prevent report creation.
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) {
        const draft: unknown = JSON.parse(saved);
        if (draft && typeof draft === "object") {
          const value = draft as Record<string, unknown>;
          if (typeof value.title === "string") setTitle(value.title);
          if (typeof value.templateId === "string") setTemplateId(value.templateId);
          if (Array.isArray(value.sections))
            setSections(
              value.sections.filter(
                (section): section is Section =>
                  !!section && typeof section.title === "string" && typeof section.content === "string"
              )
            );
          if (Array.isArray(value.selectedIds)) {
            hasSavedSelection.current = true;
            setSelectedIds(value.selectedIds.filter((id): id is string => typeof id === "string"));
          }
        }
      } else {
        setTitle("个人工作周报");
        setTemplateId("classic");
        setSections(WEEKLY_REPORT_TEMPLATES[0].sections.map((section) => ({ title: section, content: "" })));
        setSelectedIds([]);
      }
    } catch {
      setError("读取本地草稿失败，可以继续编辑并导出。 ");
    }
  }, [draftKey]);

  useEffect(() => {
    if (!workspaceSlug || !userId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setActivities([]);
    const fetchActivity = async () => {
      try {
        const results: IIssueActivity[] = [];
        let cursor: string | undefined;
        while (true) {
          // Cursor pages depend on the previous response and must be requested in order.
          // eslint-disable-next-line no-await-in-loop
          const page = await userService.getUserProfileActivity(String(workspaceSlug), String(userId), {
            per_page: 100,
            cursor,
            start_date: range.start,
            end_date: range.end,
          });
          results.push(...page.results);
          if (!page.next_page_results || !page.next_cursor || cancelled) break;
          cursor = page.next_cursor;
        }
        if (!cancelled) {
          setActivities(results);
          if (!hasSavedSelection.current) setSelectedIds(results.map((activity) => activity.id));
        }
      } catch {
        if (!cancelled) setError("获取本周活动失败，请重试。 ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchActivity();
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, userId, range.start, range.end]);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ title, templateId, sections, selectedIds }));
    } catch {
      // Export remains available when browser storage is disabled.
    }
  }, [draftKey, title, templateId, sections, selectedIds]);

  const selectedActivities = useMemo(
    () => activities.filter((activity) => selectedIds.includes(activity.id)),
    [activities, selectedIds]
  );
  const author = activities[0]?.actor_detail?.display_name ?? currentUser?.display_name ?? "";
  const markdown = reportMarkdown(title, range.start, range.end, author, selectedActivities, sections);

  const chooseTemplate = (id: string) => {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setTemplateId(id);
    setSections(
      template.sections.map((heading) => ({
        title: heading,
        content: sections.find((section) => section.title === heading)?.content ?? "",
      }))
    );
  };

  const saveCustomTemplate = () => {
    const name = customName.trim();
    const headings = [
      ...new Set(
        customHeadings
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      ),
    ];
    if (!name || !headings.length) {
      setError("请填写模板名称，并至少添加一个章节。 ");
      return;
    }
    const template = { id: `custom-${Date.now()}`, name, sections: headings };
    const next = [...customTemplates, template];
    try {
      window.localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(next));
    } catch {
      setError("浏览器无法保存自定义模板。 ");
      return;
    }
    setCustomTemplates(next);
    setSections(headings.map((heading) => ({ title: heading, content: "" })));
    setTemplateId(template.id);
    setCustomName("");
    setCustomHeadings("");
    setShowCustomEditor(false);
    setError("");
  };

  const download = (content: string, extension: "md" | "html", type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `周报-${range.start}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="vertical-scrollbar h-full overflow-y-auto px-5 pt-4 pb-10 md:px-9">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-13 text-secondary">选择时间和模板，核对活动，再补充总结。草稿自动保存在当前浏览器。</p>
          <span className="rounded-full bg-layer-2 px-3 py-1 text-12 text-secondary">
            {range.start} — {range.end}
          </span>
        </div>
        <div className="grid gap-4 rounded-lg border border-subtle bg-layer-1 p-4 md:grid-cols-3">
          <label className="space-y-1.5 text-12 font-medium text-secondary">
            周起始日
            <input
              type="date"
              value={range.start}
              onChange={(event) => {
                if (event.target.value) setRange(weekRange(new Date(`${event.target.value}T12:00:00`)));
              }}
              className="font-normal block h-9 w-full rounded-md border border-subtle bg-surface-1 px-3 text-13 text-primary"
            />
          </label>
          <label className="space-y-1.5 text-12 font-medium text-secondary">
            报告标题
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="font-normal block h-9 w-full rounded-md border border-subtle bg-surface-1 px-3 text-13 text-primary"
            />
          </label>
          <label className="space-y-1.5 text-12 font-medium text-secondary">
            <span className="flex items-center justify-between gap-2">
              模板
              <button
                type="button"
                className="font-normal text-12 text-accent-primary hover:underline"
                onClick={() => setShowCustomEditor((value) => !value)}
              >
                {showCustomEditor ? "收起" : "自定义模板"}
              </button>
            </span>
            <select
              value={templateId}
              onChange={(event) => chooseTemplate(event.target.value)}
              className="font-normal block h-9 w-full rounded-md border border-subtle bg-surface-1 px-3 text-13 text-primary"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          {showCustomEditor && (
            <div className="space-y-3 border-t border-subtle pt-4 md:col-span-3">
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="模板名称"
                className="w-full rounded-md border border-subtle bg-surface-1 p-2 text-13"
              />
              <textarea
                value={customHeadings}
                onChange={(event) => setCustomHeadings(event.target.value)}
                placeholder="每行一个章节标题"
                rows={4}
                className="w-full rounded-md border border-subtle bg-surface-1 p-2 text-13"
              />
              <Button onClick={saveCustomTemplate}>保存模板</Button>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="text-red-500 text-13">
            {error}
          </p>
        )}
        <section className="overflow-hidden rounded-lg border border-subtle bg-layer-1">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-4 py-3">
            <div>
              <h3 className="text-14 font-semibold text-primary">系统记录的工作</h3>
              <p className="mt-0.5 text-12 text-secondary">
                勾选要写入周报的活动 · 已选 {selectedActivities.length} / {activities.length}
              </p>
            </div>
            {activities.length > 0 && (
              <div className="flex gap-3 text-12">
                <button
                  type="button"
                  className="text-accent-primary hover:underline"
                  onClick={() => setSelectedIds(activities.map((activity) => activity.id))}
                >
                  全选
                </button>
                <button type="button" className="text-secondary hover:underline" onClick={() => setSelectedIds([])}>
                  清空
                </button>
              </div>
            )}
          </div>
          {loading ? (
            <p className="px-4 py-5 text-13 text-secondary">正在获取活动…</p>
          ) : activities.length === 0 ? (
            <p className="px-4 py-5 text-13 text-secondary">本周暂无工作项活动。</p>
          ) : (
            <div className="max-h-56 divide-y divide-subtle overflow-y-auto">
              {activities.map((activity) => (
                <label
                  key={activity.id}
                  className="flex cursor-pointer items-start gap-3 px-4 py-2.5 text-13 text-primary hover:bg-layer-2"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={selectedIds.includes(activity.id)}
                    onChange={(event) =>
                      setSelectedIds((ids) =>
                        event.target.checked ? [...ids, activity.id] : ids.filter((id) => id !== activity.id)
                      )
                    }
                  />
                  <span>{activityLabel(activity)}</span>
                </label>
              ))}
            </div>
          )}
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section, index) => (
            <label
              key={section.title}
              className="block space-y-2 rounded-lg border border-subtle bg-layer-1 p-4 text-13 font-medium text-primary"
            >
              <span className="block">{section.title}</span>
              <textarea
                rows={3}
                value={section.content}
                onChange={(event) =>
                  setSections((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, content: event.target.value } : item
                    )
                  )
                }
                placeholder={`填写${section.title}…`}
                className="font-normal min-h-24 w-full resize-y rounded-md border border-subtle bg-surface-1 p-3 text-primary"
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              download(
                reportHtml(title, range.start, range.end, author, selectedActivities, sections),
                "html",
                "text/html;charset=utf-8"
              )
            }
          >
            导出排版版
          </Button>
          <Button variant="secondary" onClick={() => download(markdown, "md", "text/markdown;charset=utf-8")}>
            导出 Markdown
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(markdown).catch(() => setError("复制失败，请使用导出功能。 "));
            }}
          >
            复制内容
          </Button>
          <Button variant="secondary" onClick={() => setShowPreview((value) => !value)}>
            {showPreview ? "收起预览" : "预览"}
          </Button>
        </div>
        {showPreview && (
          <pre className="rounded-lg border border-subtle bg-layer-1 p-5 text-13 whitespace-pre-wrap text-primary">
            {markdown}
          </pre>
        )}
      </div>
    </div>
  );
}
