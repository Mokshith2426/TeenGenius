import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, Target, Clock, Plus, Trash2, Check, Sparkles, 
  ChevronRight, CalendarDays, CheckSquare, PencilLine
} from 'lucide-react';
import AcademicCalendar from '../components/AcademicCalendar';

interface LocalTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  category: 'Critical' | 'Regular' | 'Minor';
}

export default function PlannerHub() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<'Critical' | 'Regular' | 'Minor'>('Regular');

  // Load local tasks
  useEffect(() => {
    const saved = localStorage.getItem('tg_planner_hub_tasks');
    if (saved) {
      try {
        setTasks(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    } else {
      // Seed some initial default tasks
      const initial: LocalTask[] = [
        { id: '1', title: 'Complete calculus homework chapter 4', completed: false, category: 'Critical' },
        { id: '2', title: 'Compile chapter 2 physics review notes', completed: true, category: 'Regular' },
        { id: '3', title: 'Revise SAT geometry flashcards', completed: false, category: 'Minor' }
      ];
      setTasks(initial);
      localStorage.setItem('tg_planner_hub_tasks', JSON.stringify(initial));
    }
  }, []);

  // Save tasks helper
  const saveTasks = (newTasks: LocalTask[]) => {
    setTasks(newTasks);
    localStorage.setItem('tg_planner_hub_tasks', JSON.stringify(newTasks));
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const task: LocalTask = {
      id: Date.now().toString(),
      title: newTaskTitle.trim(),
      completed: false,
      category: newTaskCategory
    };
    const updated = [task, ...tasks];
    saveTasks(updated);
    setNewTaskTitle('');
  };

  const toggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    saveTasks(updated);
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    saveTasks(updated);
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8 pb-32 animate-fade-in">
      {/* Top Welcome Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border-b border-zinc-200/50 dark:border-zinc-850 pb-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/20 rounded-full border border-amber-200/50 dark:border-amber-900/60">
            <CalendarIcon size={12} className="text-amber-600 dark:text-amber-400 animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">Personal Productivity Suite</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
            Productivity <span className="bg-gradient-to-r from-amber-500 to-indigo-500 bg-clip-text text-transparent">Planner</span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-450 font-medium">
            Manage assignment checklists, schedule routines, and lock into deep study habits.
          </p>
        </div>

        {/* Quick Hub Hoppers */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/app/focus')}
            className="group flex items-center gap-2 px-4 py-3 bg-zinc-900 text-white dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-750 transition-all rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 shadow-sm"
          >
            <Target size={14} className="text-rose-500 animate-pulse" />
            <span>Focus Room</span>
            <ChevronRight size={13} className="text-zinc-500 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => navigate('/app/timetable')}
            className="group flex items-center gap-2 px-4 py-3 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white transition-all rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 shadow-sm"
          >
            <Clock size={14} className="text-blue-500" />
            <span>Timetable Maker</span>
            <ChevronRight size={13} className="text-zinc-400 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Main Double Deck Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Hand: Academic Calendar Pane (gorgeous month layout) */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-7 rounded-[2.5rem] shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 px-1 border-b border-zinc-100 dark:border-zinc-850 pb-3">
            <CalendarDays size={18} className="text-amber-500" />
            <h2 className="text-md font-black uppercase tracking-tight text-zinc-900 dark:text-white">Monthly Agenda</h2>
          </div>
          <AcademicCalendar />
        </div>

        {/* Right Hand: Interactive Task Workspace Grid */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 sm:p-7 rounded-[2.5rem] shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-850 pb-4">
            <div className="flex items-center gap-2.5">
              <CheckSquare size={18} className="text-indigo-500" />
              <h2 className="text-md font-black uppercase tracking-tight text-zinc-900 dark:text-white">Goals & Tasks</h2>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest bg-zinc-50 dark:bg-zinc-805 px-3 py-1.5 rounded-xl border border-zinc-200/40 dark:border-zinc-750">
              {progressPercent}% Done
            </span>
          </div>

          {/* Quick Stats bar */}
          <div className="space-y-2">
            <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
              <motion.div 
                className="h-full bg-gradient-to-r from-amber-500 via-indigo-550 to-indigo-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-extrabold uppercase tracking-widest">
              <span>{completedCount} Completed</span>
              <span>{tasks.length - completedCount} Left</span>
            </div>
          </div>

          {/* New Task Entry */}
          <form onSubmit={addTask} className="space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Compose a new student target..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                className="w-full pl-4 pr-12 py-3.5 bg-zinc-50 dark:bg-zinc-805 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 w-8 h-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl flex items-center justify-center hover:scale-[1.03] active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Category selection */}
            <div className="flex items-center gap-2">
              <span className="text-[8.5px] font-black uppercase tracking-wider text-zinc-450 dark:text-zinc-500">Tier:</span>
              <div className="flex items-center gap-1.5">
                {(['Critical', 'Regular', 'Minor'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setNewTaskCategory(cat)}
                    className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-md border transition-all cursor-pointer ${
                      newTaskCategory === cat
                        ? cat === 'Critical' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                          cat === 'Regular' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                          'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Target List items */}
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto scrollbar-hide pr-1">
            <AnimatePresence initial={false}>
              {tasks.length === 0 ? (
                <div className="py-12 text-center space-y-1 bg-zinc-50/50 dark:bg-zinc-905/30 border border-dashed border-zinc-200/60 dark:border-zinc-800 rounded-2xl">
                  <span className="text-xl">🎉</span>
                  <h4 className="text-xxs font-black uppercase tracking-wider text-zinc-450">Everything Resolved</h4>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold leading-none">Create a target to lock in your study track.</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      task.completed
                        ? 'bg-zinc-50/50 dark:bg-zinc-950/20 border-zinc-150 dark:border-zinc-850 text-zinc-400 dark:text-zinc-550'
                        : 'bg-white dark:bg-zinc-850/40 border-zinc-150 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Interactive check bubble */}
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                          task.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 hover:bg-zinc-100 dark:bg-zinc-800'
                        }`}
                      >
                        {task.completed && <Check size={11} strokeWidth={3} />}
                      </button>

                      {/* Title text */}
                      <span className={`text-[11px] font-semibold truncate leading-none ${task.completed ? 'line-through' : ''}`}>
                        {task.title}
                      </span>
                    </div>

                    {/* Tier Indicator Pill & Delete Actions */}
                    <div className="flex items-center gap-2.5 shrink-0 ml-3">
                      <span className={`text-[7.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                        task.category === 'Critical' ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' :
                        task.category === 'Regular' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400' :
                        'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {task.category}
                      </span>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 rounded transition-colors cursor-pointer"
                        title="Delete Goal"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
