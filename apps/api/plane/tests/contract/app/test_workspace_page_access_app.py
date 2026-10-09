# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

import pytest
from django.utils import timezone
from rest_framework import status

from plane.bgtasks.page_version_task import track_page_version
from plane.db.models import FileAsset, Page, PageVersion, Project, ProjectMember, ProjectPage, User, WorkspaceMember


def _pages_url(slug):
    return f"/api/workspaces/{slug}/pages/"


def _page_url(slug, page_id):
    return f"{_pages_url(slug)}{page_id}/"


def _page_version_url(slug, page_id, version_id):
    return f"{_page_url(slug, page_id)}versions/{version_id}/"


def _page_move_url(slug, page_id):
    return f"{_page_url(slug, page_id)}move/"


def _page_archive_url(slug, page_id):
    return f"{_page_url(slug, page_id)}archive/"


def _page_lock_url(slug, page_id):
    return f"{_page_url(slug, page_id)}lock/"


def _page_duplicate_url(slug, page_id):
    return f"{_page_url(slug, page_id)}duplicate/"


def _make_project(workspace, identifier):
    return Project.objects.create(name=f"Project {identifier}", identifier=identifier, workspace=workspace)


def _make_page(workspace, owner, name, access=Page.PUBLIC_ACCESS):
    return Page.objects.create(
        workspace=workspace,
        owned_by=owner,
        is_global=True,
        access=access,
        name=name,
    )


@pytest.mark.contract
class TestWorkspacePageAccess:
    @pytest.mark.django_db
    def test_workspace_page_favorite_appears_in_favorites(self, api_client, workspace):
        owner = User.objects.create(email="favorite-owner@plane.so", username="favorite_owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        page = _make_page(workspace, owner, "Favorite")
        api_client.force_authenticate(user=owner)

        create_response = api_client.post(
            f"/api/workspaces/{workspace.slug}/user-favorites/",
            {"entity_type": "page", "entity_identifier": str(page.id), "project_id": None},
            format="json",
        )
        response = api_client.get(f"/api/workspaces/{workspace.slug}/user-favorites/")

        assert create_response.status_code == status.HTTP_200_OK
        assert response.status_code == status.HTTP_200_OK
        assert any(item["entity_identifier"] == str(page.id) for item in response.json())

    @pytest.mark.django_db
    def test_owner_can_lock_and_unlock_workspace_page(self, api_client, workspace):
        owner = User.objects.create(email="lock-owner@plane.so", username="lock_owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        page = _make_page(workspace, owner, "Lockable")
        api_client.force_authenticate(user=owner)

        assert api_client.post(_page_lock_url(workspace.slug, page.id)).status_code == status.HTTP_204_NO_CONTENT
        page.refresh_from_db()
        assert page.is_locked is True
        assert api_client.patch(_page_url(workspace.slug, page.id), {"name": "Changed"}).status_code == status.HTTP_400_BAD_REQUEST
        assert api_client.delete(_page_lock_url(workspace.slug, page.id)).status_code == status.HTTP_204_NO_CONTENT
        page.refresh_from_db()
        assert page.is_locked is False

    @pytest.mark.django_db
    def test_member_cannot_lock_or_duplicate_another_owners_page(self, api_client, workspace):
        owner = User.objects.create(email="copy-owner@plane.so", username="copy_owner")
        member = User.objects.create(email="copy-member@plane.so", username="copy_member")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15, is_active=True)
        page = _make_page(workspace, owner, "Shared")
        api_client.force_authenticate(user=member)

        assert api_client.post(_page_lock_url(workspace.slug, page.id)).status_code == status.HTTP_403_FORBIDDEN
        assert api_client.post(_page_duplicate_url(workspace.slug, page.id)).status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_owner_can_duplicate_workspace_page(self, api_client, workspace, monkeypatch):
        owner = User.objects.create(email="duplicate-owner@plane.so", username="duplicate_owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        page = _make_page(workspace, owner, "Source")
        monkeypatch.setattr("plane.app.views.page.base.page_transaction.delay", lambda **kwargs: None)
        monkeypatch.setattr(
            "plane.app.views.page.base.copy_s3_objects_of_description_and_assets.delay", lambda **kwargs: None
        )
        api_client.force_authenticate(user=owner)

        response = api_client.post(_page_duplicate_url(workspace.slug, page.id))

        assert response.status_code == status.HTTP_201_CREATED
        copy = Page.objects.get(pk=response.json()["id"])
        assert copy.id != page.id
        assert copy.name == "Source (Copy)"
        assert copy.is_global is True
        assert copy.owned_by_id == owner.id
        assert not copy.project_pages.exists()

    @pytest.mark.django_db
    def test_member_can_create_workspace_page(self, api_client, workspace):
        member = User.objects.create(email="wiki-member@plane.so", username="wiki_member")
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15, is_active=True)
        api_client.force_authenticate(user=member)

        response = api_client.post(
            _pages_url(workspace.slug),
            {
                "name": "Engineering handbook",
                "access": Page.PUBLIC_ACCESS,
                "description_html": "<p>Shared workspace content</p>",
                "description_json": {},
            },
            format="json",
        )

        assert response.status_code == status.HTTP_201_CREATED
        page = Page.objects.get(pk=response.json()["id"])
        assert page.workspace_id == workspace.id
        assert page.is_global is True
        assert not page.project_pages.filter(deleted_at__isnull=True).exists()

    @pytest.mark.django_db
    def test_member_can_read_shared_but_not_private_page(self, api_client, workspace, create_user):
        member = User.objects.create(email="wiki-reader@plane.so", username="wiki_reader")
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15, is_active=True)
        shared_page = _make_page(workspace, create_user, "Shared")
        private_page = _make_page(workspace, create_user, "Private", Page.PRIVATE_ACCESS)
        api_client.force_authenticate(user=member)

        list_response = api_client.get(_pages_url(workspace.slug))
        shared_response = api_client.get(_page_url(workspace.slug, shared_page.id))
        private_response = api_client.get(_page_url(workspace.slug, private_page.id))

        assert list_response.status_code == status.HTTP_200_OK
        assert {page["id"] for page in list_response.json()} == {str(shared_page.id)}
        assert shared_response.status_code == status.HTTP_200_OK
        assert private_response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_only_owner_or_admin_can_edit_shared_page(self, api_client, workspace, create_user):
        owner = User.objects.create(email="wiki-owner@plane.so", username="wiki_owner")
        member = User.objects.create(email="wiki-member@plane.so", username="wiki_member")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15, is_active=True)
        page = _make_page(workspace, owner, "Shared")

        api_client.force_authenticate(user=member)
        denied_response = api_client.patch(_page_url(workspace.slug, page.id), {"name": "Changed"}, format="json")

        api_client.force_authenticate(user=owner)
        owner_response = api_client.patch(_page_url(workspace.slug, page.id), {"name": "Changed"}, format="json")

        assert denied_response.status_code == status.HTTP_403_FORBIDDEN
        assert owner_response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.name == "Changed"

    @pytest.mark.django_db
    def test_guest_can_read_shared_but_cannot_create(self, api_client, workspace, create_user):
        guest = User.objects.create(email="wiki-guest@plane.so", username="wiki_guest")
        WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5, is_active=True)
        page = _make_page(workspace, create_user, "Shared")
        api_client.force_authenticate(user=guest)

        read_response = api_client.get(_page_url(workspace.slug, page.id))
        create_response = api_client.post(
            _pages_url(workspace.slug),
            {"name": "Guest page", "description_html": "<p></p>", "description_json": {}},
            format="json",
        )

        assert read_response.status_code == status.HTTP_200_OK
        assert create_response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_workspace_admin_inherits_access_to_private_page(self, api_client, workspace, create_user):
        admin = User.objects.create(email="wiki-admin@plane.so", username="wiki_admin")
        WorkspaceMember.objects.create(workspace=workspace, member=admin, role=20, is_active=True)
        page = _make_page(workspace, create_user, "Private", Page.PRIVATE_ACCESS)
        api_client.force_authenticate(user=admin)

        read_response = api_client.get(_page_url(workspace.slug, page.id))
        update_response = api_client.patch(_page_url(workspace.slug, page.id), {"name": "Admin edit"}, format="json")

        assert read_response.status_code == status.HTTP_200_OK
        assert update_response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.name == "Admin edit"

    @pytest.mark.django_db
    def test_owner_can_filter_workspace_pages_by_type(self, api_client, workspace):
        owner = User.objects.create(email="wiki-owner@plane.so", username="wiki_owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        public_page = _make_page(workspace, owner, "Public")
        private_page = _make_page(workspace, owner, "Private", Page.PRIVATE_ACCESS)
        archived_page = _make_page(workspace, owner, "Archived")
        archived_page.archived_at = timezone.now()
        archived_page.save(update_fields=["archived_at"])
        api_client.force_authenticate(user=owner)

        public_response = api_client.get(f"{_pages_url(workspace.slug)}?type=public")
        private_response = api_client.get(f"{_pages_url(workspace.slug)}?type=private")
        archived_response = api_client.get(f"{_pages_url(workspace.slug)}?type=archived")

        assert public_response.status_code == status.HTTP_200_OK
        assert private_response.status_code == status.HTTP_200_OK
        assert archived_response.status_code == status.HTTP_200_OK
        assert {item["id"] for item in public_response.json()} == {str(public_page.id)}
        assert {item["id"] for item in private_response.json()} == {str(private_page.id)}
        assert {item["id"] for item in archived_response.json()} == {str(archived_page.id)}

    @pytest.mark.django_db
    def test_owner_can_archive_restore_and_delete_workspace_page(self, api_client, workspace):
        owner = User.objects.create(email="wiki-owner@plane.so", username="wiki_owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        page = _make_page(workspace, owner, "Lifecycle")
        api_client.force_authenticate(user=owner)

        delete_active_response = api_client.delete(_page_url(workspace.slug, page.id))
        archive_response = api_client.post(_page_archive_url(workspace.slug, page.id))
        page.refresh_from_db()

        assert delete_active_response.status_code == status.HTTP_400_BAD_REQUEST
        assert archive_response.status_code == status.HTTP_200_OK
        assert page.archived_at is not None

        restore_response = api_client.delete(_page_archive_url(workspace.slug, page.id))
        page.refresh_from_db()

        assert restore_response.status_code == status.HTTP_204_NO_CONTENT
        assert page.archived_at is None

        api_client.post(_page_archive_url(workspace.slug, page.id))
        delete_response = api_client.delete(_page_url(workspace.slug, page.id))

        assert delete_response.status_code == status.HTTP_204_NO_CONTENT
        assert not Page.objects.filter(pk=page.id).exists()

    @pytest.mark.django_db
    def test_member_cannot_archive_another_owners_workspace_page(self, api_client, workspace, create_user):
        member = User.objects.create(email="wiki-member@plane.so", username="wiki_member")
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15, is_active=True)
        page = _make_page(workspace, create_user, "Shared")
        api_client.force_authenticate(user=member)

        response = api_client.post(_page_archive_url(workspace.slug, page.id))

        assert response.status_code == status.HTTP_403_FORBIDDEN
        page.refresh_from_db()
        assert page.archived_at is None

    @pytest.mark.django_db
    def test_member_cannot_restore_another_owners_page_version(self, api_client, workspace):
        owner = User.objects.create(email="wiki-owner@plane.so", username="wiki_owner")
        member = User.objects.create(email="wiki-member@plane.so", username="wiki_member")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        WorkspaceMember.objects.create(workspace=workspace, member=member, role=15, is_active=True)
        page = _make_page(workspace, owner, "Shared")
        version = PageVersion.objects.create(
            workspace=workspace,
            page=page,
            owned_by=owner,
            description_html="<p>Earlier version</p>",
        )
        api_client.force_authenticate(user=member)

        response = api_client.post(_page_version_url(workspace.slug, page.id, version.id))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_owner_can_list_read_and_restore_page_versions(self, api_client, workspace, monkeypatch):
        owner = User.objects.create(email="wiki-owner@plane.so", username="wiki_owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        page = _make_page(workspace, owner, "Versioned page")
        version = PageVersion.objects.create(
            workspace=workspace,
            page=page,
            owned_by=owner,
            description_html="<p>Earlier version</p>",
            description_json={"type": "doc", "content": [{"type": "paragraph"}]},
        )
        monkeypatch.setattr("plane.app.views.page.version.track_page_version.delay", lambda **kwargs: None)
        monkeypatch.setattr("plane.app.views.page.version.page_transaction.delay", lambda **kwargs: None)
        api_client.force_authenticate(user=owner)

        list_response = api_client.get(f"{_page_url(workspace.slug, page.id)}versions/")
        detail_response = api_client.get(_page_version_url(workspace.slug, page.id, version.id))
        restore_response = api_client.post(_page_version_url(workspace.slug, page.id, version.id))

        assert list_response.status_code == status.HTTP_200_OK
        assert {item["id"] for item in list_response.json()} == {str(version.id)}
        assert detail_response.status_code == status.HTTP_200_OK
        assert detail_response.json()["description_html"] == "<p>Earlier version</p>"
        assert restore_response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        assert page.description_html == "<p>Earlier version</p>"
        assert page.description_json == {"type": "doc", "content": [{"type": "paragraph"}]}

    @pytest.mark.django_db
    def test_version_task_snapshots_page_description_json(self, workspace, create_user):
        page = _make_page(workspace, create_user, "Versioned page")
        page.description_html = "<p>Current version</p>"
        page.description_json = {"type": "doc", "content": [{"type": "text", "text": "current"}]}
        page.save()

        track_page_version.run(
            page_id=page.id,
            existing_instance=json.dumps({"description_html": "<p>Previous version</p>"}),
            user_id=create_user.id,
        )

        version = PageVersion.objects.get(page=page)
        assert version.description_html == "<p>Current version</p>"
        assert version.description_json == {"type": "doc", "content": [{"type": "text", "text": "current"}]}

    @pytest.mark.django_db
    def test_owner_can_move_workspace_page_into_project_and_scope_its_assets(
        self, api_client, workspace
    ):
        owner = User.objects.create(email="wiki-owner@plane.so", username="wiki_owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        project = _make_project(workspace, "WIKIMOVE")
        ProjectMember.objects.create(workspace=workspace, project=project, member=owner, role=15, is_active=True)
        page = _make_page(workspace, owner, "Moveable page")
        asset = FileAsset.objects.create(
            workspace=workspace,
            page=page,
            entity_type=FileAsset.EntityTypeContext.PAGE_DESCRIPTION,
            asset="workspace/page-image.png",
            is_uploaded=True,
        )
        api_client.force_authenticate(user=owner)

        response = api_client.post(_page_move_url(workspace.slug, page.id), {"new_project_id": str(project.id)})

        assert response.status_code == status.HTTP_200_OK
        page.refresh_from_db()
        asset.refresh_from_db()
        assert page.is_global is False
        assert page.project_pages.filter(project=project, deleted_at__isnull=True).exists()
        assert asset.project_id == project.id
        assert api_client.get(_pages_url(workspace.slug)).json() == []
        project_page_response = api_client.get(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/pages/{page.id}/"
        )
        assert project_page_response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_move_rejects_malformed_destination_project_id(self, api_client, workspace):
        owner = User.objects.create(email="wiki-owner@plane.so", username="wiki_owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=15, is_active=True)
        page = _make_page(workspace, owner, "Moveable page")
        api_client.force_authenticate(user=owner)

        response = api_client.post(_page_move_url(workspace.slug, page.id), {"new_project_id": "not-a-uuid"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "new_project_id" in response.json()
        page.refresh_from_db()
        assert page.is_global is True

    @pytest.mark.django_db
    def test_workspace_page_owner_must_belong_to_destination_project(self, api_client, workspace):
        owner = User.objects.create(email="wiki-owner@plane.so", username="wiki_owner")
        WorkspaceMember.objects.create(workspace=workspace, member=owner, role=20, is_active=True)
        project = _make_project(workspace, "WIKIMOVE")
        ProjectMember.objects.create(workspace=workspace, project=project, member=owner, role=20, is_active=True)
        page_owner = User.objects.create(email="wiki-author@plane.so", username="wiki_author")
        WorkspaceMember.objects.create(workspace=workspace, member=page_owner, role=15, is_active=True)
        page = _make_page(workspace, page_owner, "Owned by another member")
        api_client.force_authenticate(user=owner)

        response = api_client.post(_page_move_url(workspace.slug, page.id), {"new_project_id": str(project.id)})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        page.refresh_from_db()
        assert page.is_global is True
