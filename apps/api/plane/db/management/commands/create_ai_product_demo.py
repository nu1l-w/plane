#!/usr/bin/env python
# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from __future__ import annotations

from datetime import timedelta
from typing import Iterable

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from plane.db.models import (
    Cycle,
    CycleIssue,
    Issue,
    IssueLabel,
    Label,
    Module,
    ModuleIssue,
    Page,
    Project,
    ProjectMember,
    ProjectPage,
    State,
    User,
    Workspace,
    WorkspaceMember,
)
from plane.db.models.state import DEFAULT_STATES


class Command(BaseCommand):
    help = "Create a multi-product AI project management demo for teams using Plane."

    def add_arguments(self, parser):
        parser.add_argument("--creator-email", required=True, help="Existing Plane user email used as workspace owner.")
        parser.add_argument(
            "--workspace-slug",
            default="ai-product-ops-demo",
            help="Workspace slug to create or reuse.",
        )
        parser.add_argument(
            "--workspace-name",
            default="多端 AI 项目管理样板",
            help="Workspace name to create when the workspace slug does not exist.",
        )
        parser.add_argument(
            "--project-name",
            default="2026 多端 AI 产品协同项目",
            help="Project name to create or reuse inside the workspace.",
        )
        parser.add_argument(
            "--project-identifier",
            default="AIPMO",
            help="Project identifier to create when the project does not exist.",
        )
        parser.add_argument(
            "--member-emails",
            default="",
            help="Comma-separated existing Plane user emails to add into the workspace and project.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        creator_email = options["creator_email"].strip().lower()
        workspace_slug = options["workspace_slug"].strip()
        workspace_name = options["workspace_name"].strip()
        project_name = options["project_name"].strip()
        project_identifier = options["project_identifier"].strip().upper()
        member_emails = self._parse_emails(options["member_emails"])

        creator = User.objects.filter(email=creator_email).first()
        if not creator:
            raise CommandError(f"User {creator_email} does not exist. Please sign in to Plane first.")

        members = list(User.objects.filter(email__in=member_emails))
        missing_members = sorted(set(member_emails) - {user.email for user in members})
        if missing_members:
            self.stdout.write(
                self.style.WARNING(
                    "These users do not exist in Plane yet and were skipped: " + ", ".join(missing_members)
                )
            )

        workspace, workspace_created = Workspace.objects.get_or_create(
            slug=workspace_slug,
            defaults={"name": workspace_name, "owner": creator},
        )
        if workspace_created:
            self.stdout.write(self.style.SUCCESS(f"Created workspace: {workspace.name} ({workspace.slug})"))
        else:
            self.stdout.write(self.style.WARNING(f"Reusing workspace: {workspace.name} ({workspace.slug})"))

        self._ensure_workspace_member(workspace, creator)
        for member in members:
            self._ensure_workspace_member(workspace, member)

        project, project_created = Project.objects.get_or_create(
            workspace=workspace,
            name=project_name,
            defaults={
                "identifier": project_identifier,
                "network": 0,
                "created_by": creator,
                "project_lead": creator,
                "module_view": True,
                "cycle_view": True,
                "issue_views_view": True,
                "page_view": True,
                "intake_view": True,
                "description": (
                    "面向颂娜 App、KNA App、KNA PC、iKF App、iKF PC、木之穹声 Web 的 AI 能力规划、排期和发布样板。"
                ),
                "logo_props": {
                    "emoji": {
                        "url": "https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f9e0.png",
                        "value": "129504",
                    },
                    "in_use": "emoji",
                },
            },
        )
        if project_created:
            self.stdout.write(self.style.SUCCESS(f"Created project: {project.name}"))
        else:
            self.stdout.write(self.style.WARNING(f"Reusing project: {project.name}"))

        self._ensure_project_member(project, creator)
        for member in members:
            self._ensure_project_member(project, member)

        states = self._ensure_states(project, creator)
        labels = self._ensure_labels(project)
        cycles = self._ensure_cycles(project, creator)
        modules = self._ensure_modules(project, creator)
        self._ensure_pages(project, creator)
        self._ensure_issues(project, states, labels, cycles, modules, creator)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("AI product demo is ready."))
        self.stdout.write(f"Workspace: {workspace.slug}")
        self.stdout.write(f"Project: {project.name} ({project.identifier})")
        self.stdout.write("Recommended first views: Modules, Cycles, Pages, then Work items grouped by state.")

    def _parse_emails(self, member_emails: str) -> list[str]:
        return [email.strip().lower() for email in member_emails.split(",") if email.strip()]

    def _ensure_workspace_member(self, workspace: Workspace, user: User) -> None:
        WorkspaceMember.objects.get_or_create(
            workspace=workspace,
            member=user,
            defaults={"role": 20, "created_by": workspace.owner},
        )

    def _ensure_project_member(self, project: Project, user: User) -> None:
        ProjectMember.objects.get_or_create(
            project=project,
            member=user,
            defaults={"role": 20, "created_by": project.created_by},
        )

    def _ensure_states(self, project: Project, creator: User) -> dict[str, State]:
        states: dict[str, State] = {}
        for state_seed in DEFAULT_STATES:
            state, _ = State.all_state_objects.get_or_create(
                project=project,
                name=state_seed["name"],
                defaults={
                    "workspace": project.workspace,
                    "color": state_seed["color"],
                    "group": state_seed["group"],
                    "default": state_seed.get("default", False),
                    "is_triage": state_seed["group"] == "triage",
                    "created_by": creator,
                },
            )
            states[state.name] = state
        if project.default_state_id is None and "Backlog" in states:
            project.default_state = states["Backlog"]
            project.save(update_fields=["default_state"])
        return states

    def _ensure_labels(self, project: Project) -> dict[str, Label]:
        label_defs = [
            ("AI能力", "#7C3AED"),
            ("语音交互", "#2563EB"),
            ("推荐策略", "#0F766E"),
            ("客服Copilot", "#0891B2"),
            ("数据看板", "#CA8A04"),
            ("跨端联调", "#EA580C"),
            ("灰度发布", "#DC2626"),
            ("风险项", "#B91C1C"),
        ]
        labels: dict[str, Label] = {}
        for name, color in label_defs:
            label, _ = Label.objects.get_or_create(
                project=project,
                name=name,
                defaults={"workspace": project.workspace, "color": color},
            )
            labels[name] = label
        return labels

    def _ensure_cycles(self, project: Project, creator: User) -> dict[str, Cycle]:
        today = timezone.now()
        cycle_defs = [
            ("Cycle 1 - AI 需求梳理与基线", today, today + timedelta(days=14)),
            ("Cycle 2 - 核心能力联调", today + timedelta(days=15), today + timedelta(days=29)),
            ("Cycle 3 - 灰度与上线准备", today + timedelta(days=30), today + timedelta(days=44)),
        ]
        cycles: dict[str, Cycle] = {}
        for name, start_at, end_at in cycle_defs:
            cycle, _ = Cycle.objects.get_or_create(
                project=project,
                name=name,
                defaults={
                    "workspace": project.workspace,
                    "owned_by": creator,
                    "start_date": start_at,
                    "end_date": end_at,
                    "timezone": project.timezone,
                },
            )
            cycles[name] = cycle
        return cycles

    def _ensure_modules(self, project: Project, creator: User) -> dict[str, Module]:
        module_defs = [
            ("颂娜 App", "AI 助手、内容理解、智能推荐入口。", "in-progress"),
            ("KNA App", "移动端智能问答、需求收集、用户反馈闭环。", "planned"),
            ("KNA PC端", "桌面端知识检索、工单摘要、运营看板。", "planned"),
            ("iKF App", "客服助手、会话总结、问题归因。", "in-progress"),
            ("iKF PC端", "坐席工作台、批量处理、会话质检。", "planned"),
            ("木之穹声 Web端", "运营配置、内容管理、AI 数据洞察。", "planned"),
            ("AI 中台与数据", "提示词、模型策略、评测、埋点、反馈学习。", "in-progress"),
            ("项目治理与发布", "排期、风险、里程碑、灰度策略。", "planned"),
        ]
        modules: dict[str, Module] = {}
        for name, description, status in module_defs:
            module, _ = Module.objects.get_or_create(
                project=project,
                name=name,
                defaults={
                    "workspace": project.workspace,
                    "description": description,
                    "status": status,
                    "lead": creator,
                },
            )
            modules[name] = module
        return modules

    def _ensure_pages(self, project: Project, creator: User) -> None:
        pages = [
            (
                "AI 功能落点地图",
                self._wrap_html(
                    [
                        "<h2>建议把 AI 先放到哪里</h2>",
                        "<ul>",
                        "<li><strong>颂娜 App：</strong>智能推荐、内容摘要、语音交互入口。</li>",
                        "<li><strong>KNA App / PC：</strong>知识检索问答、需求总结、项目周报自动生成。</li>",
                        "<li><strong>iKF App / PC：</strong>客服 Copilot、会话摘要、问题分类、质检。</li>",
                        "<li><strong>木之穹声 Web：</strong>配置后台、数据看板、内容运营建议。</li>",
                        "<li><strong>AI 中台：</strong>Prompt 管理、模型路由、评测与反馈闭环。</li>",
                        "</ul>",
                        "<p>落地原则：先做高频、标准化、能节省人力的场景，再做个性化和生成式体验。</p>",
                    ]
                ),
            ),
            (
                "企业排期与项目治理样板",
                self._wrap_html(
                    [
                        "<h2>大企业常见做法</h2>",
                        "<ol>",
                        "<li>按季度确定路线图，按双周 Cycle 执行。</li>",
                        "<li>一个项目只保留少量一级目标，跨端拆到模块。</li>",
                        "<li>需求必须带业务目标、负责人、风险、上线口径。</li>",
                        "<li>每周一次经营视角评审，每天小范围站会。</li>",
                        "</ol>",
                        "<h2>建议你们团队的治理规则</h2>",
                        "<ul>",
                        "<li>模块按产品线拆分，Cycle 按时间推进，Issue 按可交付拆到 1-3 天粒度。</li>",
                        "<li>每个需求都要挂上 AI能力 / 跨端联调 / 灰度发布 等标签。</li>",
                        "<li>上线前必须经过基线评估、灰度、回滚预案。</li>",
                        "</ul>",
                    ]
                ),
            ),
            (
                "版本路线图与里程碑",
                self._wrap_html(
                    [
                        "<h2>里程碑建议</h2>",
                        "<ul>",
                        "<li><strong>M1：</strong>完成 AI 场景清单、数据准备、优先级排序。</li>",
                        "<li><strong>M2：</strong>打通中台与 2 个核心端的 MVP。</li>",
                        "<li><strong>M3：</strong>完成全端联调、灰度发布、数据验收。</li>",
                        "</ul>",
                        "<p>建议把版本验收定义成：功能可用、指标可量化、风险可回退。</p>",
                    ]
                ),
            ),
        ]
        for name, html in pages:
            page, _ = Page.objects.get_or_create(
                workspace=project.workspace,
                name=name,
                defaults={
                    "owned_by": creator,
                    "description_html": html,
                    "access": 0,
                    "is_locked": False,
                    "color": "#4F46E5",
                },
            )
            ProjectPage.objects.get_or_create(project=project, page=page, defaults={"workspace": project.workspace})

    def _ensure_issues(
        self,
        project: Project,
        states: dict[str, State],
        labels: dict[str, Label],
        cycles: dict[str, Cycle],
        modules: dict[str, Module],
        creator: User,
    ) -> None:
        issue_defs = [
            {
                "name": "梳理六端 AI 功能清单与 ROI 优先级",
                "state": "Backlog",
                "priority": "urgent",
                "module": "项目治理与发布",
                "cycle": "Cycle 1 - AI 需求梳理与基线",
                "labels": ["AI能力", "风险项"],
                "point": 5,
                "description": "输出一张跨端 AI 能力地图，明确先做什么、为什么做、由谁负责。",
            },
            {
                "name": "建立 AI 中台 Prompt 与模型路由规范",
                "state": "In Progress",
                "priority": "high",
                "module": "AI 中台与数据",
                "cycle": "Cycle 1 - AI 需求梳理与基线",
                "labels": ["AI能力", "跨端联调"],
                "point": 8,
                "description": "统一系统提示词、模型选择、降级策略和失败兜底，避免各端各做各的。",
            },
            {
                "name": "颂娜 App 接入智能推荐与摘要 MVP",
                "state": "Todo",
                "priority": "high",
                "module": "颂娜 App",
                "cycle": "Cycle 2 - 核心能力联调",
                "labels": ["AI能力", "推荐策略"],
                "point": 8,
                "description": "先把高频内容推荐和摘要能力做成首版，让用户能感知 AI 价值。",
            },
            {
                "name": "KNA App 增加需求总结和智能问答入口",
                "state": "Todo",
                "priority": "high",
                "module": "KNA App",
                "cycle": "Cycle 2 - 核心能力联调",
                "labels": ["AI能力", "语音交互"],
                "point": 5,
                "description": "把用户反馈、会议纪要、需求池串起来，减少 PM 手工整理时间。",
            },
            {
                "name": "KNA PC端接入知识检索与周报自动生成",
                "state": "Backlog",
                "priority": "medium",
                "module": "KNA PC端",
                "cycle": "Cycle 2 - 核心能力联调",
                "labels": ["AI能力", "数据看板"],
                "point": 5,
                "description": "让 PC 端先承担信息汇总和管理端角色，适合沉淀知识和管理动作。",
            },
            {
                "name": "iKF App 建立客服会话摘要与问题分类",
                "state": "In Progress",
                "priority": "urgent",
                "module": "iKF App",
                "cycle": "Cycle 2 - 核心能力联调",
                "labels": ["客服Copilot", "AI能力"],
                "point": 8,
                "description": "把客服最重的人力工作先拿下，通常是最容易体现 ROI 的 AI 场景。",
            },
            {
                "name": "iKF PC端增加坐席 Copilot 与质检面板",
                "state": "Backlog",
                "priority": "high",
                "module": "iKF PC端",
                "cycle": "Cycle 3 - 灰度与上线准备",
                "labels": ["客服Copilot", "数据看板"],
                "point": 8,
                "description": "PC 工作台适合做复杂辅助决策、批量处理和质检复盘。",
            },
            {
                "name": "木之穹声 Web 端完成 AI 运营后台与实验开关",
                "state": "Todo",
                "priority": "high",
                "module": "木之穹声 Web端",
                "cycle": "Cycle 3 - 灰度与上线准备",
                "labels": ["数据看板", "灰度发布"],
                "point": 5,
                "description": "把实验开关、提示词版本、运营配置集中放在 Web 管理端。",
            },
            {
                "name": "补齐 AI 埋点、效果评测与反馈闭环",
                "state": "Todo",
                "priority": "urgent",
                "module": "AI 中台与数据",
                "cycle": "Cycle 1 - AI 需求梳理与基线",
                "labels": ["AI能力", "数据看板", "风险项"],
                "point": 8,
                "description": "没有评测和埋点，AI 项目就只能停留在演示阶段，无法做持续优化。",
            },
            {
                "name": "制定双周 Cycle 节奏与周会汇报模板",
                "state": "Done",
                "priority": "medium",
                "module": "项目治理与发布",
                "cycle": "Cycle 1 - AI 需求梳理与基线",
                "labels": ["跨端联调"],
                "point": 3,
                "description": "固定节奏是项目稳定推进的前提，先把管理动作标准化。",
            },
            {
                "name": "输出灰度发布、回滚和风险清单",
                "state": "Backlog",
                "priority": "high",
                "module": "项目治理与发布",
                "cycle": "Cycle 3 - 灰度与上线准备",
                "labels": ["灰度发布", "风险项"],
                "point": 5,
                "description": "AI 功能上线前必须有回滚预案，尤其是涉及客服和推荐场景。",
            },
            {
                "name": "统一六端账号、权限和日志追踪口径",
                "state": "Todo",
                "priority": "medium",
                "module": "AI 中台与数据",
                "cycle": "Cycle 2 - 核心能力联调",
                "labels": ["跨端联调", "风险项"],
                "point": 5,
                "description": "先统一身份、权限和日志字段，后面跨端协同和排障会轻很多。",
            },
        ]

        for issue_def in issue_defs:
            issue, _ = Issue.objects.get_or_create(
                project=project,
                name=issue_def["name"],
                defaults={
                    "workspace": project.workspace,
                    "state": states[issue_def["state"]],
                    "priority": issue_def["priority"],
                    "point": issue_def["point"],
                    "description_html": f"<p>{issue_def['description']}</p>",
                    "created_by": creator,
                },
            )
            if issue.state_id != states[issue_def["state"]].id:
                issue.state = states[issue_def["state"]]
                issue.save(update_fields=["state"])

            ModuleIssue.objects.get_or_create(
                module=modules[issue_def["module"]],
                issue=issue,
                defaults={"project": project, "workspace": project.workspace},
            )
            CycleIssue.objects.get_or_create(
                cycle=cycles[issue_def["cycle"]],
                issue=issue,
                defaults={"project": project, "workspace": project.workspace},
            )
            for label_name in issue_def["labels"]:
                IssueLabel.objects.get_or_create(
                    issue=issue,
                    label=labels[label_name],
                    defaults={"project": project, "workspace": project.workspace},
                )

    def _wrap_html(self, blocks: Iterable[str]) -> str:
        return "".join(blocks)
