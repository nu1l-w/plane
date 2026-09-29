# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views import ProjectIssueTypeViewSet, WorkspaceIssueTypeViewSet

urlpatterns = [
    path(
        "workspaces/<str:slug>/work-item-types/",
        WorkspaceIssueTypeViewSet.as_view({"get": "list", "post": "create"}),
        name="workspace-work-item-types",
    ),
    path(
        "workspaces/<str:slug>/work-item-types/<uuid:pk>/",
        WorkspaceIssueTypeViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="workspace-work-item-type",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/",
        ProjectIssueTypeViewSet.as_view({"get": "list", "post": "create"}),
        name="project-work-item-types",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/<uuid:pk>/",
        ProjectIssueTypeViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="project-work-item-type",
    ),
]
