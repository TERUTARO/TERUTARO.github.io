"""Contact endpoint scaffold. Message delivery is not implemented yet."""

import json


def lambda_handler(event, context):
    """Return an explicit unavailable response without processing the request."""
    return {
        "statusCode": 501,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
        },
        "body": json.dumps(
            {
                "error": "CONTACT_NOT_IMPLEMENTED",
                "message": "お問い合わせの送信機能は準備中です。",
            },
            ensure_ascii=False,
        ),
        "isBase64Encoded": False,
    }
