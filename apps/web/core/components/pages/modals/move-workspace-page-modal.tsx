/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
import { EUserPermissions } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Logo } from "@plane/propel/emoji-icon-picker";
import { ProjectIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { getPageName } from "@plane/utils";
import { EPageStoreType, usePageStore } from "@/hooks/store";
import { useProject } from "@/hooks/store/use-project";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useAppRouter } from "@/hooks/use-app-router";
import type { TPageInstance } from "@/store/pages/base-page";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  page: TPageInstance;
  workspaceSlug: string;
};

export const MoveWorkspacePageModal = observer(function MoveWorkspacePageModal(props: Props) {
  const { isOpen, onClose, page, workspaceSlug } = props;
  const { t } = useTranslation();
  const router = useAppRouter();
  const { fetchProjects, getProjectById, joinedProjectIds } = useProject();
  const { getWorkspaceBySlug } = useWorkspace();
  const { moveWorkspacePage } = usePageStore(EPageStoreType.PROJECT);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id;

  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm("");
    setSelectedProjectId("");
    void fetchProjects(workspaceSlug).catch(() => undefined);
  }, [fetchProjects, isOpen, workspaceSlug]);

  const projects = useMemo(
    () =>
      joinedProjectIds.flatMap((projectId) => {
        const project = getProjectById(projectId);
        const role = Number(project?.member_role);
        const minimumRole = page.isCurrentUserOwner ? EUserPermissions.GUEST : EUserPermissions.MEMBER;
        if (
          !project ||
          project.workspace !== workspaceId ||
          project.archived_at ||
          role < minimumRole ||
          !`${project.identifier} ${project.name}`.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return [];
        }
        return [project];
      }),
    [getProjectById, joinedProjectIds, page.isCurrentUserOwner, searchTerm, workspaceId]
  );

  const handleMove = async () => {
    if (!page.id || !selectedProjectId) return;
    setIsMoving(true);
    try {
      await moveWorkspacePage(workspaceSlug, page.id, selectedProjectId);
      onClose();
      router.push(`/${workspaceSlug}/projects/${selectedProjectId}/pages/${page.id}`);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "页面已移入项目",
        message: "页面访问权限现由目标项目成员关系控制。",
      });
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "移动失败",
        message: "请确认页面所有者和你本人均属于目标项目。",
      });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.LG}>
      <div className="border-b border-subtle p-5">
        <h2 className="text-16 font-semibold">将页面移入项目</h2>
        <p className="mt-1 text-13 text-secondary">
          “{getPageName(page.name)}”移入后将从工作区页面列表移除，并按目标项目成员权限访问。
        </p>
      </div>
      <div className="p-4">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          className="focus:border-accent-primary mb-3 h-9 w-full rounded-md border border-subtle bg-surface-1 px-3 text-13 text-primary outline-none"
        />
        <div className="vertical-scrollbar scrollbar-sm max-h-72 overflow-y-auto">
          {projects.length === 0 ? (
            <p className="py-8 text-center text-13 text-secondary">没有可用的目标项目</p>
          ) : (
            projects.map((project) => (
              <label
                key={project.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-layer-1"
              >
                <input
                  type="radio"
                  name="workspace-page-project"
                  value={project.id}
                  checked={selectedProjectId === project.id}
                  onChange={() => setSelectedProjectId(project.id)}
                />
                {project.logo_props ? (
                  <Logo logo={project.logo_props} size={16} />
                ) : (
                  <ProjectIcon className="size-4 text-tertiary" />
                )}
                <span className="truncate text-13">
                  <span className="mr-2 text-11 text-tertiary">{project.identifier}</span>
                  {project.name}
                </span>
              </label>
            ))
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-subtle p-4">
        <Button variant="secondary" size="lg" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={handleMove}
          loading={isMoving}
          disabled={!selectedProjectId || isMoving}
        >
          {isMoving ? "正在移动" : "移动页面"}
        </Button>
      </div>
    </ModalCore>
  );
});
