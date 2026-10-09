/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CircleSlash, CircleX } from "lucide-react";
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
  variant?: "badge" | "compact" | "icon";
};

export const BlockedBadge = observer(function BlockedBadge({ issue, isEpic = false, variant = "badge" }: Props) {
  const { t } = useTranslation();
  const { isMobile } = usePlatformOS();
  const { getProjectIdentifierById } = useProject();
  const { getStateById } = useProjectState();
  const { relation, issue: issueStore } = useIssueDetail(isEpic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES);
  const blockerIds = relation.getRelationByIssueIdRelationType(issue.id, "blocked_by") ?? [];
  const blockedIds = relation.getRelationByIssueIdRelationType(issue.id, "blocking") ?? [];

  const getUnfinishedRelations = (ids: string[]) =>
    ids.flatMap((id) => {
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
  const blockers = getUnfinishedRelations(blockerIds);
  const blockedItems = getUnfinishedRelations(blockedIds);
  if (blockers.length === 0 && blockedItems.length === 0) return null;

  const badges = [
    {
      type: "blocked_by",
      items: blockers,
      label: t("issue.relation.blocked"),
      heading: t("issue.relation.blocked_by"),
    },
    {
      type: "blocking",
      items: blockedItems,
      label: t("issue.relation.blocking"),
      heading: t("issue.relation.blocking"),
    },
  ].filter((badge) => badge.items.length > 0);

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {badges.map((badge) => {
        const label = `${badge.label} \u00b7 ${badge.items.length}`;
        const Icon = badge.type === "blocked_by" ? CircleSlash : CircleX;
        return (
          <Tooltip
            key={badge.type}
            tooltipHeading={badge.heading}
            tooltipContent={
              <>
                {badge.items.map((item) => (
                  <span key={item.id} className="block">
                    {item.label}
                  </span>
                ))}
              </>
            }
            isMobile={isMobile}
          >
            <span
              tabIndex={0}
              aria-label={`${label}: ${badge.items.map((item) => item.label).join("; ")}`}
              className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-sm text-caption-sm-medium ${badge.type === "blocked_by" ? "bg-danger-subtle text-danger-primary" : "bg-surface-2 text-secondary"} ${variant === "badge" ? "px-1.5 py-0.5" : "px-1 py-0.5"}`}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              {variant !== "icon" && label}
            </span>
          </Tooltip>
        );
      })}
    </span>
  );
});
