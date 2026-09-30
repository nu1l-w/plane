import { createElement, type AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NoProjectsEmptyState } from "./no-projects";

const route = vi.hoisted(() => ({ workspaceSlug: "example" }));

vi.mock("next/navigation", () => ({ useParams: () => route }));
vi.mock("next/link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => createElement("a", props),
}));
vi.mock("@plane/hooks", () => ({
  useLocalStorage: (_key: string, initialValue: unknown) => ({
    storedValue: initialValue,
    setValue: vi.fn(),
  }),
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-command-palette", () => ({
  useCommandPalette: () => ({ toggleCreateProjectModal: vi.fn() }),
}));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ joinedProjectIds: [] }),
}));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ currentWorkspace: { total_members: 1 } }),
}));
vi.mock("@/hooks/store/user", () => ({
  useUser: () => ({ data: { id: "test-user", email: "test@example.com" } }),
  useUserPermissions: () => ({ allowPermissions: () => true }),
}));

describe("quickstart workspace settings link", () => {
  it.each(["example", "another-workspace"])("keeps the %s workspace in its destination", (workspaceSlug) => {
    route.workspaceSlug = workspaceSlug;
    const html = renderToStaticMarkup(createElement(NoProjectsEmptyState));
    expect(html).toContain(`href="/${workspaceSlug}/settings"`);
    expect(html).not.toContain('href="settings"');
  });
});
