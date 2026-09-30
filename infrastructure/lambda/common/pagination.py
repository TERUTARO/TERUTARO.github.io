"""Opaque, narrowly validated DynamoDB contact cursors (no contact PII)."""

import base64
import binascii
import json
import re
from datetime import datetime
from .http import invalid, reject_duplicate_keys
from .validation import uuid


def validate_key(key):
    if not isinstance(key, dict) or set(key) != {"id", "entity", "createdAt"} or key["entity"] != "contact":
        raise invalid()
    uuid(key["id"])
    date = key["createdAt"]
    if not isinstance(date, str) or not re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z", date):
        raise invalid()
    try:
        datetime.strptime(date, "%Y-%m-%dT%H:%M:%S.%fZ")
    except ValueError:
        raise invalid() from None
    return key


def encode(key):
    if not key:
        return None
    return base64.urlsafe_b64encode(json.dumps(validate_key(key), separators=(",", ":")).encode("utf-8")).decode("ascii").rstrip("=")


def decode(value):
    if not isinstance(value, str) or not 1 <= len(value) <= 512 or not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise invalid()
    try:
        raw = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
        key = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicate_keys)
        return validate_key(key)
    except (ValueError, TypeError, UnicodeError, binascii.Error):
        raise invalid() from None
