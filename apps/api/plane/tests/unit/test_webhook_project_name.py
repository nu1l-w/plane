from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

from plane.bgtasks import webhook_task


class WebhookProjectNameTests(unittest.TestCase):
    def test_comment_includes_project_name_and_preserves_id(self):
        model = MagicMock()
        model.objects.get.return_value = SimpleNamespace(project=SimpleNamespace(name="iKF PC"))
        serializer = MagicMock()
        serializer.return_value.data = {"project": "project-id", "comment_html": "test"}
        with patch.dict(webhook_task.MODEL_MAPPER, {"issue_comment": model}), patch.dict(webhook_task.SERIALIZER_MAPPER, {"issue_comment": serializer}):
            result = webhook_task.get_model_data("issue_comment", "comment-id")
        self.assertEqual(result["project_name"], "iKF PC")
        self.assertEqual(result["project"], "project-id")

    def test_bulk_events_use_each_objects_project(self):
        model = MagicMock()
        model.objects.filter.return_value = [SimpleNamespace(project_id="a"), SimpleNamespace(project_id="b")]
        serializer = MagicMock()
        serializer.return_value.data = [{"project": "a"}, {"project": "b"}]
        with patch.dict(webhook_task.MODEL_MAPPER, {"cycle": model}), patch.dict(webhook_task.SERIALIZER_MAPPER, {"cycle": serializer}), patch.object(webhook_task.Project, "objects") as projects:
            projects.filter.return_value.values_list.return_value = [("a", "项目A"), ("b", "项目B")]
            result = webhook_task.get_model_data("cycle", ["one", "two"], many=True)
        self.assertEqual([item["project_name"] for item in result], ["项目A", "项目B"])
