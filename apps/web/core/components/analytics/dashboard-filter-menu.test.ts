import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const options = vi.hoisted(() => [] as { title: string; isChecked: boolean; onClick: () => void }[]);
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/propel/icons", () => ({ CloseIcon: () => null, FilterIcon: () => null, SearchIcon: () => null }));
vi.mock("@/components/issues/issue-layouts/filters/header/helpers", () => ({
  FiltersDropdown: ({ children }: { children: React.ReactNode }) => children,
  FilterHeader: () => null,
  FilterOption: (props: { title: string; isChecked: boolean; onClick: () => void }) => {
    options.push(props);
    return createElement("button", null, props.title);
  },
}));
import { DashboardFilterMenu } from "./dashboard-filter-menu";

describe("dashboard filter selection", () => {
  beforeEach(() => {
    options.length = 0;
  });
  const groups = [
    {
      key: "project_id" as const,
      label: "Project",
      value: "first",
      options: [
        { value: "", label: "All projects" },
        { value: "first", label: "First" },
        { value: "second", label: "Second" },
      ],
    },
  ];
  it("marks the active option and replaces a single-valued filter", () => {
    const onChange = vi.fn();
    renderToStaticMarkup(createElement(DashboardFilterMenu, { groups, onChange, isFiltersApplied: true }));
    expect(options.map((option) => option.isChecked)).toEqual([false, true, false]);
    options[2].onClick();
    expect(onChange).toHaveBeenCalledWith("project_id", "second");
  });
  it("clears a selected option on a second click or by selecting all", () => {
    const onChange = vi.fn();
    renderToStaticMarkup(createElement(DashboardFilterMenu, { groups, onChange, isFiltersApplied: true }));
    options[1].onClick();
    options[0].onClick();
    expect(onChange.mock.calls).toEqual([
      ["project_id", ""],
      ["project_id", ""],
    ]);
  });
});
