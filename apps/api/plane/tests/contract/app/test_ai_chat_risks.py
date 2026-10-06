from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from plane.db.models import Issue, IssueAssignee, IssueRelation, Project, ProjectMember, State, WorkspaceMember


@pytest.mark.contract
@pytest.mark.django_db
class TestAIChatRisks:
    @pytest.mark.parametrize("needs_retrieval", [True, False])
    def test_stream_reports_actual_phases(self, session_client, workspace, create_user, retrieval_intent, needs_retrieval):
        import json

        self.setup_scope(workspace, create_user)
        retrieval_intent.return_value = ({"needs_retrieval": needs_retrieval, "response": "你好"}, None, None)
        with patch("plane.app.views.external.ai_chat.get_llm_response", return_value=("回答", None, None)):
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/ai-chat/",
                {"message": "你好" if not needs_retrieval else "总结项目", "stream": True, "retrieval_mode": "all"},
                format="json",
            )
            events = [json.loads(line) for line in b"".join(response.streaming_content).splitlines()]
        phases = [event["phase"] for event in events if "phase" in event]
        assert phases == (["understanding", "retrieving", "generating"] if needs_retrieval else ["understanding"])
        assert events[-1]["status"] == 200
        assert events[-1]["result"]["response"] == ("回答" if needs_retrieval else "你好")

    @pytest.fixture(autouse=True)
    def retrieval_intent(self):
        with (
            patch(
                "plane.app.views.external.ai_chat._get_chat_intent",
                return_value=({"needs_retrieval": True, "response": ""}, None, None),
            ) as intent,
            patch("plane.app.views.external.ai_chat.get_llm_config", return_value=("key", "model", "provider")),
        ):
            yield intent

    def test_greeting_still_validates_project_access(self, session_client, workspace, create_user):
        self.setup_scope(workspace, create_user)
        hidden = Project.objects.create(name="Hidden", identifier="HID", workspace=workspace)
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/ai-chat/",
            {"message": "你好", "project_id": str(hidden.id)},
            format="json",
        )
        assert response.status_code == 404

    @pytest.mark.parametrize("mode", ["smart", "all"])
    def test_greeting_skips_workspace_retrieval(
        self, session_client, workspace, create_user, mode, retrieval_intent
    ):
        project = self.setup_scope(workspace, create_user)
        Issue.objects.create(name="Unrelated task", project=project)
        retrieval_intent.return_value = ({"needs_retrieval": False, "response": "你好，我是星轴 AI 助手。"}, None, None)
        with (
            patch("plane.app.views.external.ai_chat.get_issue_risks") as risks,
            patch("plane.app.views.external.ai_chat._get_issue_search_plan") as plan,
            patch("plane.app.views.external.ai_chat.get_llm_response") as llm,
            patch("plane.app.views.external.ai_chat.Issue.issue_objects.filter") as issues,
            patch("plane.app.views.external.ai_chat.Page.objects.filter") as pages,
        ):
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/ai-chat/",
                {"message": "你好", "retrieval_mode": mode, "project_id": str(project.id)},
                format="json",
            )
        assert response.status_code == 200
        assert response.data["sources"] == []
        assert "retrieval" not in response.data
        assert "你好" in response.data["response"]
        for mock in (risks, plan, llm, issues, pages):
            mock.assert_not_called()

    def setup_scope(self, workspace, user):
        WorkspaceMember.objects.filter(workspace=workspace, member=user).update(role=15)
        project = Project.objects.create(name="Visible", identifier="VIS", workspace=workspace)
        ProjectMember.objects.create(project=project, workspace=workspace, member=user, role=20)
        return project

    def test_blocked_full_count_and_cross_project_prerequisites(self, session_client, workspace, create_user):
        project = self.setup_scope(workspace, create_user)
        upstream = Project.objects.create(name="Upstream", identifier="UPS", workspace=workspace)
        ProjectMember.objects.create(project=upstream, workspace=workspace, member=create_user, role=20)
        hidden = Project.objects.create(name="Hidden", identifier="HID", workspace=workspace)
        blocker = Issue.objects.create(name="Real prerequisite", project=upstream)
        secret = Issue.objects.create(name="Secret prerequisite", project=hidden)
        for index in range(15):
            issue = Issue.objects.create(name=f"Blocked {index}", project=project)
            IssueAssignee.objects.create(issue=issue, project=project, assignee=create_user)
            IssueRelation.objects.create(
                issue=issue, related_issue=blocker, project=project, relation_type="blocked_by"
            )
        other = Issue.objects.create(name="Hidden relation", project=project)
        IssueRelation.objects.create(issue=other, related_issue=secret, project=project, relation_type="blocked_by")
        with patch("plane.app.views.external.ai_chat.get_llm_response") as llm:
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/ai-chat/",
                {"message": "我的被阻塞任务有几个", "project_id": str(project.id)},
                format="json",
            )
        assert response.status_code == 200
        assert response.data["total"] == 15
        assert "共 15 个" in response.data["response"]
        assert "12 个" in response.data["response"]
        assert len(response.data["sources"]) == 12
        assert "Real prerequisite" in response.data["response"]
        assert "Secret prerequisite" not in response.data["response"]
        assert "优先级：P4" in response.data["sources"][0]["snippet"]
        llm.assert_not_called()
        dashboard = session_client.get(
            f"/api/workspaces/{workspace.slug}/dashboard-overview/", {"project_id": str(project.id), "risk": "blocked"}
        )
        assert dashboard.data["summary"]["blocked"] == response.data["total"]
        closed = State.objects.create(name="Done", group="completed", color="#aaa", project=upstream)
        Issue.objects.filter(id=blocker.id).update(state=closed)
        released = session_client.post(
            f"/api/workspaces/{workspace.slug}/ai-chat/",
            {"message": "被阻塞有几个", "project_id": str(project.id)},
            format="json",
        )
        assert released.data["total"] == 0
        assert released.data["sources"] == []

    @pytest.mark.parametrize(
        "message,risk",
        [
            ("逾期有几个", "overdue"),
            ("未来7天到期有哪些", "due_soon"),
            ("14天未更新任务数量", "stale"),
            ("高优先级未分配有几个", "high_priority_unassigned"),
            ("How many overdue tasks?", "overdue"),
        ],
    )
    def test_risk_queries_match_dashboard(self, session_client, workspace, create_user, message, risk):
        project = self.setup_scope(workspace, create_user)
        today = timezone.localdate()
        overdue = Issue.objects.create(
            name="Late", project=project, priority="high", target_date=today - timedelta(days=1)
        )
        Issue.objects.create(name="Soon", project=project, target_date=today + timedelta(days=2))
        Issue.objects.filter(id=overdue.id).update(updated_at=timezone.now() - timedelta(days=20))
        done = State.objects.create(name="Done", group="completed", color="#aaa", project=project)
        Issue.objects.create(
            name="Closed late", project=project, state=done, priority="urgent", target_date=today - timedelta(days=1)
        )
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/ai-chat/", {"message": message}, format="json"
        )
        assert response.status_code == 200
        dashboard = session_client.get(f"/api/workspaces/{workspace.slug}/dashboard-overview/", {"risk": risk})
        assert response.data["total"] == dashboard.data["risk_total"] == 1
        assert "Closed late" not in response.data["response"]
        if message.startswith("How"):
            assert "work items: 1" in response.data["response"]

    def test_structured_count_is_complete_not_a_twelve_item_sample(self, session_client, workspace, create_user):
        project = self.setup_scope(workspace, create_user)
        for index in range(15):
            Issue.objects.create(name=f"Urgent {index}", project=project, priority="urgent")
        plan = {"assignee": "any", "creator": "any", "status": "any", "priority": "urgent", "terms": []}
        with (
            patch("plane.app.views.external.ai_chat.get_llm_config", return_value=("key", "model", "provider")),
            patch("plane.app.views.external.ai_chat._get_issue_search_plan", return_value=plan),
            patch("plane.app.views.external.ai_chat.get_llm_response") as llm,
        ):
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/ai-chat/", {"message": "P0有多少个"}, format="json"
            )
        assert response.status_code == 200
        assert response.data["total"] == 15
        assert len(response.data["sources"]) == 12
        llm.assert_not_called()

    def test_risk_breakdown_keeps_categories_separate(self, session_client, workspace, create_user):
        project = self.setup_scope(workspace, create_user)
        overdue = Issue.objects.create(
            name="Late", project=project, target_date=timezone.localdate() - timedelta(days=1)
        )
        blocker = Issue.objects.create(name="Prerequisite", project=project)
        IssueRelation.objects.create(issue=overdue, related_issue=blocker, project=project, relation_type="blocked_by")
        Issue.objects.create(name="Only overdue", project=project, target_date=timezone.localdate() - timedelta(days=1))
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/ai-chat/", {"message": "逾期和被阻塞分别有几个"}, format="json"
        )
        assert response.data["statistics"] == {"blocked": 1, "overdue": 2}
        overview = session_client.post(
            f"/api/workspaces/{workspace.slug}/ai-chat/", {"message": "风险概览"}, format="json"
        )
        assert overview.status_code == 200
        dashboard = session_client.get(f"/api/workspaces/{workspace.slug}/dashboard-overview/")
        for risk, count in overview.data["statistics"].items():
            assert count == dashboard.data["summary"][risk]

    def test_model_paraphrase_uses_validated_risk_plan_and_never_guesses_count(
        self, session_client, workspace, create_user
    ):
        import json

        project = self.setup_scope(workspace, create_user)
        issue = Issue.objects.create(name="Stuck", project=project)
        blocker = Issue.objects.create(name="Prerequisite", project=project)
        IssueRelation.objects.create(issue=issue, related_issue=blocker, project=project, relation_type="blocked_by")
        plan = {
            "assignee": "any",
            "creator": "any",
            "status": "any",
            "priority": "any",
            "terms": [],
            "risks": ["blocked"],
        }
        with (
            patch("plane.app.views.external.ai_chat.get_llm_config", return_value=("key", "model", "provider")),
            patch(
                "plane.app.views.external.ai_chat.get_llm_response", return_value=(json.dumps(plan), None, None)
            ) as llm,
        ):
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/ai-chat/", {"message": "哪些任务在等待前置工作完成"}, format="json"
            )
        assert response.status_code == 200
        assert response.data["total"] == 1
        assert "Prerequisite" in response.data["response"]
        assert llm.call_count == 1

    def test_risk_priority_token_is_a_filter_not_a_title_keyword(self, session_client, workspace, create_user):
        project = self.setup_scope(workspace, create_user)
        for priority in ["urgent", "high"]:
            Issue.objects.create(
                name="Late task",
                project=project,
                priority=priority,
                target_date=timezone.localdate() - timedelta(days=1),
            )
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/ai-chat/", {"message": "逾期的P0任务有几个"}, format="json"
        )
        assert response.status_code == 200
        assert response.data["total"] == 1
        assert "优先级：P0" in response.data["response"]

    @pytest.mark.parametrize("risks", [["unknown_risk"], "blocked", [123]])
    def test_invalid_model_risk_conditions_are_rejected(self, risks):
        import json
        from plane.app.views.external.ai_chat import _get_issue_search_plan

        plan = {"assignee": "any", "creator": "any", "status": "any", "priority": "any", "terms": [], "risks": risks}
        with patch("plane.app.views.external.ai_chat.get_llm_response", return_value=(json.dumps(plan), None, None)):
            assert _get_issue_search_plan("查任务", "key", "model", "provider") is None

    def test_chat_and_search_plan_receive_current_user_local_time(self, session_client, workspace, create_user):
        from datetime import datetime, timezone as datetime_timezone
        import json

        self.setup_scope(workspace, create_user)
        plan = {"assignee": "any", "creator": "any", "status": "any", "priority": "any", "terms": [], "risks": []}
        fixed_time = datetime(2026, 10, 6, 20, 30, tzinfo=datetime_timezone.utc)
        with (
            patch("plane.app.views.external.ai_chat.timezone.now", return_value=fixed_time),
            patch("plane.app.views.external.ai_chat.get_llm_config", return_value=("key", "model", "provider")),
            patch(
                "plane.app.views.external.ai_chat.get_llm_response",
                side_effect=[(json.dumps(plan), None, None), ("时间已提供", None, None)],
            ) as llm,
        ):
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/ai-chat/",
                {"message": "下周要干什么", "history": [{"role": "assistant", "content": "今天是2026-10-01"}]},
                format="json",
            )
        assert response.status_code == 200
        assert llm.call_count == 2
        for call in llm.call_args_list:
            task = call.args[0]
            assert "2026-10-07（星期三）" in task
            assert "04:30:00 +0800" in task
            assert "Asia/Shanghai" in task
            assert "不要根据历史对话推测" in task

    def test_all_mode_reads_scope_beyond_twelve_without_keyword_loss(self, session_client, workspace, create_user):
        project = self.setup_scope(workspace, create_user)
        for index in range(15):
            Issue.objects.create(name=f"Task {index}", project=project)
        hidden = Project.objects.create(name="Hidden", identifier="HID", workspace=workspace)
        Issue.objects.create(name="Secret", project=hidden)
        with (
            patch("plane.app.views.external.ai_chat.get_llm_config", return_value=("key", "model", "provider")),
            patch("plane.app.views.external.ai_chat.get_llm_response", return_value=("回答", None, None)) as llm,
        ):
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/ai-chat/",
                {"message": "换个问法，下周要做什么", "retrieval_mode": "all"},
                format="json",
            )
        assert response.status_code == 200
        assert response.data["retrieval"] == {"mode": "all", "matched": 15, "read": 15}
        assert len(response.data["sources"]) == 15
        assert llm.call_count == 1
        assert "Task 0" in llm.call_args.args[1]
        assert "Task 14" in llm.call_args.args[1]
        assert "Secret" not in llm.call_args.args[1]

    def test_all_mode_rejects_overflow_without_partial_answer(self, session_client, workspace, create_user):
        project = self.setup_scope(workspace, create_user)
        for index in range(3):
            Issue.objects.create(name=f"Task {index}", project=project)
        with (
            patch("plane.app.views.external.ai_chat.MAX_ALL_CONTEXT_ISSUES", 2),
            patch("plane.app.views.external.ai_chat.get_llm_config", return_value=("key", "model", "provider")),
            patch("plane.app.views.external.ai_chat.get_llm_response") as llm,
        ):
            response = session_client.post(
                f"/api/workspaces/{workspace.slug}/ai-chat/",
                {"message": "总结", "retrieval_mode": "all"},
                format="json",
            )
        assert response.status_code == 400
        assert "3" in response.data["error"]
        llm.assert_not_called()


@pytest.mark.contract
@pytest.mark.django_db
@pytest.mark.parametrize("message", ["你好", "给我讲个笑话", "你是谁"])
def test_model_direct_answer_does_not_read_workspace(session_client, workspace, message):
    import json

    result = {"needs_retrieval": False, "response": "我是星轴 AI 助手。"}
    with (
        patch("plane.app.views.external.ai_chat.get_llm_config", return_value=("key", "model", "provider")),
        patch("plane.app.views.external.ai_chat.get_llm_response", return_value=(json.dumps(result), None, None)) as llm,
        patch("plane.app.views.external.ai_chat.Issue.issue_objects.filter") as issues,
        patch("plane.app.views.external.ai_chat.Page.objects.filter") as pages,
    ):
        response = session_client.post(
            f"/api/workspaces/{workspace.slug}/ai-chat/", {"message": message}, format="json"
        )
    assert response.status_code == 200
    assert response.data == {"response": result["response"], "sources": []}
    assert llm.call_count == 1
    issues.assert_not_called()
    pages.assert_not_called()
