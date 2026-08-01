import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const ROLE_HOME = {
  instructor: '/instructor',
  student: '/student',
  admin: '/admin',
};

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    try {
      const user = await login(email, password);
      const destination = ROLE_HOME[user.role] || '/login';
      navigate(destination, { replace: true });
    } catch (err) {
      const message =
        err.response?.status === 401
          ? 'Incorrect email or password.'
          : 'Something went wrong. Please try again.';
      setError(message);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">OriginTrace</h1>
        <p className="login-subtitle">Sign in to continue</p>

        <label className="login-label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="login-input"
        />

        <label className="login-label" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="login-input"
        />

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={loading} className="login-button">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
