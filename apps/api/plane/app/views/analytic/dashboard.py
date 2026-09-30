# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import datetime, time, timedelta
from uuid import UUID

from django.db.models import Count, Exists, OuterRef, Q
from django.db.models.functions import TruncWeek
from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.db.models import Issue, IssueAssignee, Project, ProjectMember, WorkspaceMember


CREATED_RANGES = {"last_7_days": 7, "last_30_days": 30, "last_90_days": 90}
RISK_KINDS = {"overdue", "due_soon", "stale", "high_priority_unassigned"}
PRIORITIES = {"urgent", "high", "medium", "low", "none"}
DETAIL_GROUPS = {
    "total": None,
    "backlog": "backlog",
    "unstarted": "unstarted",
    "in_progress": "started",
    "completed": "completed",
    "cancelled": "cancelled",
}


def risk_item_values(queryset):
    return list(
        queryset.values(
            "id",
            "name",
            "sequence_id",
            "priority",
            "target_date",
            "updated_at",
            "project_id",
            "project__name",
            "project__identifier",
        )
    )


def weekly_trends(issues, overdue_issues, today):
    first_week = today - timedelta(days=today.weekday(), weeks=7)
    first_moment = timezone.make_aware(
        datetime.combine(first_week, time.min), timezone.get_current_timezone()
    )

    def counts_by_week(queryset, field):
        rows = (
            queryset.annotate(week=TruncWeek(field))
            .order_by()
            .values("week")
            .annotate(total=Count("id"))
        )
        return {
            (row["week"].date() if isinstance(row["week"], datetime) else row["week"]): row["total"]
            for row in rows
        }

    created = counts_by_week(issues.filter(created_at__gte=first_moment), "created_at")
    completed = counts_by_week(
        issues.filter(state__group="completed", completed_at__gte=first_moment), "completed_at"
    )
    overdue = counts_by_week(
        overdue_issues.filter(target_date__gte=first_week), "target_date"
    )
    return [
        {
            "week_start": (week := first_week + timedelta(weeks=index)).isoformat(),
            "created": created.get(week, 0),
            "completed": completed.get(week, 0),
            "overdue": overdue.get(week, 0),
        }
        for index in range(8)
    ]


class WorkspaceDashboardOverviewEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request, slug):
        today = timezone.localdate()
        project_id = request.GET.get("project_id")
        assignee_id = request.GET.get("assignee_id")
        created_range = request.GET.get("created_range", "")
        priority = request.GET.get("priority", "")
        risk = request.GET.get("risk", "")
        detail = request.GET.get("detail", "")
        page = request.GET.get("page", "1")
        try:
            if project_id:
                UUID(project_id)
            if assignee_id and assignee_id != "unassigned":
                UUID(assignee_id)
            page_number = int(page)
        except (ValueError, TypeError):
            return Response({"error": "Invalid dashboard filter."}, status=status.HTTP_400_BAD_REQUEST)
        if (
            (created_range and created_range not in CREATED_RANGES)
            or (priority and priority not in PRIORITIES)
            or (risk and risk not in RISK_KINDS)
            or (detail and detail not in DETAIL_GROUPS)
            or (risk and detail)
            or not 1 <= page_number <= 1000
        ):
            return Response({"error": "Invalid dashboard filter."}, status=status.HTTP_400_BAD_REQUEST)

        projects = Project.objects.filter(
            workspace__slug=slug,
            deleted_at__isnull=True,
            archived_at__isnull=True,
            id__in=ProjectMember.objects.filter(
                workspace__slug=slug,
                member=request.user,
                is_active=True,
                role__in=[ROLE.ADMIN.value, ROLE.MEMBER.value],
            ).values("project_id"),
        )
        available_projects = list(projects.order_by("name").values("id", "name"))
        if project_id:
            projects = projects.filter(id=project_id)
        issues = Issue.issue_objects.filter(
            workspace__slug=slug,
            project_id__in=projects.values("id"),
        )
        assigned = IssueAssignee.objects.filter(issue_id=OuterRef("pk"), deleted_at__isnull=True)
        if assignee_id:
            if assignee_id == "unassigned":
                issues = issues.annotate(has_assignee=Exists(assigned)).filter(has_assignee=False)
            else:
                issues = issues.filter(
                    id__in=IssueAssignee.objects.filter(
                        assignee_id=assignee_id, deleted_at__isnull=True
                    ).values("issue_id")
                )
        if created_range:
            issues = issues.filter(created_at__gte=timezone.now() - timedelta(days=CREATED_RANGES[created_range]))
        if priority:
            issues = issues.filter(priority=priority)

        open_issues = issues.exclude(state__group__in=["completed", "cancelled"])
        overdue_issues = open_issues.filter(target_date__lt=today)
        due_soon_issues = open_issues.filter(target_date__range=(today, today + timedelta(days=7)))
        stale_issues = open_issues.filter(updated_at__lt=timezone.now() - timedelta(days=14))
        unassigned_high_priority_issues = (
            open_issues.filter(priority__in=["urgent", "high"])
            .annotate(has_active_assignee=Exists(assigned))
            .filter(has_active_assignee=False)
        )

        counts = issues.aggregate(
            total=Count("id"),
            completed=Count("id", filter=Q(state__group="completed")),
            in_progress=Count("id", filter=Q(state__group="started")),
            cancelled=Count("id", filter=Q(state__group="cancelled")),
        )
        state_counts = {}
        for row in issues.values("state__group").annotate(total=Count("id")):
            group = row["state__group"] or "unstarted"
            state_counts[group] = state_counts.get(group, 0) + row["total"]
        project_counts = {
            row["project_id"]: row
            for row in issues.values("project_id").annotate(
                total=Count("id"),
                completed=Count("id", filter=Q(state__group="completed")),
                cancelled=Count("id", filter=Q(state__group="cancelled")),
                overdue=Count(
                    "id",
                    filter=Q(target_date__lt=today)
                    & ~Q(state__group__in=["completed", "cancelled"]),
                ),
            )
        }
        project_rows = [
            {
                "id": project.id,
                "name": project.name,
                "identifier": project.identifier,
                "total": project_counts.get(project.id, {}).get("total", 0),
                "completed": project_counts.get(project.id, {}).get("completed", 0),
                "cancelled": project_counts.get(project.id, {}).get("cancelled", 0),
                "overdue": project_counts.get(project.id, {}).get("overdue", 0),
            }
            for project in projects.order_by("name")
        ]
        project_rows.sort(key=lambda row: (-row["overdue"], row["name"]))

        risks = {
            "overdue": overdue_issues.order_by("target_date", "id"),
            "due_soon": due_soon_issues.order_by("target_date", "id"),
            "stale": stale_issues.order_by("updated_at", "id"),
            "high_priority_unassigned": unassigned_high_priority_issues.order_by("-created_at", "id"),
        }
        risk_counts = {key: queryset.count() for key, queryset in risks.items()}
        selected_risk = risks.get(risk)
        risk_total = risk_counts.get(risk, 0)
        risk_page = min(page_number, max(1, (risk_total + 19) // 20))
        risk_items = (
            risk_item_values(selected_risk[(risk_page - 1) * 20 : risk_page * 20])
            if selected_risk is not None
            else []
        )
        detail_issues = issues
        if detail and DETAIL_GROUPS[detail] == "unstarted":
            detail_issues = detail_issues.filter(
                Q(state__group="unstarted") | Q(state__group__isnull=True)
            )
        elif detail and DETAIL_GROUPS[detail]:
            detail_issues = detail_issues.filter(state__group=DETAIL_GROUPS[detail])
        detail_total = detail_issues.count() if detail else 0
        detail_page = min(page_number, max(1, (detail_total + 19) // 20))
        detail_items = (
            risk_item_values(
                detail_issues.order_by("-created_at", "id")[(detail_page - 1) * 20 : detail_page * 20]
            )
            if detail
            else []
        )
        overdue_items = risk_item_values(risks["overdue"][:10])
        assignees = WorkspaceMember.objects.filter(
            workspace__slug=slug, is_active=True, member__is_bot=False
        ).order_by("member__display_name").values("member_id", "member__display_name")

        return Response(
            {
                "summary": {
                    "projects": projects.count(),
                    **counts,
                    **risk_counts,
                },
                "states": state_counts,
                "projects": project_rows,
                "weekly_trends": weekly_trends(issues, overdue_issues, today),
                "available_projects": available_projects,
                "overdue_items": overdue_items,
                "assignees": list(assignees),
                "risk_items": risk_items,
                "risk_page": risk_page,
                "risk_total": risk_total,
                "detail_items": detail_items,
                "detail_page": detail_page,
                "detail_total": detail_total,
            }
        )
