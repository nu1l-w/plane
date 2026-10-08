import pytest
from django.template import Context, Template
from django.utils.html import escape

from plane.utils.branding import BRAND_NAME


@pytest.mark.unit
def test_brand_tag_renders_without_request_context():
    template = Template("{% load branding %}<title>{% brand_name %}研发管理平台</title>")
    assert template.render(Context()) == f"<title>{escape(BRAND_NAME)}研发管理平台</title>"


@pytest.mark.unit
def test_brand_tag_escapes_html():
    from unittest.mock import patch

    with patch("plane.app.templatetags.branding.BRAND_NAME", "<Example>"):
        template = Template("{% load branding %}{% brand_name %}")
        assert template.render(Context()) == "&lt;Example&gt;"
