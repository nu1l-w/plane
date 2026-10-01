from unittest import mock
from uuid import uuid4

import pytest

from plane.app.serializers.project import ProjectSerializer
from plane.db.models import FileAsset, Project, ProjectMember, WorkspaceMember


pytestmark = [pytest.mark.contract, pytest.mark.django_db]
S3_STORAGE_PATH = "plane.app.views.asset.v2.S3Storage"


@pytest.fixture
def project(workspace, create_user):
    project = Project.objects.create(name="Logo Project", identifier="LOGO", workspace=workspace)
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
    return project


@pytest.fixture
def logo_asset(project, workspace, create_user):
    return FileAsset.objects.create(
        project=project,
        workspace=workspace,
        created_by=create_user,
        entity_type=FileAsset.EntityTypeContext.PROJECT_LOGO,
        asset=f"{workspace.id}/logo.png",
        attributes={"name": "logo.png", "type": "image/png", "size": 128},
        size=128,
        is_uploaded=True,
        storage_metadata={"size": 128},
    )


def asset_url(workspace, project, asset=None):
    base = f"/api/assets/v2/workspaces/{workspace.slug}/projects/{project.id}/"
    return f"{base}{asset.id}/" if asset else base


def logo_payload(asset):
    return {"in_use": "image", "image": {"asset_id": str(asset.id), "url": asset.asset_url}}


def serializer_for(project, logo):
    return ProjectSerializer(
        project, data={"logo_props": logo}, partial=True, context={"workspace_id": project.workspace_id}
    )


def demote_user(workspace, project, user, role=15):
    WorkspaceMember.objects.filter(workspace=workspace, member=user).update(role=role)
    ProjectMember.objects.filter(project=project, member=user).update(role=role)


def test_admin_upload_creates_project_scoped_logo(session_client, workspace, project):
    with mock.patch(S3_STORAGE_PATH) as storage:
        storage.return_value.generate_presigned_post.return_value = {"url": "https://storage.test/upload"}
        response = session_client.post(
            asset_url(workspace, project),
            {
                "name": "logo.png",
                "type": "image/png",
                "size": 128,
                "entity_type": "PROJECT_LOGO",
                "entity_identifier": str(project.id),
            },
            format="json",
        )
    assert response.status_code == 200, response.data
    asset = FileAsset.objects.get(id=response.data["asset_id"])
    assert asset.project_id == project.id
    assert asset.workspace_id == workspace.id
    assert not asset.is_uploaded
    assert response.data["asset_url"] == f"/api/assets/v2/static/{asset.id}/"


@pytest.mark.parametrize("role", [5, 15])
def test_non_admin_cannot_upload_logo(session_client, workspace, project, create_user, role):
    demote_user(workspace, project, create_user, role)
    response = session_client.post(
        asset_url(workspace, project),
        {"entity_type": "PROJECT_LOGO", "entity_identifier": str(project.id), "size": 128},
        format="json",
    )
    assert response.status_code == 403
    assert not FileAsset.objects.exists()


@pytest.mark.parametrize(
    "changes",
    [
        {"type": "image/svg+xml"},
        {"type": "image/gif"},
        {"type": "text/html"},
        {"size": 5 * 1024 * 1024 + 1},
        {"size": 0},
        {"size": -1},
        {"size": "invalid"},
        {"entity_identifier": str(uuid4())},
    ],
)
def test_upload_rejects_invalid_logo(session_client, workspace, project, changes):
    payload = {
        "name": "logo.png",
        "type": "image/png",
        "size": 128,
        "entity_type": "PROJECT_LOGO",
        "entity_identifier": str(project.id),
        **changes,
    }
    response = session_client.post(asset_url(workspace, project), payload, format="json")
    assert response.status_code == 400
    assert not FileAsset.objects.exists()


def test_upload_confirmation_preserves_metadata(session_client, workspace, project, logo_asset):
    logo_asset.is_uploaded = False
    logo_asset.save()
    response = session_client.patch(asset_url(workspace, project, logo_asset), {}, format="json")
    assert response.status_code == 204
    logo_asset.refresh_from_db()
    assert logo_asset.is_uploaded

    response = session_client.patch(
        asset_url(workspace, project, logo_asset), {"attributes": {"type": "text/html"}}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.parametrize("method", ["patch", "delete"])
@pytest.mark.parametrize("workspace_endpoint", [False, True])
def test_member_cannot_mutate_logo(
    session_client, workspace, project, logo_asset, create_user, method, workspace_endpoint
):
    demote_user(workspace, project, create_user)
    url = (
        f"/api/assets/v2/workspaces/{workspace.slug}/{logo_asset.id}/"
        if workspace_endpoint
        else asset_url(workspace, project, logo_asset)
    )
    response = getattr(session_client, method)(url)
    assert response.status_code == 403
    logo_asset.refresh_from_db()
    assert not logo_asset.is_deleted


def test_workspace_upload_cannot_bypass_project_scope(session_client, workspace, project):
    response = session_client.post(
        f"/api/assets/v2/workspaces/{workspace.slug}/",
        {"entity_type": "PROJECT_LOGO", "entity_identifier": str(project.id)},
        format="json",
    )
    assert response.status_code == 400


def test_saved_logo_uses_canonical_asset_url(project, logo_asset):
    payload = logo_payload(logo_asset)
    payload["image"]["url"] = "https://untrusted.test/logo.svg"
    serializer = serializer_for(project, payload)
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    project.refresh_from_db()
    assert project.logo_props == logo_payload(logo_asset)


@pytest.mark.parametrize("invalid_state", ["other_project", "not_uploaded", "deleted", "wrong_type"])
def test_invalid_asset_cannot_be_saved(project, logo_asset, workspace, invalid_state):
    if invalid_state == "other_project":
        logo_asset.project = Project.objects.create(name="Other", identifier="OTHER", workspace=workspace)
    elif invalid_state == "not_uploaded":
        logo_asset.is_uploaded = False
    elif invalid_state == "deleted":
        logo_asset.is_deleted = True
    else:
        logo_asset.entity_type = FileAsset.EntityTypeContext.PROJECT_COVER
    logo_asset.save()
    serializer = serializer_for(project, logo_payload(logo_asset))
    assert not serializer.is_valid()
    assert "logo_props" in serializer.errors


@pytest.mark.parametrize("image", [{}, {"asset_id": "invalid"}, {"url": "blob:preview"}])
def test_invalid_image_payload_is_rejected(project, image):
    serializer = serializer_for(project, {"in_use": "image", "image": image})
    assert not serializer.is_valid()


def test_switching_back_to_emoji_retires_old_image(project, logo_asset):
    project.logo_props = logo_payload(logo_asset)
    project.save()
    serializer = serializer_for(project, {"in_use": "emoji", "emoji": {"value": "128578"}})
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    logo_asset.refresh_from_db()
    assert logo_asset.is_deleted
    assert logo_asset.deleted_at is not None


def test_replacing_image_retires_only_previous_asset(project, logo_asset, workspace):
    project.logo_props = logo_payload(logo_asset)
    project.save()
    replacement = FileAsset.objects.create(
        project=project,
        workspace=workspace,
        entity_type="PROJECT_LOGO",
        asset=f"{workspace.id}/replacement.png",
        is_uploaded=True,
    )
    serializer = serializer_for(project, logo_payload(replacement))
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    logo_asset.refresh_from_db()
    replacement.refresh_from_db()
    assert logo_asset.is_deleted
    assert not replacement.is_deleted
    assert project.logo_props == logo_payload(replacement)


def test_invalid_replacement_keeps_previous_image(project, logo_asset):
    project.logo_props = logo_payload(logo_asset)
    project.save()
    serializer = serializer_for(project, {"in_use": "image", "image": {"asset_id": str(uuid4())}})
    assert not serializer.is_valid()
    logo_asset.refresh_from_db()
    assert not logo_asset.is_deleted
    project.refresh_from_db()
    assert project.logo_props == logo_payload(logo_asset)


def test_current_logo_cannot_be_deleted_directly(session_client, workspace, project, logo_asset):
    project.logo_props = logo_payload(logo_asset)
    project.save()
    response = session_client.delete(asset_url(workspace, project, logo_asset))
    assert response.status_code == 400
    logo_asset.refresh_from_db()
    assert not logo_asset.is_deleted


def test_uploaded_logo_is_available_as_static_image(api_client, logo_asset):
    with mock.patch(S3_STORAGE_PATH) as storage:
        storage.return_value.generate_presigned_url.return_value = "https://storage.test/logo.png"
        response = api_client.get(logo_asset.asset_url)
    assert response.status_code == 302


def test_unconfirmed_logo_is_not_served(api_client, logo_asset):
    logo_asset.is_uploaded = False
    logo_asset.save()
    response = api_client.get(logo_asset.asset_url)
    assert response.status_code == 404
