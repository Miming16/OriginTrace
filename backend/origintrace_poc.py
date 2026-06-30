"""
OriginTrace — Proof-of-Concept snippets
=======================================
One minimal function per core component. These are PROOFS OF CONCEPT, not the
full system: each shows that the detection idea is feasible and self-implementable.

Pure-Python parts (winnowing, similarity, AI-residue scan, risk scoring) run as-is
under __main__. The AST and Git parts are real but need:
    pip install gitpython tree_sitter_languages
"""

import hashlib
import re
from collections import Counter


# ---------------------------------------------------------------------------
# 1. AST tokenization (tree-sitter) — structure, not names
# ---------------------------------------------------------------------------
def ast_token_stream(source: str, language: str = "python"):
    """Parse source into an AST and emit the stream of NODE TYPES (not the
    actual identifiers). Because every variable becomes 'identifier', renaming
    a variable does not change the stream — that is what makes detection
    resistant to cosmetic obfuscation."""
    from tree_sitter_languages import get_parser
    tree = get_parser(language).parse(source.encode())
    tokens = []

    def walk(node):
        if node.child_count == 0:        # leaf node
            tokens.append(node.type)     # e.g. 'identifier', '+', 'return'
        for child in node.children:
            walk(child)

    walk(tree.root_node)
    return tokens


# ---------------------------------------------------------------------------
# 2. Winnowing fingerprints (self-implemented — no libraries)
# ---------------------------------------------------------------------------
def _hash(gram: str) -> int:
    return int(hashlib.md5(gram.encode()).hexdigest(), 16)


def winnow(tokens, k: int = 5, w: int = 4):
    """k-gram hashing + winnowing: in every window of w hashes keep the
    minimum. Returns a set of fingerprint hashes that is stable under
    reordering and small edits (Schleimer, Wilkerson & Aiken, 2003)."""
    grams = [" ".join(map(str, tokens[i:i + k])) for i in range(len(tokens) - k + 1)]
    hashes = [_hash(g) for g in grams]
    fingerprints = set()
    for i in range(len(hashes) - w + 1):
        window = hashes[i:i + w]
        fingerprints.add(min(window))
    return fingerprints


# ---------------------------------------------------------------------------
# 3. Structural similarity (Jaccard over fingerprints)
# ---------------------------------------------------------------------------
def similarity(fp_a, fp_b) -> float:
    if not fp_a or not fp_b:
        return 0.0
    return len(fp_a & fp_b) / len(fp_a | fp_b)


# ---------------------------------------------------------------------------
# 4. Commit-pattern analysis (GitPython) — development plausibility
# ---------------------------------------------------------------------------
def commit_pattern(repo_path: str) -> dict:
    """Mine commit history for 'Big Bang' (most code in the first commit) and
    commit-message quality — signals of pasted vs. incrementally built work."""
    from git import Repo
    commits = list(Repo(repo_path).iter_commits())[::-1]   # oldest first
    if not commits:
        return {}

    def added(c):
        return sum(f["insertions"] for f in c.stats.files.values()) if c.stats.files else 0

    total_added = sum(added(c) for c in commits) or 1
    big_bang = added(commits[0]) / total_added

    generic = {"update", "final", "asd", "commit", "fix", "wip", ""}
    msgs = [c.message.strip().lower() for c in commits]
    meaningful = sum(1 for m in msgs if m not in generic and len(m) > 5)

    return {
        "num_commits": len(commits),
        "big_bang_ratio": round(big_bang, 2),       # >0.80 is suspicious
        "msg_quality": round(meaningful / len(msgs), 2),  # <0.30 is suspicious
    }


# ---------------------------------------------------------------------------
# 5. Provenance metadata — authorship / integrity anomalies
# ---------------------------------------------------------------------------
def provenance(repo_path: str) -> dict:
    """Flag commits whose author != committer and count timezone changes —
    indicators that the work was authored on someone else's machine."""
    from git import Repo
    mismatch, tz = 0, set()
    for c in Repo(repo_path).iter_commits():
        if c.author.email != c.committer.email:
            mismatch += 1
        tz.add(c.author_tz_offset)
    return {"author_committer_mismatch": mismatch, "timezone_changes": max(0, len(tz) - 1)}


def scan_ai_residue(source: str) -> int:
    """Count leftover authorship / AI-placeholder markers in the code text."""
    patterns = [r"as an ai", r"//\s*your .*here", r"@author", r"C:\\Users\\", r"/Users/\w+/"]
    return sum(len(re.findall(p, source, re.I)) for p in patterns)


# ---------------------------------------------------------------------------
# 6. Combined risk scoring (rule-based decision tree)
# ---------------------------------------------------------------------------
def risk_band(structural_sim, big_bang_ratio, msg_quality, author_mismatch, ai_residue) -> str:
    """Convergent, explainable scoring: no single signal decides; flags add up."""
    flags = 0
    if structural_sim >= 0.80:   flags += 2
    elif structural_sim >= 0.50: flags += 1
    if big_bang_ratio >= 0.80:   flags += 2
    if msg_quality < 0.30:       flags += 1
    if author_mismatch > 0:      flags += 1
    if ai_residue > 0:           flags += 1
    return "High" if flags >= 4 else "Medium" if flags >= 2 else "Low"


# ---------------------------------------------------------------------------
# Runnable demo (pure-Python parts only)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Structural token streams as ast_token_stream() would emit them.
    # 'a' and 'b' are the SAME program with variables renamed -> identical stream.
    a = ["def", "identifier", "(", "identifier", ")", ":", "return", "identifier", "+", "integer"]
    b = ["def", "identifier", "(", "identifier", ")", ":", "return", "identifier", "+", "integer"]
    c = ["import", "identifier", "for", "identifier", "in", "call", ":", "print", "string"]

    fa, fb, fc = winnow(a, k=3, w=2), winnow(b, k=3, w=2), winnow(c, k=3, w=2)
    print("structural similarity (renamed copy):", round(similarity(fa, fb), 2))
    print("structural similarity (unrelated)   :", round(similarity(fa, fc), 2))
    print("AI residue in pasted snippet         :",
          scan_ai_residue("# As an AI language model, here is the solution\nint x;"))
    print("risk band (copy + big-bang + mismatch):",
          risk_band(structural_sim=0.92, big_bang_ratio=0.85,
                    msg_quality=0.1, author_mismatch=1, ai_residue=1))
    print("risk band (clean, incremental work)   :",
          risk_band(structural_sim=0.15, big_bang_ratio=0.20,
                    msg_quality=0.9, author_mismatch=0, ai_residue=0))
