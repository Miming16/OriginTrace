"""WBS 3.2.1 / 2.3 -- winnowing fingerprint and boilerplate-filter properties.

winnow() is checked against the guarantees Schleimer, Wilkerson and Aiken's
winnowing paper actually makes, not against a golden output: below k tokens it
must produce nothing, every fingerprint it selects must be the minimum of some
window, positions must advance, the function must be deterministic, and a single
inserted token must disturb only a bounded number of fingerprints.
"""

from __future__ import annotations

import hashlib
import random

import pytest

from app.pipeline import HASH_MASK, analyze_directory, remove_boilerplate, winnow

K = 5
WINDOW = 4
UINT64 = 2 ** 64
INT64_MAX = 2 ** 63 - 1


def kgram_hashes(values: list[str], k: int = K) -> list[int]:
    """Recompute the k-gram hash array the way winnow() does, so the tests can
    check the selection rule without trusting winnow()'s own bookkeeping."""
    return [
        int(hashlib.sha256("|".join(values[index:index + k]).encode()).hexdigest()[:16], 16) & HASH_MASK
        for index in range(len(values) - k + 1)
    ]


def token_stream(length: int, alphabet: int = 6, seed: int = 11) -> list[str]:
    generator = random.Random(seed)
    return [f"node_{generator.randrange(alphabet)}" for _ in range(length)]


# --- 3.2.1 winnowing core -----------------------------------------------------

@pytest.mark.parametrize("length", [0, 1, 2, 3, 4])
def test_fewer_than_k_tokens_produces_no_fingerprints(length):
    assert winnow(token_stream(length), k=K, window=WINDOW) == []


@pytest.mark.parametrize("k", [2, 3, 5, 8])
def test_the_k_boundary_is_exact(k):
    assert winnow(token_stream(k - 1), k=k, window=WINDOW) == []
    assert len(winnow(token_stream(k), k=k, window=WINDOW)) == 1


@pytest.mark.parametrize("length", [10, 37, 120, 400])
def test_window_positions_strictly_increase_and_index_real_kgrams(length):
    values = token_stream(length)
    fingerprints = winnow(values, k=K, window=WINDOW)
    positions = [fingerprint["window_position"] for fingerprint in fingerprints]

    assert positions == sorted(set(positions)), "positions are not strictly increasing"
    assert all(position >= 0 for position in positions)
    assert max(positions) < len(values) - K + 1, "a position points past the last k-gram"


@pytest.mark.parametrize("length", [10, 37, 120, 400])
def test_every_selected_hash_is_the_minimum_of_some_window(length):
    values = token_stream(length)
    hashes = kgram_hashes(values)
    fingerprints = winnow(values, k=K, window=WINDOW)

    window_starts = range(max(1, len(hashes) - WINDOW + 1))
    minima = {
        min(range(start, min(start + WINDOW, len(hashes))), key=lambda index: hashes[index])
        for start in window_starts
    }
    for fingerprint in fingerprints:
        position = fingerprint["window_position"]
        assert fingerprint["hash_value"] == hashes[position], "hash does not match its position"
        assert position in minima, f"position {position} is not the minimum of any window"


@pytest.mark.parametrize("length", [10, 120])
def test_fingerprint_density_stays_between_its_bounds(length):
    values = token_stream(length)
    count = len(winnow(values, k=K, window=WINDOW))
    kgrams = len(values) - K + 1
    assert 1 <= count <= kgrams
    # One window can contribute at most one fingerprint.
    assert count <= max(1, kgrams - WINDOW + 1)


def test_winnow_is_deterministic():
    values = token_stream(200)
    first = winnow(values, k=K, window=WINDOW)
    assert first == winnow(values, k=K, window=WINDOW)
    assert first == winnow(list(values), k=K, window=WINDOW)


def test_identical_token_streams_fingerprint_identically():
    left = token_stream(150, seed=3)
    right = list(left)
    assert winnow(left, k=K, window=WINDOW) == winnow(right, k=K, window=WINDOW)


def test_hash_values_are_unsigned_64_bit_integers():
    for fingerprint in winnow(token_stream(300), k=K, window=WINDOW):
        assert isinstance(fingerprint["hash_value"], int)
        assert 0 <= fingerprint["hash_value"] < UINT64


def test_a_single_inserted_token_disturbs_only_a_bounded_number_of_hashes():
    """Winnowing's locality guarantee: an edit perturbs the fingerprints near it
    and leaves the rest alone. Asserted loosely -- the point is that the blast
    radius is a small constant, not proportional to file length."""
    values = token_stream(300)
    midpoint = len(values) // 2
    mutated = values[:midpoint] + ["node_inserted"] + values[midpoint:]

    before = {fingerprint["hash_value"] for fingerprint in winnow(values, k=K, window=WINDOW)}
    after = {fingerprint["hash_value"] for fingerprint in winnow(mutated, k=K, window=WINDOW)}

    lost = before - after
    gained = after - before
    assert len(before & after) > 0.85 * len(before), "one token changed most of the file's hashes"
    # A k-gram spans k tokens, so an insertion can only invalidate k of them.
    assert len(lost) <= K, f"{len(lost)} hashes lost to a single-token insertion"
    assert len(gained) <= 2 * K, f"{len(gained)} hashes gained from a single-token insertion"


def test_an_edit_at_the_end_leaves_the_start_untouched():
    values = token_stream(300)
    mutated = values + ["node_appended"] * 3
    before = winnow(values, k=K, window=WINDOW)
    after = winnow(mutated, k=K, window=WINDOW)
    prefix = len(before) // 2
    assert before[:prefix] == after[:prefix], "an append changed fingerprints at the start of the file"


# --- 2.3 boilerplate / starter-code filter ------------------------------------

STRIPPED = [
    ("angle-bracket include", "#include <stdio.h>"),
    ("indented include", "    #include <stdlib.h>"),
    ("using namespace with semicolon", "using namespace std;"),
    ("using namespace without semicolon", "using namespace std"),
    ("python main guard, double quotes", 'if __name__ == "__main__":'),
    ("python main guard, single quotes", "if __name__ == '__main__':"),
    ("java main", "public static void main(String[] args) {"),
]

KEPT = [
    ("quoted include", '#include "local_header.h"'),
    ("a word containing include", "int total = include_me(1);"),
    ("a comment mentioning include", "// this line includes a word"),
    ("a namespace declaration", "namespace origintrace {"),
    ("a main that is not the java entry point", "int main(void) {"),
    ("a string mentioning __main__", 'label = "__main__ is not here";'),
]


@pytest.mark.parametrize("label,line", STRIPPED, ids=[label for label, _ in STRIPPED])
def test_boilerplate_patterns_are_stripped(label, line):
    source = f"int before = 1;\n{line}\nint after = 2;\n"
    kept = remove_boilerplate(source).splitlines()
    assert line not in kept, f"{label} survived the filter"
    assert kept == ["int before = 1;", "int after = 2;"]


@pytest.mark.parametrize("label,line", KEPT, ids=[label for label, _ in KEPT])
def test_ordinary_lines_are_not_stripped(label, line):
    source = f"int before = 1;\n{line}\nint after = 2;\n"
    assert line in remove_boilerplate(source).splitlines(), f"{label} was wrongly stripped"


def test_boilerplate_excluded_count_matches_the_lines_actually_removed(tmp_path):
    source = "\n".join(
        [
            "#include <stdio.h>",
            "#include <stdlib.h>",
            "using namespace std;",
            "int alpha(int bravo) {",
            "    return bravo;",
            "}",
        ]
    )
    (tmp_path / "sample.c").write_text(source + "\n", encoding="utf-8")
    result = analyze_directory(tmp_path, "c")

    expected = len(source.splitlines()) - len(remove_boilerplate(source).splitlines())
    assert expected == 3
    assert result["boilerplate_lines_excluded"] == expected


def test_a_file_with_no_boilerplate_reports_zero_exclusions(tmp_path):
    (tmp_path / "sample.py").write_text("def alpha(bravo):\n    return bravo\n", encoding="utf-8")
    assert analyze_directory(tmp_path, "python")["boilerplate_lines_excluded"] == 0


# --- Evidence for defects, not aspirations. -----------------------------------

def test_winnow_never_exceeds_the_bigint_column():
    """fingerprints.hash_value is a signed BIGINT (max 2**63 - 1). winnow() masks
    the sha256 prefix to 63 bits, so no fingerprint can overflow the column and
    roll back the whole save. Regression guard for D-02 -- do not delete."""
    total = 0
    for seed in range(40):
        for fingerprint in winnow(token_stream(300, seed=seed), k=K, window=WINDOW):
            total += 1
            assert 0 <= fingerprint["hash_value"] <= INT64_MAX
    assert total > 0


def test_defect_d07_window_position_is_absolute_so_an_insertion_shifts_every_later_record():
    """The hashes survive an edit (see the locality test above), but the stored
    record is (file_path, hash_value, window_position) and window_position is an
    absolute k-gram index. Inserting one token renumbers everything after it, so
    a naive (path, position) join across submissions sees far more churn than the
    algorithm actually produced."""
    values = token_stream(300)
    midpoint = len(values) // 2
    mutated = values[:midpoint] + ["node_inserted"] + values[midpoint:]

    before = {(f["window_position"], f["hash_value"]) for f in winnow(values, k=K, window=WINDOW)}
    after = {(f["window_position"], f["hash_value"]) for f in winnow(mutated, k=K, window=WINDOW)}
    hashes_before = {f["hash_value"] for f in winnow(values, k=K, window=WINDOW)}
    hashes_after = {f["hash_value"] for f in winnow(mutated, k=K, window=WINDOW)}

    hash_overlap = len(hashes_before & hashes_after) / len(hashes_before)
    pair_overlap = len(before & after) / len(before)
    assert hash_overlap > 0.85, "the algorithm itself is not local -- a different bug"
    assert pair_overlap < hash_overlap, "positions no longer shift -- D-07 can be closed"
