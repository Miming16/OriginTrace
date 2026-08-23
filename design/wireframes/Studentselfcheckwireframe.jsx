// Low-fidelity wireframe — WBS 0.4
// Layout/structure only. No real data, no API calls, no final styling.
// Built out for real in 3.4 (skeleton) and 8.1-8.2 (full UI).
// Deliberately shows only risk band + guidance — no matches or named peers.

const dashedBox = {
  border: '1px dashed #999',
  borderRadius: 6,
  padding: 16,
};

export default function StudentSelfCheckWireframe() {
  return (
    <div style={{
      fontFamily: 'Arial, sans-serif', maxWidth: 420, margin: '0 auto',
      border: '1px solid #999', borderRadius: 8,
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderBottom: '1px solid #999', background: '#f0f0f0',
      }}>
        <span style={{ fontSize: 13, color: '#555' }}>OriginTrace</span>
        <span style={{ fontSize: 13, color: '#555' }}>Student: [name] ▾</span>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 15, color: '#333', marginBottom: 4 }}>Self-check submission</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>2 of 3 checks used today</div>

        <div style={{ ...dashedBox, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Git repo URL</div>
          <input disabled placeholder="https://github.com/..." style={{ width: '100%', marginBottom: 10 }} />
          <div style={{ fontSize: 12, color: '#888', margin: '6px 0' }}>or</div>
          <div style={{
            border: '1px dashed #999', borderRadius: 6, padding: 20,
            textAlign: 'center', fontSize: 12, color: '#888',
          }}>
            Drop file / browse to upload
          </div>
        </div>

        <button disabled style={{ width: '100%' }}>Run self-check</button>

        <div style={{ fontSize: 15, color: '#333', margin: '20px 0 8px' }}>Result</div>
        <div style={{ ...dashedBox, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Risk band</div>
          <div style={{ fontSize: 20, color: '#333', marginBottom: 10 }}>[Low / Medium / High]</div>
          <div style={{
            fontSize: 12, color: '#888', borderTop: '1px solid #ccc', paddingTop: 10,
          }}>
            Guidance text — no matched files or peer names shown
          </div>
        </div>
      </div>
    </div>
  );
}