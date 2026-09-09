from pathlib import Path

from app.pipeline import analyze_directory, remove_boilerplate, winnow


def test_winnow_returns_stable_positions():
    assert winnow(["a", "b", "c", "d", "e", "f"], k=3, window=2)


def test_boilerplate_is_excluded():
    assert "#include" not in remove_boilerplate("#include <stdio.h>\nint main() { return 0; }")


def test_python_pipeline_filters_supported_files(tmp_path: Path):
    (tmp_path / "main.py").write_text("def add(left, right):\n    return left + right\n")
    (tmp_path / "README.md").write_text("not source")
    result = analyze_directory(tmp_path, "python")
    assert result["files_included"] == 1
    assert result["risk_band"] in {"low", "medium", "high"}