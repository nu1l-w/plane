# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Issue, Project, ProjectMember


@pytest.mark.contract
@pytest.mark.django_db
def test_create_issue_without_legacy_delivery_fields(session_client, workspace, create_user):
    project = Project.objects.create(
        name="Issue creation",
        identifier="IC",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(
        project=project, workspace=workspace, member=create_user, role=20
    )

    response = session_client.post(
        f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/",
        {"name": "New work item", "priority": "none"},
        format="json",
    )

    assert response.status_code == 201
    assert Issue.objects.filter(project=project, name="New work item").exists()
