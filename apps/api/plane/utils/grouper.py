# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import F, Q, UUIDField, Value, QuerySet, OuterRef, Subquery
from django.db.models.functions import Coalesce

# Module imports
from plane.db.models import (
    Cycle,
    Issue,
    Label,
    Module,
    Project,
    ProjectMember,
    State,
    WorkspaceMember,
    IssueAssignee,
    ModuleIssue,
    IssueLabel,
    IssueRelation,
)
from typing import Optional, Dict, Tuple, Any, Union, List


def issue_queryset_grouper(
    queryset: QuerySet[Issue],
    group_by: Optional[str],
    sub_group_by: Optional[str],
) -> QuerySet[Issue]:
    FIELD_MAPPER: Dict[str, str] = {
        "label_ids": "labels__id",
        "assignee_ids": "assignees__id",
        "module_ids": "issue_module__module_id",
    }

    GROUP_FILTER_MAPPER: Dict[str, Q] = {
        "assignees__id": Q(issue_assignee__deleted_at__isnull=True),
        "labels__id": Q(label_issue__deleted_at__isnull=True),
        "issue_module__module_id": Q(issue_module__deleted_at__isnull=True),
    }

    for group_key in [group_by, sub_group_by]:
        if group_key in GROUP_FILTER_MAPPER:
            queryset = queryset.filter(GROUP_FILTER_MAPPER[group_key])

    issue_assignee_subquery = Subquery(
        IssueAssignee.objects.filter(
            issue_id=OuterRef("pk"),
            deleted_at__isnull=True,
        )
        .values("issue_id")
        .annotate(arr=ArrayAgg("assignee_id", distinct=True))
        .values("arr")
    )

    issue_module_subquery = Subquery(
        ModuleIssue.objects.filter(
            issue_id=OuterRef("pk"),
            deleted_at__isnull=True,
            module__archived_at__isnull=True,
        )
        .values("issue_id")
        .annotate(arr=ArrayAgg("module_id", distinct=True))
        .values("arr")
    )

    issue_label_subquery = Subquery(
        IssueLabel.objects.filter(issue_id=OuterRef("pk"), deleted_at__isnull=True)
        .values("issue_id")
        .annotate(arr=ArrayAgg("label_id", distinct=True))
        .values("arr")
    )

    annotations_map: Dict[str, Tuple[str, Q]] = {
        "assignee_ids": Coalesce(issue_assignee_subquery, Value([], output_field=ArrayField(UUIDField()))),
        "label_ids": Coalesce(issue_label_subquery, Value([], output_field=ArrayField(UUIDField()))),
        "module_ids": Coalesce(issue_module_subquery, Value([], output_field=ArrayField(UUIDField()))),
    }

    default_annotations: Dict[str, Any] = {}

    for key, expression in annotations_map.items():
        if FIELD_MAPPER.get(key) in {group_by, sub_group_by}:
            continue
        default_annotations[key] = expression

    return queryset.annotate(**default_annotations)


def issue_on_results(
    issues: QuerySet[Issue],
    group_by: Optional[str],
    sub_group_by: Optional[str],
    expand=None,
    user=None,
) -> List[Dict[str, Any]]:
    FIELD_MAPPER: Dict[str, str] = {
        "labels__id": "label_ids",
        "assignees__id": "assignee_ids",
        "issue_module__module_id": "module_ids",
    }

    original_list: List[str] = ["assignee_ids", "label_ids", "module_ids"]

    required_fields: List[str] = [
        "id",
        "name",
        "state_id",
        "sort_order",
        "completed_at",
        "estimate_point",
        "priority",
        "start_date",
        "target_date",
        "sequence_id",
        "project_id",
        "parent_id",
        "parent__name",
        "parent__sequence_id",
        "parent__project_id",
        "cycle_id",
        "type_id",
        "sub_issues_count",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
        "attachment_count",
        "link_count",
        "is_draft",
        "archived_at",
        "state__group",
    ]
    if "defect_count" in issues.query.annotations:
        required_fields.extend(["defect_count", "open_defect_count", "my_open_defect_count"])

    if group_by in FIELD_MAPPER:
        original_list.remove(FIELD_MAPPER[group_by])
        original_list.append(group_by)

    if sub_group_by in FIELD_MAPPER:
        original_list.remove(FIELD_MAPPER[sub_group_by])
        original_list.append(sub_group_by)

    required_fields.extend(original_list)
    results = list(issues.values(*required_fields))
    for issue in results:
        parent_id = issue["parent_id"]
        parent_name = issue.pop("parent__name")
        parent_sequence_id = issue.pop("parent__sequence_id")
        parent_project_id = issue.pop("parent__project_id")
        issue["parent"] = (
            {
                "id": parent_id,
                "name": parent_name,
                "sequence_id": parent_sequence_id,
                "project_id": parent_project_id,
            }
            if parent_id
            else None
        )
    expand_issue_relations(results, expand, user)
    return results


def expand_issue_relations(results, expand, user):
    """Batch-load visible relations for the current page, before grouping it."""
    fields = set(expand or []) & {"issue_relation", "issue_related"}
    if not results or not fields or user is None or not user.is_authenticated:
        return

    rows_by_id = {}
    for row in results:
        rows_by_id.setdefault(row["id"], []).append(row)
        for field in fields:
            row[field] = []

    memberships = ProjectMember.objects.filter(
        member=user,
        is_active=True,
        workspace_id__in=WorkspaceMember.objects.filter(member=user, is_active=True).values("workspace_id"),
    )
    restricted_projects = memberships.filter(role=5, project__guest_view_all_features=False).values("project_id")
    visible_issues = Issue.issue_objects.filter(project_id__in=memberships.values("project_id")).filter(
        ~Q(project_id__in=restricted_projects) | Q(created_by=user)
    )
    relations = (
        IssueRelation.objects.filter(
            Q(issue_id__in=rows_by_id) | Q(related_issue_id__in=rows_by_id),
            issue_id__in=visible_issues.values("id"),
            related_issue_id__in=visible_issues.values("id"),
            issue__workspace_id=F("workspace_id"),
            related_issue__workspace_id=F("workspace_id"),
        )
        .select_related("issue__state", "related_issue__state")
        .only(
            "issue_id",
            "related_issue_id",
            "relation_type",
            "issue__id",
            "issue__name",
            "issue__project_id",
            "issue__sequence_id",
            "issue__state_id",
            "issue__state__group",
            "related_issue__id",
            "related_issue__name",
            "related_issue__project_id",
            "related_issue__sequence_id",
            "related_issue__state_id",
            "related_issue__state__group",
        )
        .order_by("id")
    )
    for relation in relations:
        for field, source_id, target in (
            ("issue_relation", relation.issue_id, relation.related_issue),
            ("issue_related", relation.related_issue_id, relation.issue),
        ):
            if field not in fields:
                continue
            for row in rows_by_id.get(source_id, []):
                row[field].append(
                    {
                        "id": target.id,
                        "name": target.name,
                        "project_id": target.project_id,
                        "sequence_id": target.sequence_id,
                        "relation_type": relation.relation_type,
                        "state_id": target.state_id,
                        "state__group": target.state.group if target.state else None,
                    }
                )


def issue_group_values(
    field: str,
    slug: str,
    project_id: Optional[str] = None,
    filters: Dict[str, Any] = {},
    queryset: Optional[QuerySet] = None,
) -> List[Union[str, Any]]:
    if field == "state_id":
        queryset = State.objects.filter(is_triage=False, workspace__slug=slug).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id))
        return list(queryset)

    if field == "labels__id":
        queryset = Label.objects.filter(workspace__slug=slug).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        return list(queryset) + ["None"]

    if field == "assignees__id":
        if project_id:
            return list(
                ProjectMember.objects.filter(workspace__slug=slug, project_id=project_id, is_active=True).values_list(
                    "member_id", flat=True
                )
            )
        return list(
            WorkspaceMember.objects.filter(workspace__slug=slug, is_active=True).values_list("member_id", flat=True)
        )

    if field == "issue_module__module_id":
        queryset = Module.objects.filter(workspace__slug=slug).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        return list(queryset) + ["None"]

    if field == "cycle_id":
        queryset = Cycle.objects.filter(workspace__slug=slug).values_list("id", flat=True)
        if project_id:
            return list(queryset.filter(project_id=project_id)) + ["None"]
        return list(queryset) + ["None"]

    if field == "project_id":
        queryset = Project.objects.filter(workspace__slug=slug).values_list("id", flat=True)
        return list(queryset)

    if field == "priority":
        return ["low", "medium", "high", "urgent", "none"]

    if field == "state__group":
        return ["backlog", "unstarted", "started", "completed", "cancelled"]

    if field == "target_date":
        queryset = queryset.values_list("target_date", flat=True).distinct()
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)

    if field == "start_date":
        queryset = queryset.values_list("start_date", flat=True).distinct()
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)

    if field == "created_by":
        queryset = queryset.values_list("created_by", flat=True).distinct()
        if project_id:
            return list(queryset.filter(project_id=project_id))
        else:
            return list(queryset)

    return []
