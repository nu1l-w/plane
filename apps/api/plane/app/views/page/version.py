# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import ProjectPagePermission, WorkspacePagePermission
from plane.app.serializers import PageVersionDetailSerializer, PageVersionSerializer
from plane.bgtasks.page_transaction_task import page_transaction
from plane.bgtasks.page_version_task import track_page_version
from plane.db.models import Page, PageVersion

# Local imports
from ..base import BaseAPIView


class PageVersionEndpoint(BaseAPIView):
    permission_classes = [ProjectPagePermission]

    def get(self, request, slug, project_id, page_id, pk=None):
        # Check if pk is provided
        if pk:
            # Return a single page version. Scope to an *active* ProjectPage link
            # for the URL project so a page belonging to (or removed from)
            # another project cannot be read via this endpoint (GHSA-g49r /
            # GHSA-ghcr). The active-link partial-unique constraint keeps the
            # join to a single row; distinct() is a defensive guard so the
            # page__project_pages join can never make get() raise
            # MultipleObjectsReturned (a 500).
            page_version = (
                PageVersion.objects.filter(
                    workspace__slug=slug,
                    page__project_pages__project_id=project_id,
                    page__project_pages__deleted_at__isnull=True,
                    page_id=page_id,
                    pk=pk,
                )
                .distinct()
                .get()
            )
            # Serialize the page version
            serializer = PageVersionDetailSerializer(page_version)
            return Response(serializer.data, status=status.HTTP_200_OK)
        # Return all page versions scoped to an active ProjectPage link for the
        # URL project (defense in depth).
        page_versions = PageVersion.objects.filter(
            workspace__slug=slug,
            page__project_pages__project_id=project_id,
            page__project_pages__deleted_at__isnull=True,
            page_id=page_id,
        )
        # Serialize the page versions
        serializer = PageVersionSerializer(page_versions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, slug, project_id, page_id, pk):
        page = Page.objects.get(
            pk=page_id,
            workspace__slug=slug,
            project_pages__project_id=project_id,
            project_pages__deleted_at__isnull=True,
        )
        page_version = PageVersion.objects.get(
            workspace__slug=slug,
            page=page,
            pk=pk,
        )
        if page.is_locked or page.archived_at:
            return Response(
                {"error": "Locked or archived pages cannot restore a version."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_description_html = page.description_html
        page.description_html = page_version.description_html
        page.description_binary = page_version.description_binary
        page.description_json = page_version.description_json
        page.save()

        existing_instance = json.dumps({"description_html": old_description_html})
        track_page_version.delay(page_id=page.id, existing_instance=existing_instance, user_id=request.user.id)
        page_transaction.delay(
            new_description_html=page.description_html,
            old_description_html=old_description_html,
            page_id=page.id,
        )
        return Response({"message": "Page version restored"}, status=status.HTTP_200_OK)


class WorkspacePageVersionEndpoint(BaseAPIView):
    permission_classes = [WorkspacePagePermission]

    def get(self, request, slug, page_id, pk=None):
        page_versions = PageVersion.objects.filter(
            workspace__slug=slug,
            page_id=page_id,
            page__is_global=True,
        )
        if pk:
            page_version = page_versions.get(pk=pk)
            return Response(PageVersionDetailSerializer(page_version).data, status=status.HTTP_200_OK)

        return Response(PageVersionSerializer(page_versions, many=True).data, status=status.HTTP_200_OK)

    def post(self, request, slug, page_id, pk):
        page = Page.objects.get(workspace__slug=slug, pk=page_id, is_global=True)
        page_version = PageVersion.objects.get(workspace__slug=slug, page=page, pk=pk)
        if page.is_locked or page.archived_at:
            return Response(
                {"error": "Locked or archived pages cannot restore a version."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_description_html = page.description_html
        page.description_html = page_version.description_html
        page.description_binary = page_version.description_binary
        page.description_json = page_version.description_json
        page.save()

        existing_instance = json.dumps({"description_html": old_description_html})
        track_page_version.delay(page_id=page.id, existing_instance=existing_instance, user_id=request.user.id)
        page_transaction.delay(
            new_description_html=page.description_html,
            old_description_html=old_description_html,
            page_id=page.id,
        )
        return Response({"message": "Page version restored"}, status=status.HTTP_200_OK)
