import { describe, expect, it } from "vitest";
import { getParentModuleDefaults } from "./module-defaults";

const parent = { id: "parent", project_id: "project", module_ids: ["module-1", "module-2"] };
const child = { parent_id: "parent", project_id: "project", module_ids: null };

describe("parent module defaults", () => {
  it("copies all parent modules for a new child without a selection", () => {
    const result = getParentModuleDefaults(child, parent);
    expect(result).toEqual(parent.module_ids);
    expect(result).not.toBe(parent.module_ids);
  });

  it.each([{ module_ids: [] }, { module_ids: ["chosen-module"] }])(
    "preserves explicit module selections: %j",
    (selection) => {
      expect(getParentModuleDefaults({ ...child, ...selection }, parent)).toBeUndefined();
    }
  );

  it("does not change existing work items or copy cross-project modules", () => {
    expect(getParentModuleDefaults({ ...child, id: "existing" }, parent)).toBeUndefined();
    expect(getParentModuleDefaults({ ...child, project_id: "other-project" }, parent)).toBeUndefined();
  });

  it("ignores missing, stale, or unassigned parents", () => {
    expect(getParentModuleDefaults(child, undefined)).toBeUndefined();
    expect(getParentModuleDefaults(child, { ...parent, id: "old-parent" })).toBeUndefined();
    expect(getParentModuleDefaults(child, { ...parent, module_ids: [] })).toBeUndefined();
    expect(getParentModuleDefaults({ ...child, parent_id: null }, parent)).toBeUndefined();
  });
});
