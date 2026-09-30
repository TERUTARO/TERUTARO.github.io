"""Protected CRUD operations with optimistic concurrency control."""

from common import db, pagination, validation
from common.auth import require_admin
from common.http import ApiError, condition_failed, conflict, endpoint, invalid, read_json, request_method, response


def content_item(item, collection):
    return {"id": item["id"], "data": validation.project_public(collection, item["data"]),
            "version": item["version"], "updatedAt": item["updatedAt"]}


def conditional(operation, **kwargs):
    try:
        return operation(**kwargs)
    except Exception as error:
        if condition_failed(error):
            raise conflict() from None
        raise


def manage_content(event, method, parts):
    if len(parts) not in (3, 4) or parts[2] not in validation.COLLECTIONS:
        raise invalid()
    collection = parts[2]
    content_table = db.table("CONTENT_TABLE")
    if method == "GET" and len(parts) == 3:
        items = [content_item(item, collection) for item in db.collection_items(content_table, collection)]
        return response(200, {"items": sorted(items, key=lambda item: (item["data"]["order"], item["id"]))})
    if len(parts) != 4:
        raise invalid()
    item_id = validation.identifier(parts[3])
    body = read_json(event)
    if method == "PUT":
        validation.object_fields(body, {"data", "version"}, {"data", "version"})
        data = validation.content(collection, body["data"], item_id)
        previous_version = validation.version(body["version"], allow_new=True)
        item = {"collection": collection, "id": item_id, "data": data,
                "version": (previous_version or 0) + 1, "updatedAt": db.timestamp()}
        condition = {"ConditionExpression": "attribute_not_exists(id)"} if previous_version is None else {
            "ConditionExpression": "#version = :expected",
            "ExpressionAttributeNames": {"#version": "version"},
            "ExpressionAttributeValues": {":expected": previous_version},
        }
        conditional(content_table.put_item, Item=item, **condition)
        return response(200, content_item(item, collection))
    if method == "DELETE":
        validation.object_fields(body, {"version"}, {"version"})
        previous_version = validation.version(body["version"])
        conditional(content_table.delete_item, Key={"collection": collection, "id": item_id},
                    ConditionExpression="#version = :expected", ExpressionAttributeNames={"#version": "version"},
                    ExpressionAttributeValues={":expected": previous_version})
        return response(200, {"id": item_id, "deleted": True})
    raise ApiError(405, "METHOD_NOT_ALLOWED", "この操作には対応していません。")


def manage_contacts(event, method, parts):
    if method == "GET" and len(parts) == 2:
        query = event.get("queryStringParameters") or {}
        validation.object_fields(query, {"cursor"})
        request = {"IndexName": "by-created-at", "KeyConditionExpression": "#entity = :entity",
                   "ExpressionAttributeNames": {"#entity": "entity"}, "ExpressionAttributeValues": {":entity": "contact"},
                   "ScanIndexForward": False, "Limit": 25}
        if "cursor" in query:
            request["ExclusiveStartKey"] = pagination.decode(query["cursor"])
        result = db.table("CONTACTS_TABLE").query(**request)
        return response(200, {"items": [validation.contact_public_to_admin(item) for item in result.get("Items", [])],
                              "nextCursor": pagination.encode(result.get("LastEvaluatedKey"))})
    if method == "PATCH" and len(parts) == 3:
        item_id = validation.uuid(parts[2])
        body = read_json(event, 2048)
        validation.object_fields(body, {"status", "version"}, {"status", "version"})
        status = validation.enum(body["status"], ("new", "read", "archived"))
        previous_version = validation.version(body["version"])
        result = conditional(db.table("CONTACTS_TABLE").update_item, Key={"id": item_id},
                             UpdateExpression="SET #status = :status, #version = :next",
                             ConditionExpression="#version = :expected AND #entity = :entity",
                             ExpressionAttributeNames={"#status": "status", "#version": "version", "#entity": "entity"},
                             ExpressionAttributeValues={":status": status, ":next": previous_version + 1,
                                                        ":expected": previous_version, ":entity": "contact"}, ReturnValues="ALL_NEW")
        return response(200, validation.contact_public_to_admin(result["Attributes"]))
    raise ApiError(405, "METHOD_NOT_ALLOWED", "この操作には対応していません。")


@endpoint
def lambda_handler(event, context):
    require_admin(event)
    method = request_method(event)
    path = event.get("rawPath", "")
    if not isinstance(path, str):
        raise invalid()
    parts = path.strip("/").split("/")
    if parts[:2] == ["admin", "content"]:
        return manage_content(event, method, parts)
    if parts[:2] == ["admin", "contacts"]:
        return manage_contacts(event, method, parts)
    raise ApiError(404, "NOT_FOUND", "対象が見つかりませんでした。")
