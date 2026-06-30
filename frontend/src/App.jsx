import { useEffect, useState } from 'react'

const API = 'http://localhost:8000'

const BAND_STYLE = {
  Low:    { box: 'bg-emerald-500/15 border-emerald-500 text-emerald-300', dot: 'bg-emerald-400' },
  Medium: { box: 'bg-amber-500/15 border-amber-500 text-amber-300',       dot: 'bg-amber-400' },
  High:   { box: 'bg-rose-500/15 border-rose-500 text-rose-300',          dot: 'bg-rose-400' },
}

export default function App() {
  const [role, setRole] = useState('student')
  const [language, setLanguage] = useState('python')
  const [studentName, setStudentName] = useState('')
  const [assignmentName, setAssignmentName] = useState('Chapter 1 POC')
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [compareResult, setCompareResult] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [leftSubmissionId, setLeftSubmissionId] = useState('')
  const [rightSubmissionId, setRightSubmissionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (role === 'instructor') {
      loadSubmissions()
    } else {
      setCompareResult(null)
    }
  }, [role])

  async function loadSubmissions() {
    setLoadingSubmissions(true)
    setError('')
    try {
      const res = await fetch(`${API}/submissions?limit=100`)
      if (!res.ok) throw new Error(`Server responded ${res.status}`)
      const data = await res.json()
      setSubmissions(data)
      if (data.length > 0) {
        setLeftSubmissionId((current) => current || String(data[0].id))
        setRightSubmissionId((current) => current || String(data[1]?.id || data[0].id))
      }
    } catch (e) {
      setError(`Could not load stored submissions. Is the backend running on ${API}? (${e.message})`)
    } finally {
      setLoadingSubmissions(false)
    }
  }

  async function runSelfCheck() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          code,
          role: 'student',
        }),
      })
      if (!res.ok) throw new Error(`Server responded ${res.status}`)
      setResult(await res.json())
    } catch (e) {
      setError(`Could not run the self-check. Is the backend running on ${API}? (${e.message})`)
    } finally {
      setLoading(false)
    }
  }

  async function saveSubmission() {
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch(`${API}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language,
          code,
          role: 'student',
          student_name: studentName,
          assignment_name: assignmentName,
        }),
      })
      if (!res.ok) throw new Error(`Server responded ${res.status}`)
      setResult(await res.json())
      if (role === 'instructor') {
        await loadSubmissions()
      }
    } catch (e) {
      setError(`Could not reach the API. Is the backend running on ${API}? (${e.message})`)
    } finally {
      setLoading(false)
    }
  }

  async function compareStoredSubmissions() {
    if (!leftSubmissionId || !rightSubmissionId) return
    setLoading(true); setError(''); setCompareResult(null)
    try {
      const res = await fetch(`${API}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: Number(leftSubmissionId),
          reference_submission_id: Number(rightSubmissionId),
        }),
      })
      if (!res.ok) throw new Error(`Server responded ${res.status}`)
      setCompareResult(await res.json())
    } catch (e) {
      setError(`Could not compare stored submissions. Is the backend running on ${API}? (${e.message})`)
    } finally {
      setLoading(false)
    }
  }

  const band = result?.risk_band || compareResult?.risk_band
  const style = band ? BAND_STYLE[band] : null

  return (
    <div className="min-h-screen bg-[#0a1626] text-slate-200">
      <header className="border-b border-slate-800 bg-[#0c1f33]">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">OriginTrace</h1>
            <p className="text-sm text-slate-400">Code Originality Verification — Proof of Concept</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {['student', 'instructor'].map((r) => (
              <button key={r} onClick={() => { setRole(r); setResult(null) }}
                className={`px-4 py-2 text-sm capitalize transition ${
                  role === r ? 'bg-sky-600 text-white' : 'bg-transparent text-slate-300 hover:bg-slate-800'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 grid gap-6 md:grid-cols-2">
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-700 bg-[#0c1f33] p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white">{role === 'student' ? 'Student submission' : 'Instructor review'}</h2>
            <p className="text-xs text-slate-400">{role === 'student' ? 'Students submit once and the code is stored for instructor review.' : 'Load saved submissions and compare any two stored entries.'}</p>
          </div>

          {role === 'student' && (
            <>
              <div>
                <label className="block text-sm mb-1 text-slate-300">Student name</label>
                <input value={studentName} onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg bg-[#0c1f33] border border-slate-700 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="block text-sm mb-1 text-slate-300">Assignment name</label>
                <input value={assignmentName} onChange={(e) => setAssignmentName(e.target.value)}
                  className="w-full rounded-lg bg-[#0c1f33] border border-slate-700 px-3 py-2 text-sm" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm mb-1 text-slate-300">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg bg-[#0c1f33] border border-slate-700 px-3 py-2 text-sm">
              {['python','c','cpp','c_sharp','javascript','typescript','php'].map(l =>
                <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1 text-slate-300">Code submission</label>
            <textarea value={code} onChange={(e) => setCode(e.target.value)} rows={10}
              placeholder="Paste the code to submit…"
              className="w-full rounded-lg bg-[#0c1f33] border border-slate-700 px-3 py-2 font-mono text-sm" />
          </div>

          {role === 'student' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={runSelfCheck} disabled={loading || !code.trim()}
                className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-4 py-2.5 font-medium text-white">
                {loading ? 'Checking…' : 'Run Self-Check'}
              </button>
              <button onClick={saveSubmission} disabled={loading || !code.trim()}
                className="w-full rounded-lg border border-slate-700 bg-transparent hover:bg-slate-800 disabled:opacity-40 px-4 py-2.5 font-medium text-white">
                {loading ? 'Saving…' : 'Submit Code'}
              </button>
            </div>
          )}

          {role === 'instructor' && (
            <button onClick={saveSubmission} disabled={loading || !code.trim()}
              className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-4 py-2.5 font-medium text-white">
              {loading ? 'Saving…' : 'Save Submission'}
            </button>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </section>

        <section>
          {role === 'instructor' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-700 bg-[#0c1f33] p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">Stored submissions</h2>
                  <button onClick={loadSubmissions} disabled={loadingSubmissions}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50">
                    {loadingSubmissions ? 'Loading…' : 'Refresh'}
                  </button>
                </div>
                <p className="text-xs text-slate-400">{submissions.length} saved submission{submissions.length === 1 ? '' : 's'} available.</p>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs mb-1 text-slate-400">Left submission</label>
                    <select value={leftSubmissionId} onChange={(e) => setLeftSubmissionId(e.target.value)} className="w-full rounded-lg bg-[#0a1626] border border-slate-700 px-3 py-2 text-sm">
                      {submissions.map((item) => (
                        <option key={item.id} value={item.id}>#{item.id} - {item.student_name} - {item.assignment_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-slate-400">Right submission</label>
                    <select value={rightSubmissionId} onChange={(e) => setRightSubmissionId(e.target.value)} className="w-full rounded-lg bg-[#0a1626] border border-slate-700 px-3 py-2 text-sm">
                      {submissions.map((item) => (
                        <option key={item.id} value={item.id}>#{item.id} - {item.student_name} - {item.assignment_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button onClick={compareStoredSubmissions} disabled={loading || !leftSubmissionId || !rightSubmissionId || leftSubmissionId === rightSubmissionId}
                  className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-4 py-2.5 font-medium text-white">
                  {loading ? 'Comparing…' : 'Compare Stored Submissions'}
                </button>
              </div>

              <div className="rounded-xl border border-slate-700 bg-[#0c1f33] p-4 space-y-2 text-sm">
                <h3 className="font-semibold text-white">Saved code previews</h3>
                {submissions.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-800 bg-[#0a1626] p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span>#{item.id} {item.student_name} - {item.assignment_name}</span>
                      <span>{item.risk_band}</span>
                    </div>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-300">{item.code_preview}</pre>
                  </div>
                ))}
                {submissions.length === 0 && <p className="text-sm text-slate-500">No saved submissions yet.</p>}
              </div>
            </div>
          )}

          {role === 'student' && !result && <div className="rounded-lg border border-dashed border-slate-700 p-10 text-center text-slate-500">Self-check results will appear here, then you can submit to store the code.</div>}

          {(result || compareResult) && (
            <div className="space-y-4">
              <div className={`rounded-xl border p-5 ${style.box}`}>
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${style.dot}`} />
                  <span className="text-sm uppercase tracking-wide opacity-80">Risk Band</span>
                </div>
                <p className="text-3xl font-bold mt-1">{band}</p>
              </div>

              {result?.role === 'student' && (
                <div className="rounded-lg border border-slate-700 bg-[#0c1f33] p-4 text-sm text-slate-300">
                  {'submission_id' in result && <p className="font-semibold text-white">Submission #{result.submission_id}</p>}
                  <p className="mt-1">{result.guidance}</p>
                </div>
              )}

              {compareResult && (
                <div className="rounded-lg border border-slate-700 bg-[#0c1f33] p-4 space-y-2 text-sm">
                  <Row label="Left submission" value={`#${compareResult.left_submission.id} ${compareResult.left_submission.student_name}`} />
                  <Row label="Right submission" value={`#${compareResult.right_submission.id} ${compareResult.right_submission.student_name}`} />
                  <Row label="Structural similarity" value={`${(compareResult.structural_similarity * 100).toFixed(0)}%`} />
                  <Row label="AI / authorship residue markers" value={compareResult.ai_residue_markers} />
                  <Row label="Fingerprints extracted" value={compareResult.fingerprints} />
                  <p className="pt-2 text-xs text-slate-500">Stored submissions are kept locally for instructor review in this POC.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  )
}
