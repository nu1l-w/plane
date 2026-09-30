/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { getPageService } from "@/services/page/handler";
import type { HocusPocusServerContext } from "@/types";

const createContext = (overrides: Partial<HocusPocusServerContext> = {}): HocusPocusServerContext => ({
  projectId: null,
  cookie: "session=test",
  documentType: "workspace_page",
  workspaceSlug: "acme",
  userId: "user-id",
  ...overrides,
});

describe("getPageService", () => {
  it("uses the workspace page API routes for workspace documents", () => {
    const service = getPageService("workspace_page", createContext());

    expect((service as unknown as { basePath: string }).basePath).toBe("/api/workspaces/acme");
    expect(service.getHeader()).toEqual({ Cookie: "session=test" });
  });

  it("continues to use project-scoped routes for project documents", () => {
    const service = getPageService(
      "project_page",
      createContext({ documentType: "project_page", projectId: "project-id" })
    );

    expect((service as unknown as { basePath: string }).basePath).toBe("/api/workspaces/acme/projects/project-id");
  });

  it("rejects workspace documents without an authenticated cookie", () => {
    expect(() => getPageService("workspace_page", createContext({ cookie: "" }))).toThrow("Cookie is required.");
  });
});
