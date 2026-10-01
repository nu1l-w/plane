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

from . import BaseViewSet


class WorkspaceIssueTypeViewSet(BaseViewSet):
    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [WorkspaceEntityPermission]

    def get_queryset(self):
        return IssueType.objects.filter(workspace__slug=self.workspace_slug).order_by("level", "name", "id")

    def list(self, request, slug):
        return Response(IssueTypeSerializer(self.get_queryset(), many=True).data, status=status.HTTP_200_OK)

    def create(self, request, slug):
        serializer = IssueTypeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            issue_type = serializer.save(workspace=get_object_or_404(Workspace, slug=slug))
        except IntegrityError:
            return Response({"error": "The work item type could not be created."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, slug, pk):
        issue_type = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_200_OK)

    def partial_update(self, request, slug, pk):
        issue_type = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = IssueTypeSerializer(issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        issue_type = serializer.save()
        return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_200_OK)

    def destroy(self, request, slug, pk):
        issue_type = get_object_or_404(self.get_queryset(), pk=pk)
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


class ProjectIssueTypeViewSet(BaseViewSet):
    serializer_class = ProjectIssueTypeSerializer
    model = ProjectIssueType
    permission_classes = [ProjectEntityPermission]

    def get_project(self):
        return get_object_or_404(
            Project,
            pk=self.project_id,
            workspace__slug=self.workspace_slug,
            archived_at__isnull=True,
        )

    def get_queryset(self):
        return (
            ProjectIssueType.objects.filter(project_id=self.project_id, workspace__slug=self.workspace_slug)
            .select_related("issue_type")
            .order_by("level", "id")
        )

    def list(self, request, slug, project_id):
        return Response(ProjectIssueTypeSerializer(self.get_queryset(), many=True).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def create(self, request, slug, project_id):
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

    def retrieve(self, request, slug, project_id, pk):
        project_issue_type = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(ProjectIssueTypeSerializer(project_issue_type).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def partial_update(self, request, slug, project_id, pk):
        project_issue_type = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = ProjectIssueTypeUpdateSerializer(project_issue_type, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if serializer.validated_data.get("is_default"):
            ProjectIssueType.objects.filter(project_id=project_id).exclude(pk=project_issue_type.pk).update(
                is_default=False
            )

        if serializer.validated_data.get("is_defect"):
            ProjectIssueType.objects.filter(project_id=project_id).exclude(pk=project_issue_type.pk).update(
                is_defect=False
            )

        project_issue_type = serializer.save()
        return Response(ProjectIssueTypeSerializer(project_issue_type).data, status=status.HTTP_200_OK)

    @transaction.atomic
    def destroy(self, request, slug, project_id, pk):
        project_issue_type = get_object_or_404(self.get_queryset(), pk=pk)
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
