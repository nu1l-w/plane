# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import IssueType, ProjectIssueType

from .base import BaseSerializer


class IssueTypeSerializer(BaseSerializer):
    class Meta:
        model = IssueType
        fields = [
            "id",
            "name",
            "description",
            "logo_props",
            "is_epic",
            "is_active",
            "level",
            "workspace",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty.")
        return value


class ProjectIssueTypeSerializer(BaseSerializer):
    work_item_type = IssueTypeSerializer(source="issue_type", read_only=True)

    class Meta:
        model = ProjectIssueType
        fields = ["id", "issue_type", "work_item_type", "level", "is_default", "is_defect"]
        read_only_fields = ["id", "work_item_type"]


class ProjectIssueTypeCreateSerializer(BaseSerializer):
    issue_type_id = serializers.PrimaryKeyRelatedField(source="issue_type", queryset=IssueType.objects.all())

    class Meta:
        model = ProjectIssueType
        fields = ["issue_type_id", "level", "is_default"]

    def validate_issue_type_id(self, issue_type):
        project_id = self.context["project_id"]
        workspace_id = self.context["workspace_id"]
        if issue_type.workspace_id != workspace_id or not issue_type.is_active:
            raise serializers.ValidationError("Work item type is not available in this workspace.")
        if ProjectIssueType.objects.filter(project_id=project_id, issue_type=issue_type).exists():
            raise serializers.ValidationError("Work item type is already added to this project.")
        return issue_type


class ProjectIssueTypeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectIssueType
        fields = ["level", "is_default", "is_defect"]
