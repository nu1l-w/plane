/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";

import { useTranslation } from "@plane/i18n";
import { EditIcon, CloseIcon } from "@plane/propel/icons";
// plane imports
import { Tooltip } from "@plane/propel/tooltip";
import { cn } from "@plane/utils";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { usePlatformOS } from "@/hooks/use-platform-os";
// local imports
import { ParentIssuesListModal } from "../parent-issues-list-modal";

type TIssueParentSelect = {
  className?: string;
  disabled?: boolean;
  issueId: string;
  projectId: string;
  workspaceSlug: string;
  handleParentIssue: (_issueId?: string | null) => Promise<void>;
  handleRemoveSubIssue: (
    workspaceSlug: string,
    projectId: string,
    parentIssueId: string,
    issueId: string
  ) => Promise<void>;
  workItemLink: string;
};

export const IssueParentSelect = observer(function IssueParentSelect(props: TIssueParentSelect) {
  const {
    className = "",
    disabled = false,
    issueId,
    projectId,
    workspaceSlug,
    handleParentIssue,
    handleRemoveSubIssue,
    workItemLink,
  } = props;
  const { t } = useTranslation();
  // store hooks
  const { getProjectById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { isParentIssueModalOpen, toggleParentIssueModal } = useIssueDetail();

  // derived values
  const issue = getIssueById(issueId);
  const parentIssue = issue?.parent_id ? getIssueById(issue.parent_id) : undefined;
  const parentIssueProjectDetails =
    parentIssue && parentIssue.project_id ? getProjectById(parentIssue.project_id) : undefined;
  const { isMobile } = usePlatformOS();

  if (!issue) return <></>;

  return (
    <>
      <ParentIssuesListModal
        projectId={projectId}
        issueId={issueId}
        isOpen={isParentIssueModalOpen === issueId}
        handleClose={() => toggleParentIssueModal(null)}
        onChange={(selectedIssue: any) => handleParentIssue(selectedIssue?.id)}
      />
      {issue.parent_id && parentIssue ? (
        <div
          className={cn(
            "group flex items-center justify-between gap-2 rounded-sm px-2 py-0.5",
            {
              "cursor-not-allowed": disabled,
              "hover:bg-layer-transparent-hover": !disabled,
              "bg-layer-transparent-selected": isParentIssueModalOpen,
            },
            className
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              href={workItemLink}
              target="_blank"
              rel="noopener noreferrer"
              title={parentIssue.name}
              className="text-caption-sm-medium text-secondary"
            >
              {parentIssueProjectDetails && `${parentIssueProjectDetails.identifier}-${parentIssue.sequence_id}`}
            </Link>

            {!disabled && (
              <Tooltip tooltipContent={t("common.remove")} position="bottom" isMobile={isMobile}>
                <button
                  type="button"
                  aria-label={t("common.remove")}
                  className="grid place-items-center rounded-sm p-0.5"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveSubIssue(workspaceSlug, projectId, parentIssue.id, issueId);
                  }}
                >
                  <CloseIcon className="h-2.5 w-2.5 text-tertiary hover:text-danger-primary" />
                </button>
              </Tooltip>
            )}
          </div>
          {!disabled && (
            <Tooltip tooltipContent={t("common.edit")} isMobile={isMobile}>
              <button
                type="button"
                aria-label={t("common.edit")}
                className="grid flex-shrink-0 place-items-center rounded-sm p-1 opacity-0 group-hover:opacity-100"
                onClick={() => toggleParentIssueModal(issue.id)}
              >
                <EditIcon className="h-2.5 w-2.5 flex-shrink-0" />
              </button>
            </Tooltip>
          )}
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            "group flex items-center justify-between gap-2 rounded-sm px-2 py-0.5 outline-none",
            {
              "cursor-not-allowed": disabled,
              "hover:bg-layer-transparent-hover": !disabled,
              "bg-layer-transparent-selected": isParentIssueModalOpen,
            },
            className
          )}
          onClick={() => toggleParentIssueModal(issue.id)}
          disabled={disabled}
        >
          <span className="text-body-xs-medium text-placeholder">{t("issue.add.parent")}</span>
          {!disabled && (
            <span className="flex-shrink-0 p-1 opacity-0 group-hover:opacity-100">
              <EditIcon className="h-2.5 w-2.5 flex-shrink-0" />
            </span>
          )}
        </button>
      )}
    </>
  );
});
