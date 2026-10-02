from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0126_project_issue_type_defect_flag"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE states ADD COLUMN IF NOT EXISTS defect_stage varchar(16);
                        UPDATE states SET defect_stage = '' WHERE defect_stage IS NULL;
                        ALTER TABLE states ALTER COLUMN defect_stage SET DEFAULT '';
                        ALTER TABLE states ALTER COLUMN defect_stage SET NOT NULL;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="state",
                    name="defect_stage",
                    field=models.CharField(blank=True, default="", max_length=16),
                ),
            ],
        ),
    ]
