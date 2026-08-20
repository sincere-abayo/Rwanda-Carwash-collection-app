import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { Login } from './pages/Login';
import { FieldDashboard } from './pages/FieldDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { RegisterCarwash } from './pages/RegisterCarwash';
import { Registry } from './pages/Registry';
import { UserManagement } from './pages/UserManagement';
import { useSyncEngine } from './hooks/useSyncEngine';
import { Layout } from './components/Layout';
import { InstallPwaPrompt } from './components/InstallPwaPrompt';

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode, allowedRole?: 'admin' | 'staff' }) {
  const user = useAuthStore(state => state.user);
  if (!user) return <Navigate to="/" replace />;

  const isStaff = user.role === 'staff' || (user.role as string) === 'field_officer';
  const isAdmin = user.role === 'admin';

  if (allowedRole === 'admin' && !isAdmin) {
    return <Navigate to="/field" replace />;
  }
  if (allowedRole === 'staff' && !isStaff && !isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return <Layout>{children}</Layout>;
}

function LandingOrLogin() {
  const user = useAuthStore(state => state.user);
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/field'} replace />;
  }
  return <Login />;
}

export default function App() {
  // Initialize sync engine globally for authenticated sessions
  useSyncEngine();

  return (
    <>
      <InstallPwaPrompt />
      <Routes>
        <Route path="/" element={<LandingOrLogin />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        
        {/* Shared Routes */}
        <Route path="/register" element={<ProtectedRoute><RegisterCarwash /></ProtectedRoute>} />
        <Route path="/registry" element={<ProtectedRoute><Registry /></ProtectedRoute>} />

        {/* Field Staff Routes */}
        <Route path="/field" element={<ProtectedRoute allowedRole="staff"><FieldDashboard /></ProtectedRoute>} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRole="admin"><UserManagement /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

