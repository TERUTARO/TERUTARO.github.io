"""Explicit schemas used by writes, public projection, and initial seeding."""

import re
from decimal import Decimal
from urllib.parse import urlsplit
from uuid import UUID
from .http import invalid

COLLECTIONS = ("projects", "skills", "partners", "services", "engineers", "advisory")
CATEGORIES = ("infrastructure", "development", "network")
CONTACT_TYPES = ("インフラ構築・運用保守", "Webシステム開発", "AI基盤・開発支援", "その他のご相談")
COMMON = {"id", "order", "published"}
FIELDS = {
    "projects": {"title", "client", "year", "period", "category", "categories", "summary", "role", "tags", "phases", "stackGroups", "current", "partner", "partnerHonorific"},
    "skills": {"label", "heading", "icon", "groups"},
    "partners": {"name", "summary", "tags", "sites"},
    "services": {"category", "product", "item", "unit", "invoiceUnit", "notes", "priceYen", "sourceRow"},
    "engineers": {"category", "phase", "unit", "notes", "priceYen", "sourceRow"},
    "advisory": {"title", "summary", "unit", "priceYen"},
}


def object_fields(value, allowed, required=()):
    if not isinstance(value, dict) or set(value) - set(allowed) or set(required) - set(value):
        raise invalid()
    return value


def text(value, maximum=200, minimum=1):
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
        raise invalid()
    if any(ord(char) < 32 and char not in "\n\r\t" for char in value):
        raise invalid()
    return value.strip()


def integer(value, minimum=0, maximum=1000000):
    if isinstance(value, bool) or not isinstance(value, (int, Decimal)) or value != int(value) or not minimum <= value <= maximum:
        raise invalid()
    return int(value)


def boolean(value):
    if not isinstance(value, bool):
        raise invalid()
    return value


def enum(value, choices):
    if not isinstance(value, str) or value not in choices:
        raise invalid()
    return value


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,79}", value):
        raise invalid()
    return value


def uuid(value):
    try:
        parsed = UUID(value)
        if str(parsed) != value.lower() or parsed.version != 4:
            raise invalid()
        return str(parsed)
    except (ValueError, AttributeError, TypeError):
        raise invalid() from None


def array(value, maximum, validator):
    if not isinstance(value, list) or len(value) > maximum:
        raise invalid()
    return [validator(item) for item in value]


def tags(value):
    return array(value, 60, lambda item: text(item, 100))


def url(value):
    value = text(value, 2048)
    try:
        parts = urlsplit(value)
        if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or any(char.isspace() for char in value):
            raise invalid()
        parts.port  # Reject malformed port numbers too.
    except ValueError:
        raise invalid() from None
    return value


def stack_group(value):
    object_fields(value, {"label", "tags"}, {"label", "tags"})
    return {"label": text(value["label"], 100), "tags": tags(value["tags"])}


def skill_group(value):
    object_fields(value, {"name", "items"}, {"name", "items"})
    return {"name": text(value["name"], 100, 0), "items": tags(value["items"])}


def site(value):
    object_fields(value, {"label", "url", "previewKey"}, {"label", "url"})
    result = {"label": text(value["label"]), "url": url(value["url"])}
    if "previewKey" in value:
        result["previewKey"] = identifier(value["previewKey"])
    return result


def content(collection, value, expected_id=None):
    if collection not in COLLECTIONS:
        raise invalid()
    required = FIELDS[collection] - {"categories", "partner", "partnerHonorific", "invoiceUnit", "sourceRow"}
    object_fields(value, FIELDS[collection] | COMMON, required | {"id"})
    result = {"id": identifier(value["id"]), "order": integer(value.get("order", 0), -1000000), "published": boolean(value.get("published", True))}
    if expected_id is not None and result["id"] != expected_id:
        raise invalid()
    for key in FIELDS[collection]:
        if key not in value:
            continue
        item = value[key]
        if key in {"tags", "phases"}:
            result[key] = tags(item)
        elif key == "stackGroups":
            result[key] = array(item, 20, stack_group)
        elif key == "groups":
            result[key] = array(item, 20, skill_group)
        elif key == "sites":
            result[key] = array(item, 10, site)
        elif key == "current":
            result[key] = boolean(item)
        elif key == "categories":
            result[key] = array(item, 3, lambda v: enum(v, CATEGORIES))
        elif key == "category" and collection == "projects":
            result[key] = enum(item, CATEGORIES)
        elif key == "icon":
            result[key] = enum(item, ("cloud", "development", "ai", "devops"))
        elif key == "priceYen":
            result[key] = None if item is None else integer(item, 0, 1000000000)
        elif key == "sourceRow":
            result[key] = integer(item, 1)
        elif key == "year":
            if not isinstance(item, str) or not re.fullmatch(r"(?:19|20|21)\d{2}", item):
                raise invalid()
            result[key] = item
        else:
            result[key] = text(item, 3000 if key in {"summary", "notes"} else 200,
                               0 if key in {"notes", "invoiceUnit", "unit", "partnerHonorific", "product"} else 1)
    return result


def project_public(collection, value):
    """Project nested allowlists before validation; internal properties never escape."""
    if not isinstance(value, dict):
        raise invalid()
    clean = {key: item for key, item in value.items() if key in FIELDS[collection] | COMMON}
    nested = {"stackGroups": {"label", "tags"}, "groups": {"name", "items"}, "sites": {"label", "url", "previewKey"}}
    for key, allowed in nested.items():
        if key in clean and isinstance(clean[key], list):
            clean[key] = [{k: v for k, v in item.items() if k in allowed} if isinstance(item, dict) else item for item in clean[key]]
    return content(collection, clean)


def version(value, allow_new=False):
    return None if allow_new and value is None else integer(value, 1, 2147483647)


def contact(value):
    object_fields(value, {"name", "company", "email", "type", "message", "website"}, {"name", "email", "type", "message"})
    if value.get("website", "") != "":
        raise invalid()
    result = {"name": text(value["name"], 100), "company": text(value.get("company", ""), 150, 0),
              "email": text(value["email"], 254), "type": enum(value["type"], CONTACT_TYPES),
              "message": text(value["message"], 3000, 10)}
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", result["email"]):
        raise invalid()
    return result


def contact_public_to_admin(item):
    return {key: item[key] for key in ("id", "name", "company", "email", "type", "message", "createdAt", "status", "version") if key in item}
