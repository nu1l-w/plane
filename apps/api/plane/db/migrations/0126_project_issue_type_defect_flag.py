from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0125_default_chinese_user_preferences"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectissuetype",
            name="is_defect",
            field=models.BooleanField(default=False),
        ),
        migrations.AddConstraint(
            model_name="projectissuetype",
            constraint=models.UniqueConstraint(
                fields=("project",),
                condition=Q(deleted_at__isnull=True, is_defect=True),
                name="project_issue_type_unique_defect_type_when_deleted_at_null",
            ),
        ),
    ]
