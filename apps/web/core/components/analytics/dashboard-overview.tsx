/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSearchParams } from "react-router";
import useSWR from "swr";
import { useTranslation } from "@plane/i18n";
import { DashboardService } from "@/services/dashboard.service";
import type {
  IDashboardRiskItem,
  IWorkspaceDashboardFilters,
  IWorkspaceDashboardOverview,
  TDashboardRisk,
} from "@/services/dashboard.service";
import {
  getActionableTotal,
  getCompletionPercentage,
  getDashboardHref,
  getStateDistribution,
} from "./dashboard-overview.utils";

const dashboardService = new DashboardService();
const STATE_COLORS: Record<string, string> = {
  backlog: "bg-layer-3",
  unstarted: "bg-accent-primary",
  started: "bg-warning-primary",
  completed: "bg-success-primary",
  cancelled: "bg-layer-2",
};

const RISK_KINDS: TDashboardRisk[] = ["overdue", "due_soon", "stale", "high_priority_unassigned"];

function SummaryCard({
  label,
  value,
  href,
  active,
}: {
  label: string;
  value: number;
  href?: string;
  active?: boolean;
}) {
  const card = (
    <div className={`rounded-xl border bg-surface-1 p-5 ${active ? "border-accent-primary" : "border-subtle"}`}>
      <p className="text-13 text-tertiary">{label}</p>
      <p className="mt-3 text-28 font-semibold text-primary">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl hover:opacity-80">
      {card}
    </Link>
  ) : (
    card
  );
}

function ProjectProgress({
  workspaceSlug,
  projects,
}: {
  workspaceSlug: string;
  projects: IWorkspaceDashboardOverview["projects"];
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-subtle bg-surface-1 p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-16 font-semibold text-primary">{t("dashboard_overview.project_progress")}</h2>
        <span className="text-12 text-tertiary">{t("dashboard_overview.progress_hint")}</span>
      </div>
      {projects.length === 0 ? (
        <p className="py-10 text-center text-13 text-tertiary">{t("dashboard_overview.no_projects")}</p>
      ) : (
        <div className="max-h-[420px] space-y-5 overflow-y-auto">
          {projects.map((project) => {
            const actionable = getActionableTotal(project.total, project.cancelled);
            const percentage = getCompletionPercentage(project.completed, project.total, project.cancelled);
            return (
              <div key={project.id}>
                <div className="mb-2 flex items-center justify-between gap-3 text-13">
                  <Link
                    href={`/${workspaceSlug}/projects/${project.id}/issues`}
                    className="truncate font-medium text-primary hover:text-accent-primary"
                  >
                    {project.name}
                  </Link>
                  <span className="shrink-0 text-secondary">
                    {project.completed}/{actionable} ({percentage}%)
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={project.name}
                  aria-valuenow={percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 overflow-hidden rounded-full bg-layer-1"
                >
                  <div className="h-full rounded-full bg-accent-primary" style={{ width: `${percentage}%` }} />
                </div>
                {project.overdue > 0 && (
                  <p className="mt-1 text-12 text-danger-primary">
                    {t("dashboard_overview.project_overdue", { count: project.overdue })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StateDistribution({ states }: { states: Record<string, number> }) {
  const { t } = useTranslation();
  const distribution = getStateDistribution(states);
  const total = distribution.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="rounded-xl border border-subtle bg-surface-1 p-5">
      <h2 className="mb-5 text-16 font-semibold text-primary">{t("dashboard_overview.state_distribution")}</h2>
      {total === 0 ? (
        <p className="py-10 text-center text-13 text-tertiary">{t("dashboard_overview.no_work_items")}</p>
      ) : (
        <div className="space-y-4">
          {distribution.map(({ group, count }) => (
            <div key={group} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-13 text-secondary">{t(`dashboard_overview.states.${group}`)}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-layer-1">
                <div
                  className={`h-full rounded-full ${STATE_COLORS[group]}`}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              </div>
              <span className="w-9 text-right text-13 text-primary">{count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function WeeklyTrends({ weeks }: { weeks: IWorkspaceDashboardOverview["weekly_trends"] }) {
  const { t } = useTranslation();
  const series = [
    { key: "created", color: "bg-accent-primary" },
    { key: "completed", color: "bg-success-primary" },
    { key: "overdue", color: "bg-warning-primary" },
  ] as const;
  const peak = Math.max(1, ...weeks.flatMap((week) => series.map(({ key }) => week[key])));

  return (
    <section className="rounded-xl border border-subtle bg-surface-1 p-5">
      <h2 className="text-16 font-semibold text-primary">{t("dashboard_overview.trends.title")}</h2>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-12 text-secondary">
        {series.map(({ key, color }) => (
          <span key={key} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
            {t(`dashboard_overview.trends.${key}`)}
          </span>
        ))}
      </div>
      <div className="mt-6 overflow-x-auto">
        <div className="grid min-w-[400px] grid-cols-8 gap-2">
          {weeks.map((week) => (
            <div key={week.week_start} className="min-w-0 text-center">
              <div className="flex h-36 items-end justify-center gap-1">
                {series.map(({ key, color }) => (
                  <div
                    key={key}
                    className={`w-2.5 rounded-t-sm ${color}`}
                    style={{ height: week[key] ? `${Math.max(3, (week[key] / peak) * 128)}px` : 0 }}
                    title={`${t(`dashboard_overview.trends.${key}`)}: ${week[key]}`}
                    role="img"
                    aria-label={`${week.week_start} ${t(`dashboard_overview.trends.${key}`)} ${week[key]}`}
                  />
                ))}
              </div>
              <span className="mt-2 block text-12 text-tertiary">{week.week_start.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-12 leading-5 text-tertiary">{t("dashboard_overview.trends.hint")}</p>
    </section>
  );
}

function RiskItems({
  workspaceSlug,
  items,
  risk,
  total,
  page,
  searchParams,
}: {
  workspaceSlug: string;
  items: IDashboardRiskItem[];
  risk?: TDashboardRisk;
  total?: number;
  page?: number;
  searchParams?: URLSearchParams;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-xl border border-subtle bg-surface-1 p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-16 font-semibold text-primary">
          {risk ? t(`dashboard_overview.metrics.${risk}`) : t("dashboard_overview.overdue_list")}
        </h2>
        {risk && searchParams ? (
          <Link
            href={getDashboardHref(workspaceSlug, searchParams, { risk: null, page: null })}
            className="text-13 text-accent-primary"
          >
            {t("dashboard_overview.back_to_overview")}
          </Link>
        ) : (
          items.length > 0 && <span className="text-12 text-tertiary">{t("dashboard_overview.top_ten")}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-13 text-tertiary">
          {risk ? t("dashboard_overview.no_risk_items") : t("dashboard_overview.no_overdue")}
        </p>
      ) : (
        <div className="divide-y divide-subtle">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/${workspaceSlug}/projects/${item.project_id}/issues/${item.id}`}
              className="flex items-center justify-between gap-4 py-3 text-13 hover:text-accent-primary"
            >
              <span className="min-w-0 truncate text-primary">
                <span className="mr-2 text-tertiary">
                  {item.project__identifier}-{item.sequence_id}
                </span>
                {item.name}
              </span>
              <span className="shrink-0 text-danger-primary">
                {risk === "stale" ? item.updated_at.slice(0, 10) : (item.target_date ?? "")}
              </span>
            </Link>
          ))}
        </div>
      )}
      {risk && searchParams && total !== undefined && page !== undefined && total > 20 && (
        <div className="mt-4 flex items-center justify-between border-t border-subtle pt-4 text-13 text-secondary">
          {page > 1 ? (
            <Link href={getDashboardHref(workspaceSlug, searchParams, { page: String(page - 1) })}>
              {t("dashboard_overview.previous")}
            </Link>
          ) : (
            <span />
          )}
          <span>{t("dashboard_overview.page_info", { page, pages: Math.ceil(total / 20) })}</span>
          {page * 20 < total ? (
            <Link href={getDashboardHref(workspaceSlug, searchParams, { page: String(page + 1) })}>
              {t("dashboard_overview.next")}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </section>
  );
}

export function WorkspaceDashboardOverview() {
  const { workspaceSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const slug = workspaceSlug?.toString();
  const requestedRisk = searchParams.get("risk");
  const risk = RISK_KINDS.find((kind) => kind === requestedRisk);
  const filters: IWorkspaceDashboardFilters = {
    project_id: searchParams.get("project_id") ?? undefined,
    assignee_id: searchParams.get("assignee_id") ?? undefined,
    created_range: searchParams.get("created_range") ?? undefined,
    risk,
    page: risk ? Number(searchParams.get("page") ?? "1") : undefined,
  };
  const { data, error, isLoading, mutate } = useSWR(
    slug ? ["dashboard-overview", slug, searchParams.toString()] : null,
    () => dashboardService.getWorkspaceOverview(slug as string, filters)
  );
  const changeFilter = (key: "project_id" | "assignee_id" | "created_range", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    setSearchParams(params);
  };

  if (isLoading) {
    return <div className="px-6 py-12 text-13 text-secondary">{t("dashboard_overview.loading")}</div>;
  }
  if (error || !data) {
    return (
      <div className="px-6 py-12 text-13 text-danger-primary">
        {t("dashboard_overview.load_error")}
        <button type="button" className="ml-3 underline" onClick={() => void mutate()}>
          {t("dashboard_overview.retry")}
        </button>
      </div>
    );
  }

  const summaryCards = [
    ["projects", data.summary.projects],
    ["total", data.summary.total],
    ["completed", data.summary.completed],
    ["in_progress", data.summary.in_progress],
  ] as const;

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 px-6 py-8">
      <div>
        <h1 className="text-24 font-semibold text-primary">{t("dashboard_overview.title")}</h1>
        <p className="mt-1 text-13 text-secondary">{t("dashboard_overview.description")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-12 text-secondary">
          {t("dashboard_overview.filters.project")}
          <select
            aria-label={t("dashboard_overview.filters.project")}
            value={filters.project_id ?? ""}
            onChange={(event) => changeFilter("project_id", event.target.value)}
            className="max-w-56 rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary"
          >
            <option value="">{t("dashboard_overview.filters.all_projects")}</option>
            {data.available_projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-12 text-secondary">
          {t("dashboard_overview.filters.assignee")}
          <select
            aria-label={t("dashboard_overview.filters.assignee")}
            value={filters.assignee_id ?? ""}
            onChange={(event) => changeFilter("assignee_id", event.target.value)}
            className="max-w-56 rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary"
          >
            <option value="">{t("dashboard_overview.filters.all_assignees")}</option>
            <option value="unassigned">{t("dashboard_overview.filters.unassigned")}</option>
            {data.assignees.map((member) => (
              <option key={member.member_id} value={member.member_id}>
                {member.member__display_name || member.member_id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-12 text-secondary">
          {t("dashboard_overview.filters.created_range")}
          <select
            aria-label={t("dashboard_overview.filters.created_range")}
            value={filters.created_range ?? ""}
            onChange={(event) => changeFilter("created_range", event.target.value)}
            className="rounded-md border border-subtle bg-surface-1 px-3 py-2 text-13 text-primary"
          >
            <option value="">{t("dashboard_overview.filters.all_time")}</option>
            {["last_7_days", "last_30_days", "last_90_days"].map((range) => (
              <option key={range} value={range}>
                {t(`dashboard_overview.filters.${range}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map(([key, value]) => (
          <SummaryCard key={key} label={t(`dashboard_overview.metrics.${key}`)} value={value} />
        ))}
      </div>
      <section>
        <h2 className="mb-3 text-16 font-semibold text-primary">{t("dashboard_overview.risks_title")}</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {RISK_KINDS.map((kind) => (
            <SummaryCard
              key={kind}
              label={t(`dashboard_overview.metrics.${kind}`)}
              value={data.summary[kind]}
              href={getDashboardHref(slug as string, searchParams, { risk: kind, page: null })}
              active={risk === kind}
            />
          ))}
        </div>
        <p className="mt-2 text-12 text-tertiary">{t("dashboard_overview.risks_hint")}</p>
      </section>
      {risk && (
        <RiskItems
          workspaceSlug={slug as string}
          items={data.risk_items}
          risk={risk}
          total={data.risk_total}
          page={data.risk_page}
          searchParams={searchParams}
        />
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProjectProgress workspaceSlug={slug as string} projects={data.projects} />
        <StateDistribution states={data.states} />
      </div>
      <WeeklyTrends weeks={data.weekly_trends} />
      <section className="rounded-xl border border-subtle bg-surface-1 p-5 text-12 leading-6 text-secondary">
        <h2 className="mb-1 text-14 font-semibold text-primary">{t("dashboard_overview.definition.title")}</h2>
        <p>{t("dashboard_overview.definition.progress")}</p>
        <p>{t("dashboard_overview.definition.stale")}</p>
        <p>{t("dashboard_overview.definition.created_filter")}</p>
      </section>
      {!risk && <RiskItems workspaceSlug={slug as string} items={data.overdue_items} />}
    </main>
  );
}
