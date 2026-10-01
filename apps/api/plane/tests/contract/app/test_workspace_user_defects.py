# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import (
    Issue,
    IssueAssignee,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
)


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceUserDefects:
    def test_defect_view_and_parent_summary_are_scoped(self, session_client, workspace, create_user):
        project = Project.objects.create(
            name="Defects",
            identifier="DFT",
            workspace=workspace,
            is_issue_type_enabled=True,
        )
        ProjectMember.objects.create(
            project=project,
            workspace=workspace,
            member=create_user,
            role=20,
            is_active=True,
        )
        parent_type = IssueType.objects.create(workspace=workspace, name="Feature")
        defect_type = IssueType.objects.create(workspace=workspace, name="Bug")
        task_type = IssueType.objects.create(workspace=workspace, name="Task")
        ProjectIssueType.objects.create(workspace=workspace, project=project, issue_type=parent_type)
        ProjectIssueType.objects.create(workspace=workspace, project=project, issue_type=defect_type, is_defect=True)
        ProjectIssueType.objects.create(workspace=workspace, project=project, issue_type=task_type)

        started = State.objects.create(
            workspace=workspace, project=project, name="Started", color="#f00", group="started"
        )
        completed = State.objects.create(
            workspace=workspace, project=project, name="Completed", color="#0f0", group="completed"
        )
        cancelled = State.objects.create(
            workspace=workspace, project=project, name="Cancelled", color="#aaa", group="cancelled"
        )

        parent = Issue.objects.create(
            workspace=workspace,
            project=project,
            state=started,
            type=parent_type,
            name="Feature parent",
        )
        IssueAssignee.objects.create(workspace=workspace, project=project, issue=parent, assignee=create_user)
        open_defect = Issue.objects.create(
            workspace=workspace,
            project=project,
            state=started,
            type=defect_type,
            parent=parent,
            name="Open defect",
        )
        IssueAssignee.objects.create(workspace=workspace, project=project, issue=open_defect, assignee=create_user)
        Issue.objects.create(
            workspace=workspace,
            project=project,
            state=started,
            type=defect_type,
            parent=parent,
            name="Unassigned open defect",
        )
        done_defect = Issue.objects.create(
            workspace=workspace,
            project=project,
            state=completed,
            type=defect_type,
            parent=parent,
            name="Done defect",
        )
        IssueAssignee.objects.create(workspace=workspace, project=project, issue=done_defect, assignee=create_user)
        cancelled_defect = Issue.objects.create(
            workspace=workspace,
            project=project,
            state=cancelled,
            type=defect_type,
            parent=parent,
            name="Cancelled defect",
        )
        IssueAssignee.objects.create(workspace=workspace, project=project, issue=cancelled_defect, assignee=create_user)
        non_defect = Issue.objects.create(
            workspace=workspace,
            project=project,
            state=started,
            type=task_type,
            parent=parent,
            name="Regular task",
        )
        IssueAssignee.objects.create(workspace=workspace, project=project, issue=non_defect, assignee=create_user)

        hidden_project = Project.objects.create(
            name="Hidden defects",
            identifier="HDF",
            workspace=workspace,
            is_issue_type_enabled=True,
        )
        ProjectMember.objects.create(
            project=hidden_project,
            workspace=workspace,
            member=create_user,
            role=20,
            is_active=False,
        )
        hidden_defect_type = IssueType.objects.create(workspace=workspace, name="Hidden bug")
        ProjectIssueType.objects.create(
            workspace=workspace,
            project=hidden_project,
            issue_type=hidden_defect_type,
            is_defect=True,
        )
        hidden_state = State.objects.create(
            workspace=workspace,
            project=hidden_project,
            name="Hidden started",
            color="#f00",
            group="started",
        )
        hidden_defect = Issue.objects.create(
            workspace=workspace,
            project=hidden_project,
            state=hidden_state,
            type=hidden_defect_type,
            parent=parent,
            name="Hidden defect",
        )
        IssueAssignee.objects.create(
            workspace=workspace,
            project=hidden_project,
            issue=hidden_defect,
            assignee=create_user,
        )

        defect_response = session_client.get(
            f"/api/workspaces/{workspace.slug}/user-issues/{create_user.id}/",
            {"assigned_defects": "true", "assignees": str(create_user.id)},
        )
        defect_list_response = session_client.get(
            f"/api/workspaces/{workspace.slug}/user-issues/{create_user.id}/",
            {
                "assigned_defects": "true",
                "assignees": str(create_user.id),
                "sub_issue": "false",
                "layout": "list",
                "order_by": "start_date",
                "cursor": "50:0:0",
                "per_page": "50",
            },
        )
        assigned_response = session_client.get(
            f"/api/workspaces/{workspace.slug}/user-issues/{create_user.id}/",
            {"assignees": str(create_user.id)},
        )
        stats_response = session_client.get(f"/api/workspaces/{workspace.slug}/user-stats/{create_user.id}/")

        assert defect_response.status_code == 200
        assert [item["id"] for item in defect_response.data["results"]] == [open_defect.id]
        assert defect_list_response.status_code == 200
        assert [item["id"] for item in defect_list_response.data["results"]] == [open_defect.id]
        assert assigned_response.status_code == 200
        parent_item = next(item for item in assigned_response.data["results"] if item["id"] == parent.id)
        assert parent_item["defect_count"] == 4
        assert parent_item["open_defect_count"] == 2
        assert parent_item["my_open_defect_count"] == 1
        assert stats_response.status_code == 200
        assert stats_response.data["assigned_defects"] == 1
