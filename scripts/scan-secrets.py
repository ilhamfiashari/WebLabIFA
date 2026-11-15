"""Scan only project files eligible for Git; preserve ignored local configuration."""
import json
import pathlib
import subprocess
import sys

result = subprocess.run(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    check=True, capture_output=True,
)
files = sorted(set(path for path in result.stdout.decode().split("\0") if path))
files = [path for path in files if pathlib.Path(path).suffix not in {".png", ".webp", ".svg"} and pathlib.Path(path).name not in {"Cargo.lock", "package-lock.json"}]
scan = subprocess.run(
    [sys.executable, "-m", "detect_secrets", "scan", "--all-files", *files],
    check=True, capture_output=True, text=True,
)
report = json.loads(scan.stdout)
pathlib.Path(sys.argv[1]).write_text(json.dumps(report, indent=2), encoding="utf-8")
print(f"Scanned {len(files)} project files; ignored local files excluded.")
