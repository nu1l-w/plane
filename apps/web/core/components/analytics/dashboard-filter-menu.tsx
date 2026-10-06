/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { useTranslation } from "@plane/i18n";
import { CloseIcon, FilterIcon, SearchIcon } from "@plane/propel/icons";
import { FilterHeader, FilterOption, FiltersDropdown } from "@/components/issues/issue-layouts/filters/header/helpers";

export type TDashboardFilterKey = "project_id" | "assignee_id" | "created_range" | "priority";
export type TDashboardFilterGroup = {
  key: TDashboardFilterKey;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

export function DashboardFilterMenu({
  groups,
  onChange,
  isFiltersApplied,
}: {
  groups: TDashboardFilterGroup[];
  onChange: (key: TDashboardFilterKey, value: string) => void;
  isFiltersApplied: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Partial<Record<TDashboardFilterKey, boolean>>>({});
  return (
    <FiltersDropdown
      title={t("common.filters")}
      icon={<FilterIcon className="size-4" />}
      miniIcon={<FilterIcon className="size-4" />}
      placement="bottom-start"
      isFiltersApplied={isFiltersApplied}
    >
      <div className="p-2.5 pb-0">
        <div className="flex items-center gap-1.5 rounded-sm border border-subtle bg-surface-2 px-1.5 py-1 text-11">
          <SearchIcon className="size-3 shrink-0 text-placeholder" />
          <input
            type="search"
            aria-label={t("common.search")}
            placeholder={t("common.search")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full min-w-0 bg-surface-2 outline-none placeholder:text-placeholder"
          />
          {query && (
            <button type="button" aria-label={t("common.clear_all")} onClick={() => setQuery("")}>
              <CloseIcon className="size-3" />
            </button>
          )}
        </div>
      </div>
      <div className="vertical-scrollbar scrollbar-sm divide-y divide-subtle-1 overflow-y-auto px-2.5">
        {groups.map((group) => {
          const options = group.options.filter((option) =>
            `${group.label} ${option.label}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
          );
          if (!options.length) return null;
          const expanded = Boolean(query) || !collapsed[group.key];
          return (
            <div key={group.key} className="py-2">
              <FilterHeader
                title={group.label}
                isPreviewEnabled={expanded}
                handleIsPreviewEnabled={() =>
                  setCollapsed((previous) => ({ ...previous, [group.key]: !previous[group.key] }))
                }
              />
              {expanded && (
                <div className="mt-1 space-y-0.5">
                  {options.map((option) => (
                    <FilterOption
                      key={option.value}
                      multiple={false}
                      title={option.label}
                      isChecked={group.value === option.value}
                      onClick={() => onChange(group.key, group.value === option.value ? "" : option.value)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!groups.some((group) =>
          group.options.some((option) =>
            `${group.label} ${option.label}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
          )
        ) && <p className="py-4 text-center text-12 text-tertiary">{t("no_matching_results")}</p>}
      </div>
    </FiltersDropdown>
  );
}
