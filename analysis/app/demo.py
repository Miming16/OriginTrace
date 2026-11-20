"""Live endpoints for the pipeline visualizer (visualizer/index.html).

Only mounted when DEMO_MODE=1. They run the real pipeline functions but never
touch the database and need no login, so keep DEMO_MODE off in production.

POST   /api/demo/ast              parse pasted code: boilerplate removal, syntax tree, node types, fingerprints
POST   /api/demo/clone            clone a public repository, fingerprint it, return its log lines, optionally save it
GET    /api/demo/saved            list saved results
DELETE /api/demo/saved/{run_id}   forget one saved result
POST   /api/demo/compare          compare two saved results: overlap, matched code regions, risk band and why

Saved results are JSON files in <LOG_DIR>/demo_results/. They keep the fingerprints plus the source the
parser saw, so matches can be shown as code after the clone folder is gone. The comparison uses the same
rule as db.save_analysis: shared unique hashes / the checked run's unique hashes, then risk_band().
"""

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from tree_sitter import Language, Parser

from .config import LOG_DIR
from .logger import RunLog, new_run_id
from .pipeline import (
    HIGH_OVERLAP, LANGUAGE_MODULES, MEDIUM_OVERLAP, analyze_git_url, normalized_ast,
    remove_boilerplate, risk_band, source_files, validate_language, winnow,
)

router = APIRouter(prefix="/api/demo")

RUN_ID = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{6}_[0-9a-f]{6}$")
MAX_SOURCE_CHARS = 3_000_000   # bigger repositories are compared without the code view
MAX_REGIONS = 40
MERGE_GAP = 8                  # fingerprints this close together on both sides belong to one region


class AstRequest(BaseModel):
    source: str = Field(max_length=20_000)
    language: str


class CloneRequest(BaseModel):
    url: str = Field(max_length=500)
    language: str = "python"
    save: bool = True


class CompareRequest(BaseModel):
    check: str
    against: str


def _language(value: str) -> str:
    try:
        return validate_language(value)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


# ------------------------------------------------------------------ single snippet

@router.post("/ast")
def demo_ast(request: AstRequest) -> dict:
    """The same steps analyze_directory runs on one file, with the tree kept for drawing."""
    language = _language(request.language)
    filtered = remove_boilerplate(request.source)
    data = filtered.encode("utf-8", errors="ignore")
    tree = Parser(Language(LANGUAGE_MODULES[language]())).parse(data)

    # tree-sitter reports byte offsets; the page highlights by character
    char_at = [0] * (len(data) + 1)
    position = 0
    for index, char in enumerate(filtered):
        size = len(char.encode("utf-8", errors="ignore"))
        for offset in range(size):
            char_at[position + offset] = index
        position += size
    char_at[position] = len(filtered)

    def node_json(node) -> dict:
        return {"t": node.type, "s": char_at[node.start_byte], "e": char_at[node.end_byte], "c": [node_json(child) for child in node.named_children]}

    types = normalized_ast(filtered, language)
    fingerprints = winnow(types)
    return {
        "language": language,
        "source": request.source,
        "filtered": filtered,
        "ast": node_json(tree.root_node),
        "types": types,
        "fingerprints": [[item["window_position"], str(item["hash_value"])] for item in fingerprints],
    }


# ------------------------------------------------------------------ saved results

def _results_dir() -> Path:
    return Path(LOG_DIR) / "demo_results"


def _load_saved(run_id: str) -> dict | None:
    if not RUN_ID.match(run_id):
        return None
    try:
        return json.loads((_results_dir() / f"{run_id}.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _meta(saved: dict) -> dict:
    meta = {key: saved.get(key) for key in ("run_id", "url", "language", "head", "files_included", "fingerprint_count", "saved_at")}
    meta["commit_signals"] = [item["signal_type"] if isinstance(item, dict) else item for item in saved.get("commit_signals", [])]
    meta["provenance_flags"] = [item["flag_type"] if isinstance(item, dict) else item for item in saved.get("provenance_flags", [])]
    meta["has_code"] = bool(saved.get("sources"))
    return meta


def snapshot_code(root: Path, language: str) -> dict:
    """The text the parser saw for each file, plus the node types and line span of every 5-gram.

    Walks the tree exactly like normalized_ast, so 5-gram i here is window_position i in winnow().
    """
    parser = Parser(Language(LANGUAGE_MODULES[language]()))
    sources, spans, types, total = {}, {}, {}, 0
    for path in source_files(root, language):
        relative = path.relative_to(root).as_posix()
        text = remove_boilerplate(path.read_text(encoding="utf-8", errors="ignore"))
        total += len(text)
        if total > MAX_SOURCE_CHARS:
            return {}
        nodes = []

        def visit(node) -> None:
            if node.is_named:
                nodes.append((node.type, node.start_point[0], node.end_point[0]))
            for child in node.named_children:
                visit(child)

        visit(parser.parse(text.encode("utf-8", errors="ignore")).root_node)
        sources[relative] = text
        types[relative] = [node[0] for node in nodes]
        spans[relative] = [
            [min(node[1] for node in nodes[i:i + 5]) + 1, max(node[2] for node in nodes[i:i + 5]) + 1]
            for i in range(len(nodes) - 4)
        ]
    return {"sources": sources, "spans": spans, "types": types}


def build_saved(run_id: str, url: str, language: str, head: str | None, result: dict, code: dict) -> dict:
    return {
        "run_id": run_id, "url": url, "language": language, "head": head,
        "files_included": result["files_included"],
        "fingerprint_count": len(result["fingerprints"]),
        "saved_at": datetime.now().isoformat(timespec="seconds"),
        "commit_metrics": result["commit_metrics"],
        "commit_signals": result["commit_signals"],
        "provenance_flags": result["provenance_flags"],
        "fingerprints": [[item["file_path"], str(item["hash_value"]), item["window_position"]] for item in result["fingerprints"]],
        **code,
    }


@router.get("/saved")
def demo_saved() -> list[dict]:
    folder = _results_dir()
    items = [_load_saved(path.stem) for path in folder.glob("*.json")] if folder.is_dir() else []
    return sorted((_meta(item) for item in items if item), key=lambda item: item["run_id"], reverse=True)


@router.delete("/saved/{run_id}")
def demo_forget(run_id: str) -> dict:
    if not RUN_ID.match(run_id):
        raise HTTPException(status_code=400, detail="Invalid run id")
    try:
        (_results_dir() / f"{run_id}.json").unlink()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Saved result not found") from error
    return {"deleted": run_id}


# ------------------------------------------------------------------ clone

def _read(path: Path) -> list[str]:
    try:
        return path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []


@router.post("/clone")
def demo_clone(request: CloneRequest) -> dict:
    """Runs analyze_git_url exactly as /api/analyze does, without the database, and returns its logs."""
    url = request.url.strip()
    if not url.startswith("https://"):
        raise HTTPException(status_code=400, detail="Only https:// repository URLs can be cloned")
    language = _language(request.language)
    run_id = new_run_id()
    result, error, code = None, None, {}

    def keep_code(target: Path) -> None:
        if request.save:
            code.update(snapshot_code(target, language))

    with RunLog("analysis", run_id) as log:
        log.write("start", src="git", source=url, lang=language, demo=True)
        try:
            result = analyze_git_url(url, language, run_id=run_id, log=log, inspect=keep_code)
            log.write("done", ms=log.ms())
        except subprocess.TimeoutExpired:
            error = "Clone took longer than 60 seconds"
            log.write("fail", "E", error=error, ms=log.ms())
        except (OSError, ValueError) as exc:
            error = str(exc)
            log.write("fail", "E", error=error, ms=log.ms())

    clone_lines = _read(Path(LOG_DIR) / "clone" / f"{run_id}.log")
    status_file = Path(LOG_DIR) / "status" / f"analysis_{run_id[:10]}.log"
    summary = None
    if result:
        head = next((match.group(1) for line in clone_lines if (match := re.search(r" done .*head=(\S+)", line))), None)
        if request.save:
            folder = _results_dir()
            folder.mkdir(parents=True, exist_ok=True)
            (folder / f"{run_id}.json").write_text(json.dumps(build_saved(run_id, url, language, head, result, code)), encoding="utf-8")
        summary = {
            "files_included": result["files_included"],
            "boilerplate_lines_excluded": result["boilerplate_lines_excluded"],
            "fingerprints": len(result["fingerprints"]),
            "commit_metrics": result["commit_metrics"],
            "commit_signals": [signal["signal_type"] for signal in result["commit_signals"]],
            "provenance_flags": [flag["flag_type"] for flag in result["provenance_flags"]],
        }
    return {
        "run_id": run_id,
        "ok": error is None,
        "error": error,
        "summary": summary,
        "saved": bool(result and request.save),
        "log_dir": str(Path(LOG_DIR).resolve()),
        "logs": {
            "clone": clone_lines,
            "analysis": _read(Path(LOG_DIR) / "analysis" / f"{run_id}.log"),
            "status": [line for line in _read(status_file) if f"run={run_id}" in line],
        },
    }


# ------------------------------------------------------------------ compare

def _index(saved: dict) -> dict[str, list[tuple[str, int]]]:
    index: dict[str, list[tuple[str, int]]] = {}
    for file_path, hash_value, position in saved["fingerprints"]:
        index.setdefault(str(hash_value), []).append((file_path, int(position)))
    return index


def _signals(saved: dict) -> tuple[list[dict], list[dict]]:
    """Older saved files kept only names; give them the severities pipeline.git_signals uses."""
    severity = {"big_bang_commit": "medium", "low_message_entropy": "low", "author_committer_mismatch": "medium",
                "enrolled_email_mismatch": "medium", "timestamp_anomaly": "high", "orphan_commit": "high", "history_rewritten": "high"}
    signals = [item if isinstance(item, dict) else {"signal_type": item, "severity": severity.get(item, "low"), "description": ""} for item in saved.get("commit_signals", [])]
    flags = [item if isinstance(item, dict) else {"flag_type": item, "severity": severity.get(item, "low"), "description": ""} for item in saved.get("provenance_flags", [])]
    return signals, flags


def build_comparison(check: dict, against: dict) -> dict:
    """How db.save_analysis would score `check` if `against` were the only peer, plus the code that matched."""
    mine, theirs = _index(check), _index(against)
    shared = set(mine) & set(theirs)
    unique = len(mine)
    overlap = round(len(shared) / unique, 4) if unique else 0.0
    signals, flags = _signals(check)

    # every place a shared hash occurs on both sides (a few per hash is plenty)
    pairs: dict[tuple[str, str], list[tuple[int, int, str]]] = {}
    for value in shared:
        for file_a, pos_a in mine[value][:3]:
            for file_b, pos_b in theirs[value][:3]:
                pairs.setdefault((file_a, file_b), []).append((pos_a, pos_b, value))

    # A copied stretch shows up as fingerprints on one diagonal: position in B minus position in A stays
    # about the same. Grow runs along that diagonal; stray hits on other diagonals stay tiny and sink.
    regions = []
    for (file_a, file_b), hits in pairs.items():
        hits.sort()
        open_runs: list[dict] = []
        for pos_a, pos_b, value in hits:
            offset = pos_b - pos_a
            run = next((run for run in open_runs if abs(run["offset"] - offset) <= MERGE_GAP and pos_a - run["last"] <= MERGE_GAP), None)
            if run is None:
                run = {"offset": offset, "last": pos_a, "hits": []}
                open_runs.append(run)
            run["hits"].append((pos_a, pos_b, value))
            run["last"], run["offset"] = pos_a, offset
            for stale in [run for run in open_runs if pos_a - run["last"] > MERGE_GAP]:
                regions.append((file_a, file_b, stale["hits"]))
                open_runs.remove(stale)
        regions.extend((file_a, file_b, run["hits"]) for run in open_runs)

    def lines(saved: dict, file_path: str, first: int, last: int) -> list[int] | None:
        spans = (saved.get("spans") or {}).get(file_path)
        if not spans or last >= len(spans):
            return None
        return [spans[first][0], spans[last][1]]

    def gram(saved: dict, file_path: str, position: int) -> list[str]:
        types = (saved.get("types") or {}).get(file_path) or []
        return types[position:position + 5]

    regions.sort(key=lambda region: len({hit[2] for hit in region[2]}), reverse=True)
    shown = []
    for file_a, file_b, run in regions[:MAX_REGIONS]:
        a_first, a_last = run[0][0], max(hit[0] for hit in run)
        b_first, b_last = min(hit[1] for hit in run), max(hit[1] for hit in run)
        shown.append({
            "file_a": file_a, "file_b": file_b,
            "lines_a": lines(check, file_a, a_first, a_last),
            "lines_b": lines(against, file_b, b_first, b_last),
            "hashes": len({hit[2] for hit in run}),
            "gram": gram(check, file_a, a_first),
        })

    files_a = {region["file_a"] for region in shown}
    files_b = {region["file_b"] for region in shown}
    return {
        "check": _meta(check),
        "against": _meta(against),
        "unique_check": unique,
        "unique_against": len(theirs),
        "shared": len(shared),
        "overlap": overlap,
        "reverse_overlap": round(len(shared) / len(theirs), 4) if theirs else 0.0,
        "thresholds": {"medium": MEDIUM_OVERLAP, "high": HIGH_OVERLAP},
        "base_band": risk_band(overlap, [], []),
        "risk_band": risk_band(overlap, signals, flags),
        "commit_metrics": check.get("commit_metrics"),
        "commit_signals": signals,
        "provenance_flags": flags,
        "regions": shown,
        "region_total": sum(1 for region in regions if len({hit[2] for hit in region[2]}) >= 2),
        "sources_a": {name: text for name, text in (check.get("sources") or {}).items() if name in files_a},
        "sources_b": {name: text for name, text in (against.get("sources") or {}).items() if name in files_b},
    }


@router.post("/compare")
def demo_compare(request: CompareRequest) -> dict:
    check, against = _load_saved(request.check), _load_saved(request.against)
    if not check or not against:
        raise HTTPException(status_code=404, detail="Saved result not found")
    return build_comparison(check, against)
