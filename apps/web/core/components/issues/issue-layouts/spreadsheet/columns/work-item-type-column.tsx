/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// types
import type { TIssue } from "@plane/types";
// components
import { WorkItemTypeDropdown } from "@/components/dropdowns/work-item-type";

type Props = {
  issue: TIssue;
  onClose: () => void;
  onChange: (issue: TIssue, data: Partial<TIssue>, updates: any) => void;
  disabled: boolean;
};

export const SpreadsheetWorkItemTypeColumn = observer(function SpreadsheetWorkItemTypeColumn(props: Props) {
  const { issue, onChange, disabled, onClose } = props;
  const { workspaceSlug } = useParams();

  return (
    <div className="flex h-11 items-center border-b-[0.5px] border-subtle">
      <WorkItemTypeDropdown
        workspaceSlug={workspaceSlug?.toString()}
        projectId={issue.project_id}
        value={issue.type_id}
        onChange={(typeId) =>
          onChange(issue, { type_id: typeId }, { changed_property: "type_id", change_details: typeId })
        }
        disabled={disabled}
        onClose={onClose}
        buttonVariant="transparent-with-text"
        className="h-full w-full"
        buttonContainerClassName="w-full"
        buttonClassName="rounded-none px-page-x text-left"
        showTooltip
      />
    </div>
  );
});
