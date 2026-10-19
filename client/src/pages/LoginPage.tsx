import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../stores/auth.store';
import * as authService from '../services/auth.service';

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      setAuth(data.user, data.token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-7 shadow-xl backdrop-blur-sm">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-100">Welcome Back</h1>
        <p className="text-xs text-slate-400 mt-1">Sign in to resume your collaborative coding sessions</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="developer@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && (
          <div className="bg-red-950/40 border border-red-800/60 text-red-300 text-xs px-3.5 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full mt-2">
          Sign In
        </Button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
        <p className="text-xs text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
