import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/instructor', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/instructor/subjects', label: 'Subjects', icon: 'school' },
  { to: '/instructor/clusters', label: 'Clusters', icon: 'hub' },
  { to: '/instructor/settings', label: 'Settings', icon: 'settings' },
];

export default function InstructorLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-background text-primary">
      <div className="w-56 border-r border-border-standard p-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <span className="material-symbols-outlined text-secondary">shield</span>
          <span className="font-bold text-lg">OriginTrace</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                isActive ? 'bg-secondary text-white font-bold' : 'text-slate-text-secondary hover:bg-surface-container-high'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <div className="mt-auto px-3 py-2 text-xs text-slate-text-muted">
          Instructor: {user?.fullName || '[name]'}
          <button onClick={logout} className="block text-secondary font-bold mt-1">Sign out</button>
        </div>
      </div>

      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
