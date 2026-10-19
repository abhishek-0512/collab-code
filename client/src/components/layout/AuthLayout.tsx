import { Outlet, Link } from 'react-router-dom';
import { Code2 } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2.5 mb-8 justify-center group">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 group-hover:bg-indigo-500 flex items-center justify-center transition-colors shadow-lg shadow-indigo-600/30">
            <Code2 size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-slate-100 tracking-tight">Collab Code</span>
        </Link>
        <Outlet />
      </div>
    </div>
  );
}
