"""Fail-closed validation for portable, local-only JSON settings."""

from __future__ import annotations

import math
import re
from typing import Any

MAX_JSON_DEPTH = 64

SENSITIVE_SETTING_NAMES = frozenset(
    {
        "apikey",
        "authorization",
        "bearer",
        "cookie",
        "credential",
        "credentials",
        "env",
        "passwd",
        "password",
        "privatekey",
        "secret",
        "session",
        "token",
    }
)


class SafeJsonError(ValueError):
    """A JSON value breaks Queuewright's portable offline contract."""

    def __init__(self, path: str, message: str) -> None:
        super().__init__(message)
        self.path = path
        self.message = message


def reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    """``json.loads`` object_pairs_hook that refuses a repeated key."""
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _key_parts(key: str) -> set[str]:
    snake_case = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", key)
    parts = set(re.findall(r"[a-z0-9]+", snake_case.lower()))
    return parts | {part[:-1] for part in parts if part.endswith("s")}


def validate_json_depth(value: Any, path: str) -> None:
    """Bound container nesting and reject non-UTF-8-encodable strings before hashing."""
    pending = [(value, 0)]
    while pending:
        current, depth = pending.pop()
        if isinstance(current, str):
            _require_unicode(current, path)
        if not isinstance(current, (dict, list)):
            continue
        depth += 1
        if depth > MAX_JSON_DEPTH:
            raise SafeJsonError(path, f"JSON must not exceed {MAX_JSON_DEPTH} nesting levels")
        if isinstance(current, dict):
            for key in current:
                if isinstance(key, str):
                    _require_unicode(key, path)
        children = current.values() if isinstance(current, dict) else current
        pending.extend((child, depth) for child in children if isinstance(child, (dict, list, str)))


def _require_unicode(text: str, path: str) -> None:
    try:
        text.encode("utf-8")
    except UnicodeEncodeError:
        raise SafeJsonError(path, "JSON strings must be valid Unicode text") from None


def _validate_scalar(value: Any, path: str) -> bool:
    if value is None or value.__class__ in {bool, int}:
        return True
    if value.__class__ is float:
        if math.isfinite(value):
            return True
        raise SafeJsonError(path, "settings must contain finite JSON numbers")
    if isinstance(value, str):
        if "://" in value:
            raise SafeJsonError(path, "settings must not contain URLs")
        return True
    return False


def validate_safe_json(value: Any, path: str) -> None:
    """Reject URLs, secret-shaped keys, non-finite numbers, and non-JSON values."""
    validate_json_depth(value, path)
    _validate_safe_json(value, path)


def _validate_safe_json(value: Any, path: str) -> None:
    if _validate_scalar(value, path):
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _validate_safe_json(item, f"{path}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise SafeJsonError(path, "settings object keys must be strings")
            parts = _key_parts(key)
            if (
                parts & SENSITIVE_SETTING_NAMES
                or {"api", "key"} <= parts
                or {"private", "key"} <= parts
            ):
                raise SafeJsonError(f"{path}.{key}", "sensitive setting names are forbidden")
            _validate_safe_json(item, f"{path}.{key}")
        return
    raise SafeJsonError(path, "settings must contain only JSON values")
