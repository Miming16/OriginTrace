from __future__ import annotations

import hashlib
import re
import subprocess
import tempfile
from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_c
import tree_sitter_java
import tree_sitter_php
import tree_sitter_python

from .config import SUPPORTED_LANGUAGES

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
    hashes = [int(hashlib.sha256("|".join(values[i:i + k]).encode()).hexdigest()[:16], 16) for i in range(len(values) - k + 1)]
    selected: dict[int, int] = {}
    for start in range(max(1, len(hashes) - window + 1)):
        end = min(start + window, len(hashes))
        minimum = min(range(start, end), key=lambda index: hashes[index])
        selected.setdefault(minimum, hashes[minimum])
    return [{"hash_value": value, "window_position": position} for position, value in selected.items()]


def git_signals(root: Path) -> list[dict]:
    try:
        log = subprocess.run(["git", "-C", str(root), "log", "--format=%H%x09%an%x09%ae%x09%cn%x09%ce%x09%s", "-n", "50"], capture_output=True, text=True, timeout=10, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return [{"signal_type": "low_message_entropy", "severity": "medium", "description": "Git history could not be read."}]
    lines = [line for line in log.stdout.splitlines() if line]
    signals = []
    if len(lines) <= 1:
        signals.append({"signal_type": "big_bang_commit", "severity": "medium", "description": "Repository has little or no development history."})
    messages = [line.split("\t", 5)[-1] for line in lines]
    if messages and sum(len(message.split()) <= 2 for message in messages) / len(messages) > 0.5:
        signals.append({"signal_type": "low_message_entropy", "severity": "low", "description": "A high proportion of commit messages are unusually short."})
    if any(fields[1] != fields[3] or fields[2] != fields[4] for line in lines if len((fields := line.split("\t"))) >= 6):
        signals.append({"signal_type": "author_committer_mismatch", "severity": "medium", "description": "At least one commit author differs from its committer."})
    return signals


def analyze_directory(root: Path, language: str) -> dict:
    language = validate_language(language)
    files = source_files(root, language)
    fingerprints = []
    excluded = 0
    for path in files:
        source = path.read_text(encoding="utf-8", errors="ignore")
        filtered = remove_boilerplate(source)
        excluded += len(source.splitlines()) - len(filtered.splitlines())
        fingerprints.extend({"file_path": str(path.relative_to(root)), **fingerprint} for fingerprint in winnow(normalized_ast(filtered, language)))
    commit_flags = git_signals(root)
    provenance_flags = [{"flag_type": flag["signal_type"], "severity": flag["severity"], "description": flag["description"]} for flag in commit_flags if flag["signal_type"] == "author_committer_mismatch"]
    similarity_score = min(1.0, len(fingerprints) / 1000)
    score = similarity_score + 0.15 * len(commit_flags) + 0.15 * len(provenance_flags)
    risk_band = "high" if score >= 0.75 else "medium" if score >= 0.35 else "low"
    return {"language": language, "files_included": len(files), "boilerplate_lines_excluded": excluded, "fingerprints": fingerprints, "commit_signals": commit_flags, "provenance_flags": provenance_flags, "similarity_score": round(similarity_score, 4), "risk_band": risk_band}


def analyze_git_url(url: str, language: str) -> dict:
    with tempfile.TemporaryDirectory() as directory:
        target = Path(directory) / "repository"
        result = subprocess.run(["git", "clone", "--depth", "50", "--", url, str(target)], capture_output=True, text=True, timeout=60, check=False)
        if result.returncode != 0:
            raise ValueError("Repository could not be cloned")
        return analyze_directory(target, language)