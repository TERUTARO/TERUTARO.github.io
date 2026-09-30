"""Offline security and persistence tests. No boto3 clients or AWS calls."""

import base64
import copy
import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

LAMBDA_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LAMBDA_ROOT))
from admin.handler import lambda_handler as admin
from contact.handler import lambda_handler as contact
from public.handler import lambda_handler as public
from common import db, pagination, validation
from common.http import ApiError

spec = importlib.util.spec_from_file_location("seed_content", LAMBDA_ROOT.parent / "scripts" / "seed_content.py")
seed_content = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed_content)

NOW = "2026-09-30T05:00:00.000Z"
CLAIMS = {"token_use": "access", "scope": "aws.cognito.signin.user.admin", "cognito:groups": ["administrators"]}
MESSAGE = {"name": "テスト利用者", "company": "テスト会社", "email": "test@example.test", "type": "その他のご相談", "message": "接続検証のための問い合わせです。", "website": ""}


class ConditionalFailure(Exception):
    response = {"Error": {"Code": "ConditionalCheckFailedException"}}


class FakeTable:
    def __init__(self):
        self.items = {}
        self.requests = []
        self.concurrent_item = None

    @staticmethod
    def key(item):
        return (item.get("collection"), item["id"])

    def get_item(self, **request):
        self.requests.append(("get", copy.deepcopy(request)))
        item = self.items.get(self.key(request["Key"]))
        return {"Item": copy.deepcopy(item)} if item else {}

    def put_item(self, **request):
        self.requests.append(("put", copy.deepcopy(request)))
        key = self.key(request["Item"])
        if self.concurrent_item:
            self.items[key] = copy.deepcopy(request["Item"])
            self.concurrent_item = None
            raise ConditionalFailure()
        current = self.items.get(key)
        if request["ConditionExpression"] == "attribute_not_exists(id)":
            if current:
                raise ConditionalFailure()
        elif not current or current["version"] != request["ExpressionAttributeValues"][":expected"]:
            raise ConditionalFailure()
        self.items[key] = copy.deepcopy(request["Item"])
        return {}

    def delete_item(self, **request):
        self.requests.append(("delete", copy.deepcopy(request)))
        key = self.key(request["Key"])
        current = self.items.get(key)
        if not current or current["version"] != request["ExpressionAttributeValues"][":expected"]:
            raise ConditionalFailure()
        del self.items[key]
        return {}

    def update_item(self, **request):
        self.requests.append(("update", copy.deepcopy(request)))
        key = self.key(request["Key"])
        values = request["ExpressionAttributeValues"]
        current = self.items.get(key)
        if ":limit" in values:
            current = current or dict(request["Key"], count=0)
            if current["count"] >= values[":limit"]:
                raise ConditionalFailure()
            current["count"] += 1
            current["expiresAt"] = values[":expires"]
        else:
            if not current or current["version"] != values[":expected"] or current.get("entity") != "contact":
                raise ConditionalFailure()
            current.update(status=values[":status"], version=values[":next"])
        self.items[key] = current
        return {"Attributes": copy.deepcopy(current)}

    def query(self, **request):
        self.requests.append(("query", copy.deepcopy(request)))
        values = request["ExpressionAttributeValues"]
        if ":collection" in values:
            items = [item for item in self.items.values() if item.get("collection") == values[":collection"]]
            items.sort(key=lambda item: item["id"])
        else:
            items = [item for item in self.items.values() if item.get("entity") == "contact"]
            items.sort(key=lambda item: (item["createdAt"], item["id"]), reverse=True)
        if request.get("ExclusiveStartKey"):
            found = next(index for index, item in enumerate(items) if item["id"] == request["ExclusiveStartKey"]["id"])
            items = items[found + 1:]
        page = items[:request["Limit"]]
        result = {"Items": copy.deepcopy(page)}
        if len(items) > len(page):
            keys = ("collection", "id") if ":collection" in values else ("id", "entity", "createdAt")
            result["LastEvaluatedKey"] = {key: page[-1][key] for key in keys}
        return result


def event(method="GET", path="/public/content", body=None, authenticated=False):
    value = {"rawPath": path, "requestContext": {"http": {"method": method, "sourceIp": "192.0.2.123"}}, "headers": {}}
    if authenticated:
        value["requestContext"]["authorizer"] = {"jwt": {"claims": copy.deepcopy(CLAIMS)}}
    if body is not None:
        value["body"] = json.dumps(body, ensure_ascii=False)
    return value


def decoded(result):
    return json.loads(result["body"])


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tables = {name: FakeTable() for name in ("CONTENT_TABLE", "CONTACTS_TABLE", "RATE_LIMIT_TABLE")}
        self.table_patch = patch.object(db, "table", side_effect=lambda name: self.tables[name])
        self.table_patch.start()
        self.addCleanup(self.table_patch.stop)
        self.time_patch = patch.object(db, "timestamp", return_value=NOW)
        self.time_patch.start()
        self.addCleanup(self.time_patch.stop)
        self.content = seed_content.records()

    def send_contact(self, key=None, message=None):
        request = event("POST", "/contact", message or MESSAGE)
        request["headers"]["Idempotency-Key"] = key or str(uuid4())
        return contact(request, None)

    def put_content(self, data=None, version=None):
        data = data or self.content[0]["data"]
        return admin(event("PUT", "/admin/content/projects/" + data["id"], {"data": data, "version": version}, True), None)

    def test_all_seed_records_validate_and_are_only_public_fields(self):
        self.assertEqual({name: sum(row["collection"] == name for row in self.content) for name in validation.COLLECTIONS},
                         {"projects": 32, "skills": 4, "partners": 3, "services": 39, "engineers": 19, "advisory": 1})
        for row in self.content:
            self.assertEqual(validation.content(row["collection"], row["data"]), row["data"])
            self.assertNotIn("source", row["data"])

    def test_seed_never_overwrites_existing_edits(self):
        table = self.tables["CONTENT_TABLE"]
        seed_content.seed(table, self.content)
        first = table.items[table.key(self.content[0])]
        first["data"]["title"] = "管理画面での更新"
        result = seed_content.seed(table, self.content)
        self.assertEqual(result, {"created": 0, "skipped": 98})
        self.assertEqual(first["data"]["title"], "管理画面での更新")

    def test_admin_requires_authorizer_access_scope_and_exact_group(self):
        base = event("GET", "/admin/contacts", authenticated=True)
        for claims in ({}, {**CLAIMS, "token_use": "id"}, {**CLAIMS, "scope": ""},
                       {**CLAIMS, "cognito:groups": "not-administrators"}, {**CLAIMS, "cognito:groups": ["Administrators"]}):
            request = copy.deepcopy(base)
            request["requestContext"]["authorizer"]["jwt"]["claims"] = claims
            self.assertEqual(admin(request, None)["statusCode"], 403)
        self.assertEqual(admin(event("GET", "/admin/contacts"), None)["statusCode"], 403)
        self.assertFalse(self.tables["CONTACTS_TABLE"].requests)

    def test_authorizer_group_array_encodings(self):
        for groups in (["editors", "administrators"], '["editors","administrators"]', "[editors administrators]", "[editors,administrators]", "administrators"):
            request = event("GET", "/admin/contacts", authenticated=True)
            request["requestContext"]["authorizer"]["jwt"]["claims"]["cognito:groups"] = groups
            self.assertEqual(admin(request, None)["statusCode"], 200)

    def test_public_projection_does_not_leak_nested_private_fields_or_contacts(self):
        rows = copy.deepcopy(self.content)
        rows[0]["data"].update(privateEmail="private@example.test", published=False)
        rows[1]["data"]["privateEmail"] = "private@example.test"
        rows[1]["data"]["stackGroups"][0]["secret"] = "nested-secret"
        rows[2]["data"].pop("published")
        for row in rows:
            self.tables["CONTENT_TABLE"].items[FakeTable.key(row)] = row
        result = public(event(), None)
        self.assertEqual(result["statusCode"], 200)
        data = decoded(result)
        self.assertEqual(len(data["collections"]["projects"]), 30)
        self.assertNotIn("private@example.test", result["body"])
        self.assertNotIn("nested-secret", result["body"])
        self.assertNotIn("contacts", data["collections"])
        self.assertFalse(self.tables["CONTACTS_TABLE"].requests)

    def test_unknown_top_level_and_nested_input_fields_rejected(self):
        data = copy.deepcopy(self.content[0]["data"])
        data["privateEmail"] = "private@example.test"
        self.assertEqual(self.put_content(data)["statusCode"], 400)
        data.pop("privateEmail")
        data["stackGroups"][0]["secret"] = "value"
        self.assertEqual(self.put_content(data)["statusCode"], 400)
        self.assertFalse(self.tables["CONTENT_TABLE"].items)

    def test_content_validation_types_ranges_urls_and_lengths(self):
        project = self.content[0]["data"]
        for field, value in (("current", 1), ("order", True), ("year", "yesterday"), ("category", "other"),
                             ("tags", ["x"] * 61), ("summary", "x" * 3001), ("title", "")):
            with self.subTest(field=field):
                with self.assertRaises(ApiError):
                    validation.content("projects", {**project, field: value})
        partner = next(row["data"] for row in self.content if row["collection"] == "partners")
        for url in ("javascript:alert(1)", "http://example.test", "https://user:pass@example.test", "https://example.test:bad"):
            with self.assertRaises(ApiError):
                validation.content("partners", {**partner, "sites": [{"label": "site", "url": url}]})
        service = next(row["data"] for row in self.content if row["collection"] == "services")
        for price in (-1, True, 1000000001, 1.1):
            with self.assertRaises(ApiError):
                validation.content("services", {**service, "priceYen": price})

    def test_create_edit_conflicts_and_delete_are_conditional(self):
        data = self.content[0]["data"]
        self.assertEqual(self.put_content()["statusCode"], 200)
        self.assertEqual(self.put_content()["statusCode"], 409)
        self.assertEqual(decoded(self.put_content({**data, "title": "改訂"}, 1))["version"], 2)
        self.assertEqual(self.put_content(data, 1)["statusCode"], 409)
        path = "/admin/content/projects/" + data["id"]
        self.assertEqual(admin(event("DELETE", path, {"version": 1}, True), None)["statusCode"], 409)
        self.assertEqual(admin(event("DELETE", path, {"version": 2}, True), None)["statusCode"], 200)
        self.assertFalse(self.tables["CONTENT_TABLE"].items)

    def test_contact_returns_receipt_only_and_duplicate_does_not_resend(self):
        key = str(uuid4())
        first = self.send_contact(key)
        second = self.send_contact(key)
        self.assertEqual((first["statusCode"], second["statusCode"]), (201, 200))
        self.assertEqual(decoded(first), {"id": key, "receivedAt": NOW})
        self.assertEqual(decoded(first), decoded(second))
        self.assertEqual(len(self.tables["CONTACTS_TABLE"].items), 1)
        self.assertEqual(len(self.tables["RATE_LIMIT_TABLE"].requests), 1)
        self.assertEqual(self.send_contact(key, {**MESSAGE, "name": "別のお名前"})["statusCode"], 409)

    def test_concurrent_contact_duplicate_returns_success(self):
        self.tables["CONTACTS_TABLE"].concurrent_item = True
        result = self.send_contact()
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(len(self.tables["CONTACTS_TABLE"].items), 1)

    def test_rate_limit_is_atomic_and_has_no_raw_ip(self):
        with patch("contact.handler.time.time", return_value=1800):
            self.assertEqual([self.send_contact()["statusCode"] for _ in range(6)], [201] * 5 + [429])
        rate_table = self.tables["RATE_LIMIT_TABLE"]
        self.assertEqual(len(rate_table.items), 1)
        item = next(iter(rate_table.items.values()))
        self.assertEqual(item["count"], 5)
        self.assertEqual(item["expiresAt"], 3600)
        self.assertNotIn("192.0.2.123", json.dumps(rate_table.requests))
        self.assertTrue(all("ConditionExpression" in request for _, request in rate_table.requests))

    def test_contact_validation_honeypot_oversize_and_unknown_fields(self):
        for changes in ({"website": "https://spam.test"}, {"email": "bad"}, {"message": "short"}, {"name": ""}, {"private": "field"}, {"type": "unknown"}):
            self.assertEqual(self.send_contact(message={**MESSAGE, **changes})["statusCode"], 400)
        request = event("POST", "/contact", MESSAGE)
        request["headers"]["Idempotency-Key"] = str(uuid4())
        request["body"] = " " * 16385
        self.assertEqual(contact(request, None)["statusCode"], 400)
        self.assertFalse(self.tables["CONTACTS_TABLE"].requests)

    def test_contact_invalid_idempotency_key_rejected(self):
        self.assertEqual(self.send_contact("not-a-uuid")["statusCode"], 400)
        self.assertFalse(self.tables["CONTACTS_TABLE"].requests)

    def test_duplicate_json_keys_and_non_finite_numbers_rejected(self):
        request = event("PUT", "/admin/content/projects/test", authenticated=True)
        for body in ('{"version":1,"version":2,"data":{}}', '{"version":NaN,"data":{}}'):
            request["body"] = body
            self.assertEqual(admin(request, None)["statusCode"], 400)

    def test_contact_cursor_limits_scope_and_paginates(self):
        contacts = self.tables["CONTACTS_TABLE"]
        for index in range(27):
            item = dict(MESSAGE, id=str(uuid4()), entity="contact", createdAt=f"2026-09-30T05:00:{index:02}.000Z", status="new", version=1, payloadHash="never-expose")
            contacts.items[contacts.key(item)] = item
        first = decoded(admin(event("GET", "/admin/contacts", authenticated=True), None))
        self.assertEqual(len(first["items"]), 25)
        self.assertNotIn("payloadHash", first["items"][0])
        request = event("GET", "/admin/contacts", authenticated=True)
        request["queryStringParameters"] = {"cursor": first["nextCursor"]}
        second = decoded(admin(request, None))
        self.assertEqual(len(second["items"]), 2)
        self.assertIsNone(second["nextCursor"])
        self.assertGreater(first["items"][0]["createdAt"], second["items"][0]["createdAt"])
        self.assertEqual(contacts.requests[-1][1]["IndexName"], "by-created-at")

    def test_malformed_or_cross_entity_cursor_rejected_before_query(self):
        for cursor in ("!bad", "x" * 513, base64.urlsafe_b64encode(json.dumps({"id": str(uuid4()), "entity": "private", "createdAt": NOW}).encode()).decode().rstrip("=")):
            request = event("GET", "/admin/contacts", authenticated=True)
            request["queryStringParameters"] = {"cursor": cursor}
            self.assertEqual(admin(request, None)["statusCode"], 400)
        self.assertFalse(self.tables["CONTACTS_TABLE"].requests)

    def test_contact_status_patch_is_versioned_and_whitelisted(self):
        key = decoded(self.send_contact())["id"]
        path = "/admin/contacts/" + key
        result = admin(event("PATCH", path, {"status": "read", "version": 1}, True), None)
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(decoded(result)["version"], 2)
        self.assertNotIn("payloadHash", decoded(result))
        self.assertEqual(admin(event("PATCH", path, {"status": "archived", "version": 1}, True), None)["statusCode"], 409)
        self.assertEqual(admin(event("PATCH", path, {"status": "deleted", "version": 2}, True), None)["statusCode"], 400)

    def test_storage_errors_do_not_echo_pii_or_internal_exception(self):
        with patch.object(db, "table", side_effect=RuntimeError("test@example.test internal-table-secret")):
            result = self.send_contact()
        self.assertEqual(result["statusCode"], 500)
        self.assertNotIn("test@example.test", result["body"])
        self.assertNotIn("internal-table-secret", result["body"])


if __name__ == "__main__":
    unittest.main()
