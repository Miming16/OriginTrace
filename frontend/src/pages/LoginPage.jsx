import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_HOME = {
  student: '/student',
  instructor: '/instructor',
  admin: '/admin',
};

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  async function handleRoleLogin(role) {
    await login('demo@usjr.edu', 'demo123', role);
    navigate(ROLE_HOME[role] || '/student', { replace: true });
  }

  return (
    <div className="login-shell">
      <div className="login-card-panel">
        <div className="brand-block">
          <img src="/origintrace-logo.svg" alt="OriginTrace logo" className="brand-logo login-logo" />
        </div>

        <div className="role-chooser">
          <button
            className="role-button"
            onClick={() => handleRoleLogin('student')}
            disabled={loading}
          >
            <span className="material-symbols-outlined">school</span>
            Student
          </button>

          <button
            className="role-button"
            onClick={() => handleRoleLogin('instructor')}
            disabled={loading}
          >
            <span className="material-symbols-outlined">person</span>
            Instructor
          </button>

          <button
            className="role-button secondary"
            onClick={() => handleRoleLogin('admin')}
            disabled={loading}
          >
            <span className="material-symbols-outlined">admin_panel_settings</span>
            Admin
          </button>
        </div>
      </div>
    </div>
  );
}
