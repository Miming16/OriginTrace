import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import InstructorDashboard from './pages/instructor/Dashboard';
import Subjects from './pages/instructor/Subjects'; // Added import
import StudentSelfCheck from './pages/student/SelfCheck';
import AdminPanel from './pages/admin/AdminPanel';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/instructor/*"
            element={
              <ProtectedRoute allowedRoles={['instructor']}>
                <Routes>
                  <Route path="/" element={<InstructorDashboard />} />
                  <Route path="subjects" element={<Subjects />} />
                </Routes>
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/*"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentSelfCheck />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPanel />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}a