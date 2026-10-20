import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, LogIn, Clock, Users, Trash2, ArrowRight, Code2, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { useAuthStore } from '../stores/auth.store';
import * as roomService from '../services/room.service';
import * as problemService from '../services/problem.service';
import type { Room, Problem } from '../types';

const languageOptions = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
];

function formatTimeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [addProblemOpen, setAddProblemOpen] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    language: 'javascript',
    isPrivate: true,
  });
  const [joinCode, setJoinCode] = useState('');
  const [customProblem, setCustomProblem] = useState({
    title: '',
    description: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    tags: 'LeetCode, DSA',
    constraints: '',
  });
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [savingProblem, setSavingProblem] = useState(false);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoadingRooms(true);
    Promise.all([roomService.getUserRooms(), problemService.getProblems()])
      .then(([r, p]) => {
        setRooms(r);
        setProblems(p);
      })
      .catch((err) => {
        console.error('Failed to load dashboard data:', err);
      })
      .finally(() => setLoadingRooms(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const room = await roomService.createRoom(createForm);
      navigate(`/room/${room.roomId}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to create room');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setJoining(true);
    try {
      const room = await roomService.joinRoom(joinCode.trim().toUpperCase());
      navigate(`/room/${room.roomId}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Invalid or expired invite code');
    } finally {
      setJoining(false);
    }
  };

  const handleDelete = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await roomService.deleteRoom(roomId);
      setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete room');
    }
  };

  const handleAddCustomProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customProblem.title.trim() || !customProblem.description.trim()) {
      setError('Title and description are required');
      return;
    }
    setError('');
    setSavingProblem(true);
    try {
      const created = await problemService.createProblem({
        title: customProblem.title.trim(),
        description: customProblem.description.trim(),
        difficulty: customProblem.difficulty,
        tags: customProblem.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        constraints: customProblem.constraints.trim(),
      });

      setProblems((prev) => [created, ...prev]);
      setAddProblemOpen(false);
      // Automatically launch room with this problem
      await startProblemRoom(created);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to save problem');
    } finally {
      setSavingProblem(false);
    }
  };

  const startProblemRoom = async (p: Problem) => {
    try {
      const room = await roomService.createRoom({
        name: `${p.title} Session`,
        description: `Solving problem: ${p.title}`,
        language: 'javascript',
        isPrivate: true,
      });
      navigate(`/room/${room.roomId}?problem=${p.slug}`);
    } catch (err: any) {
      alert(err?.message || 'Failed to initialize session');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Welcome, {user?.username}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your collaborative coding rooms and practice sessions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setError('');
              setJoinCode('');
              setJoinOpen(true);
            }}
            className="gap-2"
          >
            <LogIn size={15} />
            Join via Code
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setError('');
              setCreateForm({
                name: `${user?.username || 'Dev'}'s Workspace`,
                description: '',
                language: 'javascript',
                isPrivate: true,
              });
              setCreateOpen(true);
            }}
            className="gap-2 shadow-sm"
          >
            <Plus size={15} />
            New Room
          </Button>
        </div>
      </div>

      {/* Main Grid: Rooms & Practice Problems */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Sessions */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Clock size={14} />
              Recent Coding Sessions ({rooms.length})
            </h2>
          </div>

          {loadingRooms ? (
            <div className="flex items-center justify-center py-20 border border-slate-800/80 rounded-2xl bg-slate-900/40">
              <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading sessions...</span>
              </div>
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
              <Code2 size={36} className="text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-300">No active coding sessions</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                Create a new private workspace or join an existing room with an invite code.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setError('');
                  setCreateOpen(true);
                }}
              >
                Create First Room
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {rooms.map((room) => (
                <div
                  key={room.id || room.roomId}
                  onClick={() => navigate(`/room/${room.roomId}`)}
                  className="flex items-center justify-between p-4 bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl transition-all cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0 group-hover:border-indigo-500/50 transition-colors">
                      <Code2 size={18} className="text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-100 truncate">
                          {room.name}
                        </span>
                        <Badge variant="default">{room.language}</Badge>
                        {room.isOwner && <Badge variant="info">Owner</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="font-mono">ID: {room.roomId}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {room.memberCount || 1} members
                        </span>
                        <span>•</span>
                        <span>Updated {formatTimeAgo(room.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right hidden sm:block mr-2">
                      <div className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                        Code: {room.inviteCode}
                      </div>
                    </div>

                    {room.isOwner && (
                      <button
                        title="Delete Room"
                        onClick={(e) => handleDelete(room.roomId, e)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}

                    <div className="p-2 rounded-lg text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Problem Practice Catalog */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={14} />
              Practice Challenges
            </h2>
            <button
              onClick={() => {
                setError('');
                setCustomProblem({
                  title: '',
                  description: '',
                  difficulty: 'medium',
                  tags: 'LeetCode, DSA',
                  constraints: '',
                });
                setAddProblemOpen(true);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} />
              Add LeetCode / Custom
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {problems.map((p) => (
              <div
                key={p.slug}
                className="p-4 bg-slate-900/50 border border-slate-800 hover:border-slate-700/80 rounded-xl flex flex-col gap-2 transition-all hover:bg-slate-900/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm text-slate-200">{p.title}</span>
                  <Badge
                    variant={
                      p.difficulty === 'easy'
                        ? 'success'
                        : p.difficulty === 'medium'
                        ? 'warning'
                        : 'danger'
                    }
                  >
                    {p.difficulty}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => startProblemRoom(p)}
                  className="mt-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Sparkles size={13} />
                  Solve with Collaborator →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Room Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Collaborative Room"
        description="Launch an isolated coding workspace and invite your peers"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Room Name"
            placeholder="e.g. Distributed Systems Lab"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            required
          />

          <Input
            label="Description (Optional)"
            placeholder="What are you pairing on today?"
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
          />

          <Select
            label="Primary Language"
            options={languageOptions}
            value={createForm.language}
            onChange={(e) => setCreateForm({ ...createForm, language: e.target.value })}
          />

          {error && (
            <div className="bg-red-950/40 border border-red-800/60 text-red-300 text-xs px-3.5 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={creating} className="flex-1">
              Create Room
            </Button>
          </div>
        </form>
      </Modal>

      {/* Join Room Modal */}
      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join Existing Room"
        description="Enter the 8-character invite code provided by room owner"
      >
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <Input
            label="Invite Code"
            placeholder="e.g. A9B8C7D6"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            required
            className="font-mono text-center tracking-widest uppercase text-base"
            maxLength={12}
          />

          {error && (
            <div className="bg-red-950/40 border border-red-800/60 text-red-300 text-xs px-3.5 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setJoinOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={joining} className="flex-1">
              Join Session
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Custom / LeetCode Problem Modal */}
      <Modal
        open={addProblemOpen}
        onClose={() => setAddProblemOpen(false)}
        title="Add LeetCode or Custom DSA Problem"
        description="Paste any LeetCode, Codeforces, or interview problem statement to solve collaboratively"
        size="lg"
      >
        <form onSubmit={handleAddCustomProblem} className="flex flex-col gap-3.5">
          <Input
            label="Problem Title"
            placeholder="e.g. Longest Substring Without Repeating Characters"
            value={customProblem.title}
            onChange={(e) => setCustomProblem({ ...customProblem, title: e.target.value })}
            required
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <Select
                label="Difficulty"
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
                value={customProblem.difficulty}
                onChange={(e) =>
                  setCustomProblem({
                    ...customProblem,
                    difficulty: e.target.value as 'easy' | 'medium' | 'hard',
                  })
                }
              />
            </div>
            <div className="flex-1">
              <Input
                label="Topic Tags (comma-separated)"
                placeholder="String, Sliding Window, Hash Table"
                value={customProblem.tags}
                onChange={(e) => setCustomProblem({ ...customProblem, tags: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-medium text-slate-300">
              Problem Description & Examples
            </label>
            <textarea
              rows={5}
              placeholder="Paste problem prompt, input/output description, and example test cases here..."
              value={customProblem.description}
              onChange={(e) =>
                setCustomProblem({ ...customProblem, description: e.target.value })
              }
              className="w-full rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-2 text-slate-100 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-y"
              required
            />
          </div>

          <Input
            label="Constraints (Optional)"
            placeholder="e.g. 0 <= s.length <= 5 * 10^4"
            value={customProblem.constraints}
            onChange={(e) =>
              setCustomProblem({ ...customProblem, constraints: e.target.value })
            }
          />

          {error && (
            <div className="bg-red-950/40 border border-red-800/60 text-red-300 text-xs px-3.5 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddProblemOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingProblem} className="flex-1">
              Save & Launch Session
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
