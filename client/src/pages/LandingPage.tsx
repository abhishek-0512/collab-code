import { Link } from 'react-router-dom';
import { Code2, Users, Zap, Shield, ArrowRight, Terminal, Cpu, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';

const features = [
  {
    icon: Code2,
    title: 'Real-Time Shared Monaco Editor',
    description:
      'Synchronized multi-user coding workspace powered by Monaco with live keystrokes, remote cursor positions, and zero jitter.',
  },
  {
    icon: Terminal,
    title: 'Sandboxed Code Execution',
    description:
      'Isolated runtime environments for JavaScript, TypeScript, Python, C++, Java, Go, and Rust with memory and CPU boundaries.',
  },
  {
    icon: Users,
    title: 'Room Presence & Collaborators',
    description:
      'Instant join via unique room IDs and 8-character invite codes. See who is currently online with distinct user badges.',
  },
  {
    icon: Cpu,
    title: 'Curated Problem Solving',
    description:
      'Browse classic algorithmic challenges, inspect test constraints, and evaluate code against sample and hidden test cases.',
  },
  {
    icon: Sparkles,
    title: 'In-Room Discussion Chat',
    description:
      'Communicate with collaborators alongside the editor without switching windows or interrupting your flow.',
  },
  {
    icon: Shield,
    title: 'Private & Secure by Default',
    description:
      'All sessions are token-authenticated with hashed passwords, JWT validation, and room authorization checks.',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <nav className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Code2 size={18} className="text-white" />
            </div>
            <span className="font-bold text-slate-100 tracking-tight text-lg">Collab Code</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-950/70 border border-indigo-700/40 text-indigo-300 text-xs px-3.5 py-1.5 rounded-full mb-8 shadow-sm">
          <Zap size={13} className="text-indigo-400 fill-indigo-400" />
          <span>Real-time collaborative workspace for developers & interview prep</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-100 mb-6 tracking-tight leading-[1.15]">
          Code together,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-300 to-sky-400">
            synchronize in real time
          </span>
        </h1>
        <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed font-normal">
          Create private coding rooms, write code concurrently with live collaborator presence, run
          sandboxed programs in multiple languages, and practice algorithmic problems together.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link to="/register">
            <Button size="lg" className="gap-2 shadow-lg shadow-indigo-600/20">
              Start a Session <ArrowRight size={17} />
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="secondary">
              Sign In to Account
            </Button>
          </Link>
        </div>

        {/* Live Workspace Preview Card */}
        <div className="mt-14 max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-2xl overflow-hidden text-left p-1">
          <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-slate-300">room: algorithm-study-group</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>3 collaborators online</span>
              </div>
            </div>
            <pre className="font-mono text-xs md:text-sm text-slate-300 py-4 overflow-x-auto leading-relaxed">
              <span className="text-indigo-400">function</span> <span className="text-sky-300">twoSum</span>
              (nums: <span className="text-amber-300">number</span>[], target: <span className="text-amber-300">number</span>) {'{\n'}
              {'  '}<span className="text-slate-500">// Real-time CRDT synchronized between all participants</span>{'\n'}
              {'  '}<span className="text-indigo-400">const</span> map = <span className="text-indigo-400">new</span> <span className="text-sky-300">Map</span>();{'\n'}
              {'  '}<span className="text-indigo-400">for</span> (<span className="text-indigo-400">let</span> i = 0; i &lt; nums.length; i++) {'{\n'}
              {'    '}<span className="text-indigo-400">const</span> diff = target - nums[i];{'\n'}
              {'    '}<span className="text-indigo-400">if</span> (map.has(diff)) <span className="text-indigo-400">return</span> [map.get(diff), i];{'\n'}
              {'    '}map.set(nums[i], i);{'\n'}
              {'  }'}{'\n'}
              {'  '}<span className="text-indigo-400">return</span> [];{'\n'}
              {'}'}
            </pre>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-900">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-100 tracking-tight">
            Engineered for real collaborative workflows
          </h2>
          <p className="text-slate-400 mt-2 text-sm">
            Everything you need for technical interviews, pair programming, and peer learning.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 transition-all hover:bg-slate-900/70"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-950/70 border border-indigo-700/40 flex items-center justify-center mb-4">
                <feat.icon size={20} className="text-indigo-400" />
              </div>
              <h3 className="font-semibold text-slate-100 text-base mb-2">{feat.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/60 py-6 px-6 bg-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-indigo-400" />
            <span className="font-medium text-slate-400">Collab Code</span>
            <span>— Real-Time Collaborative Platform</span>
          </div>
          <div>Built with React, Monaco, TypeScript, Socket.IO & Express</div>
        </div>
      </footer>
    </div>
  );
}
