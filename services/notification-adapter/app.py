"""Plane webhook to Feishu / DingTalk adapter, using only Python's standard library."""

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import sqlite3
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Tuple
from urllib.parse import urlencode, urlparse, quote, parse_qs
from urllib.request import Request, HTTPRedirectHandler, build_opener

logger = logging.getLogger("notification-adapter")
MAX_BODY = 1024 * 1024
PRIORITIES = {"urgent": "P0", "high": "P1", "medium": "P2", "low": "P3", "none": "P4"}


def clean_text(value: Any, limit: int = 300) -> str:
    return " ".join(str(value or "").split())[:limit]


class PlainHTML(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        if tag in ("script", "style"):
            self.hidden += 1
        if tag in ("br", "p", "div", "li"):
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)
        if tag in ("p", "div", "li"):
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self.hidden:
            self.parts.append(data)


def html_summary(value: Any) -> str:
    parser = PlainHTML()
    parser.feed(str(value or ""))
    text = " ".join("".join(parser.parts).split())
    return text[:300] + ("…" if len(text) > 300 else "")


def user_name(user: Any) -> str:
    if not isinstance(user, dict):
        return ""
    return clean_text(user.get("display_name") or " ".join(filter(None, (user.get("first_name"), user.get("last_name")))))


def change_summary(activity: Dict[str, Any]) -> str:
    field = activity.get("field")
    old, new = activity.get("old_value"), activity.get("new_value")
    if field == "description":
        return "更新了任务描述"
    if field in ("assignees", "labels"):
        label = "负责人" if field == "assignees" else "标签"
        if new and not old:
            return f"添加{label}：{clean_text(new)}"
        if old and not new:
            return f"移除{label}：{clean_text(old)}"
    labels = {"state": "状态", "priority": "优先级", "name": "名称", "target_date": "截止日期", "start_date": "开始日期", "assignees": "负责人", "labels": "标签", "parent": "父任务", "cycles": "迭代", "modules": "模块"}
    if field not in labels or old == new:
        return ""
    def display(value: Any) -> str:
        if field == "priority":
            return PRIORITIES.get(str(value), clean_text(value)) if value else "未设置"
        return clean_text(value) or "未设置"
    return f"{labels[field]}：{display(old)} → {display(new)}"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> None:
        # Robot credentials must never be forwarded to a redirect destination.
        return None


def send_request(request: Request) -> Any:
    return build_opener(NoRedirect()).open(request, timeout=10)


def verify_signature(payload: Dict[str, Any], signature: str, secret: str) -> bool:
    # Plane signs json.dumps(payload), rather than the HTTP body's raw bytes.
    expected = hmac.new(secret.encode(), json.dumps(payload).encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def message_text(payload: Dict[str, Any], base_url: str, brand: str = "星轴研发") -> str:
    data = payload.get("data") or {}
    activity = payload.get("activity") or {}
    actor = activity.get("actor") or {}
    event = payload["event"]
    action = {"create": "创建", "created": "创建", "update": "更新", "updated": "更新", "delete": "删除", "deleted": "删除"}.get(payload["action"], payload["action"])
    event_name = {"issue": "任务", "issue_comment": "评论", "project": "项目", "module": "模块", "cycle": "迭代", "cycle_issue": "迭代任务", "module_issue": "模块任务"}.get(event, event)
    title = data.get("name") or ("任务评论" if event == "issue_comment" else "已删除任务" if event == "issue" and action == "删除" else "任务" if event == "issue" else event_name)
    sequence = data.get("sequence_id")
    prefix = f"#{sequence} " if sequence is not None else ""
    lines = [f"{clean_text(brand)} · {event_name}通知", f"操作：{action}{event_name}", f"名称：{prefix}{clean_text(title, 500)}"]
    project_name = data.get("project_name")
    if not project_name and isinstance(data.get("project"), dict):
        project_name = data["project"].get("name")
    if project_name:
        lines.insert(1, f"项目：{clean_text(project_name)}")
    if event == "issue" and action != "删除":
        state = data.get("state")
        if isinstance(state, dict) and state.get("name"):
            lines.append(f"状态：{clean_text(state['name'])}")
        if "priority" in data:
            lines.append(f"优先级：{PRIORITIES.get(str(data.get('priority')), '未设置')}")
        if isinstance(data.get("assignees"), list):
            names = [user_name(user) for user in data['assignees'] if user_name(user)]
            lines.append(f"负责人：{'、'.join(names) if names else '未分配'}")
        for key, label in (("start_date", "开始日期"), ("target_date", "截止日期")):
            if data.get(key):
                lines.append(f"{label}：{clean_text(data[key])}")
        labels = data.get("labels")
        if isinstance(labels, list):
            names = [clean_text(label['name']) for label in labels if isinstance(label, dict) and label.get('name')]
            if names:
                lines.append(f"标签：{'、'.join(names)}")
    change = change_summary(activity) if action == "更新" and event == "issue" else ""
    if change:
        lines.append(f"变更：{change}")
    if event == "issue_comment" and action != "删除":
        summary = html_summary(data.get("comment_html"))
        if summary:
            lines.append(f"评论：{summary}")
    if user_name(actor):
        lines.append(f"操作人：{user_name(actor)}")
    workspace = quote(payload["workspace_slug"], safe="")
    project = data.get("project")
    if isinstance(project, dict):
        project = project.get("id")
    issue_id = data.get("id") if event == "issue" else data.get("issue") if event == "issue_comment" else None
    if isinstance(issue_id, dict):
        issue_id = issue_id.get("id")
    if project and issue_id and payload["action"] not in ("delete", "deleted"):
        link = f"{base_url}/{workspace}/projects/{quote(str(project), safe='')}/issues/{quote(str(issue_id), safe='')}"
    else:
        link = f"{base_url}/{workspace}/"
    lines.append(link)
    return "\n".join(lines)


def robot_request(channel: str, url: str, secret: str, text: str, now: Optional[int] = None) -> Tuple[str, Dict[str, Any]]:
    timestamp = int(time.time()) if now is None else now
    if channel == "feishu":
        body: Dict[str, Any] = {"msg_type": "text", "content": {"text": text}}
        if secret:
            key = f"{timestamp}\n{secret}".encode()
            body.update(timestamp=str(timestamp), sign=base64.b64encode(hmac.new(key, b"", hashlib.sha256).digest()).decode())
        return url, body
    lines = text.splitlines()
    def escape_markdown(value: str) -> str:
        return re.sub(r"([\\`*_{}\[\]()<>#!|])", r"\\\1", value)
    heading = lines[0] if lines else "星轴研发"
    content = [f"### {escape_markdown(heading)}"]
    for line in lines[1:]:
        if line.startswith(("http://", "https://")):
            label = "查看任务" if "/issues/" in line else "打开工作空间"
            content.append(f"[{label}]({line.replace('(', '%28').replace(')', '%29')})")
        else:
            content.append(escape_markdown(line))
    body = {"msgtype": "markdown", "markdown": {"title": heading, "text": "\n\n".join(content)}}
    if secret:
        milliseconds = timestamp * 1000
        sign = base64.b64encode(hmac.new(secret.encode(), f"{milliseconds}\n{secret}".encode(), hashlib.sha256).digest()).decode()
        url += "&" + urlencode({"timestamp": milliseconds, "sign": sign})
    return url, body


def validate_robot_url(channel: str, url: str) -> None:
    hosts = {"feishu": ("open.feishu.cn", "/open-apis/bot/v2/hook/"), "dingtalk": ("oapi.dingtalk.com", "/robot/send")}
    if channel not in hosts or not isinstance(url, str):
        raise ValueError("Invalid robot platform or URL")
    host, prefix = hosts[channel]
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != host or not parsed.path.startswith(prefix) or parsed.username or parsed.port not in (None, 443) or parsed.fragment:
        raise ValueError(f"Invalid {channel} robot URL")
    if channel == "dingtalk" and (parsed.path != prefix or not parse_qs(parsed.query).get("access_token")):
        raise ValueError("DingTalk robot URL requires access_token")


class Adapter:
    def __init__(self, env: Mapping[str, str]) -> None:
        self.secret = env.get("PLANE_WEBHOOK_SECRET", "")
        self.base_url = env.get("PLANE_BASE_URL", "").rstrip("/")
        self.brand = env.get("NOTIFICATION_BRAND", "星轴研发").strip() or "星轴研发"
        if not self.secret or urlparse(self.base_url).scheme not in ("http", "https") or not urlparse(self.base_url).hostname:
            raise ValueError("PLANE_WEBHOOK_SECRET and a valid PLANE_BASE_URL are required")
        self.events = {value.strip() for value in env.get("PLANE_EVENTS", "issue,issue_comment").split(",") if value.strip()}
        self.projects = {value.strip() for value in env.get("PLANE_PROJECT_IDS", "").split(",") if value.strip()}
        self.channels: Dict[str, Tuple[str, str]] = {}
        for channel, host, prefix in (("feishu", "open.feishu.cn", "/open-apis/bot/v2/hook/"), ("dingtalk", "oapi.dingtalk.com", "/robot/send")):
            url = env.get(f"{channel.upper()}_WEBHOOK_URL", "")
            if not url:
                continue
            validate_robot_url(channel, url)
            self.channels[channel] = (url, env.get(f"{channel.upper()}_SIGN_SECRET", ""))
        self.routes: Optional[Dict[str, list]] = None
        self.global_targets: list = []
        routes_path = Path(env.get("ROUTES_FILE", "/app/config/routes.json"))
        if routes_path.is_file():
            configuration = json.loads(routes_path.read_text())
            projects = configuration.get("projects") if isinstance(configuration, dict) else None
            if not isinstance(projects, dict):
                raise ValueError("Routes must contain a projects object")
            self.routes = {}
            entries = [(None, configuration.get("all_projects", []))] + list(projects.items())
            for project_id, targets in entries:
                if project_id is not None:
                    try:
                        project_id = str(uuid.UUID(project_id))
                    except ValueError:
                        raise ValueError("Route project keys must be UUIDs") from None
                if not isinstance(targets, list):
                    raise ValueError("Route targets must be arrays")
                destinations = []
                if project_id is None:
                    self.global_targets = destinations
                else:
                    self.routes[project_id] = destinations
                for target in targets:
                    if not isinstance(target, dict):
                        raise ValueError("Invalid route target")
                    channel = target.get("platform")
                    url = target.get("webhook_url")
                    secret = target.get("sign_secret", "")
                    if not isinstance(secret, str):
                        raise ValueError("Invalid route signing secret")
                    validate_robot_url(channel, url)
                    # Stable per destination, independent of list position. A
                    # changed URL never redirects an already queued notification.
                    key = channel + ":" + hashlib.sha256(url.encode()).hexdigest()
                    if key in self.channels and self.channels[key] != (url, secret):
                        raise ValueError("Conflicting secrets for the same destination")
                    self.channels[key] = (url, secret)
                    if key not in destinations:
                        destinations.append(key)
        elif env.get("ROUTES_FILE"):
            raise ValueError("Configured ROUTES_FILE does not exist")
        if not self.channels and self.routes is None:
            raise ValueError("Configure at least one robot URL")
        path = env.get("QUEUE_DB", "data/queue.sqlite3")
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.lock = threading.Lock()
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("CREATE TABLE IF NOT EXISTS jobs (delivery TEXT, channel TEXT, text TEXT, attempts INTEGER DEFAULT 0, due REAL, status TEXT DEFAULT 'pending', PRIMARY KEY(delivery, channel))")
        self.db.execute("CREATE TABLE IF NOT EXISTS issue_titles (workspace TEXT, issue TEXT, name TEXT, sequence INTEGER, updated REAL, PRIMARY KEY(workspace, issue))")
        self.db.commit()

    def accept(self, payload: Dict[str, Any], delivery: str) -> int:
        if not all(isinstance(payload.get(key), str) and payload[key] for key in ("event", "action", "workspace_slug")):
            raise ValueError("Invalid event envelope")
        if not isinstance(payload.get("data"), (dict, type(None))) or not isinstance(payload.get("activity"), (dict, type(None))):
            raise ValueError("Invalid event data")
        activity = payload.get("activity") or {}
        if not isinstance(activity.get("actor"), (dict, type(None))):
            raise ValueError("Invalid actor")
        if payload["event"] not in self.events:
            return 0
        data = payload.get("data") or {}
        project = data.get("project")
        if isinstance(project, dict):
            project = project.get("id")
        if payload["event"] == "project":
            project = data.get("id")
        if self.projects and str(project) not in self.projects:
            return 0
        targets = list(dict.fromkeys(self.global_targets + self.routes.get(str(project).lower(), []))) if self.routes is not None else list(self.channels)
        if not targets:
            return 0
        with self.lock, self.db:
            self.db.execute("DELETE FROM issue_titles WHERE updated < ?", (time.time() - 2592000,))
            # Comment events only contain the task ID. Reuse titles observed in
            # task events; never require an API token or cache task descriptions.
            if payload["event"] == "issue" and data.get("id") and data.get("name"):
                self.db.execute("INSERT OR REPLACE INTO issue_titles VALUES (?, ?, ?, ?, ?)", (payload['workspace_slug'], str(data['id']), clean_text(data['name'], 500), data.get('sequence_id'), time.time()))
            elif payload["event"] == "issue_comment":
                issue = data.get("issue")
                issue_id = issue.get("id") if isinstance(issue, dict) else issue
                cached = self.db.execute("SELECT name, sequence FROM issue_titles WHERE workspace = ? AND issue = ?", (payload['workspace_slug'], str(issue_id))).fetchone()
                if cached:
                    payload = {**payload, "data": {**data, "name": cached[0], "sequence_id": cached[1]}}
            text = message_text(payload, self.base_url, self.brand)
            # Retain completed deliveries for seven days to deduplicate replays.
            self.db.execute("DELETE FROM jobs WHERE status = 'sent' AND due < ?", (time.time() - 604800,))
            for channel in targets:
                self.db.execute("INSERT OR IGNORE INTO jobs(delivery, channel, text, due) VALUES (?, ?, ?, ?)", (delivery, channel, text, time.time()))
        return len(targets)

    def process_once(self) -> bool:
        with self.lock:
            job = self.db.execute("SELECT delivery, channel, text, attempts FROM jobs WHERE status = 'pending' AND due <= ? ORDER BY due LIMIT 1", (time.time(),)).fetchone()
        if not job:
            return False
        delivery, channel, text, attempts = job
        status = "sent"
        due = time.time()
        try:
            if channel not in self.channels:
                raise ValueError("Channel configuration removed")
            platform = channel.split(":", 1)[0]
            url, body = robot_request(platform, *self.channels[channel], text)
            request = Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
            with send_request(request) as response:
                result = json.loads(response.read(MAX_BODY))
            code = result.get("code", result.get("StatusCode")) if platform == "feishu" else result.get("errcode")
            if code != 0:
                raise ValueError("Robot rejected message")
        except Exception:
            # Never log exception messages: HTTP errors may include secret URLs.
            attempts += 1
            status = "failed" if attempts >= 8 else "pending"
            due += min(3600, 5 * 2 ** attempts)
            logger.warning("Delivery %s channel %s attempt %s: %s", delivery, channel, attempts, status)
        with self.lock, self.db:
            self.db.execute("UPDATE jobs SET attempts = ?, due = ?, status = ? WHERE delivery = ? AND channel = ?", (attempts, due, status, delivery, channel))
        return True

    def stats(self) -> Dict[str, int]:
        with self.lock:
            return dict(self.db.execute("SELECT status, count(*) FROM jobs GROUP BY status").fetchall())


def handler_for(adapter: Adapter) -> Any:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            pass

        def reply(self, status: int, body: Dict[str, Any]) -> None:
            encoded = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self) -> None:
            self.reply(200 if self.path == "/healthz" else 404, {"status": "ok"} if self.path == "/healthz" else {"error": "Not found"})

        def do_POST(self) -> None:
            if self.path != "/webhooks/plane":
                self.reply(404, {"error": "Not found"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= MAX_BODY:
                    self.reply(413, {"error": "Invalid body size"})
                    return
                self.connection.settimeout(10)
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict):
                    raise ValueError("Invalid JSON")
                if not verify_signature(payload, self.headers.get("X-Plane-Signature", ""), adapter.secret):
                    self.reply(401, {"error": "Invalid signature"})
                    return
                delivery = str(uuid.UUID(self.headers.get("X-Plane-Delivery", "")))
                queued = adapter.accept(payload, delivery)
                self.reply(202, {"status": "accepted", "channels": queued})
            except (ValueError, UnicodeError):
                self.reply(400, {"error": "Invalid payload or delivery ID"})
            except Exception:
                logger.error("Failed to persist webhook")
                self.reply(503, {"error": "Queue unavailable"})
    return Handler


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    adapter = Adapter(os.environ)
    def worker() -> None:
        while True:
            try:
                if not adapter.process_once():
                    time.sleep(1)
            except Exception:
                logger.error("Queue worker failed; retrying")
                time.sleep(5)
    threading.Thread(target=worker, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), handler_for(adapter)).serve_forever()


if __name__ == "__main__":
    main()
