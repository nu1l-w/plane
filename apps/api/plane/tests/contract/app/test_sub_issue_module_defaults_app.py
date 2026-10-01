import pytest
from django.utils import timezone

from plane.app.serializers import IssueCreateSerializer
from plane.db.models import Issue, Module, ModuleIssue, Project, ProjectMember
from plane.utils.issue_modules import inherit_parent_modules

pytestmark = [pytest.mark.django_db, pytest.mark.contract]


@pytest.fixture
def setup(workspace, create_user, mocker):
    mocker.patch("celery.app.task.Task.delay")
    project = Project.objects.create(name="Project", identifier="MOD", workspace=workspace)
    ProjectMember.objects.create(project=project, member=create_user, role=20)
    parent = Issue.objects.create(name="Parent", project=project)
    modules = [
        Module.objects.create(name=f"Module {index}", project=project)
        for index in range(2)
    ]
    for module in modules:
        ModuleIssue.objects.create(project=project, issue=parent, module=module)
    return project, parent, modules


def module_ids(issue):
    return set(ModuleIssue.objects.filter(issue=issue).values_list("module_id", flat=True))


def create_child(project, parent, **extra):
    serializer = IssueCreateSerializer(
        data={"name": "Child", "parent_id": str(parent.id), **extra},
        context={
            "project_id": project.id,
            "workspace_id": project.workspace_id,
            "default_assignee_id": None,
        },
    )
    assert serializer.is_valid(), serializer.errors
    return serializer.save()


@pytest.mark.unit
@pytest.mark.parametrize("extra", [{}, {"module_ids": None}])
def test_create_inherits_all_modules(setup, extra):
    project, parent, modules = setup
    child = create_child(project, parent, **extra)
    assert module_ids(child) == {module.id for module in modules}


@pytest.mark.unit
@pytest.mark.parametrize("selection", [[], ["00000000-0000-0000-0000-000000000001"]])
def test_explicit_module_selection_suppresses_default(setup, selection):
    project, parent, _ = setup
    # Explicit selections are saved through the existing module endpoint.
    child = create_child(project, parent, module_ids=selection)
    assert not module_ids(child)


@pytest.mark.unit
def test_inheritance_ignores_archived_deleted_and_removed_modules(setup):
    project, parent, modules = setup
    modules[0].archived_at = timezone.now()
    modules[0].save()
    modules[1].delete()
    removed = Module.objects.create(name="Removed", project=project)
    ModuleIssue.objects.create(project=project, issue=parent, module=removed).delete()
    assert not module_ids(create_child(project, parent))


@pytest.mark.unit
def test_existing_modules_are_preserved_and_inheritance_is_idempotent(setup):
    project, parent, modules = setup
    child = Issue.objects.create(name="Existing", project=project)
    own_module = Module.objects.create(name="Own", project=project)
    ModuleIssue.objects.create(project=project, issue=child, module=own_module)
    inherit_parent_modules(child, parent)
    assert module_ids(child) == {own_module.id}
    new_child = create_child(project, parent)
    inherit_parent_modules(new_child, parent)
    assert module_ids(new_child) == {module.id for module in modules}


@pytest.mark.unit
def test_cross_project_and_draft_children_do_not_inherit(setup):
    project, parent, _ = setup
    other = Project.objects.create(
        name="Other", identifier="OTHER", workspace_id=project.workspace_id
    )
    child = Issue.objects.create(name="Foreign", project=other)
    inherit_parent_modules(child, parent)
    assert not module_ids(child)
    assert not module_ids(create_child(project, parent, is_draft=True))


def test_create_endpoint_returns_persisted_defaults(session_client, setup):
    project, parent, modules = setup
    response = session_client.post(
        f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/issues/",
        {"name": "Child", "parent_id": str(parent.id)},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert set(map(str, response.data["module_ids"])) == {str(module.id) for module in modules}


def test_link_existing_inherits_only_for_unassigned_children(session_client, setup):
    project, parent, modules = setup
    child = Issue.objects.create(name="Unassigned", project=project)
    assigned = Issue.objects.create(name="Assigned", project=project)
    ModuleIssue.objects.create(project=project, issue=assigned, module=modules[0])
    response = session_client.post(
        f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/issues/{parent.id}/sub-issues/",
        {"sub_issue_ids": [str(child.id), str(assigned.id)]},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert module_ids(child) == {module.id for module in modules}
    assert module_ids(assigned) == {modules[0].id}
    returned = {str(row["id"]): row for row in response.data["sub_issues"]}
    assert set(returned[str(child.id)]["module_ids"]) == {str(module.id) for module in modules}


def test_set_parent_inherits_but_unlink_and_regular_edits_preserve_modules(session_client, setup):
    project, parent, modules = setup
    child = Issue.objects.create(name="Child", project=project)
    url = f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/issues/{child.id}/"
    response = session_client.patch(url, {"parent_id": str(parent.id)}, format="json")
    assert response.status_code == 204, response.data
    assert module_ids(child) == {module.id for module in modules}
    response = session_client.patch(url, {"parent_id": None}, format="json")
    assert response.status_code == 204
    assert module_ids(child) == {module.id for module in modules}
    ModuleIssue.objects.filter(issue=child).delete()
    response = session_client.patch(url, {"name": "Renamed"}, format="json")
    assert response.status_code == 204
    assert not module_ids(child)


def test_relink_same_parent_does_not_restore_cleared_modules(session_client, setup):
    project, parent, _ = setup
    child = create_child(project, parent)
    ModuleIssue.objects.filter(issue=child).delete()
    response = session_client.post(
        f"/api/workspaces/{project.workspace.slug}/projects/{project.id}/issues/{parent.id}/sub-issues/",
        {"sub_issue_ids": [str(child.id)]},
        format="json",
    )
    assert response.status_code == 200
    assert not module_ids(child)
