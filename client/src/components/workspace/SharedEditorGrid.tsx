import { useMemo } from 'react';
import { EyeOff, LayoutGrid, Maximize2 } from 'lucide-react';
import { useRoomStore } from '../../stores/room.store';
import { SharedEditorPanel } from './SharedEditorPanel';
import { Button } from '../ui/Button';

interface SharedEditorGridProps {
  currentSocketId?: string | null;
  onPeerEdit?: (ownerSocketId: string, newCode: string) => void;
}

export function SharedEditorGrid({ currentSocketId, onPeerEdit }: SharedEditorGridProps) {
  const { sharedSnapshots, editorPermissions, setViewMode } = useRoomStore();

  const snapshots = useMemo(() => {
    return Array.from(sharedSnapshots.values());
  }, [sharedSnapshots]);

  if (snapshots.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
        <div className="w-14 h-14 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center mb-4">
          <EyeOff size={26} className="text-indigo-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1.5">No Shared Editors Yet</h3>
        <p className="text-xs text-slate-400 max-w-md mb-5 leading-relaxed">
          Participants solve problems in their own workspaces. When a teammate clicks &ldquo;Share Editor&rdquo; in their toolbar, their live code will appear here!
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setViewMode('my-editor')}
          className="gap-1.5 text-xs cursor-pointer"
        >
          Return to My Editor
        </Button>
      </div>
    );
  }

  const gridClass = useMemo(() => {
    switch (snapshots.length) {
      case 1:
        return 'grid-cols-1 grid-rows-1';
      case 2:
        return 'grid-cols-1 md:grid-cols-2 grid-rows-1';
      case 3:
        return 'grid-cols-1 md:grid-cols-3';
      case 4:
        return 'grid-cols-1 md:grid-cols-2 grid-rows-2';
      default:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    }
  }, [snapshots.length]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 p-2 gap-2">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border border-slate-800/80 rounded-lg shrink-0 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <LayoutGrid size={14} className="text-indigo-400" />
          <span className="font-semibold">Shared Solutions Grid</span>
          <span className="text-[11px] text-slate-500">
            ({snapshots.length} active shared {snapshots.length === 1 ? 'editor' : 'editors'})
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Click <Maximize2 size={11} className="inline mx-0.5 text-indigo-400" /> on any editor to view it full screen.
        </div>
      </div>

      {/* Grid of Shared Editors */}
      <div className={`flex-1 grid ${gridClass} gap-2 min-h-0 overflow-auto`}>
        {snapshots.map((snapshot) => {
          const allowedWriters = editorPermissions[snapshot.socketId] || [];
          const canWrite = Boolean(currentSocketId && allowedWriters.includes(currentSocketId));

          return (
            <div key={snapshot.socketId} className="min-h-[260px] h-full">
              <SharedEditorPanel
                snapshot={snapshot}
                canWrite={canWrite}
                onCodeChange={(newCode) => onPeerEdit?.(snapshot.socketId, newCode)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
