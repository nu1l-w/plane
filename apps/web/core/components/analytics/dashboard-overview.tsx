/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSearchParams } from "react-router";
import useSWR from "swr";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button, getButtonStyling } from "@plane/propel/button";
import { Dialog } from "@plane/propel/dialog";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, InfoIcon } from "@plane/propel/icons";
import { CustomSelect, Loader, Tag } from "@plane/ui";
import { cn } from "@plane/utils";
import { useUser } from "@/hooks/store/user";
import { DashboardBlockedItems } from "./dashboard-blocked-items";
import { DashboardFilterMenu } from "./dashboard-filter-menu";
import { DashboardDistributions } from "./dashboard-distributions";
import { DashboardService } from "@/services/dashboard.service";
import type {
  IDashboardRiskItem,
  IWorkspaceDashboardFilters,
  IWorkspaceDashboardOverview,
  TDashboardDetail,
  TDashboardPriority,
  TDashboardRisk,
} from "@/services/dashboard.service";
import {
  getActionableTotal,
  getCompletionPercentage,
  getDashboardHref,
  getStateDistribution,
  sortDashboardProjects,
  type TProjectSort,
} from "./dashboard-overview.utils";

const dashboardService = new DashboardService();
const STATE_COLORS: Record<string, string> = {
  backlog: "bg-layer-3",
  unstarted: "bg-accent-primary",
  started: "bg-warning-primary",
  completed: "bg-success-primary",
  cancelled: "bg-layer-2",
};

const RISK_KINDS: TDashboardRisk[] = ["blocked", "overdue", "due_soon", "stale", "high_priority_unassigned"];
const DETAIL_KINDS: TDashboardDetail[] = [
  "open",
  "total",
  "backlog",
  "unstarted",
  "in_progress",
  "completed",
  "cancelled",
];
const PRIORITIES: TDashboardPriority[] = ["urgent", "high", "medium", "low", "none"];
const CARD_CLASS = "rounded-lg border border-subtle bg-surface-1";

function SummaryCard({
  label,
  value,
  href,
  active,
  attention = false,
}: {
  label: string;
  value: number;
  href?: string;
  active?: boolean;
  attention?: boolean;
}) {
  const card = (
    <div
      className={cn(
        CARD_CLASS,
        "relative h-full overflow-hidden p-4 transition-all duration-200",
        href && "group-hover:border-strong group-hover:bg-layer-1 group-hover:shadow-raised-100",
        attention && value > 0 && "border-warning-subtle bg-warning-subtle/30",
        active && "border-accent-strong bg-accent-primary/5 shadow-raised-100"
      )}
    >
      {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent-primary" aria-hidden="true" />}
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-12 font-medium text-tertiary", active && "text-accent-primary")}>{label}</p>
        {href && (
          <ChevronRightIcon
            className={cn(
              "mt-0.5 size-3.5 shrink-0 text-placeholder transition-all",
              active
                ? "translate-x-0 text-accent-primary"
                : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
            )}
            aria-hidden="true"
          />
        )}
      </div>
      <p
        className={cn(
          "mt-2 text-24 font-semibold tracking-tight text-primary",
          attention && value > 0 && "text-warning-primary"
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="group block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
      aria-current={active ? "page" : undefined}
    >
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
  const [sort, setSort] = useState<TProjectSort>("overdue");
  return (
    <section className={cn(CARD_CLASS, "p-4 md:p-5")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-16 font-semibold text-primary">{t("dashboard_overview.project_progress")}</h2>
        <CustomSelect
          value={sort}
          onChange={(value: TProjectSort) => setSort(value)}
          label={t(`dashboard_overview.sort.${sort}`)}
        >
          {(["overdue", "completion", "name"] as const).map((key) => (
            <CustomSelect.Option key={key} value={key}>
              {t(`dashboard_overview.sort.${key}`)}
            </CustomSelect.Option>
          ))}
        </CustomSelect>
      </div>
      {projects.length === 0 ? (
        <p className="py-10 text-center text-13 text-tertiary">{t("dashboard_overview.no_projects")}</p>
      ) : (
        <>
          <p className="mb-3 text-12 text-tertiary">{t("dashboard_overview.progress_hint")}</p>
          <div className="-mx-2 grid max-h-[420px] grid-cols-1 items-start gap-x-6 gap-y-1 overflow-y-auto px-2 md:grid-cols-2">
            {sortDashboardProjects(projects, sort).map((project) => {
              const actionable = getActionableTotal(project.total, project.cancelled);
              const percentage = getCompletionPercentage(project.completed, project.total, project.cancelled);
              return (
                <Link
                  key={project.id}
                  href={`/${workspaceSlug}/projects/${project.id}/issues`}
                  className="group block rounded-md px-2 py-2.5 transition-colors outline-none hover:bg-layer-1 focus-visible:ring-2 focus-visible:ring-accent-strong"
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-13">
                    <span className="min-w-0 truncate font-medium text-primary transition-colors group-hover:text-accent-primary">
                      {project.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-secondary">
                      {project.completed}/{actionable} ({percentage}%)
                      <ChevronRightIcon
                        className="size-3 text-placeholder opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                        aria-hidden="true"
                      />
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
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function StateDistribution({
  workspaceSlug,
  states,
  searchParams,
  activeDetail,
}: {
  workspaceSlug: string;
  states: Record<string, number>;
  searchParams: URLSearchParams;
  activeDetail?: TDashboardDetail;
}) {
  const { t } = useTranslation();
  const distribution = getStateDistribution(states);
  const total = distribution.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className={cn(CARD_CLASS, "p-4 md:p-5 xl:row-span-2 xl:grid xl:grid-rows-subgrid")}>
      <div className="mb-3 min-h-20 xl:mb-0">
        <h2 className="text-16 font-semibold text-primary">{t("dashboard_overview.state_distribution")}</h2>
        <p className="mt-1 text-12 leading-5 text-tertiary">{t("dashboard_overview.state_hint")}</p>
      </div>
      {total === 0 ? (
        <p className="py-10 text-center text-13 text-tertiary">{t("dashboard_overview.no_work_items")}</p>
      ) : (
        <div className="-mx-2 max-h-[400px] overflow-y-auto xl:h-[400px]">
          {distribution.map(({ group, count }) => {
            const detail = group === "started" ? "in_progress" : group;
            const isActive = activeDetail === detail;
            return (
              <Link
                key={group}
                href={getDashboardHref(workspaceSlug, searchParams, {
                  detail,
                  risk: null,
                  page: null,
                })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group block h-20 rounded-md px-2 py-2.5 transition-colors outline-none hover:bg-layer-1 focus-visible:ring-2 focus-visible:ring-accent-strong",
                  isActive && "bg-accent-primary/5"
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-13">
                  <span className={cn("text-secondary", isActive && "text-accent-primary")}>
                    {t(`dashboard_overview.states.${group}`)}
                  </span>
                  <span className="font-medium text-primary">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-layer-1">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-300", STATE_COLORS[group])}
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DashboardPagination({
  workspaceSlug,
  searchParams,
  page,
  total,
}: {
  workspaceSlug: string;
  searchParams: URLSearchParams;
  page: number;
  total: number;
}) {
  const { t } = useTranslation();
  const pages = Math.ceil(total / 20);

  return (
    <nav
      className="mt-4 flex items-center justify-between gap-3 border-t border-subtle pt-4"
      aria-label={t("dashboard_overview.page_info", { page, pages })}
    >
      {page > 1 ? (
        <Link
          href={getDashboardHref(workspaceSlug, searchParams, { page: String(page - 1) })}
          className={cn(getButtonStyling("secondary", "lg"), "gap-1")}
        >
          <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
          {t("dashboard_overview.previous")}
        </Link>
      ) : (
        <span className="h-7 min-w-16" aria-hidden="true" />
      )}
      <span className="text-12 text-tertiary">{t("dashboard_overview.page_info", { page, pages })}</span>
      {page < pages ? (
        <Link
          href={getDashboardHref(workspaceSlug, searchParams, { page: String(page + 1) })}
          className={cn(getButtonStyling("secondary", "lg"), "gap-1")}
        >
          {t("dashboard_overview.next")}
          <ChevronRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      ) : (
        <span className="h-7 min-w-16" aria-hidden="true" />
      )}
    </nav>
  );
}

function DetailItems({
  workspaceSlug,
  items,
  total,
  page,
  searchParams,
}: {
  workspaceSlug: string;
  items: IDashboardRiskItem[];
  total: number;
  page: number;
  searchParams: URLSearchParams;
}) {
  const { t } = useTranslation();
  return (
    <div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-13 text-tertiary">{t("dashboard_overview.no_work_items")}</p>
      ) : (
        <div className="-mx-2 divide-y divide-subtle">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/${workspaceSlug}/projects/${item.project_id}/issues/${item.id}`}
              className="group flex items-center justify-between gap-4 rounded-sm px-2 py-3 text-13 transition-colors outline-none hover:bg-layer-1 focus-visible:ring-2 focus-visible:ring-accent-strong"
            >
              <span className="min-w-0 truncate text-primary transition-colors group-hover:text-accent-primary">
                <span className="mr-2 text-tertiary">
                  {item.project__identifier}-{item.sequence_id}
                </span>
                <span className="block truncate font-medium">{item.name}</span>
                <span className="mt-1 block truncate text-12 text-tertiary">
                  {item.project__name} · {t(item.priority)} ·{" "}
                  {item.assignees.map((member) => member.name || member.id).join(", ") ||
                    t("dashboard_overview.filters.unassigned")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-secondary">
                {item.target_date ?? ""}
                <ChevronRightIcon
                  className="size-3 text-placeholder opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      )}
      {total > 20 && (
        <DashboardPagination workspaceSlug={workspaceSlug} searchParams={searchParams} page={page} total={total} />
      )}
    </div>
  );
}

function DashboardDetailDrawer({
  workspaceSlug,
  items,
  detail,
  risk,
  total,
  page,
  searchParams,
  onClose,
}: {
  workspaceSlug: string;
  items: IDashboardRiskItem[];
  detail?: TDashboardDetail;
  risk?: TDashboardRisk;
  total: number;
  page: number;
  searchParams: URLSearchParams;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const title = risk
    ? t(`dashboard_overview.metrics.${risk}`)
    : detail === "open" || detail === "total" || detail === "in_progress"
      ? t(`dashboard_overview.metrics.${detail}`)
      : t(`dashboard_overview.states.${detail}`);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Panel
        aria-labelledby="dashboard-detail-title"
        className="!fixed !inset-y-0 !top-0 !right-0 !left-auto flex !h-screen !w-full !max-w-none !translate-x-0 !translate-y-0 flex-col overflow-hidden !rounded-none !border-y-0 !border-r-0 p-0 sm:!w-[min(48rem,calc(100vw-1rem))] sm:!rounded-l-lg"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-subtle px-5 py-4">
          <Dialog.Title id="dashboard-detail-title" className="text-16 font-semibold text-primary">
            {title}
          </Dialog.Title>
          <Button variant="ghost" size="lg" prependIcon={<CloseIcon />} onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {detail && (
            <DetailItems
              workspaceSlug={workspaceSlug}
              items={items}
              total={total}
              page={page}
              searchParams={searchParams}
            />
          )}
          {risk && (
            <RiskItems
              workspaceSlug={workspaceSlug}
              items={items}
              risk={risk}
              total={total}
              page={page}
              searchParams={searchParams}
              isDrawer
            />
          )}
        </div>
      </Dialog.Panel>
    </Dialog>
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
    <section className={cn(CARD_CLASS, "p-4 md:p-5")}>
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
        <div className="grid min-w-[560px] grid-cols-8 gap-1">
          {weeks.map((week) => (
            <div
              key={week.week_start}
              className="group min-w-0 rounded-md px-1.5 pt-2 text-center transition-colors hover:bg-layer-1"
            >
              <div className="mb-1 flex min-h-5 items-center justify-center gap-1 text-10 font-medium text-secondary opacity-0 transition-opacity group-hover:opacity-100">
                {series.map(({ key }) => (
                  <span key={key}>{week[key]}</span>
                ))}
              </div>
              <div className="flex h-32 items-end justify-center gap-1">
                {series.map(({ key, color }) => (
                  <div
                    key={key}
                    className={cn("w-2.5 rounded-t-sm transition-opacity group-hover:opacity-80", color)}
                    style={{ height: week[key] ? `${Math.max(3, (week[key] / peak) * 112)}px` : 0 }}
                    title={`${t(`dashboard_overview.trends.${key}`)}: ${week[key]}`}
                    role="img"
                    aria-label={`${week.week_start} ${t(`dashboard_overview.trends.${key}`)} ${week[key]}`}
                  />
                ))}
              </div>
              <span className="mt-2 block pb-2 text-12 text-tertiary">{week.week_start.slice(5)}</span>
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
  isDrawer = false,
}: {
  workspaceSlug: string;
  items: IDashboardRiskItem[];
  risk?: TDashboardRisk;
  total?: number;
  page?: number;
  searchParams?: URLSearchParams;
  isDrawer?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className={isDrawer ? "" : cn(CARD_CLASS, "p-4 md:p-5")}>
      {!risk && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-16 font-semibold text-primary">{t("dashboard_overview.overdue_list")}</h2>
          {items.length > 0 && <span className="text-12 text-tertiary">{t("dashboard_overview.top_ten")}</span>}
        </div>
      )}
      {items.length === 0 ? (
        <p className="py-10 text-center text-13 text-tertiary">
          {risk ? t("dashboard_overview.no_risk_items") : t("dashboard_overview.no_overdue")}
        </p>
      ) : risk === "blocked" ? (
        <DashboardBlockedItems workspaceSlug={workspaceSlug} items={items} />
      ) : (
        <div className="-mx-2 divide-y divide-subtle">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/${workspaceSlug}/projects/${item.project_id}/issues/${item.id}`}
              className="group flex items-center justify-between gap-4 rounded-sm px-2 py-3 text-13 transition-colors outline-none hover:bg-layer-1 focus-visible:ring-2 focus-visible:ring-accent-strong"
            >
              <span className="min-w-0 truncate text-primary transition-colors group-hover:text-accent-primary">
                <span className="mr-2 text-tertiary">
                  {item.project__identifier}-{item.sequence_id}
                </span>
                <span className="block truncate font-medium">{item.name}</span>
                <span className="mt-1 block truncate text-12 text-tertiary">
                  {item.project__name} · {t(item.priority)} ·{" "}
                  {item.assignees.map((member) => member.name || member.id).join(", ") ||
                    t("dashboard_overview.filters.unassigned")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-danger-primary">
                <span className="text-right">
                  <span className="block">
                    {risk === "stale" ? item.updated_at.slice(0, 10) : (item.target_date ?? "")}
                  </span>
                  {item.overdue_days > 0 && (
                    <span className="mt-1 block text-12">
                      {t("dashboard_overview.overdue_days", { count: item.overdue_days })}
                    </span>
                  )}
                </span>
                <ChevronRightIcon
                  className="size-3 text-placeholder opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      )}
      {risk && searchParams && total !== undefined && page !== undefined && total > 20 && (
        <DashboardPagination workspaceSlug={workspaceSlug} searchParams={searchParams} page={page} total={total} />
      )}
    </section>
  );
}

function DashboardOverviewLoader() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 md:px-6">
      <span className="sr-only">{t("dashboard_overview.loading")}</span>
      <Loader className="space-y-3">
        <Loader.Item height="16px" width="420px" className="max-w-full" />
      </Loader>
      <Loader>
        <Loader.Item height="92px" width="100%" className="rounded-lg" />
      </Loader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {["total", "completed", "in-progress", "projects"].map((key) => (
          <Loader key={key}>
            <Loader.Item height="104px" width="100%" className="rounded-lg" />
          </Loader>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {["project-progress", "state-distribution"].map((key) => (
          <Loader key={key}>
            <Loader.Item height="280px" width="100%" className="rounded-lg" />
          </Loader>
        ))}
      </div>
    </main>
  );
}

export const WorkspaceOverview = observer(function WorkspaceOverview() {
  const { data: currentUser } = useUser();
  const { workspaceSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const slug = workspaceSlug?.toString();
  const requestedRisk = searchParams.get("risk");
  const risk = RISK_KINDS.find((kind) => kind === requestedRisk);
  const requestedDetail = searchParams.get("detail");
  const detail = risk ? undefined : DETAIL_KINDS.find((kind) => kind === requestedDetail);
  const filters: IWorkspaceDashboardFilters = {
    project_id: searchParams.get("project_id") ?? undefined,
    assignee_id: searchParams.get("assignee_id") ?? undefined,
    created_range: searchParams.get("created_range") ?? undefined,
    priority: PRIORITIES.find((priority) => priority === searchParams.get("priority")),
    risk,
    detail,
    page: risk || detail ? Number(searchParams.get("page") ?? "1") : undefined,
  };
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    slug ? ["dashboard-overview", slug, searchParams.toString()] : null,
    () => dashboardService.getWorkspaceOverview(slug as string, filters),
    { keepPreviousData: true }
  );
  const changeFilter = (key: "project_id" | "assignee_id" | "created_range" | "priority", value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    setSearchParams(params, { replace: true });
  };
  const hasActiveFilters = Boolean(
    filters.project_id || filters.assignee_id || filters.created_range || filters.priority
  );
  const clearFilters = () => {
    const params = new URLSearchParams(searchParams);
    ["project_id", "assignee_id", "created_range", "priority", "page"].forEach((key) => params.delete(key));
    setSearchParams(params, { replace: true });
  };
  const closeDetail = () => {
    const params = new URLSearchParams(searchParams);
    ["detail", "risk", "page"].forEach((key) => params.delete(key));
    setSearchParams(params, { replace: true });
  };

  if (isLoading && !data) return <DashboardOverviewLoader />;
  if (!data) {
    return (
      <div className="mx-auto flex min-h-[360px] w-full max-w-[1440px] flex-col items-center justify-center gap-3 px-6 py-4 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-danger-subtle text-danger-primary">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <p className="text-14 font-medium text-primary">{t("dashboard_overview.load_error")}</p>
        <Button variant="secondary" size="lg" onClick={() => void mutate()}>
          {t("dashboard_overview.retry")}
        </Button>
      </div>
    );
  }

  const summaryCards = [
    ["projects", data.summary.projects],
    ["total", data.summary.total],
    ["completed", data.summary.completed],
    ["in_progress", data.summary.in_progress],
  ] as const;
  const selectedProject = data.available_projects.find((project) => project.id === filters.project_id);
  const selectedAssignee = data.assignees.find((member) => member.member_id === filters.assignee_id);
  const createdRangeLabel = filters.created_range
    ? t(`dashboard_overview.filters.${filters.created_range}`)
    : t("dashboard_overview.filters.all_time");
  const appliedFilters: {
    key: "project_id" | "assignee_id" | "created_range" | "priority";
    label: string;
    value: string;
  }[] = [];
  if (filters.project_id) {
    appliedFilters.push({
      key: "project_id",
      label: t("dashboard_overview.filters.project"),
      value: selectedProject?.name ?? filters.project_id,
    });
  }
  if (filters.assignee_id) {
    appliedFilters.push({
      key: "assignee_id",
      label: t("dashboard_overview.filters.assignee"),
      value:
        filters.assignee_id === "unassigned"
          ? t("dashboard_overview.filters.unassigned")
          : selectedAssignee?.member__display_name || filters.assignee_id,
    });
  }
  if (filters.created_range) {
    appliedFilters.push({
      key: "created_range",
      label: t("dashboard_overview.filters.created_range"),
      value: createdRangeLabel,
    });
  }
  if (filters.priority) {
    appliedFilters.push({
      key: "priority",
      label: t("common.priority"),
      value: t(filters.priority),
    });
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 md:px-6">
      <div className="grid grid-cols-1 items-start gap-x-3 gap-y-1 md:grid-cols-2">
        <div className="md:row-span-2">
          <h1 className="text-24 font-semibold tracking-tight text-primary">{t("dashboard_overview.title")}</h1>
          <p className="mt-1 text-13 text-secondary">{t("dashboard_overview.description")}</p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <DashboardFilterMenu
            isFiltersApplied={hasActiveFilters}
            groups={[
              {
                key: "project_id",
                label: t("dashboard_overview.filters.project"),
                value: filters.project_id ?? "",
                options: [
                  { value: "", label: t("dashboard_overview.filters.all_projects") },
                  ...data.available_projects.map((project) => ({ value: project.id, label: project.name })),
                ],
              },
              {
                key: "assignee_id",
                label: t("dashboard_overview.filters.assignee"),
                value: filters.assignee_id ?? "",
                options: [
                  { value: "", label: t("dashboard_overview.filters.all_assignees") },
                  { value: "unassigned", label: t("dashboard_overview.filters.unassigned") },
                  ...data.assignees.map((member) => ({
                    value: member.member_id,
                    label: member.member__display_name || member.member_id,
                  })),
                ],
              },
              {
                key: "created_range",
                label: t("dashboard_overview.filters.created_range"),
                value: filters.created_range ?? "",
                options: [
                  { value: "", label: t("dashboard_overview.filters.all_time") },
                  ...["last_7_days", "last_30_days", "last_90_days"].map((range) => ({
                    value: range,
                    label: t(`dashboard_overview.filters.${range}`),
                  })),
                ],
              },
              {
                key: "priority",
                label: t("common.priority"),
                value: filters.priority ?? "",
                options: [
                  { value: "", label: t("common.all") },
                  ...PRIORITIES.map((priority) => ({ value: priority, label: t(priority) })),
                ],
              },
            ]}
            onChange={changeFilter}
          />
          {currentUser && (
            <Button
              variant={filters.assignee_id === currentUser.id ? "primary" : "secondary"}
              size="lg"
              onClick={() => changeFilter("assignee_id", filters.assignee_id === currentUser.id ? "" : currentUser.id)}
            >
              {t("dashboard_overview.only_mine")}
            </Button>
          )}
        </div>
        <section
          className="relative flex h-6 min-w-0 items-center overflow-x-auto md:col-start-2"
          aria-label={t("common.filters")}
          aria-busy={isValidating}
        >
          {isValidating && (
            <span className="sr-only" role="status">
              {t("dashboard_overview.loading")}
            </span>
          )}
          {appliedFilters.length > 0 && (
            <div className="ml-auto flex shrink-0 items-center gap-1.5" aria-label={t("common.filters")}>
              {appliedFilters.map((filter) => (
                <Tag key={filter.key} className="h-6 shrink-0 gap-1 px-1.5 py-0 text-11">
                  <span className="text-11 text-tertiary">{filter.label}</span>
                  <span className="max-w-28 truncate text-11 text-primary" title={filter.value}>
                    {filter.value}
                  </span>
                  <button
                    type="button"
                    className="grid place-items-center text-tertiary hover:text-secondary"
                    aria-label={`${t("common.remove")} ${filter.label}`}
                    onClick={() => changeFilter(filter.key, "")}
                  >
                    <CloseIcon height={12} width={12} strokeWidth={2} />
                  </button>
                </Tag>
              ))}
              <button
                type="button"
                className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                onClick={clearFilters}
              >
                <Tag className="h-6 shrink-0 gap-1 px-1.5 py-0 text-11">
                  {t("common.clear_all")}
                  <CloseIcon height={12} width={12} strokeWidth={2} />
                </Tag>
              </button>
            </div>
          )}
        </section>
      </div>
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-danger-subtle bg-danger-subtle px-3 py-2 text-12 text-danger-primary">
          <span>{t("dashboard_overview.load_error")}</span>
          <Button variant="ghost" size="sm" onClick={() => void mutate()}>
            {t("dashboard_overview.retry")}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(([key, value]) => (
          <SummaryCard
            key={key}
            label={t(`dashboard_overview.metrics.${key}`)}
            value={value}
            href={
              key === "projects"
                ? `/${slug}/projects/`
                : getDashboardHref(slug as string, searchParams, { detail: key, risk: null, page: null })
            }
            active={detail === key}
          />
        ))}
      </div>
      {(detail || risk) && (
        <DashboardDetailDrawer
          workspaceSlug={slug as string}
          items={detail ? data.detail_items : data.risk_items}
          detail={detail}
          risk={risk}
          total={detail ? data.detail_total : (data.risk_total ?? 0)}
          page={detail ? data.detail_page : (data.risk_page ?? 1)}
          searchParams={searchParams}
          onClose={closeDetail}
        />
      )}
      <section className={cn(CARD_CLASS, "p-4 md:p-5")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-16 font-semibold text-primary">{t("dashboard_overview.risks_title")}</h2>
        </div>
        <p className="mb-4 text-12 leading-5 text-tertiary">{t("dashboard_overview.risks_hint")}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {RISK_KINDS.map((kind) => (
            <SummaryCard
              key={kind}
              label={t(`dashboard_overview.metrics.${kind}`)}
              value={data.summary[kind]}
              attention
              href={getDashboardHref(slug as string, searchParams, { risk: kind, detail: null, page: null })}
              active={risk === kind}
            />
          ))}
        </div>
      </section>
      <ProjectProgress workspaceSlug={slug as string} projects={data.projects} />
      {!risk && !detail && <RiskItems workspaceSlug={slug as string} items={data.overdue_items} />}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:grid-rows-[auto_1fr]">
        <StateDistribution
          workspaceSlug={slug as string}
          states={data.states}
          searchParams={searchParams}
          activeDetail={detail}
        />
        <DashboardDistributions workspaceSlug={slug as string} data={data} searchParams={searchParams} />
      </div>
      <WeeklyTrends weeks={data.weekly_trends} />
      <details className={cn(CARD_CLASS, "group overflow-hidden")}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-13 font-medium text-secondary transition-colors outline-none hover:bg-layer-1 focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          <InfoIcon className="size-4 shrink-0 text-tertiary" aria-hidden="true" />
          <span className="flex-1">{t("dashboard_overview.definition.title")}</span>
          <ChevronRightIcon
            className="size-3.5 text-placeholder transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-1 border-t border-subtle px-4 py-3 text-12 leading-6 text-secondary">
          <p>{t("dashboard_overview.definition.progress")}</p>
          <p>{t("dashboard_overview.definition.stale")}</p>
          <p>{t("dashboard_overview.definition.blocked")}</p>
          <p>{t("dashboard_overview.definition.created_filter")}</p>
        </div>
      </details>
    </main>
  );
});
