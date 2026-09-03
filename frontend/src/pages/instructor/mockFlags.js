export const FLAGS_BY_SUBMISSION = {
  1: [ // E. Winters — High risk
    {
      id: 'f1', category: 'commit', type: 'Big Bang Commit', severity: 'High',
      source: '4.2 — Big Bang Commit Detector',
      explanation: 'A single commit introduced 94% of the final codebase, with no earlier incremental commits building up to it.',
      evidence: 'commit 8a2f19e\nAuthor: E. Winters\nDate: Oct 12 2026 11:58 PM\n\n    "final submission"\n\n 1 file changed, 412 insertions(+), 3 deletions(-)',
    },
    {
      id: 'f2', category: 'provenance', type: 'Author–Committer Mismatch', severity: 'High',
      source: '5.2 — Author–Committer Mismatch Detector',
      explanation: 'The commit author email does not match the committer email on 6 of 7 commits — often a sign the code was written elsewhere and re-committed under this account.',
      evidence: 'Author:    e.winters@usjr.edu.ph\nCommitter: devbox2019@gmail.com\n(mismatch on commits 8a2f19e, c410b2a, 9e21f0d, ...)',
    },
  ],
  2: [ // S. Connor — Medium risk
    {
      id: 'f3', category: 'commit', type: 'Low Commit-Message Entropy', severity: 'Medium',
      source: '4.4 — Commit-Message Entropy Scorer',
      explanation: 'Commit messages are generic/auto-generated across the whole history, offering no development narrative.',
      evidence: 'commit 1: "update"\ncommit 2: "fix"\ncommit 3: "update"\ncommit 4: "wip"\ncommit 5: "final"',
    },
  ],
  5: [ // M. Santos — High risk
    {
      id: 'f4', category: 'commit', type: 'Zombie Code', severity: 'Medium',
      source: '4.3 — Zombie Code Detector',
      explanation: 'A large block (61 lines) was added and then deleted within the same session, with no corresponding explanation in the commit message.',
      evidence: 'commit 4b7e2aa (+61 lines)\ncommit 4b8f3cd (-61 lines, same file, 4 minutes later)\nmessage: "oops"',
    },
    {
      id: 'f5', category: 'provenance', type: 'Timestamp Anomaly', severity: 'High',
      source: '5.3 — Timestamp & Timezone Anomaly Detector',
      explanation: 'Commit timestamps jump between UTC+8 and UTC-5 across the same working session, and one commit is dated before the assignment was published.',
      evidence: 'commit a1: 2026-10-09 14:02 +08:00\ncommit a2: 2026-10-09 14:07 -05:00\ncommit a3: 2026-09-30 09:11 +08:00  (before assignment opened)',
    },
  ],
  9: [ // D. Ramos — High risk
    {
      id: 'f6', category: 'provenance', type: 'Embedded Authorship Marker', severity: 'High',
      source: '5.4 — Embedded Authorship Marker Scanner',
      explanation: 'A source comment references a name that does not match the enrolled student, suggesting the file originated from someone else.',
      evidence: '// Author: J. Bautista\n// Solution for CS205 Assignment 3\n// Do not distribute',
    },
  ],
};

export function getFlagsFor(submissionId) {
  return FLAGS_BY_SUBMISSION[submissionId] || [];
}
