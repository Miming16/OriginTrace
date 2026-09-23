from __future__ import annotations

import hashlib
import re
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_c
import tree_sitter_java
import tree_sitter_php
import tree_sitter_python

from .config import SUPPORTED_LANGUAGES

HASH_MASK = 0x7FFF_FFFF_FFFF_FFFF
SOURCE_EXTENSIONS = {"c": {".c", ".h"}, "java": {".java"}, "python": {".py"}, "php": {".php"}}
IGNORED_PARTS = {".git", "node_modules", "vendor", "__pycache__", ".venv", "dist", "build"}
BOILERPLATE_PATTERNS = (
    re.compile(r"^\s*(#include\s+<.*>|using\s+namespace\s+\w+;?)\s*$"),
    re.compile(r"^\s*(if __name__ == ['\"]__main__['\"]:|public static void main\s*\()"),
)
LANGUAGE_MODULES = {
    "c": tree_sitter_c.language,
    "java": tree_sitter_java.language,
    "php": tree_sitter_php.language_php,
    "python": tree_sitter_python.language,
}

MEDIUM_OVERLAP = 0.35
HIGH_OVERLAP = 0.60

def validate_language(language: str) -> str:
    normalized = language.lower().strip()
    if normalized not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language: {language}")
    return normalized


def source_files(root: Path, language: str) -> list[Path]:
    extensions = SOURCE_EXTENSIONS[language]
    return [
        path for path in root.rglob("*")
        if path.is_file()
        and not any(part in IGNORED_PARTS for part in path.relative_to(root).parts)
        and path.suffix.lower() in extensions
    ]


def remove_boilerplate(source: str) -> str:
    return "\n".join(line for line in source.splitlines() if not any(pattern.match(line) for pattern in BOILERPLATE_PATTERNS))


def normalized_ast(source: str, language: str) -> list[str]:
    parser = Parser(Language(LANGUAGE_MODULES[language]()))
    tree = parser.parse(source.encode("utf-8", errors="ignore"))
    node_types: list[str] = []

    def visit(node) -> None:
        if node.is_named:
            node_types.append(node.type)
        for child in node.named_children:
            visit(child)

    visit(tree.root_node)
    return node_types


def winnow(values: list[str], k: int = 5, window: int = 4) -> list[dict]:
    if len(values) < k:
        return []
    hashes = [
        int(hashlib.sha256("|".join(values[i:i + k]).encode()).hexdigest()[:16], 16) & HASH_MASK
        for i in range(len(values) - k + 1)
    ]
    selected: dict[int, int] = {}
    for start in range(max(1, len(hashes) - window + 1)):
        end = min(start + window, len(hashes))
        minimum = min(range(start, end), key=lambda index: hashes[index])
        selected.setdefault(minimum, hashes[minimum])
    return [{"hash_value": value, "window_position": position} for position, value in selected.items()]


def git_signals(root: Path, final_lines: int, enrolled_email: str | None = None) -> tuple[list[dict], list[dict], dict]:
    try:
        log = subprocess.run(
            ["git", "-C", str(root), "log", "--numstat", "--format=%H%x09%P%x09%aI%x09%an%x09%ae%x09%cn%x09%ce%x09%s", "-n", "50"],
            capture_output=True, text=True, timeout=10, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ([{"signal_type": "low_message_entropy", "severity": "medium", "description": "Git history could not be read."}], [], {
            "commit_count": 0, "timespan_days": 0, "has_big_bang": False,
            "low_entropy_count": 0, "author_committer_match_pct": 100.0,
        })
    commits = []
    current = None
    for line in log.stdout.splitlines():
        fields = line.split("\t", 7)
        if len(fields) == 8 and len(fields[0]) == 40 and "T" in fields[2]:
            current = {
            "parents": fields[1].split() if fields[1] else [], "date": fields[2],
            "author": fields[3], "author_email": fields[4],
            "committer": fields[5], "committer_email": fields[6],
            "message": fields[7], "changed_lines": 0,
            }
            commits.append(current)
        elif current and line.count("\t") == 2:
            additions, deletions, _path = line.split("\t")
            if additions.isdigit():
                current["changed_lines"] += int(additions)
            if deletions.isdigit():
                current["changed_lines"] += int(deletions)

    commit_count = len(commits)
    dates = [datetime.fromisoformat(commit["date"]) for commit in commits]
    timespan_days = (max(dates) - min(dates)).total_seconds() / 86400 if dates else 0
    message_counts = {}
    for commit in commits:
        normalized_message = " ".join(commit["message"].lower().split())
        message_counts[normalized_message] = message_counts.get(normalized_message, 0) + 1
    low_entropy_count = sum(
        len(commit["message"].split()) <= 2
        or message_counts[" ".join(commit["message"].lower().split())] > 1
        for commit in commits
    )
    matching_commits = sum(
        commit["author"] == commit["committer"] and commit["author_email"] == commit["committer_email"]
        for commit in commits
    )
    author_committer_match_pct = round(100 * matching_commits / commit_count, 2) if commit_count else 100.0
    has_big_bang = bool(final_lines and any(commit["changed_lines"] > final_lines * 0.8 for commit in commits))
    metrics = {
        "commit_count": commit_count,
        "timespan_days": round(timespan_days, 2),
        "has_big_bang": has_big_bang,
        "low_entropy_count": low_entropy_count,
        "author_committer_match_pct": author_committer_match_pct,
    }
    signals = []
    provenance_flags = []
    if commit_count <= 1 or has_big_bang:
        signals.append({"signal_type": "big_bang_commit", "severity": "medium", "description": "Repository has little or no development history."})
    if commit_count and low_entropy_count / commit_count > 0.5:
        signals.append({"signal_type": "low_message_entropy", "severity": "low", "description": "A high proportion of commit messages are unusually short."})
    if author_committer_match_pct < 100:
        provenance_flags.append({"flag_type": "author_committer_mismatch", "severity": "medium", "description": "At least one commit author differs from its committer."})
    if enrolled_email and any(commit["author_email"].lower() != enrolled_email.lower() for commit in commits):
        provenance_flags.append({"flag_type": "enrolled_email_mismatch", "severity": "medium", "description": "At least one commit author email does not match the enrolled student account."})
    timestamps = [commit["date"] for commit in commits]
    backwards = any(left < right for left, right in zip(timestamps, timestamps[1:]))
    identical = commit_count > 1 and len(set(timestamps)) == 1
    if backwards or identical:
        reason = "Commit timestamps run backwards." if backwards else "All commits share one timestamp."
        provenance_flags.append({"flag_type": "timestamp_anomaly", "severity": "high", "description": reason})
    if commit_count == 1 and not commits[0]["parents"]:
        provenance_flags.append({"flag_type": "orphan_commit", "severity": "high", "description": "Repository contains a single root commit with no development history."})
    unreachable = subprocess.run(
        ["git", "-C", str(root), "fsck", "--full", "--no-reflogs", "--unreachable"],
        capture_output=True, text=True, timeout=10, check=False,
    )
    if any(line.startswith("unreachable commit ") for line in unreachable.stdout.splitlines()):
        provenance_flags.append({"flag_type": "history_rewritten", "severity": "high", "description": "Git contains commits that are no longer reachable from the current history."})
    return signals, provenance_flags, metrics


def analyze_directory(root: Path, language: str, overlap: float = 0.0, enrolled_email: str | None = None) -> dict:
    language = validate_language(language)
    files = source_files(root, language)
    sources = {
        path: path.read_text(encoding="utf-8", errors="ignore")
        for path in files
    }
    fingerprints = []
    excluded = 0
    for path in files:
        source = sources[path]
        filtered = remove_boilerplate(source)
        excluded += len(source.splitlines()) - len(filtered.splitlines())
        fingerprints.extend({"file_path": path.relative_to(root).as_posix(), **fingerprint} for fingerprint in winnow(normalized_ast(filtered, language)))
    final_lines = sum(len(source.splitlines()) for source in sources.values())
    commit_flags, provenance_flags, commit_metrics = git_signals(root, final_lines, enrolled_email)
    risk_band_value = risk_band(overlap, commit_flags, provenance_flags)
    return {"language": language, "files_included": len(files), "boilerplate_lines_excluded": excluded, "fingerprints": fingerprints, "commit_signals": commit_flags, "commit_metrics": commit_metrics, "provenance_flags": provenance_flags, "similarity_score": 0.0, "risk_band": risk_band_value}


def analyze_git_url(url: str, language: str, enrolled_email: str | None = None) -> dict:
    with tempfile.TemporaryDirectory() as directory:
        target = Path(directory) / "repository"
        result = subprocess.run(["git", "clone", "--", url, str(target)], capture_output=True, text=True, timeout=60, check=False)
        if result.returncode != 0:
            raise ValueError("Repository could not be cloned")
        return analyze_directory(target, language, enrolled_email=enrolled_email)

def risk_band(overlap: float, commit_signals: list[dict], provenance_flags: list[dict]) -> str:
    """Overlap sets the band. Commit and provenance findings are soft flags:
    together they raise it by at most one step and can never reach high alone."""
    if overlap >= HIGH_OVERLAP:
        band = "high"
    elif overlap >= MEDIUM_OVERLAP:
        band = "medium"
    else:
        band = "low"

    soft = (
        any(s["signal_type"] == "big_bang_commit" for s in commit_signals)
        or any(f["severity"] == "high" for f in provenance_flags)
    )
    if soft and band == "low":
        return "medium"
    if soft and band == "medium":
        return "high"
    return band