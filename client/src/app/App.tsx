import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import { AuthLayout } from '../components/layout/AuthLayout';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { DashboardPage } from '../pages/DashboardPage';
import { RoomPage } from '../pages/RoomPage';
import { ProfilePage } from '../pages/ProfilePage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Authentication Routes (Public only) */}
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
        </Route>

        {/* Protected Authenticated Routes */}
        <Route element={<ProtectedRoute />}>
          {/* Main App Layout */}
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Fullscreen Dedicated Collaborative Workspace */}
          <Route path="/room/:roomId" element={<RoomPage />} />
        </Route>

        {/* Fallback Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
