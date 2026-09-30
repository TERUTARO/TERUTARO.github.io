"""Only known collections and explicitly published fields leave this endpoint."""

from common import db, validation
from common.http import ApiError, endpoint, request_method, response


@endpoint
def lambda_handler(event, context):
    if request_method(event) != "GET":
        raise ApiError(405, "METHOD_NOT_ALLOWED", "この操作には対応していません。")
    table = db.table("CONTENT_TABLE")
    collections = {}
    for collection in validation.COLLECTIONS:
        rows = []
        for item in db.collection_items(table, collection):
            data = item.get("data", {})
            if not isinstance(data, dict) or data.get("published") is not True:
                continue
            try:
                rows.append(validation.project_public(collection, data))
            except ApiError:
                continue
        collections[collection] = sorted(rows, key=lambda row: (row["order"], row["id"]))
    return response(200, {"schemaVersion": 1, "collections": collections}, public=True)
