"""Additional authorization after API Gateway verifies the JWT signature."""

import json
import os
import re
from .http import ApiError


def require_admin(event):
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    if not isinstance(claims, dict):
        claims = {}
    groups = claims.get("cognito:groups", [])
    if isinstance(groups, str):
        try:
            parsed = json.loads(groups)
            groups = parsed if isinstance(parsed, list) else [groups]
        except (ValueError, TypeError):
            # HTTP API may represent JWT arrays as "[group-a group-b]".
            groups = re.split(r"[\s,]+", groups.strip().strip("[]"))
    if not isinstance(groups, list) or not all(isinstance(group, str) for group in groups):
        groups = []
    scope = claims.get("scope", "")
    scopes = scope.split() if isinstance(scope, str) else []
    if (claims.get("token_use") != "access"
            or os.environ.get("ADMIN_GROUP", "administrators") not in groups
            or os.environ.get("ADMIN_SCOPE", "aws.cognito.signin.user.admin") not in scopes):
        raise ApiError(403, "FORBIDDEN", "この操作を行う権限がありません。")
