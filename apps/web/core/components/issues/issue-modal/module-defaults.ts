import type { TIssue } from "@plane/types";

export const getParentModuleDefaults = (
  issue: Partial<TIssue>,
  parent: Partial<TIssue> | undefined
): string[] | undefined => {
  // null means no selection yet; [] is an intentional choice of no modules.
  if (
    issue.id ||
    issue.module_ids != null ||
    !parent ||
    !issue.parent_id ||
    issue.parent_id !== parent.id ||
    !issue.project_id ||
    issue.project_id !== parent.project_id ||
    !parent.module_ids?.length
  )
    return undefined;

  return [...parent.module_ids];
};
