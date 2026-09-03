// Shared mock data for the instructor dashboard — used by both
// SubmissionListView (7.1) and the detail panel (3.3/7.2/7.3/7.4).
// Real data replaces this entirely in 7.5 (Instructor Dashboard API Integration).
//
// "section" mirrors the gap flagged in 0.3.2 — the submissions table doesn't
// have a real section/subject field yet, so this filter is UI-only until
// 0.3.3 resolves that.

export const SUBMISSIONS = [
  { id: 1, name: 'E. Winters', section: 'CS302-A', lang: 'Java', risk: 'High', date: '2026-10-14',
    fileSummary: { includedCount: 18, excludedBreakdown: [{ reason: 'node_modules', count: 112 }, { reason: 'vendor', count: 6 }] } },
  { id: 2, name: 'S. Connor', section: 'CS101-B', lang: 'Python', risk: 'Medium', date: '2026-10-14',
    fileSummary: { includedCount: 6, excludedBreakdown: [{ reason: '__pycache__', count: 3 }] } },
  { id: 3, name: 'A. Adams', section: 'CS205-A', lang: 'JavaScript', risk: 'Low', date: '2026-10-13',
    fileSummary: { includedCount: 9, excludedBreakdown: [] } },
  { id: 4, name: 'J. Dela Cruz', section: 'CS101-B', lang: 'PHP', risk: 'Low', date: '2026-10-13',
    fileSummary: { includedCount: 5, excludedBreakdown: [] } },
  { id: 5, name: 'M. Santos', section: 'CS302-A', lang: 'C', risk: 'High', date: '2026-10-12',
    fileSummary: { includedCount: 11, excludedBreakdown: [{ reason: 'vendor', count: 2 }] } },
  { id: 6, name: 'R. Cruz', section: 'CS205-A', lang: 'Python', risk: 'Medium', date: '2026-10-12',
    fileSummary: { includedCount: 7, excludedBreakdown: [{ reason: '__pycache__', count: 4 }] } },
  { id: 7, name: 'K. Lim', section: 'CS101-B', lang: 'JavaScript', risk: 'Low', date: '2026-10-11',
    fileSummary: { includedCount: 4, excludedBreakdown: [{ reason: 'node_modules', count: 63 }] } },
  { id: 8, name: 'P. Torres', section: 'CS302-A', lang: 'Java', risk: 'Medium', date: '2026-10-11',
    fileSummary: { includedCount: 14, excludedBreakdown: [] } },
  { id: 9, name: 'D. Ramos', section: 'CS205-A', lang: 'C', risk: 'High', date: '2026-10-10',
    fileSummary: { includedCount: 9, excludedBreakdown: [{ reason: 'vendor', count: 1 }] } },
  { id: 10, name: 'V. Reyes', section: 'CS101-B', lang: 'Python', risk: 'Low', date: '2026-10-10',
    fileSummary: { includedCount: 6, excludedBreakdown: [] } },
  { id: 11, name: 'N. Garcia', section: 'CS302-A', lang: 'PHP', risk: 'Medium', date: '2026-10-09',
    fileSummary: { includedCount: 8, excludedBreakdown: [{ reason: '__pycache__', count: 2 }] } },
  { id: 12, name: 'F. Ocampo', section: 'CS205-A', lang: 'Java', risk: 'Low', date: '2026-10-09',
    fileSummary: { includedCount: 10, excludedBreakdown: [] } },
];

export const SECTIONS = ['All sections', ...new Set(SUBMISSIONS.map((s) => s.section))];
export const RISK_BANDS = ['All risk bands', 'Low', 'Medium', 'High'];
