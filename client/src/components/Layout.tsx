import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-roadtrip-500 to-roadtrip-700 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5 text-white" viewBox="0 0 100 100" fill="currentColor">
                  <path d="M30 65 L50 25 L70 65 Z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-gray-900">Roadtrip</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/trips/new" className="inline-flex items-center gap-1.5 px-4 py-2 bg-roadtrip-600 text-white rounded-xl text-sm font-medium hover:bg-roadtrip-700 transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Trip
              </Link>
              <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-roadtrip-400 to-roadtrip-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-sm text-gray-600 hidden sm:block">{user?.name}</span>
                <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors ml-1">Logout</button>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
