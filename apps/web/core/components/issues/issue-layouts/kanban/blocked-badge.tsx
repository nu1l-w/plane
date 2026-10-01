/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CircleSlash } from "lucide-react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { Tooltip } from "@plane/propel/tooltip";
import type { TIssue } from "@plane/types";
import { EIssueServiceType } from "@plane/types";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  issue: TIssue;
  isEpic?: boolean;
};

export const KanbanBlockedBadge = observer(function KanbanBlockedBadge({ issue, isEpic = false }: Props) {
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  const { getProjectIdentifierById } = useProject();
  const { getStateById } = useProjectState();
  const { relation, issue: issueStore } = useIssueDetail(isEpic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES);
  const blockerIds = relation.getRelationByIssueIdRelationType(issue.id, "blocked_by") ?? [];

  if (blockerIds.length === 0) return null;

  const blockers = blockerIds.flatMap((id) => {
    // Expanded relations include items outside the currently loaded board or page.
    const expandedBlocker =
      issue.issue_relation?.find((item) => item.id === id) ?? issue.issue_related?.find((item) => item.id === id);
    const blocker = issueStore.getIssueById(id) ?? expandedBlocker;
    if (!blocker) return { id, label: id };
    // Resolve the current state first: the list's state group may predate an optimistic update.
    const stateGroup =
      getStateById(blocker.state_id)?.group ??
      blocker.state__group ??
      (blocker.state_id === expandedBlocker?.state_id ? expandedBlocker?.state__group : undefined);
    if (stateGroup === "completed") return [];
    const projectIdentifier = getProjectIdentifierById(blocker.project_id);
    const identifier = projectIdentifier ? `${projectIdentifier}-${blocker.sequence_id}` : `#${blocker.sequence_id}`;
    return { id, label: `${identifier}: ${blocker.name}` };
  });
  if (blockers.length === 0) return null;
  const label = `${t("issue.relation.blocked")} \u00b7 ${blockers.length}`;

  return (
    <Tooltip
      tooltipHeading={t("issue.relation.blocked_by")}
      tooltipContent={
        <>
          {blockers.map((blocker) => (
            <span key={blocker.id} className="block">
              {blocker.label}
            </span>
          ))}
        </>
      }
      isMobile={isMobile}
    >
      <span
        tabIndex={0}
        aria-label={`${label}: ${blockers.map((blocker) => blocker.label).join("; ")}`}
        className="inline-flex w-fit items-center gap-1 rounded-sm bg-danger-subtle px-1.5 py-0.5 text-caption-sm-medium text-danger-primary"
      >
        <CircleSlash className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </span>
    </Tooltip>
  );
});
