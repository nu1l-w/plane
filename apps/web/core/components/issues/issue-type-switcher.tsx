/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// store hooks
import { WorkItemTypeDropdown } from "@/components/dropdowns/work-item-type";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
// components
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";

export type TIssueTypeSwitcherProps = {
  issueId: string;
  disabled: boolean;
};

export const IssueTypeSwitcher = observer(function IssueTypeSwitcher(props: TIssueTypeSwitcherProps) {
  const { issueId, disabled } = props;
  const { workspaceSlug } = useParams();
  const { t } = useTranslation();
  // store hooks
  const {
    issue: { getIssueById, updateIssue },
  } = useIssueDetail();
  const { getProjectById } = useProject();
  // derived values
  const issue = getIssueById(issueId);

  if (!issue || !issue.project_id) return <></>;

  return (
    <div className="flex items-center gap-2">
      <IssueIdentifier issueId={issueId} projectId={issue.project_id} size="md" enableClickToCopyIdentifier />
      {getProjectById(issue.project_id)?.is_issue_type_enabled && (
        <WorkItemTypeDropdown
          workspaceSlug={workspaceSlug?.toString()}
          projectId={issue.project_id}
          value={issue.type_id}
          disabled={disabled}
          onChange={(typeId) => {
            updateIssue(workspaceSlug?.toString() ?? "", issue.project_id ?? "", issueId, { type_id: typeId }).catch(
              () =>
                setToast({
                  type: TOAST_TYPE.ERROR,
                  title: t("error"),
                  message: t("something_went_wrong"),
                })
            );
          }}
        />
      )}
    </div>
  );
});
