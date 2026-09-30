/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { computed, makeObservable } from "mobx";
import { computedFn } from "mobx-utils";
// constants
import { EPageAccess, EUserPermissions } from "@plane/constants";
import type { TPage } from "@plane/types";
// plane web store
import type { RootStore } from "@/store/root.store";
// services
import { ProjectPageService, WorkspacePageService } from "@/services/page";
const projectPageService = new ProjectPageService();
const workspacePageService = new WorkspacePageService();
// store
import { BasePage } from "./base-page";
import type { TPageInstance } from "./base-page";

export type TProjectPage = TPageInstance;

export class ProjectPage extends BasePage implements TProjectPage {
  constructor(store: RootStore, page: TPage) {
    // required fields for API calls
    const { workspaceSlug } = store.router;
    const projectId = page.project_ids?.[0];
    const isWorkspacePage = page.is_global;
    // initialize base instance
    super(store, page, {
      update: async (payload) => {
        if (!workspaceSlug || !page.id || (!isWorkspacePage && !projectId)) throw new Error("Missing required fields.");
        if (isWorkspacePage) return await workspacePageService.update(workspaceSlug, page.id, payload);
        return await projectPageService.update(workspaceSlug, projectId!, page.id, payload);
      },
      updateDescription: async (document) => {
        if (!workspaceSlug || !page.id || (!isWorkspacePage && !projectId)) throw new Error("Missing required fields.");
        if (isWorkspacePage) return await workspacePageService.updateDescription(workspaceSlug, page.id, document);
        await projectPageService.updateDescription(workspaceSlug, projectId!, page.id, document);
      },
      updateAccess: async (payload) => {
        if (!workspaceSlug || !page.id || (!isWorkspacePage && !projectId)) throw new Error("Missing required fields.");
        if (isWorkspacePage) {
          await workspacePageService.update(workspaceSlug, page.id, payload);
          return;
        }
        await projectPageService.updateAccess(workspaceSlug, projectId!, page.id, payload);
      },
      lock: async () => {
        if (isWorkspacePage) throw new Error("Locking workspace pages is not available yet.");
        if (!workspaceSlug || !projectId || !page.id) throw new Error("Missing required fields.");
        await projectPageService.lock(workspaceSlug, projectId, page.id);
      },
      unlock: async () => {
        if (isWorkspacePage) throw new Error("Locking workspace pages is not available yet.");
        if (!workspaceSlug || !projectId || !page.id) throw new Error("Missing required fields.");
        await projectPageService.unlock(workspaceSlug, projectId, page.id);
      },
      archive: async () => {
        if (isWorkspacePage) throw new Error("Archiving workspace pages is not available yet.");
        if (!workspaceSlug || !projectId || !page.id) throw new Error("Missing required fields.");
        return await projectPageService.archive(workspaceSlug, projectId, page.id);
      },
      restore: async () => {
        if (isWorkspacePage) throw new Error("Archiving workspace pages is not available yet.");
        if (!workspaceSlug || !projectId || !page.id) throw new Error("Missing required fields.");
        await projectPageService.restore(workspaceSlug, projectId, page.id);
      },
      duplicate: async () => {
        if (isWorkspacePage) throw new Error("Duplicating workspace pages is not available yet.");
        if (!workspaceSlug || !projectId || !page.id) throw new Error("Missing required fields.");
        return await projectPageService.duplicate(workspaceSlug, projectId, page.id);
      },
    });
    makeObservable(this, {
      // computed
      canCurrentUserAccessPage: computed,
      canCurrentUserEditPage: computed,
      canCurrentUserDuplicatePage: computed,
      canCurrentUserLockPage: computed,
      canCurrentUserChangeAccess: computed,
      canCurrentUserArchivePage: computed,
      canCurrentUserDeletePage: computed,
      canCurrentUserFavoritePage: computed,
      canCurrentUserMovePage: computed,
      isContentEditable: computed,
    });
  }

  private getHighestRoleAcrossProjects = computedFn((): EUserPermissions | undefined => {
    const { workspaceSlug } = this.rootStore.router;
    if (!workspaceSlug || !this.project_ids?.length) return;
    let highestRole: EUserPermissions | undefined = undefined;
    this.project_ids.map((projectId) => {
      const currentUserProjectRole = this.rootStore.user.permission.getProjectRoleByWorkspaceSlugAndProjectId(
        workspaceSlug?.toString() || "",
        projectId?.toString() || ""
      );
      if (currentUserProjectRole) {
        if (!highestRole) highestRole = currentUserProjectRole;
        else if (currentUserProjectRole > highestRole) highestRole = currentUserProjectRole;
      }
    });
    return highestRole;
  });

  private get isWorkspacePageOwnerOrAdmin() {
    const { workspaceSlug } = this.rootStore.router;
    const workspaceRole = workspaceSlug
      ? this.rootStore.user.permission.getWorkspaceRoleByWorkspaceSlug(workspaceSlug.toString())
      : undefined;
    return this.isCurrentUserOwner || workspaceRole === EUserPermissions.ADMIN;
  }

  /**
   * @description returns true if the current logged in user can access the page
   */
  get canCurrentUserAccessPage() {
    const isPagePublic = this.access === EPageAccess.PUBLIC;
    if (this.is_global) return isPagePublic || this.isWorkspacePageOwnerOrAdmin;
    return isPagePublic || this.isCurrentUserOwner;
  }

  /**
   * @description returns true if the current logged in user can edit the page
   */
  get canCurrentUserEditPage() {
    if (this.is_global) return this.isWorkspacePageOwnerOrAdmin;
    const highestRole = this.getHighestRoleAcrossProjects();
    const isPagePublic = this.access === EPageAccess.PUBLIC;
    return (
      (isPagePublic && !!highestRole && highestRole >= EUserPermissions.MEMBER) ||
      (!isPagePublic && this.isCurrentUserOwner)
    );
  }

  /**
   * @description returns true if the current logged in user can create a duplicate the page
   */
  get canCurrentUserDuplicatePage() {
    if (this.is_global) return false;
    const highestRole = this.getHighestRoleAcrossProjects();
    return !!highestRole && highestRole >= EUserPermissions.MEMBER;
  }

  /**
   * @description returns true if the current logged in user can lock the page
   */
  get canCurrentUserLockPage() {
    if (this.is_global) return false;
    const highestRole = this.getHighestRoleAcrossProjects();
    return this.isCurrentUserOwner || highestRole === EUserPermissions.ADMIN;
  }

  /**
   * @description returns true if the current logged in user can change the access of the page
   */
  get canCurrentUserChangeAccess() {
    if (this.is_global) return this.isWorkspacePageOwnerOrAdmin;
    const highestRole = this.getHighestRoleAcrossProjects();
    return this.isCurrentUserOwner || highestRole === EUserPermissions.ADMIN;
  }

  /**
   * @description returns true if the current logged in user can archive the page
   */
  get canCurrentUserArchivePage() {
    if (this.is_global) return false;
    const highestRole = this.getHighestRoleAcrossProjects();
    return this.isCurrentUserOwner || highestRole === EUserPermissions.ADMIN;
  }

  /**
   * @description returns true if the current logged in user can delete the page
   */
  get canCurrentUserDeletePage() {
    if (this.is_global) return false;
    const highestRole = this.getHighestRoleAcrossProjects();
    return this.isCurrentUserOwner || highestRole === EUserPermissions.ADMIN;
  }

  /**
   * @description returns true if the current logged in user can favorite the page
   */
  get canCurrentUserFavoritePage() {
    if (this.is_global) return false;
    const highestRole = this.getHighestRoleAcrossProjects();
    return !!highestRole && highestRole >= EUserPermissions.MEMBER;
  }

  /**
   * @description returns true if the current logged in user can move the page
   */
  get canCurrentUserMovePage() {
    if (this.is_global) return this.isWorkspacePageOwnerOrAdmin;
    const highestRole = this.getHighestRoleAcrossProjects();
    return this.isCurrentUserOwner || highestRole === EUserPermissions.ADMIN;
  }

  /**
   * @description returns true if the page can be edited
   */
  get isContentEditable() {
    if (this.is_global) return this.isWorkspacePageOwnerOrAdmin && !this.archived_at && !this.is_locked;
    const highestRole = this.getHighestRoleAcrossProjects();
    const isOwner = this.isCurrentUserOwner;
    const isPublic = this.access === EPageAccess.PUBLIC;
    const isArchived = this.archived_at;
    const isLocked = this.is_locked;

    return (
      !isArchived && !isLocked && (isOwner || (isPublic && !!highestRole && highestRole >= EUserPermissions.MEMBER))
    );
  }

  getRedirectionLink = computedFn(() => {
    const { workspaceSlug } = this.rootStore.router;
    if (this.is_global) return `/${workspaceSlug}/pages/${this.id}`;
    return `/${workspaceSlug}/projects/${this.project_ids?.[0]}/pages/${this.id}`;
  });
}
