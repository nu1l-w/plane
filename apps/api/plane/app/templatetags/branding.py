from django import template
from plane.utils.branding import BRAND_NAME

register = template.Library()


@register.simple_tag
def brand_name():
    return BRAND_NAME
