# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import timedelta
from django.db.models import Exists, OuterRef
from django.utils import timezone
from plane.db.models import Issue, IssueAssignee, IssueRelation

RISK_KINDS = {"blocked", "overdue", "due_soon", "stale", "high_priority_unassigned"}


def get_issue_risks(issues, visible_issues, today=None):
    """Use caller-scoped issues; prerequisites use the full permission-scoped set."""
    today = today or timezone.localdate()
    open_issues = issues.exclude(state__group__in=["completed", "cancelled"])
    blocker_relations = IssueRelation.objects.filter(
        deleted_at__isnull=True,
        relation_type="blocked_by",
        related_issue_id__in=visible_issues.exclude(state__group__in=["completed", "cancelled"]).values("id"),
    )
    assigned = IssueAssignee.objects.filter(issue_id=OuterRef("pk"), deleted_at__isnull=True)
    risks = {
        "blocked": open_issues.filter(Exists(blocker_relations.filter(issue_id=OuterRef("pk")))).order_by(
            "-updated_at", "id"
        ),
        "overdue": open_issues.filter(target_date__lt=today).order_by("target_date", "id"),
        "due_soon": open_issues.filter(target_date__range=(today, today + timedelta(days=7))).order_by(
            "target_date", "id"
        ),
        "stale": open_issues.filter(updated_at__lt=timezone.now() - timedelta(days=14)).order_by("updated_at", "id"),
        "high_priority_unassigned": open_issues.filter(priority__in=["urgent", "high"])
        .filter(~Exists(assigned))
        .order_by("-created_at", "id"),
    }
    return risks, blocker_relations


def risk_item_values(queryset, blocker_relations=None):
    items = list(
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
    assignments = {}
    for row in (
        IssueAssignee.objects.filter(issue_id__in=[item["id"] for item in items], deleted_at__isnull=True)
        .order_by("assignee__display_name", "assignee_id")
        .values("issue_id", "assignee_id", "assignee__display_name")
    ):
        assignments.setdefault(row["issue_id"], []).append(
            {
                "id": row["assignee_id"],
                "name": row["assignee__display_name"],
            }
        )
    for item in items:
        item["assignees"] = assignments.get(item["id"], [])
        item["overdue_days"] = max(0, (timezone.localdate() - item["target_date"]).days) if item["target_date"] else 0
    if blocker_relations is not None:
        relations = list(
            blocker_relations.filter(issue_id__in=[item["id"] for item in items])
            .order_by("related_issue__project__identifier", "related_issue__sequence_id", "id")
            .values("issue_id", "related_issue_id")
        )
        blocker_items = {
            item["id"]: item
            for item in risk_item_values(
                Issue.issue_objects.filter(id__in=[relation["related_issue_id"] for relation in relations])
            )
        }
        blockers_by_issue = {}
        for relation in relations:
            blocker = blocker_items.get(relation["related_issue_id"])
            if blocker is not None:
                blockers_by_issue.setdefault(relation["issue_id"], []).append(blocker)
        for item in items:
            item["blockers"] = blockers_by_issue.get(item["id"], [])
    return items
