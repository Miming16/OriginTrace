// Low-fidelity wireframe — WBS 0.4
// Layout/structure only. No real data, no API calls, no final styling.
// Built out for real in 3.3 (skeleton) and 7.1-7.4 (full UI).

const box = {
  border: '1px dashed #999',
  borderRadius: 6,
  padding: 10,
  fontSize: 12,
  color: '#777',
};

const solidBox = {
  border: '1px solid #999',
  borderRadius: 6,
};

export default function InstructorDashboardWireframe() {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', border: '1px solid #999', borderRadius: 8 }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderBottom: '1px solid #999', background: '#f0f0f0',
      }}>
        <span style={{ fontSize: 13, color: '#555' }}>OriginTrace</span>
        <span style={{ fontSize: 13, color: '#555' }}>Instructor: [name] ▾</span>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: 140, borderRight: '1px solid #999', padding: '16px 0' }}>
          {['Submissions', 'Subjects', 'Clusters', 'Settings'].map((label, i) => (
            <div key={label} style={{
              padding: '8px 16px', fontSize: 13,
              color: i === 0 ? '#333' : '#999',
              borderLeft: i === 0 ? '3px solid #333' : '3px solid transparent',
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: 16 }}>
          <div style={{ fontSize: 15, color: '#333', marginBottom: 12 }}>Submission list</div>

          <div style={solidBox}>
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr',
              padding: '8px 12px', fontSize: 12, color: '#888', borderBottom: '1px solid #ccc',
            }}>
              <span>Student</span><span>Subject</span><span>Risk band</span><span>Status</span>
            </div>
            {[1, 2, 3].map((row) => (
              <div key={row} style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr',
                padding: '8px 12px', fontSize: 12, color: '#666',
                borderBottom: row < 3 ? '1px solid #eee' : 'none',
              }}>
                <span>[name]</span><span>[subject]</span><span>[band]</span><span>[status]</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 15, color: '#333', margin: '16px 0 8px' }}>
            Detail panel (on row select)
          </div>
          <div style={{ ...box, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={box}>Matched fragments list</div>
            <div style={box}>Peer overlaps</div>
            <div style={box}>Commit / provenance flags</div>
            <div style={box}>Risk band summary</div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button disabled>Clear</button>
            <button disabled>Flag for review</button>
            <button disabled>Mark under review</button>
          </div>
        </div>
      </div>
    </div>
  );
}
