"""WBS 3.1.1 / 3.1.2 / 3.1.3 -- tree-sitter grammar and normalisation verification.

Proves, per installed language, that the parser wrapper produces a usable AST,
that the "normalised" sequence really is normalised (no identifier text, no
string contents), that renaming every identifier leaves it byte-identical, that
changing control flow changes it, and that a syntactically broken file degrades
into ERROR nodes instead of raising.

Tests whose name starts with DEFECT record current behaviour that contradicts
the WBS. They are expected to pass; a failure means the defect has been fixed.
"""

from __future__ import annotations

from importlib.metadata import version
from pathlib import Path

import pytest

from app.config import SUPPORTED_LANGUAGES
from app.pipeline import (
    LANGUAGE_MODULES,
    SOURCE_EXTENSIONS,
    analyze_directory,
    normalized_ast,
    validate_language,
)

FIXTURES = Path(__file__).parent / "fixtures"

# language -> (fixture stem, declaration node type the grammar must produce,
#              identifiers and string contents that must NOT survive normalisation)
LANGUAGES = {
    "c": ("c/sample.c", "function_definition", {"alpha", "bravo", "charlie", "delta", "echo", "stdio.h"}),
    "python": ("python/sample.py", "function_definition", {"alpha", "bravo", "charlie", "delta", "echo"}),
    "php": ("php/sample.php", "function_definition", {"alpha", "bravo", "charlie", "delta", "echo"}),
    "java": ("java/Sample.java", "method_declaration", {"Alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "String"}),
}

RENAMED = {
    "c": "c/sample_renamed.c",
    "python": "python/sample_renamed.py",
    "php": "php/sample_renamed.php",
    "java": "java/SampleRenamed.java",
}

# Same program with `if` replaced by `while` -- structure changed, names untouched.
REFLOWED = {
    "c": "c/sample_reflowed.c",
    "python": "python/sample_reflowed.py",
    "php": "php/sample_reflowed.php",
    "java": "java/SampleReflowed.java",
}

BROKEN = {
    "c": "c/broken.c",
    "python": "python/broken.py",
    "php": "php/broken.php",
    "java": "java/Broken.java",
}

ALL = sorted(LANGUAGES)


def read(relative: str) -> str:
    return (FIXTURES / relative).read_text(encoding="utf-8")


# --- 3.1.1 grammar installation and the parser wrapper ------------------------

def test_parser_wrapper_covers_exactly_the_configured_languages():
    assert set(LANGUAGE_MODULES) == SUPPORTED_LANGUAGES
    assert set(SOURCE_EXTENSIONS) == SUPPORTED_LANGUAGES


@pytest.mark.parametrize("language", ALL)
def test_grammar_produces_a_non_empty_ast(language):
    sequence = normalized_ast(read(LANGUAGES[language][0]), language)
    assert isinstance(sequence, list)
    assert len(sequence) > 10, f"{language} produced a suspiciously small AST: {sequence}"
    assert all(isinstance(node, str) and node for node in sequence)


@pytest.mark.parametrize("language", ALL)
def test_grammar_produces_the_expected_declaration_node(language):
    _, declaration, _ = LANGUAGES[language]
    sequence = normalized_ast(read(LANGUAGES[language][0]), language)
    assert declaration in sequence, f"{language} AST has no {declaration}: {sorted(set(sequence))}"
    assert "if_statement" in sequence
    assert "return_statement" in sequence


# --- 3.1.3 normalisation ------------------------------------------------------

@pytest.mark.parametrize("language", ALL)
def test_normalisation_leaks_no_identifier_or_string_text(language):
    """The 3.1.3 claim, proved rather than assumed."""
    fixture, _, secrets = LANGUAGES[language]
    sequence = normalized_ast(read(fixture), language)
    leaked = secrets.intersection(sequence)
    assert not leaked, f"{language} leaked source text into the AST sequence: {leaked}"
    for node in sequence:
        assert '"' not in node and "'" not in node, f"quoted literal survived: {node!r}"
        assert node == node.lower() or node.isupper(), f"unexpected node type casing: {node!r}"


@pytest.mark.parametrize("language", ALL)
def test_renaming_every_identifier_leaves_the_sequence_identical(language):
    original = normalized_ast(read(LANGUAGES[language][0]), language)
    renamed = normalized_ast(read(RENAMED[language]), language)
    assert original == renamed, (
        f"{language} is not rename-invariant; first difference at "
        f"{next(i for i, (a, b) in enumerate(zip(original, renamed)) if a != b)}"
    )


@pytest.mark.parametrize("language", ALL)
def test_changing_control_flow_changes_the_sequence(language):
    original = normalized_ast(read(LANGUAGES[language][0]), language)
    reflowed = normalized_ast(read(REFLOWED[language]), language)
    assert original != reflowed, f"{language} did not notice if -> while"
    assert "if_statement" in original
    assert "while_statement" in reflowed
    assert len(original) == len(reflowed), "only the branch node should have changed"


# --- 3.1.2 parse-output verification, including malformed input ---------------

@pytest.mark.parametrize("language", ALL)
def test_a_broken_file_yields_error_nodes_instead_of_raising(language):
    sequence = normalized_ast(read(BROKEN[language]), language)
    assert sequence, f"{language} returned nothing for a broken file"
    assert "ERROR" in sequence, f"{language} broken fixture produced no ERROR node: {sequence}"


@pytest.mark.parametrize("language", ALL)
def test_the_pipeline_still_completes_over_a_broken_file(language, tmp_path):
    source = FIXTURES / BROKEN[language]
    (tmp_path / source.name).write_text(source.read_text(encoding="utf-8"), encoding="utf-8")
    result = analyze_directory(tmp_path, language)
    assert result["files_included"] == 1
    assert result["risk_band"] in {"low", "medium", "high"}


def test_tree_sitter_versions_are_recorded_and_past_the_obsolete_pin():
    """WBS 3.1.2 notes 'requires tree-sitter pinned to 0.21.3'. That note refers to
    tree_sitter_languages 1.10.2, which this branch does not use -- it uses the
    per-language tree-sitter-* packages, which require tree-sitter >= 0.23."""
    core = tuple(int(part) for part in version("tree-sitter").split(".")[:2])
    assert core >= (0, 23), f"tree-sitter {version('tree-sitter')} is below the range requirements.txt asks for"
    for package in ("tree-sitter-c", "tree-sitter-java", "tree-sitter-php", "tree-sitter-python"):
        assert version(package), f"{package} is not installed"


# --- Evidence for defects, not aspirations. -----------------------------------

def test_defect_d05_comments_survive_normalisation():
    """WBS 3.1.3 asks for comments to be stripped. They are not: the comment node
    type stays in the sequence, so adding a comment changes a file's fingerprints."""
    with_comment = normalized_ast("# note\nalpha = 1\n", "python")
    without_comment = normalized_ast("alpha = 1\n", "python")
    assert "comment" in with_comment
    assert with_comment != without_comment, "comments appear to be stripped now -- D-05 can be closed"
    assert "line_comment" in normalized_ast(read("java/Sample.java"), "java")


def test_defect_d06_javascript_is_rejected_although_the_wbs_and_schema_expect_it():
    """WBS 3.1 is 'Tree-Sitter Parser Integration (C, Python, JS, PHP)' and
    submissions.language allows 'javascript'. The service installs Java instead."""
    with pytest.raises(ValueError, match="Unsupported language: javascript"):
        validate_language("javascript")
    assert "javascript" not in SUPPORTED_LANGUAGES
    assert "java" in SUPPORTED_LANGUAGES
    assert ".js" not in {ext for extensions in SOURCE_EXTENSIONS.values() for ext in extensions}


@pytest.mark.parametrize("language", ALL)
def test_validate_language_normalises_case_and_whitespace(language):
    assert validate_language(f"  {language.upper()}  ") == language
