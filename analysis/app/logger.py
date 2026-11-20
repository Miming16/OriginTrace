"""Plain-text logs for the analysis service.

Every line is: time level event key=value ...
    10:15:02.113 I start url=https://github.com/pallets/click
Level is one letter: I = info, W = warning, E = error.

logs/clone/<run>.log              one new file per git clone
logs/analysis/<run>.log           one new file per analysis (same <run> name as its clone)
logs/status/analysis_<date>.log   service status, one file per day, only ever appended to
"""

from __future__ import annotations

import re
import secrets
import threading
import time
from datetime import datetime
from pathlib import Path

from .config import LOG_DIR

_status_lock = threading.Lock()
_plain = re.compile(r'^[^\s="]+$')          # values that can be written without quotes
_credentials = re.compile(r"://[^/\s@]+@")  # user:token@ inside a URL


def new_run_id() -> str:
    """Date, time and 6 random hex characters, e.g. 2026-09-24_101502_a1b2c3."""
    return f"{datetime.now():%Y-%m-%d_%H%M%S}_{secrets.token_hex(3)}"


def short_id(value: str | None) -> str | None:
    """The first 8 characters of a UUID are enough to find the row again."""
    return str(value)[:8] if value else None


def _format(value) -> str:
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, float):
        value = round(value, 4)
    text = _credentials.sub("://***@", " ".join(str(value).split()))
    if len(text) > 300:
        text = text[:297] + "..."
    return text if _plain.match(text) else '"' + text.replace('"', "'") + '"'


def _line(level: str, event: str, fields: dict) -> str:
    now = datetime.now()
    parts = [f"{now:%H:%M:%S}.{now.microsecond // 1000:03d}", level, event]
    parts += [f"{key}={_format(value)}" for key, value in fields.items() if value is not None and value != ""]
    return " ".join(parts) + "\n"


def log_status(event: str, level: str = "I", **fields) -> None:
    """Adds one line to today's status file. A logging problem never stops the service."""
    line = _line(level, event, fields)
    folder = Path(LOG_DIR) / "status"
    try:
        folder.mkdir(parents=True, exist_ok=True)
        with _status_lock, open(folder / f"analysis_{datetime.now():%Y-%m-%d}.log", "a", encoding="utf-8") as file:
            file.write(line)
    except OSError:
        pass


class RunLog:
    """The log file of one clone or one analysis.

    It is opened with mode "x", which only creates new files, so one run can
    never overwrite the log of another. Use it in a with-block: if the block
    fails, a fail line is written for you, and a one-line summary goes to the
    status log when the block ends.
    """

    def __init__(self, kind: str, run_id: str) -> None:
        self.kind = kind
        self.run_id = run_id
        self.started = time.perf_counter()
        self.failed = False
        try:
            folder = Path(LOG_DIR) / kind
            folder.mkdir(parents=True, exist_ok=True)
            self.file = open(folder / f"{run_id}.log", "x", encoding="utf-8")
        except OSError:
            self.file = None

    def ms(self) -> int:
        return int((time.perf_counter() - self.started) * 1000)

    def write(self, event: str, level: str = "I", **fields) -> None:
        self.failed = self.failed or level == "E"
        if self.file:
            try:
                self.file.write(_line(level, event, fields))
                self.file.flush()
            except OSError:
                pass

    def __enter__(self) -> RunLog:
        return self

    def __exit__(self, error_type, error, _traceback) -> None:
        if error is not None and not self.failed:
            detail = getattr(error, "detail", None) or f"{error_type.__name__}: {error}"
            self.write("fail", "E", status=getattr(error, "status_code", None), error=detail, ms=self.ms())
        if self.file:
            self.file.close()
        log_status(self.kind, "E" if self.failed else "I", run=self.run_id, result="fail" if self.failed else "ok", ms=self.ms())
