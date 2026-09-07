import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const DEMO_USERS = {
  student: { id: 's-1001', fullName: 'Alex Adams', role: 'student', email: 'alex@usjr.edu' },
  instructor: { id: 'i-2001', fullName: 'Prof. Ramos', role: 'instructor', email: 'ramos@usjr.edu' },
  admin: { id: 'a-3001', fullName: 'System Admin', role: 'admin', email: 'admin@usjr.edu' },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEMO_USERS.student);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email, password, role = 'student') => {
    setLoading(true);
    try {
      const demoUser = DEMO_USERS[role] || DEMO_USERS.student;
      setUser(demoUser);
      return demoUser;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
