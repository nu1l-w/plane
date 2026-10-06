import hashlib
import hmac
import json
import tempfile
import threading
import unittest
import uuid
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError
from urllib.request import Request, ProxyHandler, build_opener

from app import Adapter, handler_for, message_text, robot_request, verify_signature, html_summary, change_summary


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = {
            "PLANE_WEBHOOK_SECRET": "test-secret",
            "PLANE_BASE_URL": "https://plane.example.com",
            "FEISHU_WEBHOOK_URL": "https://open.feishu.cn/open-apis/bot/v2/hook/test",
            "QUEUE_DB": str(Path(self.temp.name) / "queue.sqlite3"),
        }
        self.adapter = Adapter(self.env)
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.adapter.db.close)
        self.payload = {"event": "issue", "action": "update", "workspace_slug": "team", "data": {"id": "task-id", "project": "project-id", "name": "测试任务"}, "activity": None}

    def signature(self):
        return hmac.new(b"test-secret", json.dumps(self.payload).encode(), hashlib.sha256).hexdigest()

    def test_signature_matches_plane_unicode_serialization_and_rejects_tampering(self):
        signature = self.signature()
        self.assertTrue(verify_signature(self.payload, signature, "test-secret"))
        self.payload["action"] = "delete"
        self.assertFalse(verify_signature(self.payload, signature, "test-secret"))

    def test_message_links_and_deleted_fallback(self):
        text = message_text(self.payload, self.adapter.base_url)
        self.assertIn("测试任务", text)
        self.assertIn("星轴研发 · 任务通知", text)
        self.assertIn("操作：更新任务", text)
        self.assertIn("/team/projects/project-id/issues/task-id", text)
        self.payload["action"] = "delete"
        self.assertNotIn("/issues/", message_text(self.payload, self.adapter.base_url))

    def test_robot_signatures(self):
        _, body = robot_request("feishu", self.env["FEISHU_WEBHOOK_URL"], "secret", "hello", 100)
        self.assertEqual(body["timestamp"], "100")
        self.assertEqual(body["sign"], "KUnJ8wrVSlQE2kFHpc7kL1u/Kp43Y+UBQpRojlmoDyo=")
        url, body = robot_request("dingtalk", "https://oapi.dingtalk.com/robot/send?access_token=test", "secret", "hello", 100)
        self.assertIn("timestamp=100000", url)
        self.assertIn("sign=", url)
        self.assertEqual(body["msgtype"], "markdown")
        self.assertEqual(body["markdown"]["title"], "hello")

    def test_created_action_brand_and_markdown_link(self):
        self.payload["action"] = "created"
        self.payload["data"]["name"] = "任务 [链接](https://evil.example)\n下一行"
        text = message_text(self.payload, self.adapter.base_url, "星轴")
        self.assertIn("星轴 · 任务通知", text)
        self.assertIn("操作：创建任务", text)
        _, body = robot_request("dingtalk", "https://oapi.dingtalk.com/robot/send?access_token=test", "", text)
        self.assertIn("[查看任务](https://plane.example.com/team/projects/project-id/issues/task-id)", body["markdown"]["text"])
        self.assertIn(r"\[链接\]", body["markdown"]["text"])

    def test_queue_persists_and_deduplicates(self):
        delivery = str(uuid.uuid4())
        self.adapter.accept(self.payload, delivery)
        self.adapter.accept(self.payload, delivery)
        other = Adapter(self.env)
        try:
            self.assertEqual(other.stats(), {"pending": 1})
        finally:
            other.db.close()

    def test_task_details_and_state_change(self):
        self.payload['data']['project_name'] = 'iKF PC'
        self.payload['data'].update(sequence_id=42, state={'name': '进行中'}, priority='high', assignees=[{'display_name': '吴棋'}, {'first_name': '小明', 'last_name': ''}], target_date='2026-10-10', labels=[{'name': '后端'}])
        self.payload['activity'] = {'field': 'state', 'old_value': '待办', 'new_value': '进行中', 'actor': {'display_name': '吴棋'}}
        text = message_text(self.payload, self.adapter.base_url)
        self.assertIn('项目：iKF PC', text)
        for expected in ('名称：#42 测试任务', '状态：进行中', '优先级：P1', '负责人：吴棋、小明', '截止日期：2026-10-10', '标签：后端', '变更：状态：待办 → 进行中', '操作人：吴棋'):
            self.assertIn(expected, text)

    def test_priority_assignee_and_description_changes(self):
        self.assertEqual(change_summary({'field': 'priority', 'old_value': 'low', 'new_value': 'urgent'}), '优先级：P3 → P0')
        self.assertEqual(change_summary({'field': 'assignees', 'old_value': '', 'new_value': '吴棋'}), '添加负责人：吴棋')
        self.assertEqual(change_summary({'field': 'assignees', 'old_value': '吴棋', 'new_value': ''}), '移除负责人：吴棋')
        self.assertEqual(change_summary({'field': 'description', 'new_value': '<p>secret</p>'}), '更新了任务描述')

    def test_empty_task_values_and_deletion(self):
        self.payload['data'].update(priority=None, assignees=[])
        text = message_text(self.payload, self.adapter.base_url)
        self.assertIn('负责人：未分配', text)
        self.assertIn('优先级：未设置', text)
        self.payload['data']['priority'] = 'none'
        self.assertIn('优先级：P4', message_text(self.payload, self.adapter.base_url))
        self.payload.update(action='deleted', data={'id': 'deleted-uuid'})
        text = message_text(self.payload, self.adapter.base_url)
        self.assertIn('名称：已删除任务', text)
        self.assertNotIn('deleted-uuid', text)

    def test_comment_html_summary_and_cached_title(self):
        self.payload['data']['sequence_id'] = 7
        self.adapter.accept(self.payload, str(uuid.uuid4()))
        comment = {**self.payload, 'event': 'issue_comment', 'action': 'created', 'data': {'id': 'comment-id', 'issue': 'task-id', 'project': 'project-id', 'comment_html': '<p>已修复 &amp; 验证</p><script>hidden()</script><p>请确认</p>'}}
        self.adapter.accept(comment, str(uuid.uuid4()))
        text = self.adapter.db.execute('SELECT text FROM jobs ORDER BY due DESC LIMIT 1').fetchone()[0]
        self.assertIn('名称：#7 测试任务', text)
        self.assertIn('评论：已修复 & 验证 请确认', text)
        self.assertNotIn('hidden()', text)
        self.assertIn('/issues/task-id', text)
        self.assertEqual(len(html_summary('<p>' + '长' * 400 + '</p>')), 301)
        comment['data']['issue'] = 'unknown-task'
        self.assertIn('名称：任务评论', message_text(comment, self.adapter.base_url))

    def test_event_and_project_filters(self):
        self.adapter.projects = {"another-project"}
        self.assertEqual(self.adapter.accept(self.payload, str(uuid.uuid4())), 0)
        self.adapter.projects.clear()
        self.payload["event"] = "project"
        self.assertEqual(self.adapter.accept(self.payload, str(uuid.uuid4())), 0)
        self.assertEqual(self.adapter.stats(), {})

    def routed_adapter(self, projects, all_projects=None):
        path = Path(self.temp.name) / 'routes.json'
        path.write_text(json.dumps({'projects': projects, 'all_projects': [] if all_projects is None else all_projects}))
        adapter = Adapter({**self.env, 'ROUTES_FILE': str(path)})
        self.addCleanup(adapter.db.close)
        return adapter

    def test_routes_isolate_projects_and_skip_unknown(self):
        first, second = str(uuid.uuid4()), str(uuid.uuid4())
        targets = [{'platform': 'dingtalk', 'webhook_url': 'https://oapi.dingtalk.com/robot/send?access_token=first'}, {'platform': 'feishu', 'webhook_url': self.env['FEISHU_WEBHOOK_URL']}]
        adapter = self.routed_adapter({first: targets, second: [dict(targets[0], webhook_url='https://oapi.dingtalk.com/robot/send?access_token=second')]})
        self.payload['data']['project'] = first
        delivery = str(uuid.uuid4())
        self.assertEqual(adapter.accept(self.payload, delivery), 2)
        adapter.accept(self.payload, delivery)
        self.assertEqual(adapter.stats(), {'pending': 2})
        queued = [row[0] for row in adapter.db.execute('SELECT channel FROM jobs')]
        self.assertTrue(any(key.startswith('dingtalk:') for key in queued))
        self.assertTrue(any(key.startswith('feishu:') for key in queued))
        self.assertNotIn('feishu', queued)
        self.payload['data']['project'] = {'id': second}
        self.assertEqual(adapter.accept(self.payload, str(uuid.uuid4())), 1)
        self.payload['data']['project'] = str(uuid.uuid4())
        self.assertEqual(adapter.accept(self.payload, str(uuid.uuid4())), 0)
        self.payload.update(action='deleted', data={'id': 'task-id'})
        self.assertEqual(adapter.accept(self.payload, str(uuid.uuid4())), 0)

    def test_all_projects_fanout_and_deduplication(self):
        project = str(uuid.uuid4())
        global_target = {'platform': 'dingtalk', 'webhook_url': 'https://oapi.dingtalk.com/robot/send?access_token=global'}
        dedicated = dict(global_target, webhook_url='https://oapi.dingtalk.com/robot/send?access_token=dedicated')
        adapter = self.routed_adapter({project: [global_target, dedicated]}, [global_target, global_target])
        self.payload['data']['project'] = project
        self.assertEqual(adapter.accept(self.payload, str(uuid.uuid4())), 2)
        self.payload['data']['project'] = str(uuid.uuid4())
        self.assertEqual(adapter.accept(self.payload, str(uuid.uuid4())), 1)
        self.payload.update(action='deleted', data={'id': 'task-id'})
        self.assertEqual(adapter.accept(self.payload, str(uuid.uuid4())), 1)
        with self.assertRaises(ValueError):
            self.routed_adapter({}, {'invalid': 'not-an-array'})

    def test_routed_delivery_uses_platform_and_keeps_destination_identity(self):
        project = str(uuid.uuid4())
        target = {'platform': 'dingtalk', 'webhook_url': 'https://oapi.dingtalk.com/robot/send?access_token=first'}
        adapter = self.routed_adapter({project: [target, target]})
        self.payload['data']['project'] = project
        self.assertEqual(adapter.accept(self.payload, str(uuid.uuid4())), 1)
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"errcode":0}'
        with patch('app.send_request', return_value=response) as send:
            adapter.process_once()
        self.assertEqual(json.loads(send.call_args[0][0].data)['msgtype'], 'markdown')
        self.assertEqual(adapter.stats(), {'sent': 1})
        adapter.accept(self.payload, str(uuid.uuid4()))
        changed = self.routed_adapter({project: [dict(target, webhook_url='https://oapi.dingtalk.com/robot/send?access_token=new')]})
        with patch('app.send_request') as send:
            changed.process_once()
            send.assert_not_called()

    def test_invalid_route_configuration_fails_closed(self):
        project = str(uuid.uuid4())
        for projects in ({'not-a-uuid': []}, {project: {}}, {project: [{'platform': 'dingtalk', 'webhook_url': 'https://evil.example'}]}):
            with self.assertRaises(ValueError):
                self.routed_adapter(projects)
        with self.assertRaises(ValueError):
            Adapter({**self.env, 'ROUTES_FILE': str(Path(self.temp.name) / 'missing.json')})

    def test_reject_invalid_actor(self):
        self.payload["activity"] = {"actor": "invalid"}
        with self.assertRaises(ValueError):
            self.adapter.accept(self.payload, str(uuid.uuid4()))

    def test_channel_success_and_failure_are_independent(self):
        self.adapter.channels["dingtalk"] = ("https://oapi.dingtalk.com/robot/send?access_token=test", "")
        self.adapter.accept(self.payload, str(uuid.uuid4()))
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"code":0}'
        with patch("app.send_request", return_value=response):
            self.adapter.process_once()
        response.__enter__.return_value.read.return_value = b'{"errcode":310000}'
        with patch("app.send_request", return_value=response):
            self.adapter.process_once()
        self.assertEqual(self.adapter.stats(), {"sent": 1, "pending": 1})
        with self.adapter.db:
            self.adapter.db.execute("UPDATE jobs SET due = 0, attempts = 7 WHERE status = 'pending'")
        with patch("app.send_request", side_effect=TimeoutError):
            self.adapter.process_once()
        self.assertEqual(self.adapter.stats(), {"sent": 1, "failed": 1})

    def test_invalid_url_and_missing_credentials(self):
        for update in ({"PLANE_WEBHOOK_SECRET": ""}, {"FEISHU_WEBHOOK_URL": "https://example.com/hook"}, {"FEISHU_WEBHOOK_URL": ""}):
            with self.assertRaises(ValueError):
                Adapter({**self.env, **update})

    def test_http_authentication_and_acceptance(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_for(self.adapter))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            # Local integration traffic must not use system HTTP proxies.
            opener = build_opener(ProxyHandler({}))
            url = f"http://127.0.0.1:{server.server_port}/webhooks/plane"
            headers = {"Content-Type": "application/json", "X-Plane-Delivery": str(uuid.uuid4())}
            request = Request(url, json.dumps(self.payload, ensure_ascii=False).encode(), headers=headers)
            with self.assertRaises(HTTPError) as error:
                opener.open(request, timeout=3)
            self.assertEqual(error.exception.code, 401)
            request.add_header("X-Plane-Signature", self.signature())
            with opener.open(request, timeout=3) as response:
                self.assertEqual(response.status, 202)
            self.assertEqual(self.adapter.stats(), {"pending": 1})
            with opener.open(request, timeout=3) as response:
                self.assertEqual(response.status, 202)
            self.assertEqual(self.adapter.stats(), {"pending": 1})
            request.add_header("X-Plane-Delivery", "invalid")
            with self.assertRaises(HTTPError) as error:
                opener.open(request, timeout=3)
            self.assertEqual(error.exception.code, 400)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
