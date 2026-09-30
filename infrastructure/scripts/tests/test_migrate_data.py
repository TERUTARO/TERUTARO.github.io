"""Migration tests with in-memory DynamoDB fakes; never contact AWS."""

import copy
import importlib.util
import io
import json
import stat
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

try:
    import boto3
    from boto3.dynamodb.types import Binary, TypeSerializer
except ImportError:
    boto3 = None

SCRIPT = Path(__file__).resolve().parents[1] / "migrate_data.py"
spec = importlib.util.spec_from_file_location("migrate_data", SCRIPT)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class OfflineSerializer:
    """Minimal SDK-shaped serializer, only for exercising copy logic offline."""
    def serialize(self, value):
        if value is None:
            return {"NULL": True}
        if isinstance(value, bool):
            return {"BOOL": value}
        if isinstance(value, (int, Decimal)):
            return {"N": str(value)}
        if isinstance(value, str):
            return {"S": value}
        if isinstance(value, bytes):
            return {"B": value}
        if isinstance(value, dict):
            return {"M": {key: self.serialize(item) for key, item in value.items()}}
        if isinstance(value, list):
            return {"L": [self.serialize(item) for item in value]}
        if isinstance(value, set):
            kind = next(iter(self.serialize(next(iter(value)))))
            return {kind + "S": [self.serialize(item)[kind] for item in value]}
        raise TypeError("Unsupported test value")


class ConditionalFailure(Exception):
    response = {"Error": {"Code": "ConditionalCheckFailedException"}}


class FakeTable:
    def __init__(self, kind, items=(), page_size=2):
        self.kind = kind
        self.items = {self.key(item): copy.deepcopy(item) for item in items}
        self.requests = []
        self.page_size = page_size
        self.race_item = None

    def key(self, item):
        return tuple(item[name] for name in migration.KINDS[self.kind])

    def scan(self, **request):
        self.requests.append(("scan", copy.deepcopy(request)))
        items = list(self.items.values())
        start = 0
        if request.get("ExclusiveStartKey"):
            key = self.key(request["ExclusiveStartKey"])
            start = next(index + 1 for index, item in enumerate(items) if self.key(item) == key)
        page = items[start:start + self.page_size]
        result = {"Count": len(page)}
        if request["Select"] != "COUNT":
            result["Items"] = copy.deepcopy(page)
        if start + len(page) < len(items):
            result["LastEvaluatedKey"] = migration.item_key(page[-1], self.kind)
        return result

    def get_item(self, **request):
        self.requests.append(("get", copy.deepcopy(request)))
        item = self.items.get(self.key(request["Key"]))
        return {"Item": copy.deepcopy(item)} if item is not None else {}

    def put_item(self, **request):
        self.requests.append(("put", copy.deepcopy(request)))
        key = self.key(request["Item"])
        if self.race_item is not None:
            self.items[key] = self.race_item
            self.race_item = None
        if key in self.items:
            raise ConditionalFailure()
        self.items[key] = copy.deepcopy(request["Item"])


class FakeSession:
    def __init__(self, account="111111111111", table_account=None, broken_schema=False):
        self.account = account
        self.table_account = table_account or account
        self.broken_schema = broken_schema

    def client(self, service):
        return self

    def resource(self, service):
        return self

    def get_caller_identity(self):
        return {"Account": self.account}

    def describe_table(self, TableName):
        kind = "contacts" if "contacts" in TableName else "content"
        names = migration.KINDS[kind]
        return {"Table": {"TableArn": f"arn:aws:dynamodb:ap-northeast-1:{self.table_account}:table/{TableName}",
                          "TableStatus": "ACTIVE", "KeySchema": [{"KeyType": role, "AttributeName": name} for role, name in zip(("HASH", "RANGE"), names)],
                          "AttributeDefinitions": [{"AttributeName": name, "AttributeType": "N" if self.broken_schema else "S"} for name in names]}}

    def Table(self, name):
        return FakeTable("contacts" if "contacts" in name else "content")


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.serializer = OfflineSerializer()
        self.config = {"region": "ap-northeast-1", "content_table_name": "portfolio-content", "contacts_table_name": "portfolio-contacts"}
        self.content = [{"collection": "projects", "id": f"project-{i}", "data": {"title": f"test-{i}", "published": True}, "version": Decimal(i + 1), "updatedAt": "2026-09-30T00:00:00.000Z"} for i in range(5)]
        self.contacts = [{"id": f"contact-{i}", "entity": "contact", "email": "private@example.test", "message": "個人情報を含む本文", "status": "read", "version": Decimal(3)} for i in range(3)]
        self.source = {"content": FakeTable("content", self.content), "contacts": FakeTable("contacts", self.contacts)}
        self.destination = {kind: FakeTable(kind) for kind in migration.KINDS}
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)

    def migrate(self):
        return migration.migrate(self.source, self.destination, self.serializer, self.temporary.name, self.config, "111111111111")

    def test_paginated_consistent_scan_and_count_only_dry_run(self):
        table = self.source["content"]
        self.assertEqual(migration.count_items(table), 5)
        self.assertEqual(len(table.requests), 3)
        self.assertTrue(all(request["ConsistentRead"] and request["Select"] == "COUNT" for _, request in table.requests))
        self.assertIn("ExclusiveStartKey", table.requests[1][1])
        self.assertEqual(migration.scan_items(table), self.content)
        self.assertTrue(all(operation == "scan" for operation, _ in table.requests))

    def test_full_copy_preserves_all_attributes_and_private_backups(self):
        result = self.migrate()
        self.assertEqual(result["content"], {"source": 5, "created": 5, "identical": 0, "verified": 5})
        self.assertEqual(result["contacts"], {"source": 3, "created": 3, "identical": 0, "verified": 3})
        self.assertEqual(self.source["content"].items, self.destination["content"].items)
        self.assertEqual(self.source["contacts"].items, self.destination["contacts"].items)
        directory = next(Path(self.temporary.name).iterdir())
        self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)
        for file in directory.iterdir():
            self.assertEqual(stat.S_IMODE(file.stat().st_mode), 0o600)
        backup = json.loads((directory / "contacts.json").read_text())
        self.assertEqual(backup["items"][0]["version"], {"N": "3"})
        self.assertEqual(backup["items"][0]["email"], {"S": "private@example.test"})
        for table in self.destination.values():
            for operation, request in table.requests:
                if operation == "put":
                    self.assertEqual(request["ConditionExpression"], "attribute_not_exists(#key)")
                if operation == "get":
                    self.assertIs(request["ConsistentRead"], True)

    def test_repeated_identical_items_skip_without_changing_data(self):
        self.migrate()
        before = copy.deepcopy(self.destination["contacts"].items)
        result = self.migrate()
        self.assertEqual(result["content"]["identical"], 5)
        self.assertEqual(result["contacts"]["identical"], 3)
        self.assertEqual(result["content"]["created"], 0)
        self.assertEqual(before, self.destination["contacts"].items)
        self.assertEqual(len(list(Path(self.temporary.name).iterdir())), 2)

    def test_conflict_in_second_table_prevents_every_destination_write(self):
        changed = {**self.contacts[-1], "status": "archived"}
        self.destination["contacts"].items[self.destination["contacts"].key(changed)] = changed
        with self.assertRaises(migration.MigrationError):
            self.migrate()
        self.assertFalse(self.destination["content"].items)
        self.assertTrue(all(operation != "put" for table in self.destination.values() for operation, _ in table.requests))
        self.assertEqual(self.destination["contacts"].items[('contact-2',)]["status"], "archived")
        self.assertEqual(len(list(Path(self.temporary.name).rglob('*.json'))), 2)

    def test_conditional_write_detects_racing_conflict_without_overwrite(self):
        changed = {**self.content[0], "version": Decimal(999)}
        self.destination["content"].race_item = changed
        with self.assertRaises(migration.MigrationError):
            migration.copy_items(self.destination["content"], self.content, "content", self.serializer)
        self.assertEqual(self.destination["content"].items[('projects', 'project-0')]["version"], Decimal(999))

    def test_conditional_racing_identical_write_is_safe_skip(self):
        self.destination["content"].race_item = copy.deepcopy(self.content[0])
        result = migration.copy_items(self.destination["content"], self.content, "content", self.serializer)
        self.assertEqual(result, {"created": 4, "identical": 1})

    def test_source_change_and_destination_change_are_detected(self):
        self.migrate()
        self.source["content"].items[('projects', 'project-0')]["version"] = Decimal(20)
        with self.assertRaises(migration.MigrationError):
            migration.verify_items(self.source["content"], self.destination["content"], self.content, "content", self.serializer)
        self.source["content"].items[('projects', 'project-0')]["version"] = Decimal(1)
        self.destination["content"].items[('projects', 'project-0')]["data"]["title"] = "edited"
        with self.assertRaises(migration.MigrationError):
            migration.verify_items(self.source["content"], self.destination["content"], self.content, "content", self.serializer)

    def test_backups_cannot_be_written_into_repository(self):
        with self.assertRaises(migration.MigrationError):
            migration.private_backup_directory(migration.REPO / "private-backup")

    def test_typed_json_handles_binary_sets_nested_decimals_and_boolean_distinction(self):
        item = {"nested": {"amount": Decimal("12.50"), "enabled": True, "empty": None},
                "binary": b'\x00\xff', "binarySet": {b'b', b'a'}, "strings": {"z", "a"}, "numbers": {Decimal('2'), Decimal('1')}}
        typed = migration.typed_item(item, self.serializer)
        self.assertEqual(typed["binary"], {"B": "AP8="})
        self.assertEqual(typed["binarySet"], {"BS": ["YQ==", "Yg=="]})
        self.assertEqual(typed["nested"]["M"]["amount"], {"N": "12.50"})
        json.dumps(typed)
        self.assertNotEqual(migration.fingerprint({"v": True}, self.serializer), migration.fingerprint({"v": Decimal(1)}, self.serializer))

    def test_account_ownership_and_schema_are_checked_before_data_access(self):
        with self.assertRaises(migration.MigrationError):
            migration.verified_tables(FakeSession(account="222222222222"), self.config, "111111111111")
        with self.assertRaises(migration.MigrationError):
            migration.verified_tables(FakeSession(table_account="222222222222"), self.config, "111111111111")
        with self.assertRaises(migration.MigrationError):
            migration.verified_tables(FakeSession(broken_schema=True), self.config, "111111111111")
        tables = migration.verified_tables(FakeSession(), self.config, "111111111111")
        self.assertEqual(set(tables), {"content", "contacts"})

    def test_same_account_is_rejected_before_any_sdk_import(self):
        args = ["--source-profile", "old", "--destination-profile", "new", "--source-account-id", "111111111111", "--destination-account-id", "111111111111", "--source-outputs", "old.json", "--destination-outputs", "new.json", "--dry-run"]
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as result:
                migration.main(args)
        self.assertEqual(result.exception.code, 2)

    @unittest.skipIf(boto3 is None, "Optional boto3 integration test")
    def test_real_type_serializer_preserves_binary_and_decimal_values(self):
        serializer = TypeSerializer()
        value = {"price": Decimal("123.45"), "blob": Binary(b'\x00\xff'), "set": {Decimal(1), Decimal(2)}}
        self.assertEqual(migration.typed_item(value, serializer), {"price": {"N": "123.45"}, "blob": {"B": "AP8="}, "set": {"NS": ["1", "2"]}})
        self.assertEqual(migration.copy_items(self.destination["content"], self.content, "content", serializer), {"created": 5, "identical": 0})

    @unittest.skipIf(boto3 is None, "Optional boto3 integration test")
    def test_dry_run_cli_outputs_only_counts_and_makes_no_item_writes(self):
        args = ["--source-profile", "old", "--destination-profile", "new", "--source-account-id", "111111111111", "--destination-account-id", "222222222222", "--source-outputs", "old.json", "--destination-outputs", "new.json", "--dry-run"]
        output = io.StringIO()
        with patch.object(boto3, "Session"), patch.object(migration, "load_outputs", return_value=self.config), patch.object(migration, "verified_tables", side_effect=[self.source, self.destination]), patch.object(migration, "migrate") as copy_call, redirect_stdout(output):
            self.assertEqual(migration.main(args), 0)
            copy_call.assert_not_called()
        self.assertEqual(json.loads(output.getvalue()), {"content": {"source": 5, "destination": 0}, "contacts": {"source": 3, "destination": 0}})
        self.assertTrue(all(operation == "scan" and request["Select"] == "COUNT" for table in [*self.source.values(), *self.destination.values()] for operation, request in table.requests))

    @unittest.skipIf(boto3 is None, "Optional boto3 integration test")
    def test_unexpected_sdk_exception_does_not_log_private_data(self):
        args = ["--source-profile", "old", "--destination-profile", "new", "--source-account-id", "111111111111", "--destination-account-id", "222222222222", "--source-outputs", "old.json", "--destination-outputs", "new.json", "--dry-run"]
        output, errors = io.StringIO(), io.StringIO()
        with patch.object(boto3, "Session", side_effect=RuntimeError("private@example.test")), patch.object(migration, "load_outputs", return_value=self.config), redirect_stdout(output), redirect_stderr(errors):
            self.assertEqual(migration.main(args), 1)
        self.assertEqual(output.getvalue(), "")
        self.assertNotIn("private@example.test", errors.getvalue())


if __name__ == "__main__":
    unittest.main()
