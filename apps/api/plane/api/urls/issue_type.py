# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views import (
    IssueTypeDetailAPIEndpoint,
    IssueTypeListCreateAPIEndpoint,
    ProjectIssueTypeDetailAPIEndpoint,
    ProjectIssueTypeListCreateAPIEndpoint,
)

urlpatterns = [
    path(
        "workspaces/<str:slug>/work-item-types/",
        IssueTypeListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="work-item-types",
    ),
    path(
        "workspaces/<str:slug>/work-item-types/<uuid:issue_type_id>/",
        IssueTypeDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="work-item-type-detail",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/",
        ProjectIssueTypeListCreateAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="project-work-item-types",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/work-item-types/<uuid:project_issue_type_id>/",
        ProjectIssueTypeDetailAPIEndpoint.as_view(http_method_names=["get", "patch", "delete"]),
        name="project-work-item-type-detail",
    ),
]
