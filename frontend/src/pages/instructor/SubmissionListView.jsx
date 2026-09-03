import { useState, useMemo } from 'react';
import { SUBMISSIONS as MOCK_SUBMISSIONS, SECTIONS, RISK_BANDS } from './mockSubmissions';

const PAGE_SIZE = 5;

export default function SubmissionListView({ onSelect, selectedId }) {
  const [riskFilter, setRiskFilter] = useState('All risk bands');
  const [sectionFilter, setSectionFilter] = useState('All sections');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return MOCK_SUBMISSIONS.filter((s) => {
      if (riskFilter !== 'All risk bands' && s.risk !== riskFilter) return false;
      if (sectionFilter !== 'All sections' && s.section !== sectionFilter) return false;
      if (dateFilter && s.date !== dateFilter) return false;
      return true;
    });
  }, [riskFilter, sectionFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function updateFilter(setter, value) {
    setter(value);
    setPage(1); // reset to page 1 whenever a filter changes
  }

  return (
    <div className="bg-white border border-border-standard rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-surface-container-low border-b border-border-standard flex flex-wrap gap-3 items-center justify-between">
        <h5 className="font-bold text-primary">Submissions</h5>
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            value={riskFilter}
            onChange={(e) => updateFilter(setRiskFilter, e.target.value)}
            className="border border-border-standard rounded-md px-2 py-1"
          >
            {RISK_BANDS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={sectionFilter}
            onChange={(e) => updateFilter(setSectionFilter, e.target.value)}
            className="border border-border-standard rounded-md px-2 py-1"
          >
            {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => updateFilter(setDateFilter, e.target.value)}
            className="border border-border-standard rounded-md px-2 py-1"
          />
          {(riskFilter !== 'All risk bands' || sectionFilter !== 'All sections' || dateFilter) && (
            <button
              onClick={() => updateFilter(setDateFilter, '') || setRiskFilter('All risk bands') || setSectionFilter('All sections')}
              className="text-secondary font-semibold px-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {pageItems.length === 0 ? (
        <p className="text-sm text-slate-text-muted text-center py-8">No submissions match these filters.</p>
      ) : (
        <div className="divide-y divide-border-standard">
          {pageItems.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`flex items-center justify-between gap-4 px-5 py-3 cursor-pointer hover:bg-surface-container-low transition ${
                selectedId === s.id ? 'bg-secondary/5' : ''
              }`}
            >
              <div>
                <p className="font-semibold text-primary">{s.name}</p>
                <p className="text-xs text-slate-text-muted">{s.section} · {s.date}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-[10px] bg-surface-container-high px-2 py-0.5 rounded">{s.lang}</span>
                <span className={`risk-badge ${s.risk.toLowerCase()}`}>{s.risk}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-3 border-t border-border-standard flex items-center justify-between text-xs text-slate-text-muted">
        <span>
          Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          –{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-2 py-1 border border-border-standard rounded disabled:opacity-40"
          >
            Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 border border-border-standard rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
