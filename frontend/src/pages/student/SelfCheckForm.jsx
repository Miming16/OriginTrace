import { useState, useRef } from 'react';
const QUOTA = { used: 1, limit: 3 };

const STATUS_META = {
  idle: null,
  uploading: { label: 'Uploading…', icon: 'upload', cls: 'text-secondary' },
  queued: { label: 'Queued for analysis', icon: 'schedule', cls: 'text-slate-text-muted' },
  processing: { label: 'Analyzing…', icon: 'sync', cls: 'text-risk-medium' },
  complete: { label: 'Complete', icon: 'check_circle', cls: 'text-risk-low' },
  failed: { label: 'Failed — try again', icon: 'error', cls: 'text-risk-high' },
};

export default function SelfCheckForm({ onComplete }) {
  const [method, setMethod] = useState('git'); // 'git' | 'upload'
  const [repoUrl, setRepoUrl] = useState('');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState('idle');
  const fileInputRef = useRef(null);

  const remaining = QUOTA.limit - QUOTA.used;
  const isSubmitting = status !== 'idle' && status !== 'complete' && status !== 'failed';
  const canSubmit = remaining > 0 && !isSubmitting && (method === 'git' ? repoUrl.trim() !== '' : file !== null);

  function handleFileSelect(selected) {
    if (selected && !selected.name.toLowerCase().endsWith('.zip')) {
      setStatus('failed');
      return;
    }
    setFile(selected);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files?.[0]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    // Simulated pipeline stages — real version replaces this with actual
    // status polling / websocket updates once 3.5's submission API exists.
    setStatus('uploading');
    setTimeout(() => setStatus('queued'), 700);
    setTimeout(() => setStatus('processing'), 1600);
    setTimeout(() => {
      setStatus('complete');
      onComplete?.({ band: 'low' }); // placeholder result — 8.2 owns real display
    }, 2800);
  }

  const statusInfo = STATUS_META[status];

  return (
    <div className="bg-white border border-border-standard rounded-xl p-6 shadow-sm">
      <h3 className="font-bold text-lg mb-1">Self-check submission</h3>
      <p className="text-xs text-slate-text-muted mb-4">
        {remaining} of {QUOTA.limit} checks remaining today
        {remaining <= 0 && <span className="text-risk-high font-semibold"> — quota reached, try again tomorrow</span>}
      </p>

      <div className="flex gap-1 mb-4 bg-surface-container-low rounded-lg p-1 w-fit">
        {['git', 'upload'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
              method === m ? 'bg-white shadow-sm text-primary' : 'text-slate-text-muted'
            }`}
          >
            {m === 'git' ? 'Git repo URL' : 'Upload .zip'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {method === 'git' ? (
          <div>
            <label className="text-xs font-semibold text-slate-text-secondary block mb-1">Git repo URL</label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full border border-border-standard rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center text-xs cursor-pointer transition ${
              dragOver ? 'border-secondary bg-secondary/5' : 'border-border-standard text-slate-text-muted'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
            {file ? (
              <p className="text-primary font-semibold">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
            ) : (
              <p>Drop a .zip file here, or click to browse</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-secondary text-white py-2.5 rounded-lg text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          {isSubmitting ? 'Working…' : 'Run self-check'}
        </button>
      </form>

      {statusInfo && (
        <div className={`flex items-center gap-2 mt-4 text-sm font-semibold ${statusInfo.cls}`}>
          <span className={`material-symbols-outlined text-[18px] ${status === 'processing' ? 'animate-spin' : ''}`}>
            {statusInfo.icon}
          </span>
          {statusInfo.label}
        </div>
      )}
    </div>
  );
}
