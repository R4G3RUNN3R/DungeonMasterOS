#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "research" / "campaign-library"
SCHEMA_PATH = LIB / "_templates" / "campaign-template-v2.schema.json"
LOOT_SCHEMA_PATH = LIB / "_templates" / "campaign-loot-profile.schema.json"

LOOT_MINIMUMS = {
    "micro": 2,
    "one-shot": 3,
    "short": 4,
    "multi-session": 6,
}


def read(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def add_schema_errors(failures, validator, data, path):
    for error in sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path)):
        pointer = "/".join(map(str, error.absolute_path)) or "<root>"
        failures.append(f"{path.relative_to(ROOT)} [{pointer}]: {error.message}")


def validate_loot_semantics(failures, profile, path, campaign_status=None):
    scale = profile.get("campaignScale")
    minimum = LOOT_MINIMUMS.get(scale)
    coverage = profile.get("coverage", {})
    approval = profile.get("approval", {})
    supplemental = profile.get("supplemental", {})

    if minimum is not None and approval.get("passesLootGate"):
        actual = coverage.get("tangibleRewardBeats", 0)
        if actual < minimum:
            failures.append(
                f"{path.relative_to(ROOT)}: loot gate passes but tangibleRewardBeats={actual}; "
                f"minimum for {scale} is {minimum}"
            )
        if coverage.get("usefulRewardBeats", 0) < 1:
            failures.append(
                f"{path.relative_to(ROOT)}: passing loot profile must contain at least one useful reward beat"
            )

    if not supplemental.get("enabled") and supplemental.get("mode") != "none":
        failures.append(
            f"{path.relative_to(ROOT)}: supplemental.enabled=false requires mode='none'"
        )
    if supplemental.get("enabled") and supplemental.get("mode") == "none":
        failures.append(
            f"{path.relative_to(ROOT)}: supplemental.enabled=true requires a non-'none' mode"
        )

    weights = supplemental.get("weightOverride")
    if isinstance(weights, dict):
        total = sum(float(weights.get(key, 0)) for key in (
            "mundane", "consumableUtility", "minorSpecial", "notableSpecial", "exceptional"
        ))
        if abs(total - 1.0) > 0.000001:
            failures.append(
                f"{path.relative_to(ROOT)}: supplemental weightOverride must sum to 1.0, got {total:.6f}"
            )

    if campaign_status == "approved":
        if profile.get("status") != "verified":
            failures.append(
                f"{path.relative_to(ROOT)}: approved campaign requires loot profile status='verified'"
            )
        if approval.get("passesLootGate") is not True:
            failures.append(
                f"{path.relative_to(ROOT)}: approved campaign must pass the loot gate"
            )
        if approval.get("blockers"):
            failures.append(
                f"{path.relative_to(ROOT)}: approved campaign loot profile cannot retain blockers"
            )


def main():
    failures = []
    json_files = sorted(LIB.rglob("*.json"))
    for path in json_files:
        try:
            read(path)
        except Exception as exc:
            failures.append(f"{path.relative_to(ROOT)}: invalid JSON: {exc}")

    try:
        schema = read(SCHEMA_PATH)
    except Exception as exc:
        failures.append(f"{SCHEMA_PATH.relative_to(ROOT)}: schema load failed: {exc}")
        schema = None

    try:
        loot_schema = read(LOOT_SCHEMA_PATH)
    except Exception as exc:
        failures.append(f"{LOOT_SCHEMA_PATH.relative_to(ROOT)}: loot schema load failed: {exc}")
        loot_schema = None

    validated = 0
    loot_validated = 0
    campaign_templates = []

    if schema:
        validator = Draft202012Validator(schema)
        for path in sorted((LIB / "campaigns").glob("*/dmos-template.json")):
            try:
                data = read(path)
            except Exception:
                continue
            if not str(data.get("$schema", "")).endswith("campaign-template-v2.schema.json"):
                continue
            validated += 1
            campaign_templates.append((path, data))
            add_schema_errors(failures, validator, data, path)

    if loot_schema:
        loot_validator = Draft202012Validator(loot_schema)
        for path in sorted((LIB / "campaigns").glob("*/loot-profile.json")):
            try:
                profile = read(path)
            except Exception:
                continue
            loot_validated += 1
            add_schema_errors(failures, loot_validator, profile, path)
            folder_id = path.parent.name
            if profile.get("campaignId") != folder_id:
                failures.append(
                    f"{path.relative_to(ROOT)}: campaignId must match campaign folder '{folder_id}'"
                )
            validate_loot_semantics(failures, profile, path)

        for template_path, template in campaign_templates:
            status = template.get("status")
            if status not in {"qa", "approved"}:
                continue
            profile_path = template_path.parent / "loot-profile.json"
            if not profile_path.exists():
                failures.append(
                    f"{template_path.relative_to(ROOT)}: status '{status}' requires loot-profile.json"
                )
                continue
            try:
                profile = read(profile_path)
            except Exception:
                continue
            validate_loot_semantics(failures, profile, profile_path, campaign_status=status)

    if failures:
        print("Campaign library validation FAILED")
        for failure in failures:
            print("-", failure)
        return 1

    print(
        f"Campaign library validation PASSED: {len(json_files)} JSON files parsed; "
        f"{validated} v2 templates schema-validated; {loot_validated} loot profiles validated."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())