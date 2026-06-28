import { useAuth } from '../context/AuthContext';
import CollaborativeWhiteboard from '../components/CollaborativeWhiteboard';
import { Palette, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WhiteboardScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.uid || 'guest';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-55 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none">
      {/* Header Bar */}
      <header className="h-16 shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-250/60 dark:border-zinc-800 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/community')}
            className="p-2 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-650 dark:text-zinc-400 rounded-xl transition-all cursor-pointer active:scale-95"
            title="Back to Community"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Palette size={15} className="text-blue-500 animate-pulse" />
              <h1 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
                Student Drawing Sandbox
              </h1>
            </div>
            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold mt-0.5 leading-none">
              Brainstorm formulas, draw graphs, or sketch science outlines. Saved online automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[8.5px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-950/40 text-blue-650 dark:text-blue-300 px-2.5 py-1 rounded border border-blue-150/40 dark:border-blue-800">
            Channel: Personal Board
          </span>
        </div>
      </header>

      {/* Main Sandbox Canvas Wrapper (Uses all remaining space) */}
      <main className="flex-1 min-h-0 bg-zinc-50 dark:bg-zinc-950 relative">
        <CollaborativeWhiteboard groupId="personal" userId={userId} />
      </main>
    </div>
  );
}
