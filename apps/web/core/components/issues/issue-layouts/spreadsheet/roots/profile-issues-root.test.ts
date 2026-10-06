import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { ProfileIssuesSpreadsheetLayout } from "./profile-issues-root";

const mocks = vi.hoisted(() => ({
  allowPermissions: vi.fn(() => true),
  root: vi.fn(
    (_props: {
      viewId?: string;
      isWorkspaceLevel?: boolean;
      canEditPropertiesBasedOnProject: (projectId: string) => boolean;
    }) => null
  ),
  route: { workspaceSlug: "workspace", profileViewId: "defects" },
}));

vi.mock("next/navigation", () => ({ useParams: () => mocks.route }));
vi.mock("@/hooks/store/user", () => ({
  useUserPermissions: () => ({ allowPermissions: mocks.allowPermissions }),
}));
vi.mock("../../quick-action-dropdowns", () => ({ ProjectIssueQuickActions: () => null }));
vi.mock("../base-spreadsheet-root", () => ({ BaseSpreadsheetRoot: mocks.root }));

describe("profile spreadsheet", () => {
  it("uses the selected profile tab and workspace columns", () => {
    renderToStaticMarkup(createElement(ProfileIssuesSpreadsheetLayout));
    expect(mocks.root.mock.calls[0]?.[0]).toMatchObject({ viewId: "defects", isWorkspaceLevel: true });
  });

  it("checks editing access in each work item's project", () => {
    renderToStaticMarkup(createElement(ProfileIssuesSpreadsheetLayout));
    const props = mocks.root.mock.calls.at(-1)?.[0];
    if (!props) throw new Error("Spreadsheet root was not rendered");
    expect(props.canEditPropertiesBasedOnProject("project-1")).toBe(true);
    expect(mocks.allowPermissions).toHaveBeenLastCalledWith(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      "workspace",
      "project-1"
    );
    mocks.allowPermissions.mockReturnValueOnce(false);
    expect(props.canEditPropertiesBasedOnProject("project-2")).toBe(false);
  });
});
