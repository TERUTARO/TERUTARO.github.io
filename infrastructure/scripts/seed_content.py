#!/usr/bin/env python3
"""Validate and seed public portfolio content without overwriting existing items.

Dry run needs only Python's standard library. Live seeding also needs boto3 and
uses its normal AWS credential provider; this script never reads credential files.
"""

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "infrastructure" / "lambda"))
from common import db, validation  # noqa: E402
from common.http import ApiError, condition_failed  # noqa: E402


def records():
    content_dir = REPO / "frontend" / "content"
    def read(name):
        return json.loads((content_dir / name).read_text(encoding="utf-8"))
    pricing = read("pricing.json")
    collections = {
        "projects": read("career.json")["projects"],
        "skills": read("skills.json"),
        "partners": read("partners.json"),
        "services": pricing["services"],
        "engineers": pricing["engineers"],
        "advisory": pricing["advisory"],
    }
    result = []
    for collection, values in collections.items():
        seen = set()
        for index, original in enumerate(values):
            data = dict(original)
            if "id" not in data:
                prefix = "service" if collection == "services" else "engineer"
                data["id"] = f"{prefix}-{data.get('sourceRow', index + 1):03d}"
            data.setdefault("order", index)
            data.setdefault("published", True)
            # Local provenance belongs to the source files, never to the public API.
            clean = validation.project_public(collection, data)
            if clean["id"] in seen:
                raise ValueError("Duplicate initial content identifier")
            seen.add(clean["id"])
            result.append({"collection": collection, "id": clean["id"], "data": clean,
                           "version": 1, "updatedAt": db.timestamp()})
    return result


def seed(table, items):
    created = skipped = 0
    for item in items:
        try:
            table.put_item(Item=item, ConditionExpression="attribute_not_exists(id)")
            created += 1
        except Exception as error:
            if not condition_failed(error):
                raise
            skipped += 1
    return {"created": created, "skipped": skipped}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--table", required=True, help="DynamoDB content table name")
    parser.add_argument("--region", default="ap-northeast-1")
    parser.add_argument("--allowed-account-id", help="Required for live writes; must match STS caller account")
    parser.add_argument("--dry-run", action="store_true", help="Validate local data only; make no AWS calls")
    args = parser.parse_args()
    if not args.dry_run and (not args.allowed_account_id or not re.fullmatch(r"\d{12}", args.allowed_account_id)):
        parser.error("Live seeding requires --allowed-account-id with the authorized 12-digit AWS account ID")
    try:
        items = records()
        counts = {collection: sum(item["collection"] == collection for item in items) for collection in validation.COLLECTIONS}
        print(json.dumps({"collections": counts, "total": len(items), "dryRun": args.dry_run}, ensure_ascii=False))
        if not args.dry_run:
            import boto3
            session = boto3.Session(region_name=args.region)
            account_id = session.client("sts").get_caller_identity()["Account"]
            if account_id != args.allowed_account_id:
                print("AWS account does not match --allowed-account-id; no content was written.", file=sys.stderr)
                return 1
            table = session.resource("dynamodb").Table(args.table)
            print(json.dumps(seed(table, items)))
        return 0
    except (ApiError, ValueError):
        print("Initial content validation failed; no invalid item was written.", file=sys.stderr)
        return 1
    except Exception:
        print("Seed failed. Check the table, AWS configuration, and permissions before retrying.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
