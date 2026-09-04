import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import SelfCheckForm from './SelfCheckForm';
import AggregateResultDisplay from '../../components/AggregateResultDisplay';

export default function StudentSelfCheck() {
  const { user, logout } = useAuth();
  const [result, setResult] = useState(null); // { band: 'low' | 'medium' | 'high' } | null

  return (
    <div className="min-h-screen bg-background text-primary">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-standard bg-white">
        <span className="font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">shield</span> OriginTrace
        </span>
        <span className="text-sm text-slate-text-secondary">
          Student: {user?.fullName || '[name]'}
          <button onClick={logout} className="ml-2 text-secondary font-bold">Sign out</button>
        </span>
      </div>

      <div className="max-w-md mx-auto p-6">
        <SelfCheckForm onComplete={setResult} />

        <div className="mt-6">
          <h3 className="font-bold text-sm mb-3">Result</h3>
          <AggregateResultDisplay band={result?.band} />
        </div>
      </div>
    </div>
  );
}
