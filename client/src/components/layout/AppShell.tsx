import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Code2, LayoutDashboard, LogOut, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { Tooltip } from '../ui/Tooltip';

export function AppShell() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-sans">
      {/* Sleek Vertical Rail */}
      <aside className="w-14 flex flex-col items-center gap-3 border-r border-slate-800/80 bg-slate-900/90 py-4 shrink-0">
        <Link to="/dashboard" className="mb-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-all shadow-md shadow-indigo-600/20">
            <Code2 size={18} className="text-white" />
          </div>
        </Link>

        <Tooltip content="Dashboard" position="right">
          <Link
            to="/dashboard"
            className={`p-2.5 rounded-lg transition-colors ${
              isActive('/dashboard')
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard size={18} />
          </Link>
        </Tooltip>

        <Tooltip content="Profile" position="right">
          <Link
            to="/profile"
            className={`p-2.5 rounded-lg transition-colors ${
              isActive('/profile')
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <UserIcon size={18} />
          </Link>
        </Tooltip>

        <div className="mt-auto flex flex-col items-center gap-3">
          <Tooltip content={user?.username || 'Profile'} position="right">
            <Link to="/profile">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-white/10 hover:ring-indigo-400 transition-all">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
            </Link>
          </Tooltip>
          <Tooltip content="Sign out" position="right">
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
            >
              <LogOut size={18} />
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-slate-950">
        <Outlet />
      </main>
    </div>
  );
}
