# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import datetime, time, timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from plane.db.models import (
    Issue,
    IssueAssignee,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)


@pytest.mark.contract
@pytest.mark.django_db
class TestWorkspaceDashboardOverview:
    def test_only_active_project_memberships_are_counted(self, session_client, workspace, create_user):
        visible = Project.objects.create(
            name="Visible", identifier="VIS", workspace=workspace, created_by=create_user
        )
        hidden = Project.objects.create(
            name="Hidden", identifier="HID", workspace=workspace, created_by=create_user
        )
        ProjectMember.objects.create(
            project=visible, workspace=workspace, member=create_user, role=20
        )
        ProjectMember.objects.create(
            project=hidden, workspace=workspace, member=create_user, role=20, is_active=False
        )
        started = State.objects.create(
            name="Started", color="#eee", group="started", project=visible
        )
        completed = State.objects.create(
            name="Completed", color="#ddd", group="completed", project=visible
        )
        hidden_state = State.objects.create(
            name="Secret", color="#ccc", group="started", project=hidden
        )
        yesterday = timezone.localdate() - timedelta(days=1)
        overdue = Issue.objects.create(
            name="Late task", project=visible, state=started, priority="urgent", target_date=yesterday
        )
        Issue.objects.create(
            name="Done task", project=visible, state=completed, target_date=yesterday
        )
        Issue.objects.create(name="Hidden task", project=hidden, state=hidden_state, target_date=yesterday)

        response = session_client.get(f"/api/workspaces/{workspace.slug}/dashboard-overview/")

        assert response.status_code == 200
        assert response.data["summary"] == {
            "projects": 1,
            "total": 2,
            "completed": 1,
            "in_progress": 1,
            "cancelled": 0,
            "overdue": 1,
            "due_soon": 0,
            "stale": 0,
            "high_priority_unassigned": 1,
        }
        assert response.data["states"] == {"started": 1, "completed": 1}
        assert len(response.data["projects"]) == 1
        assert response.data["projects"][0]["overdue"] == 1
        assert [item["id"] for item in response.data["overdue_items"]] == [overdue.id]
        assert len(response.data["weekly_trends"]) == 8
        assert response.data["weekly_trends"][-1]["created"] == 2

    def test_weekly_trends_and_cancelled_progress_scope(self, session_client, workspace, create_user):
        project = Project.objects.create(name="Trend", identifier="TRD", workspace=workspace)
        ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
        started = State.objects.create(name="Started", color="#aaa", group="started", project=project)
        completed = State.objects.create(name="Completed", color="#bbb", group="completed", project=project)
        cancelled = State.objects.create(name="Cancelled", color="#ccc", group="cancelled", project=project)
        this_week = timezone.localdate() - timedelta(days=timezone.localdate().weekday())
        last_week = this_week - timedelta(days=7)
        last_week_moment = timezone.make_aware(
            datetime.combine(last_week + timedelta(days=1), time(12))
        )
        finished = Issue.objects.create(name="Finished", project=project, state=completed)
        Issue.objects.filter(id=finished.id).update(
            created_at=last_week_moment, completed_at=last_week_moment
        )
        Issue.objects.create(name="New", project=project, state=started)
        Issue.objects.create(
            name="Past due", project=project, state=started, target_date=last_week
        )
        Issue.objects.create(
            name="Cancelled", project=project, state=cancelled, target_date=last_week
        )

        response = session_client.get(f"/api/workspaces/{workspace.slug}/dashboard-overview/")

        assert response.status_code == 200
        assert response.data["summary"]["total"] == 4
        assert response.data["summary"]["completed"] == 1
        assert response.data["summary"]["cancelled"] == 1
        assert response.data["projects"][0]["cancelled"] == 1
        last_week_bucket, this_week_bucket = response.data["weekly_trends"][-2:]
        assert last_week_bucket == {
            "week_start": last_week.isoformat(),
            "created": 1,
            "completed": 1,
            "overdue": 1,
        }
        assert this_week_bucket["created"] == 3
        assert this_week_bucket["completed"] == 0
        assert this_week_bucket["overdue"] == 0

    def test_assigned_high_priority_work_does_not_count_as_unassigned(
        self, session_client, workspace, create_user
    ):
        project = Project.objects.create(
            name="Assigned", identifier="ASN", workspace=workspace, created_by=create_user
        )
        ProjectMember.objects.create(
            project=project, workspace=workspace, member=create_user, role=20
        )
        state = State.objects.create(name="Open", color="#eee", project=project)
        issue = Issue.objects.create(name="Assigned issue", project=project, state=state, priority="high")
        IssueAssignee.objects.create(issue=issue, assignee=create_user, project=project)

        response = session_client.get(f"/api/workspaces/{workspace.slug}/dashboard-overview/")

        assert response.status_code == 200
        assert response.data["summary"]["high_priority_unassigned"] == 0
        assert response.data["summary"]["overdue"] == 0

    def test_project_and_assignee_filters_keep_counts_scoped(self, session_client, workspace, create_user):
        first = Project.objects.create(name="First", identifier="FST", workspace=workspace)
        second = Project.objects.create(name="Second", identifier="SND", workspace=workspace)
        for project in [first, second]:
            ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
        assigned = Issue.objects.create(name="Assigned", project=first, priority="high")
        IssueAssignee.objects.create(project=first, issue=assigned, assignee=create_user)
        Issue.objects.create(name="Not assigned", project=first, priority="high")
        Issue.objects.create(name="Other project", project=second, priority="urgent")
        url = f"/api/workspaces/{workspace.slug}/dashboard-overview/"

        response = session_client.get(url, {"project_id": str(first.id), "assignee_id": str(create_user.id)})
        unassigned = session_client.get(url, {"project_id": str(first.id), "assignee_id": "unassigned"})

        assert response.status_code == 200
        assert response.data["summary"]["projects"] == 1
        assert response.data["summary"]["total"] == 1
        assert response.data["summary"]["high_priority_unassigned"] == 0
        assert unassigned.data["summary"]["total"] == 1
        assert unassigned.data["summary"]["high_priority_unassigned"] == 1

    def test_priority_filter_and_detail_drilldown_are_scoped(self, session_client, workspace, create_user):
        project = Project.objects.create(name="Details", identifier="DTL", workspace=workspace)
        ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
        started = State.objects.create(name="Started", color="#aaa", group="started", project=project)
        completed = State.objects.create(name="Completed", color="#bbb", group="completed", project=project)
        completed_high = Issue.objects.create(
            name="High completed", project=project, state=completed, priority="high"
        )
        Issue.objects.create(name="Low completed", project=project, state=completed, priority="low")
        Issue.objects.create(name="High in progress", project=project, state=started, priority="high")
        url = f"/api/workspaces/{workspace.slug}/dashboard-overview/"

        response = session_client.get(url, {"priority": "high", "detail": "completed"})
        in_progress = session_client.get(url, {"priority": "high", "detail": "in_progress"})

        assert response.status_code == 200
        assert response.data["summary"]["total"] == 2
        assert response.data["detail_total"] == 1
        assert response.data["detail_page"] == 1
        assert [item["id"] for item in response.data["detail_items"]] == [completed_high.id]
        assert in_progress.status_code == 200
        assert in_progress.data["detail_total"] == 1
        assert in_progress.data["detail_items"][0]["name"] == "High in progress"

    def test_created_range_and_risks_are_filtered_and_paginated(self, session_client, workspace, create_user):
        project = Project.objects.create(name="Time", identifier="TME", workspace=workspace)
        ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
        today = timezone.localdate()
        for index in range(21):
            Issue.objects.create(
                name=f"Due soon {index}", project=project, target_date=today + timedelta(days=1)
            )
        old_issue = Issue.objects.create(name="Old", project=project)
        Issue.objects.filter(id=old_issue.id).update(
            created_at=timezone.now() - timedelta(days=60),
            updated_at=timezone.now() - timedelta(days=20),
        )
        url = f"/api/workspaces/{workspace.slug}/dashboard-overview/"

        recent = session_client.get(url, {"created_range": "last_7_days", "risk": "due_soon", "page": "2"})
        stale = session_client.get(url, {"risk": "stale"})
        past_last_page = session_client.get(url, {"risk": "stale", "page": "999"})

        assert recent.status_code == 200
        assert recent.data["summary"]["total"] == 21
        assert recent.data["summary"]["due_soon"] == 21
        assert recent.data["risk_total"] == 21
        assert recent.data["risk_page"] == 2
        assert len(recent.data["risk_items"]) == 1
        assert stale.data["summary"]["stale"] == 1
        assert stale.data["risk_items"][0]["id"] == old_issue.id
        assert past_last_page.data["risk_page"] == 1
        assert past_last_page.data["risk_items"][0]["id"] == old_issue.id

    def test_invalid_or_hidden_project_filters_do_not_expose_data(
        self, session_client, workspace
    ):
        hidden = Project.objects.create(name="Hidden filter", identifier="HFL", workspace=workspace)
        Issue.objects.create(name="Hidden task", project=hidden)
        url = f"/api/workspaces/{workspace.slug}/dashboard-overview/"

        assert session_client.get(url, {"project_id": "invalid"}).status_code == 400
        assert session_client.get(url, {"assignee_id": "invalid"}).status_code == 400
        assert session_client.get(url, {"created_range": "all_time"}).status_code == 400
        assert session_client.get(url, {"risk": "private"}).status_code == 400
        assert session_client.get(url, {"priority": "critical"}).status_code == 400
        assert session_client.get(url, {"detail": "private"}).status_code == 400
        assert session_client.get(url, {"risk": "stale", "detail": "total"}).status_code == 400
        assert session_client.get(url, {"page": "0"}).status_code == 400
        response = session_client.get(url, {"project_id": str(hidden.id)})
        assert response.status_code == 200
        assert response.data["summary"]["total"] == 0
        assert response.data["projects"] == []

    def test_no_projects_returns_empty_overview(self, session_client, workspace):
        response = session_client.get(f"/api/workspaces/{workspace.slug}/dashboard-overview/")

        assert response.status_code == 200
        assert response.data["summary"]["projects"] == 0
        assert response.data["summary"]["total"] == 0
        assert response.data["projects"] == []
        assert response.data["overdue_items"] == []

    def test_guest_role_in_project_does_not_expose_its_work_items(
        self, session_client, workspace, create_user
    ):
        project = Project.objects.create(
            name="Restricted", identifier="RST", workspace=workspace, created_by=create_user
        )
        ProjectMember.objects.create(
            project=project, workspace=workspace, member=create_user, role=5
        )
        Issue.objects.create(name="Restricted issue", project=project)

        response = session_client.get(f"/api/workspaces/{workspace.slug}/dashboard-overview/")

        assert response.status_code == 200
        assert response.data["summary"]["projects"] == 0
        assert response.data["summary"]["total"] == 0

    def test_non_member_cannot_read_workspace_overview(self, workspace):
        stranger = User.objects.create(
            email="stranger-dashboard@example.com", username="stranger-dashboard"
        )
        client = APIClient()
        client.force_authenticate(user=stranger)

        response = client.get(f"/api/workspaces/{workspace.slug}/dashboard-overview/")

        assert response.status_code == 403

    def test_guest_cannot_read_workspace_overview(self, workspace):
        guest = User.objects.create(
            email="guest-dashboard@example.com", username="guest-dashboard"
        )
        WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)
        client = APIClient()
        client.force_authenticate(user=guest)

        response = client.get(f"/api/workspaces/{workspace.slug}/dashboard-overview/")

        assert response.status_code == 403
