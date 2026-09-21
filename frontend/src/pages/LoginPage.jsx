import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  student: '/student',
  instructor: '/instructor',
  admin: '/admin',
};

export default function LoginPage() {
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { login, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    try {
      const user = await login(idNumber, password);
      const destination = ROLE_HOME[user?.role] || '/login';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid ID number or password.');
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card-panel">
        <div className="brand-block">
          <img src="/origintrace-logo.svg" alt="OriginTrace logo" className="brand-logo login-logo" />
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="idNumber">ID Number</label>
            <input
              id="idNumber"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. 2023001234"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
