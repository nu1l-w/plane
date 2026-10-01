# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from rest_framework import status

from plane.app.serializers import IssueCreateSerializer
from plane.api.serializers import IssueSerializer
from plane.db.models import Issue, IssueType, Project, ProjectIssueType, ProjectMember, State, Workspace


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(
        name="Types Project",
        identifier="TYP",
        workspace=workspace,
        created_by=create_user,
    )
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.mark.contract
class TestWorkItemTypeAPI:
    def workspace_types_url(self, workspace):
        return f"/api/v1/workspaces/{workspace.slug}/work-item-types/"

    def project_types_url(self, workspace, project):
        return f"/api/v1/workspaces/{workspace.slug}/projects/{project.id}/work-item-types/"

    def test_session_api_lists_workspace_types(self, session_client, workspace):
        IssueType.objects.create(workspace=workspace, name="Feature type")

        response = session_client.get(f"/api/workspaces/{workspace.slug}/work-item-types/")

        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["name"] == "Feature type"

    def test_session_api_adds_type_to_project(self, session_client, workspace, project):
        issue_type = IssueType.objects.create(workspace=workspace, name="Project type")

        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/work-item-types/",
            {"issue_type_id": str(issue_type.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["is_default"] is True
        assert response.data["work_item_type"]["name"] == "Project type"

    def test_session_api_marks_only_one_project_type_as_defect(self, session_client, workspace, project):
        issue_types = [IssueType.objects.create(workspace=workspace, name=f"Type {index}") for index in range(2)]
        project_type_ids = []
        for issue_type in issue_types:
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/projects/{project.id}/work-item-types/",
                {"issue_type_id": str(issue_type.id)},
                format="json",
            )
            assert response.status_code == status.HTTP_201_CREATED
            project_type_ids.append(response.data["id"])

        for project_type_id in project_type_ids:
            response = session_client.patch(
                f"/api/workspaces/{workspace.slug}/projects/{project.id}/work-item-types/{project_type_id}/",
                {"is_defect": True},
                format="json",
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.data["is_defect"] is True

        assert list(
            ProjectIssueType.objects.filter(project=project, is_defect=True).values_list("issue_type_id", flat=True)
        ) == [issue_types[1].id]

    def test_internal_work_item_serializer_uses_project_default_type(self, workspace, project):
        issue_type = IssueType.objects.create(workspace=workspace, name="Default type")
        ProjectIssueType.objects.create(
            workspace=workspace,
            project=project,
            issue_type=issue_type,
            is_default=True,
        )
        state = State.objects.create(
            workspace=workspace,
            project=project,
            name="Todo",
            color="#60646C",
            group="unstarted",
        )
        serializer = IssueCreateSerializer(
            data={"name": "Issue with default type", "state_id": str(state.id)},
            context={
                "project_id": project.id,
                "workspace_id": workspace.id,
                "default_assignee_id": None,
            },
        )

        assert serializer.is_valid(), serializer.errors
        issue = serializer.save()

        assert issue.type_id == issue_type.id
        assert serializer.data["type_id"] == issue_type.id

    def test_create_and_list_workspace_types(self, api_key_client, workspace):
        response = api_key_client.post(
            self.workspace_types_url(workspace),
            {"name": "需求", "description": "业务需求"},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "需求"
        assert response.data["workspace"] == workspace.id

        list_response = api_key_client.get(self.workspace_types_url(workspace))
        assert list_response.status_code == status.HTTP_200_OK
        assert [item["name"] for item in list_response.data["results"]] == ["需求"]

    def test_project_type_binding_sets_first_type_as_default(self, api_key_client, workspace, project):
        issue_type = IssueType.objects.create(workspace=workspace, name="缺陷")

        response = api_key_client.post(
            self.project_types_url(workspace, project),
            {"issue_type_id": str(issue_type.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["is_default"] is True
        assert response.data["work_item_type"]["id"] == issue_type.id

    def test_external_api_updates_defect_type_mapping(self, api_key_client, workspace, project):
        issue_types = [
            IssueType.objects.create(workspace=workspace, name=f"External type {index}") for index in range(2)
        ]
        project_type_ids = []
        for issue_type in issue_types:
            response = api_key_client.post(
                self.project_types_url(workspace, project),
                {"issue_type_id": str(issue_type.id)},
                format="json",
            )
            assert response.status_code == status.HTTP_201_CREATED
            project_type_ids.append(response.data["id"])

        response = api_key_client.patch(
            f"{self.project_types_url(workspace, project)}{project_type_ids[1]}/",
            {"is_defect": True},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_defect"] is True
        assert ProjectIssueType.objects.filter(project=project, is_defect=True).count() == 1

    def test_project_types_cannot_use_a_type_from_another_workspace(
        self, api_key_client, workspace, project, create_user
    ):
        other_workspace = Workspace.objects.create(
            name="Other Workspace",
            owner=create_user,
            slug="other-workspace",
        )
        issue_type = IssueType.objects.create(workspace=other_workspace, name="Foreign type")

        response = api_key_client.post(
            self.project_types_url(workspace, project),
            {"issue_type_id": str(issue_type.id)},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert not ProjectIssueType.objects.filter(project=project).exists()

    def test_work_items_cannot_use_a_type_not_added_to_the_project(self, workspace, project):
        issue_type = IssueType.objects.create(workspace=workspace, name="未分配类型")
        serializer = IssueSerializer(
            data={"name": "不允许使用的工作项", "type_id": str(issue_type.id)},
            context={
                "project_id": project.id,
                "workspace_id": workspace.id,
                "default_assignee_id": None,
            },
        )

        assert not serializer.is_valid()
        assert "type_id" in serializer.errors

    def test_cannot_remove_a_type_assigned_to_work_items(self, api_key_client, workspace, project, create_user):
        issue_type = IssueType.objects.create(workspace=workspace, name="需求")
        project_issue_type = ProjectIssueType.objects.create(
            workspace=workspace,
            project=project,
            issue_type=issue_type,
            is_default=True,
        )
        state = State.objects.create(
            workspace=workspace,
            project=project,
            name="待办",
            color="#60646C",
            group="unstarted",
        )
        Issue.objects.create(
            workspace=workspace,
            project=project,
            state=state,
            type=issue_type,
            name="关联工作项",
            created_by=create_user,
        )

        response = api_key_client.delete(f"{self.project_types_url(workspace, project)}{project_issue_type.id}/")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert ProjectIssueType.objects.filter(pk=project_issue_type.id).exists()
