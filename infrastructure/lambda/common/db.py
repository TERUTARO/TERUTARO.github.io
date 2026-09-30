"""Lazy boto3 resource creation also keeps offline tests independent of AWS."""

import os
from datetime import datetime, timezone

_resource = None


def table(environment_key):
    global _resource
    if _resource is None:
        import boto3
        _resource = boto3.resource("dynamodb")
    return _resource.Table(os.environ[environment_key])


def timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def collection_items(content_table, collection):
    items = []
    request = {
        "KeyConditionExpression": "#collection = :collection",
        "ExpressionAttributeNames": {"#collection": "collection"},
        "ExpressionAttributeValues": {":collection": collection},
        "Limit": 200,
        "ConsistentRead": True,
    }
    while True:
        result = content_table.query(**request)
        items.extend(result.get("Items", []))
        if len(items) > 2000:
            raise RuntimeError("Collection capacity exceeded")
        key = result.get("LastEvaluatedKey")
        if not key:
            return items
        request["ExclusiveStartKey"] = key
