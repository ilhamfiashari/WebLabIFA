import json
import sys

with open(sys.argv[1], encoding="utf-8") as report:
    results = json.load(report)["results"]
if results:
    # Print locations only, never candidate secret values.
    for path, findings in results.items():
        for finding in findings:
            print(f"Review required: {path}:{finding['line_number']} ({finding['type']})")
    raise SystemExit(1)
