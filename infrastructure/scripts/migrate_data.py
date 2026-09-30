#!/usr/bin/env python3
"""Copy content and contact data between explicitly identified AWS accounts.

Use standard AWS profiles and Terraform output JSON files. Freeze source writes
during migration: a strongly consistent scan is not a point-in-time snapshot.
Existing destination items are never overwritten. Private backups are written
outside the repository, and diagnostics never include item data or item keys.
"""

import argparse
import base64
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

REPO = Path(__file__).resolve().parents[2]
KINDS = {"content": ("collection", "id"), "contacts": ("id",)}


class MigrationError(Exception):
    """Only fixed, non-sensitive messages should be passed to this exception."""


def load_outputs(filename):
    path = Path(filename)
    if path.stat().st_size > 1048576:
        raise MigrationError("Terraform outputs file is too large.")
    raw = json.loads(path.read_text(encoding="utf-8"))
    config = {}
    for key in ("region", "content_table_name", "contacts_table_name"):
        value = raw.get(key, {}).get("value")
        if not isinstance(value, str):
            raise MigrationError("Terraform outputs must contain region and both table names.")
        config[key] = value
    if not re.fullmatch(r"[a-z]{2}(?:-gov)?-[a-z]+-\d+", config["region"]):
        raise MigrationError("Terraform outputs contain an invalid region.")
    if any(not re.fullmatch(r"[A-Za-z0-9_.-]{3,255}", config[kind + "_table_name"]) for kind in KINDS):
        raise MigrationError("Terraform outputs contain an invalid table name.")
    if config["content_table_name"] == config["contacts_table_name"]:
        raise MigrationError("Content and contact tables must be separate.")
    return config


def verified_tables(session, config, expected_account):
    if session.client("sts").get_caller_identity().get("Account") != expected_account:
        raise MigrationError("AWS caller account does not match the explicitly authorized account.")
    resource = session.resource("dynamodb")
    client = session.client("dynamodb")
    tables = {}
    for kind, keys in KINDS.items():
        name = config[kind + "_table_name"]
        description = client.describe_table(TableName=name)["Table"]
        arn = description.get("TableArn", "").split(":", 5)
        if len(arn) != 6 or arn[2:5] != ["dynamodb", config["region"], expected_account] or arn[5] != "table/" + name:
            raise MigrationError("DynamoDB table ownership does not match the authorized account and region.")
        expected_keys = {"HASH": keys[0], **({"RANGE": keys[1]} if len(keys) == 2 else {})}
        actual_keys = {entry["KeyType"]: entry["AttributeName"] for entry in description.get("KeySchema", [])}
        attributes = {entry["AttributeName"]: entry["AttributeType"] for entry in description.get("AttributeDefinitions", [])}
        if actual_keys != expected_keys or any(attributes.get(key) != "S" for key in keys):
            raise MigrationError("DynamoDB table key schema does not match the migration contract.")
        if description.get("TableStatus") != "ACTIVE":
            raise MigrationError("DynamoDB tables must be ACTIVE before migration.")
        tables[kind] = resource.Table(name)
    return tables


def scan_pages(table, count_only=False):
    request = {"ConsistentRead": True, "Limit": 100, "Select": "COUNT" if count_only else "ALL_ATTRIBUTES"}
    while True:
        result = table.scan(**request)
        yield result
        key = result.get("LastEvaluatedKey")
        if not key:
            break
        request["ExclusiveStartKey"] = key


def count_items(table):
    return sum(page["Count"] for page in scan_pages(table, count_only=True))


def scan_items(table):
    return [item for page in scan_pages(table) for item in page.get("Items", [])]


def item_key(item, kind):
    keys = KINDS[kind]
    if any(not isinstance(item.get(key), str) or not item[key] for key in keys):
        raise MigrationError("A source item has an invalid primary key.")
    return {key: item[key] for key in keys}


def json_attribute(attribute):
    """TypeSerializer output with binary values base64 encoded for JSON storage."""
    kind, value = next(iter(attribute.items()))
    if kind == "B":
        value = base64.b64encode(bytes(value)).decode("ascii")
    elif kind == "BS":
        value = sorted(base64.b64encode(bytes(item)).decode("ascii") for item in value)
    elif kind in ("SS", "NS"):
        value = sorted(value)
    elif kind == "L":
        value = [json_attribute(item) for item in value]
    elif kind == "M":
        value = {key: json_attribute(item) for key, item in value.items()}
    return {kind: value}


def typed_item(item, serializer):
    return {key: json_attribute(serializer.serialize(value)) for key, value in item.items()}


def fingerprint(item, serializer):
    # Typed equality distinguishes BOOL from N and preserves all nested attributes.
    return json.dumps(typed_item(item, serializer), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def indexed_items(items, kind, serializer):
    result = {}
    for item in items:
        key = tuple(item_key(item, kind).values())
        if key in result:
            raise MigrationError("Source scan returned a duplicate key; freeze writes before retrying.")
        result[key] = fingerprint(item, serializer)
    return result


def private_backup_directory(directory):
    base = Path(directory).expanduser().resolve()
    if base == REPO or REPO in base.parents:
        raise MigrationError("Backup directory must be outside the repository.")
    base.mkdir(mode=0o700, parents=True, exist_ok=True)
    name = datetime.now(timezone.utc).strftime("migration-%Y%m%dT%H%M%SZ-") + uuid4().hex[:12]
    target = base / name
    target.mkdir(mode=0o700)
    return target


def write_backup(directory, kind, items, serializer, config, source_account):
    target = directory / (kind + ".json")
    document = {"schemaVersion": 1, "format": "dynamodb-attribute-values", "binaryEncoding": "base64",
                "sourceAccountId": source_account, "region": config["region"],
                "tableName": config[kind + "_table_name"], "count": len(items),
                "items": [typed_item(item, serializer) for item in items]}
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(str(target), flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as stream:
        json.dump(document, stream, ensure_ascii=False, separators=(",", ":"))
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def conditional_failure(error):
    return getattr(error, "response", {}).get("Error", {}).get("Code") == "ConditionalCheckFailedException"


def preflight_destination(table, items, kind, serializer):
    """Find any existing conflicts before the first destination write."""
    for item in items:
        existing = table.get_item(Key=item_key(item, kind), ConsistentRead=True).get("Item")
        if existing is not None and fingerprint(existing, serializer) != fingerprint(item, serializer):
            raise MigrationError("Destination contains conflicting data; no item will be overwritten.")


def copy_items(table, items, kind, serializer):
    created = identical = 0
    for item in items:
        try:
            table.put_item(Item=item, ConditionExpression="attribute_not_exists(#key)",
                           ExpressionAttributeNames={"#key": KINDS[kind][0]})
            created += 1
        except Exception as error:
            if not conditional_failure(error):
                raise
            existing = table.get_item(Key=item_key(item, kind), ConsistentRead=True).get("Item")
            if existing is None or fingerprint(existing, serializer) != fingerprint(item, serializer):
                raise MigrationError("Destination data changed or conflicts; no existing item was overwritten.") from None
            identical += 1
    return {"created": created, "identical": identical}


def verify_items(source_table, destination_table, original, kind, serializer):
    expected = indexed_items(original, kind, serializer)
    current = indexed_items(scan_items(source_table), kind, serializer)
    if current != expected:
        raise MigrationError("Source changed during migration; freeze writes and review the backup before retrying.")
    for item in original:
        existing = destination_table.get_item(Key=item_key(item, kind), ConsistentRead=True).get("Item")
        if existing is None or fingerprint(existing, serializer) != fingerprint(item, serializer):
            raise MigrationError("Destination verification failed; source and backups remain unchanged.")
    return len(expected)


def migrate(source, destination, serializer, backup_dir, source_config, source_account):
    snapshots = {kind: scan_items(source[kind]) for kind in KINDS}
    for kind, items in snapshots.items():
        indexed_items(items, kind, serializer)
    directory = private_backup_directory(backup_dir)
    # Complete both private backups before any destination write.
    for kind, items in snapshots.items():
        write_backup(directory, kind, items, serializer, source_config, source_account)
    for kind, items in snapshots.items():
        preflight_destination(destination[kind], items, kind, serializer)
    result = {}
    for kind, items in snapshots.items():
        result[kind] = {"source": len(items), **copy_items(destination[kind], items, kind, serializer)}
    for kind, items in snapshots.items():
        result[kind]["verified"] = verify_items(source[kind], destination[kind], items, kind, serializer)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-profile", required=True)
    parser.add_argument("--destination-profile", required=True)
    parser.add_argument("--source-account-id", required=True)
    parser.add_argument("--destination-account-id", required=True)
    parser.add_argument("--source-outputs", required=True, help="Source terraform output -json file")
    parser.add_argument("--destination-outputs", required=True, help="Destination terraform output -json file")
    parser.add_argument("--backup-dir", help="Private backup parent outside repository; required for live migration")
    parser.add_argument("--dry-run", action="store_true", help="Read table counts only; no item payloads, backups, or writes")
    args = parser.parse_args(argv)
    if any(not re.fullmatch(r"\d{12}", value) for value in (args.source_account_id, args.destination_account_id)):
        parser.error("Both expected account IDs must contain 12 digits.")
    if args.source_account_id == args.destination_account_id:
        parser.error("Source and destination must be different authorized accounts.")
    if not args.dry_run and not args.backup_dir:
        parser.error("Live migration requires --backup-dir outside the repository.")
    try:
        import boto3
        from boto3.dynamodb.types import TypeSerializer
        source_config, destination_config = load_outputs(args.source_outputs), load_outputs(args.destination_outputs)
        source_session = boto3.Session(profile_name=args.source_profile, region_name=source_config["region"])
        destination_session = boto3.Session(profile_name=args.destination_profile, region_name=destination_config["region"])
        source = verified_tables(source_session, source_config, args.source_account_id)
        destination = verified_tables(destination_session, destination_config, args.destination_account_id)
        if args.dry_run:
            result = {kind: {"source": count_items(source[kind]), "destination": count_items(destination[kind])} for kind in KINDS}
        else:
            result = migrate(source, destination, TypeSerializer(), args.backup_dir, source_config, args.source_account_id)
        print(json.dumps(result, sort_keys=True))
        return 0
    except MigrationError as error:
        print(str(error), file=sys.stderr)
    except Exception:
        # AWS SDK exceptions can contain item keys; never print exception values.
        print("Migration failed. Check profiles, table configuration, permissions, and private backups before retrying.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
