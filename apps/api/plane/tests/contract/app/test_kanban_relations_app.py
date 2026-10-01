# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.utils import timezone

from plane.db.models import Cycle, CycleIssue, Issue, IssueRelation, Module, ModuleIssue, Project, ProjectMember, State
from plane.utils.grouper import expand_issue_relations


@pytest.fixture
def board(db, workspace, create_user, monkeypatch):
    monkeypatch.setattr("plane.app.views.issue.base.recent_visited_task.delay", lambda **kwargs: None)
    project = Project.objects.create(name="Board", identifier="BRD", workspace=workspace)
    membership = ProjectMember.objects.create(project=project, member=create_user, role=20)
    state = State.objects.create(name="Todo", group="unstarted", project=project, workspace=workspace)
    blocker = Issue.objects.create(name="Firmware", project=project, workspace=workspace, state=state)
    blocked = Issue(name="PC adaptation", project=project, workspace=workspace, state=state)
    blocked.save(created_by_id=create_user.id)
    relation = IssueRelation.objects.create(
        issue=blocked, related_issue=blocker, relation_type="blocked_by", project=project, workspace=workspace
    )
    module = Module.objects.create(name="Release", project=project, workspace=workspace)
    cycle = Cycle.objects.create(name="Sprint", project=project, workspace=workspace, owned_by=create_user)
    ModuleIssue.objects.create(module=module, issue=blocked, project=project, workspace=workspace)
    CycleIssue.objects.create(cycle=cycle, issue=blocked, project=project, workspace=workspace)
    return {
        "project": project,
        "membership": membership,
        "blocked": blocked,
        "blocker": blocker,
        "relation": relation,
        "module": module,
        "cycle": cycle,
    }


def flatten(results):
    if isinstance(results, list):
        return results
    if "results" in results:
        return flatten(results["results"])
    return [row for group in results.values() for row in flatten(group)]


@pytest.mark.contract
@pytest.mark.django_db
class TestKanbanRelations:
    @pytest.mark.parametrize("endpoint", ["project", "module", "cycle"])
    @pytest.mark.parametrize(
        "grouping", [{}, {"group_by": "state_id"}, {"group_by": "state_id", "sub_group_by": "priority"}]
    )
    def test_expands_relations_on_first_load(self, session_client, workspace, board, endpoint, grouping):
        prefix = f"/api/workspaces/{workspace.slug}/projects/{board['project'].id}"
        paths = {
            "project": f"{prefix}/issues/",
            "module": f"{prefix}/modules/{board['module'].id}/issues/",
            "cycle": f"{prefix}/cycles/{board['cycle'].id}/cycle-issues/",
        }
        response = session_client.get(paths[endpoint], {"expand": "issue_relation,issue_related", **grouping})
        assert response.status_code == 200, response.content
        rows = {str(row["id"]): row for row in flatten(response.data["results"])}
        relations = rows[str(board["blocked"].id)]["issue_relation"]
        assert len(relations) == 1
        assert str(relations[0]["id"]) == str(board["blocker"].id)
        assert relations[0]["name"] == "Firmware"
        assert relations[0]["relation_type"] == "blocked_by"
        assert str(relations[0]["state_id"]) == str(board["blocker"].state_id)
        assert relations[0]["state__group"] == "unstarted"
        # Module/cycle only contain the blocked item; the blocker is outside the current view.
        if endpoint != "project":
            assert str(board["blocker"].id) not in rows

    def test_batch_expansion_uses_one_query_for_both_directions(self, board, create_user, django_assert_num_queries):
        rows = [{"id": board["blocked"].id}, {"id": board["blocker"].id}, {"id": board["blocked"].id}]
        with django_assert_num_queries(1):
            expand_issue_relations(rows, ["issue_relation", "issue_related"], create_user)
        assert rows[0]["issue_relation"][0]["id"] == board["blocker"].id
        assert rows[1]["issue_related"][0]["id"] == board["blocked"].id
        assert rows[2]["issue_relation"] == rows[0]["issue_relation"]

    def test_no_expansion_has_no_extra_queries(self, board, create_user, django_assert_num_queries):
        rows = [{"id": board["blocked"].id}]
        with django_assert_num_queries(0):
            expand_issue_relations(rows, None, create_user)
        assert "issue_relation" not in rows[0]

    def test_completed_blocker_retains_relation_and_reports_current_state(
        self, board, workspace, create_user, django_assert_num_queries
    ):
        done = State.objects.create(name="Accepted", group="completed", project=board["project"], workspace=workspace)
        Issue.objects.filter(pk=board["blocker"].id).update(state=done)
        rows = [{"id": board["blocked"].id}]
        with django_assert_num_queries(1):
            expand_issue_relations(rows, ["issue_relation"], create_user)
        assert rows[0]["issue_relation"][0]["state__group"] == "completed"
        assert rows[0]["issue_relation"][0]["state_id"] == done.id
        assert IssueRelation.objects.filter(pk=board["relation"].id).exists()

        Issue.objects.filter(pk=board["blocker"].id).update(state_id=board["blocked"].state_id)
        expand_issue_relations(rows, ["issue_relation"], create_user)
        assert rows[0]["issue_relation"][0]["state__group"] == "unstarted"

    def test_does_not_expose_a_blocker_from_an_inaccessible_project(self, board, workspace, create_user):
        private_project = Project.objects.create(name="Private", identifier="PRV", workspace=workspace)
        Issue.objects.filter(pk=board["blocker"].id).update(project=private_project)
        rows = [{"id": board["blocked"].id}]
        expand_issue_relations(rows, ["issue_relation"], create_user)
        assert rows[0]["issue_relation"] == []

    def test_restricted_guest_cannot_read_another_authors_blocker(self, board, create_user):
        board["membership"].role = 5
        board["membership"].save()
        rows = [{"id": board["blocked"].id}]
        expand_issue_relations(rows, ["issue_relation"], create_user)
        assert rows[0]["issue_relation"] == []

    def test_deleted_relations_are_not_counted(self, board, create_user):
        IssueRelation.objects.filter(pk=board["relation"].id).update(deleted_at=timezone.now())
        rows = [{"id": board["blocked"].id}]
        expand_issue_relations(rows, ["issue_relation"], create_user)
        assert rows[0]["issue_relation"] == []
