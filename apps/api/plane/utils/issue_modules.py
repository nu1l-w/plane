# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.db.models import ModuleIssue


def inherit_parent_modules(issue, parent, actor_id=None):
    """Apply a one-time default, preserving any existing module membership."""
    if (
        parent is None
        or issue.id == parent.id
        or issue.project_id != parent.project_id
        or issue.workspace_id != parent.workspace_id
        or issue.is_draft
        or ModuleIssue.objects.filter(issue_id=issue.id).exists()
    ):
        return

    module_ids = ModuleIssue.objects.filter(
        issue_id=parent.id,
        project_id=issue.project_id,
        workspace_id=issue.workspace_id,
        module__project_id=issue.project_id,
        module__workspace_id=issue.workspace_id,
        module__archived_at__isnull=True,
        module__deleted_at__isnull=True,
    ).values_list("module_id", flat=True)

    ModuleIssue.objects.bulk_create(
        [
            ModuleIssue(
                issue_id=issue.id,
                module_id=module_id,
                project_id=issue.project_id,
                workspace_id=issue.workspace_id,
                created_by_id=actor_id,
                updated_by_id=actor_id,
            )
            for module_id in module_ids
        ],
        ignore_conflicts=True,
    )
