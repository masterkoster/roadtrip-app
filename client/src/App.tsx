import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import TripDetailPage from './pages/TripDetailPage';
import PlanningPage from './pages/PlanningPage';
import NewTripPage from './pages/NewTripPage';
import EditTripPage from './pages/EditTripPage';
import GuideViewPage from './pages/GuideViewPage';
import NewGuidePage from './pages/NewGuidePage';
import PhotosPage from './pages/PhotosPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/trips" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="new" element={<NewTripPage />} />
        <Route path=":id" element={<TripDetailPage />} />
        <Route path=":id/edit" element={<EditTripPage />} />
        <Route path=":id/photos" element={<PhotosPage />} />
        <Route path=":id/guides/new" element={<NewGuidePage />} />
      </Route>
      <Route path="/trips/:id/plan" element={<ProtectedRoute><PlanningPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
