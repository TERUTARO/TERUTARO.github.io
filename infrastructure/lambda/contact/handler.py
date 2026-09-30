"""Persist validated enquiries once, with a short-lived per-IP send limit."""

import hashlib
import json
import time
from common import db, validation
from common.http import ApiError, condition_failed, conflict, endpoint, invalid, read_json, request_method, response


def existing_response(item, digest):
    if item.get("payloadHash") != digest:
        raise conflict()
    return response(200, {"id": item["id"], "receivedAt": item["createdAt"]})


@endpoint
def lambda_handler(event, context):
    if request_method(event) != "POST":
        raise ApiError(405, "METHOD_NOT_ALLOWED", "この操作には対応していません。")
    data = validation.contact(read_json(event, 16384))
    headers = {key.lower(): value for key, value in (event.get("headers") or {}).items()}
    contact_id = validation.uuid(headers.get("idempotency-key"))
    digest = hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    contacts = db.table("CONTACTS_TABLE")
    existing = contacts.get_item(Key={"id": contact_id}, ConsistentRead=True).get("Item")
    if existing:
        return existing_response(existing, digest)

    # Trust API Gateway's source IP, never client-supplied forwarded headers.
    source_ip = event.get("requestContext", {}).get("http", {}).get("sourceIp")
    if not isinstance(source_ip, str) or not source_ip or len(source_ip) > 64:
        raise invalid()
    bucket = int(time.time()) // 900
    rate_id = hashlib.sha256((str(bucket) + ":" + source_ip).encode("utf-8")).hexdigest()
    try:
        db.table("RATE_LIMIT_TABLE").update_item(
            Key={"id": rate_id},
            UpdateExpression="SET expiresAt = :expires ADD #count :one",
            ConditionExpression="attribute_not_exists(#count) OR #count < :limit",
            ExpressionAttributeNames={"#count": "count"},
            ExpressionAttributeValues={":expires": (bucket + 2) * 900, ":one": 1, ":limit": 5},
        )
    except Exception as error:
        if not condition_failed(error):
            raise
        existing = contacts.get_item(Key={"id": contact_id}, ConsistentRead=True).get("Item")
        if existing:
            return existing_response(existing, digest)
        raise ApiError(429, "RATE_LIMITED", "送信回数の上限に達しました。しばらくしてからお試しください。") from None

    received_at = db.timestamp()
    item = dict(data, id=contact_id, entity="contact", createdAt=received_at, version=1,
                status="new", payloadHash=digest)
    try:
        contacts.put_item(Item=item, ConditionExpression="attribute_not_exists(id)")
    except Exception as error:
        if not condition_failed(error):
            raise
        existing = contacts.get_item(Key={"id": contact_id}, ConsistentRead=True).get("Item")
        if existing:
            return existing_response(existing, digest)
        raise conflict() from None
    return response(201, {"id": contact_id, "receivedAt": received_at})
