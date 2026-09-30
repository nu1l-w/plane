from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0123_add_delivery_management"),
    ]

    operations = [
        # These columns remain in databases migrated through 0123, but the
        # current Issue model does not supply them on insert.
        migrations.RunSQL(
            sql="""
                ALTER TABLE issues ALTER COLUMN external_vendor SET DEFAULT '';
                ALTER TABLE issues ALTER COLUMN firmware_version SET DEFAULT '';
                ALTER TABLE issues ALTER COLUMN hardware_model SET DEFAULT '';
            """,
            reverse_sql="""
                ALTER TABLE issues ALTER COLUMN external_vendor DROP DEFAULT;
                ALTER TABLE issues ALTER COLUMN firmware_version DROP DEFAULT;
                ALTER TABLE issues ALTER COLUMN hardware_model DROP DEFAULT;
            """,
        ),
    ]
