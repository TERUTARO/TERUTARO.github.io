"""Small HTTP boundary shared by the three Lambda handlers."""

import base64
import json
from decimal import Decimal
from functools import wraps


class ApiError(Exception):
    def __init__(self, status, code, message):
        self.status = status
        self.code = code
        self.message = message


def invalid():
    return ApiError(400, "INVALID_INPUT", "入力内容を確認してください。")


def conflict():
    return ApiError(409, "CONFLICT", "内容が更新されています。再取得してからお試しください。")


def json_number(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError("Unsupported JSON value")


def response(status, body, public=False):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=60" if public else "no-store",
            "X-Content-Type-Options": "nosniff",
        },
        "body": json.dumps(body, ensure_ascii=False, default=json_number, allow_nan=False),
        "isBase64Encoded": False,
    }


def endpoint(function):
    @wraps(function)
    def wrapped(event, context):
        try:
            return function(event, context)
        except ApiError as error:
            return response(error.status, {"error": error.code, "message": error.message})
        except Exception:
            # Never include exception strings, request bodies, IPs, or email addresses.
            return response(500, {"error": "INTERNAL_ERROR", "message": "処理できませんでした。時間をおいてお試しください。"})
    return wrapped


def reject_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate key")
        result[key] = value
    return result


def read_json(event, max_bytes=65536):
    try:
        raw = event.get("body", "")
        if not isinstance(raw, str) or len(raw) > max_bytes * 2:
            raise invalid()
        raw = base64.b64decode(raw, validate=True) if event.get("isBase64Encoded") else raw.encode("utf-8")
        if len(raw) > max_bytes:
            raise invalid()
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=reject_duplicate_keys,
                           parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Non-finite value")))
        if not isinstance(value, dict):
            raise invalid()
        return value
    except (ValueError, UnicodeError, TypeError):
        raise invalid() from None


def condition_failed(error):
    return getattr(error, "response", {}).get("Error", {}).get("Code") == "ConditionalCheckFailedException"


def request_method(event):
    return event.get("requestContext", {}).get("http", {}).get("method", event.get("httpMethod", ""))
