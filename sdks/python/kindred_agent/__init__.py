from __future__ import annotations

from typing import Any, Dict, List, Tuple

REQUIRED_ACTION_FIELDS = {"tool", "args"}


def validate_run_step_response(payload: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Tiny helper to verify run_step responses before returning them."""

    errors: List[str] = []

    if not isinstance(payload, dict):
        errors.append("response must be a dict")
        return False, errors

    thought = payload.get("thought")
    if not isinstance(thought, str) or not thought.strip():
        errors.append("thought must be a non-empty string")

    action = payload.get("action")
    if not isinstance(action, dict):
        errors.append("action must be an object")
    else:
        missing = REQUIRED_ACTION_FIELDS - action.keys()
        if missing:
            errors.append(f"action missing fields: {', '.join(sorted(missing))}")
        if "tool" in action and not isinstance(action["tool"], str):
            errors.append("action.tool must be a string")
        if "args" in action and not isinstance(action["args"], dict):
            errors.append("action.args must be an object")

    return len(errors) == 0, errors
