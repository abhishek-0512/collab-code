import { useState, useEffect } from 'react';
import { User, Mail, Calendar, ShieldCheck, Code, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { Badge } from '../components/ui/Badge';
import * as roomService from '../services/room.service';
import type { Room } from '../types';

export function ProfilePage() {
  const { user } = useAuthStore();
  const [userRooms, setUserRooms] = useState<Room[]>([]);

  useEffect(() => {
    roomService.getUserRooms().then(setUserRooms).catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors mb-4"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Developer Profile</h1>
        <p className="text-xs text-slate-400 mt-1">Account details and session metadata</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="md:col-span-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-sky-500 flex items-center justify-center text-2xl font-bold text-white shadow-xl shadow-indigo-600/20 mb-4 ring-2 ring-indigo-500/30">
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>

          <h2 className="text-lg font-bold text-slate-100">{user?.username}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>

          <div className="w-full mt-6 pt-5 border-t border-slate-800/80 flex flex-col gap-3 text-left text-xs">
            <div className="flex items-center gap-2.5 text-slate-400">
              <User size={14} className="text-indigo-400 shrink-0" />
              <span>
                User ID: <span className="font-mono text-slate-300">{user?.id?.slice(0, 10)}...</span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-400">
              <Mail size={14} className="text-indigo-400 shrink-0" />
              <span className="truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-400">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              <span>JWT Authenticated</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-400">
              <Calendar size={14} className="text-indigo-400 shrink-0" />
              <span>Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}</span>
            </div>
          </div>
        </div>

        {/* Stats & Metadata */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-semibold text-sm text-slate-200 mb-4 flex items-center gap-2">
              <Code size={16} className="text-indigo-400" />
              Session Statistics
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <div className="text-2xl font-bold text-slate-100">{userRooms.length}</div>
                <div className="text-xs text-slate-400 mt-1">Total Rooms</div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <div className="text-2xl font-bold text-indigo-400">
                  {userRooms.filter((r) => r.isOwner).length}
                </div>
                <div className="text-xs text-slate-400 mt-1">Owned Rooms</div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                <div className="text-2xl font-bold text-emerald-400">7</div>
                <div className="text-xs text-slate-400 mt-1">Runtimes Supported</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <h3 className="font-semibold text-sm text-slate-200 mb-3">Supported Sandboxed Languages</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Programs are isolated inside sandboxed runtimes with CPU quotas, memory limits, and timeouts.
            </p>
            <div className="flex flex-wrap gap-2">
              {['JavaScript (Node 18)', 'TypeScript 5', 'Python 3.10', 'Java 15', 'C++ (GCC 10)', 'Go 1.16', 'Rust 1.50'].map(
                (lang) => (
                  <Badge key={lang} variant="default">
                    {lang}
                  </Badge>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
