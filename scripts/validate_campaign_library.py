#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "research" / "campaign-library"
SCHEMA_PATH = LIB / "_templates" / "campaign-template-v2.schema.json"


def read(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


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

    validated = 0
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
            for error in sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path)):
                pointer = "/".join(map(str, error.absolute_path)) or "<root>"
                failures.append(f"{path.relative_to(ROOT)} [{pointer}]: {error.message}")

    if failures:
        print("Campaign library validation FAILED")
        for failure in failures:
            print("-", failure)
        return 1

    print(f"Campaign library validation PASSED: {len(json_files)} JSON files parsed; {validated} v2 templates schema-validated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
