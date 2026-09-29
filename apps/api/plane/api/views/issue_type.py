# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from plane.api.serializers import (
    IssueTypeSerializer,
    ProjectIssueTypeCreateSerializer,
    ProjectIssueTypeSerializer,
    ProjectIssueTypeUpdateSerializer,
)
from plane.app.permissions import ProjectEntityPermission, WorkspaceEntityPermission
from plane.db.models import Issue, IssueType, Project, ProjectIssueType, Workspace

from .base import BaseAPIView


class IssueTypeListCreateAPIEndpoint(BaseAPIView):
    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [WorkspaceEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return IssueType.objects.filter(workspace__slug=self.workspace_slug).order_by("level", "name", "id")

    def get(self, request, slug):
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda issue_types: IssueTypeSerializer(
                issue_types, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    def post(self, request, slug):
        serializer = IssueTypeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            workspace = get_object_or_404(Workspace, slug=self.workspace_slug)
            issue_type = serializer.save(workspace=workspace)
        except IntegrityError:
            return Response({"error": "The work item type could not be created."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_201_CREATED)


class IssueTypeDetailAPIEndpoint(BaseAPIView):
    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [WorkspaceEntityPermission]

    def get_object(self):
        return get_object_or_404(IssueType, workspace__slug=self.workspace_slug, pk=self.kwargs["issue_type_id"])

    def get(self, request, slug, issue_type_id):
        return Response(IssueTypeSerializer(self.get_object()).data, status=status.HTTP_200_OK)

    def patch(self, request, slug, issue_type_id):
        issue_type = self.get_object()
        serializer = IssueTypeSerializer(issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        issue_type = serializer.save()
        return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_200_OK)

    def delete(self, request, slug, issue_type_id):
        issue_type = self.get_object()
        if (
            ProjectIssueType.objects.filter(issue_type=issue_type).exists()
            or Issue.objects.filter(type=issue_type).exists()
        ):
            return Response(
                {"error": "Remove this work item type from projects and work items before deleting it."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        issue_type.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectIssueTypeListCreateAPIEndpoint(BaseAPIView):
    serializer_class = ProjectIssueTypeSerializer
    model = ProjectIssueType
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_project(self):
        return get_object_or_404(
            Project,
            pk=self.project_id,
            workspace__slug=self.workspace_slug,
            archived_at__isnull=True,
        )

    def get_queryset(self):
        return (
            ProjectIssueType.objects.filter(
                project_id=self.project_id,
                workspace__slug=self.workspace_slug,
            )
            .select_related("issue_type")
            .order_by("level", "id")
        )

    def get(self, request, slug, project_id):
        return self.paginate(
            request=request,
            queryset=self.get_queryset(),
            on_results=lambda project_issue_types: ProjectIssueTypeSerializer(
                project_issue_types, many=True, fields=self.fields, expand=self.expand
            ).data,
        )

    @transaction.atomic
    def post(self, request, slug, project_id):
        project = self.get_project()
        serializer = ProjectIssueTypeCreateSerializer(
            data=request.data,
            context={"project_id": project.id, "workspace_id": project.workspace_id},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        is_first_type = not self.get_queryset().exists()
        is_default = serializer.validated_data.get("is_default", False) or is_first_type
        if is_default:
            ProjectIssueType.objects.filter(project=project).update(is_default=False)

        try:
            project_issue_type = serializer.save(
                project=project,
                workspace=project.workspace,
                is_default=is_default,
            )
        except IntegrityError:
            return Response(
                {"error": "This work item type is already added to the project."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(ProjectIssueTypeSerializer(project_issue_type).data, status=status.HTTP_201_CREATED)


class ProjectIssueTypeDetailAPIEndpoint(BaseAPIView):
    serializer_class = ProjectIssueTypeSerializer
    model = ProjectIssueType
    permission_classes = [ProjectEntityPermission]

    def get_object(self):
        return get_object_or_404(
            ProjectIssueType.objects.select_related("issue_type"),
            pk=self.kwargs["project_issue_type_id"],
            project_id=self.project_id,
            workspace__slug=self.workspace_slug,
        )

    def get(self, request, slug, project_id, project_issue_type_id):
        return Response(ProjectIssueTypeSerializer(self.get_object()).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def patch(self, request, slug, project_id, project_issue_type_id):
        project_issue_type = self.get_object()
        serializer = ProjectIssueTypeUpdateSerializer(project_issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if serializer.validated_data.get("is_default"):
            ProjectIssueType.objects.filter(project_id=project_id).exclude(pk=project_issue_type.pk).update(
                is_default=False
            )

        project_issue_type = serializer.save()
        return Response(ProjectIssueTypeSerializer(project_issue_type).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def delete(self, request, slug, project_id, project_issue_type_id):
        project_issue_type = self.get_object()
        if Issue.objects.filter(project_id=project_id, type=project_issue_type.issue_type).exists():
            return Response(
                {"error": "This work item type is assigned to existing work items."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        was_default = project_issue_type.is_default
        project_issue_type.delete()
        if was_default:
            next_type = ProjectIssueType.objects.filter(project_id=project_id).order_by("level", "id").first()
            if next_type:
                next_type.is_default = True
                next_type.save(update_fields=["is_default"])

        return Response(status=status.HTTP_204_NO_CONTENT)
