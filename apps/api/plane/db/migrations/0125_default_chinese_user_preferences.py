import pytz
from django.db import migrations, models

import plane.db.models.user


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0124_default_legacy_issue_delivery_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="user_timezone",
            field=models.CharField(
                choices=tuple(zip(pytz.common_timezones, pytz.common_timezones)),
                default="Asia/Shanghai",
                max_length=255,
            ),
        ),
        migrations.AlterField(
            model_name="profile",
            name="theme",
            field=models.JSONField(default=plane.db.models.user.get_default_profile_theme),
        ),
        migrations.AlterField(
            model_name="profile",
            name="language",
            field=models.CharField(default="zh-CN", max_length=255),
        ),
        migrations.AlterField(
            model_name="profile",
            name="start_of_the_week",
            field=models.PositiveSmallIntegerField(
                choices=[
                    (0, "Sunday"),
                    (1, "Monday"),
                    (2, "Tuesday"),
                    (3, "Wednesday"),
                    (4, "Thursday"),
                    (5, "Friday"),
                    (6, "Saturday"),
                ],
                default=1,
            ),
        ),
    ]
