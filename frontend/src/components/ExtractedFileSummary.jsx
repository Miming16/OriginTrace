// WBS 2.1.1.2 — Extracted-File Summary in Submission View
// Shared by both the instructor detail panel and the student self-check result,
// since both surfaces need to show the same "what got analyzed" information.
//
// Shape expected once real data exists (from 2.1.1.1 / 2.1.1.3):
//   {
//     includedCount: number,
//     excludedBreakdown: [{ reason: string, count: number }]
//   }

export default function ExtractedFileSummary({ summary }) {
  const excludedTotal = summary.excludedBreakdown.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="border border-border-standard rounded-lg p-3 text-xs">
      <p className="font-semibold text-primary mb-1">
        {summary.includedCount} file{summary.includedCount === 1 ? '' : 's'} included
        {excludedTotal > 0 && (
          <span className="text-slate-text-muted font-normal"> · {excludedTotal} excluded</span>
        )}
      </p>
      {excludedTotal > 0 && (
        <ul className="text-slate-text-muted list-disc list-inside space-y-0.5">
          {summary.excludedBreakdown.map((item) => (
            <li key={item.reason}>
              {item.count} from <code className="text-[11px]">{item.reason}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
