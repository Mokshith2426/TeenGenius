import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Plus, Trash2, Check, Clock, Sparkles, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface AcademicNode {
  id: string;
  title: string;
  type: 'task' | 'plan' | 'completed'; // Blue, Orange/Yellow, Green
  date: string; // YYYY-MM-DD
}

const getLocalYYYYMMDD = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getRelativeDateString = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return getLocalYYYYMMDD(d);
};

const formatReadableDate = (dateString: string): string => {
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(y, m, d);
      return dateObj.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  } catch (e) {}
  return dateString;
};

export default function AcademicCalendar() {
  const { user } = useAuth();
  
  // Use dynamic current date for starting state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(getLocalYYYYMMDD(new Date()));
  
  // Storage key is user-specific for clean separation
  const storageKey = `tg_academic_nodes_${user?.uid || 'guest'}`;
  const [nodes, setNodes] = useState<AcademicNode[]>([]);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeType, setNewNodeType] = useState<'task' | 'plan' | 'completed'>('task');
  const [showAddForm, setShowAddForm] = useState(false);

  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeTitle, setEditingNodeTitle] = useState('');
  
  const [dailyMinutesGoal, setDailyMinutesGoal] = useState(() => {
    const saved = localStorage.getItem(`tg_daily_goal_mins_${user?.uid || 'guest'}`);
    return saved ? parseInt(saved, 10) : 120;
  });

  const changeDailyGoal = (val: number) => {
    const nextVal = Math.max(10, Math.min(480, val));
    setDailyMinutesGoal(nextVal);
    localStorage.setItem(`tg_daily_goal_mins_${user?.uid || 'guest'}`, String(nextVal));
  };

  const toggleNodeComplete = (id: string) => {
    const updated = nodes.map(n => {
      if (n.id === id) {
        return {
          ...n,
          type: (n.type === 'completed' ? 'task' : 'completed') as 'task' | 'plan' | 'completed'
        };
      }
      return n;
    });
    saveNodes(updated);
  };

  const startEditingNode = (id: string, currentTitle: string) => {
    setEditingNodeId(id);
    setEditingNodeTitle(currentTitle);
  };

  const saveEditingNode = (id: string) => {
    if (!editingNodeTitle.trim()) return;
    const updated = nodes.map(n => {
      if (n.id === id) {
        return { ...n, title: editingNodeTitle.trim() };
      }
      return n;
    });
    saveNodes(updated);
    setEditingNodeId(null);
  };

  // Load and seed initial nodes to look like the exact image representation
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setNodes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse calendar nodes", e);
      }
    } else {
      const seeded: AcademicNode[] = [];
      setNodes(seeded);
      localStorage.setItem(storageKey, JSON.stringify(seeded));
    }
  }, [storageKey]);

  // Handle save
  const saveNodes = (updated: AcademicNode[]) => {
    setNodes(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const addAcademicNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeTitle.trim()) return;

    const newNode: AcademicNode = {
      id: `node-${Date.now()}`,
      title: newNodeTitle.trim(),
      type: newNodeType,
      date: selectedDay,
    };

    const newNodesList = [...nodes, newNode];
    saveNodes(newNodesList);
    setNewNodeTitle('');
    setShowAddForm(false);
  };

  const deleteNode = (id: string) => {
    const filtered = nodes.filter(n => n.id !== id);
    saveNodes(filtered);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const resetToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(getLocalYYYYMMDD(new Date()));
  };

  // Grid calculation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayIndex = new Date(year, month, 1).getDay(); // Index of first day of month (0: Sun)
  const totalDays = new Date(year, month + 1, 0).getDate(); // Total days in current month
  const prevMonthTotalDays = new Date(year, month, 0).getDate(); // Total days in previous month

  const daysGrid: { dayNumber: number; dateString: string; isCurrentMonth: boolean }[] = [];

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthTotalDays - i;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    const dateStr = `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    daysGrid.push({ dayNumber: d, dateString: dateStr, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    daysGrid.push({ dayNumber: d, dateString: dateStr, isCurrentMonth: true });
  }

  // Next month padding days to fill 6-row grid (42 cells)
  const remainingCells = 42 - daysGrid.length;
  for (let d = 1; d <= remainingCells; d++) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    const dateStr = `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    daysGrid.push({ dayNumber: d, dateString: dateStr, isCurrentMonth: false });
  }

  // Active day filter for event list
  const activeDayNodes = nodes.filter(node => node.date === selectedDay);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Container header mimicking standard outer indicators */}
      <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-[0.2em] text-[10px] sm:text-xs">
        <span className="flex items-center gap-2">
          <CalendarIcon size={14} className="text-zinc-400" />
          Academic Calendar & Schedule
        </span>
        <span className="bg-zinc-100 dark:bg-zinc-805/30 px-3 py-1 rounded-full text-[9px] font-black border border-zinc-200/40 dark:border-zinc-800/20 shadow-sm">
          {nodes.length} Active Items
        </span>
      </div>

      {/* Main Calendar Card styled elegantly with a premium slate overlay/background option */}
      <div className="bg-zinc-900 border border-zinc-950 dark:border-zinc-800 rounded-[2rem] p-4 sm:p-8 shadow-2xl relative overflow-hidden text-white transition-colors duration-300">
        
        {/* Top Header inside Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 dark:bg-blue-600/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white dark:text-blue-400 transition-colors">
              <CalendarIcon size={22} strokeWidth={2.5} />
            </div>
            <div>
              <motion.h3 
                key={month + '-' + year}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-black tracking-tight"
              >
                {monthNames[month]} {year}
              </motion.h3>
              <p className="text-[10px] font-black text-white/70 dark:text-blue-400 uppercase tracking-widest leading-none">
                Academic Schedule
              </p>
            </div>
          </div>

          {/* Nav Controls */}
          <div className="flex items-center gap-1.5 self-end sm:self-center">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-white/10 dark:hover:bg-zinc-800 rounded-xl transition-all active:scale-90 border border-white/10 dark:border-zinc-800"
              title="Previous Month"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={resetToToday}
              className="px-5 py-2 bg-white/15 hover:bg-white/25 dark:bg-zinc-805/40 dark:hover:bg-zinc-800 border border-white/20 dark:border-zinc-800 font-extrabold text-[10px] uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all"
            >
              Today
            </button>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-white/10 dark:hover:bg-zinc-800 rounded-xl transition-all active:scale-90 border border-white/10 dark:border-zinc-800"
              title="Next Month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Days of week headings */}
        <div className="grid grid-cols-7 gap-y-2 text-center text-[10px] font-black uppercase tracking-widest text-white/50 dark:text-zinc-500 mb-4 border-b border-white/10 dark:border-zinc-800/40 pb-3">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days grid inside Card */}
        <div className="grid grid-cols-7 border-t border-l border-white/10 dark:border-zinc-800/40 rounded-lg overflow-hidden">
          {daysGrid.map((cell, index) => {
            const cellNodes = nodes.filter(n => n.date === cell.dateString);
            const isSelected = selectedDay === cell.dateString;
            const isToday = cell.dateString === getLocalYYYYMMDD(new Date()); // Dynamic current date check
            
            // Collect dots
            const hasTask = cellNodes.some(n => n.type === 'task');
            const hasPlan = cellNodes.some(n => n.type === 'plan');
            const hasCompleted = cellNodes.some(n => n.type === 'completed');

            return (
              <button
                key={`${cell.dateString}-${index}`}
                onClick={() => setSelectedDay(cell.dateString)}
                className={cn(
                  "min-h-[45px] sm:min-h-[90px] p-1 sm:p-2.5 flex flex-col justify-between items-start text-left border-r border-b border-white/10 dark:border-zinc-800/40 relative group transition-all duration-200 outline-none",
                  cell.isCurrentMonth ? "text-white" : "text-white/30 dark:text-zinc-600",
                  isSelected 
                    ? "bg-white/10 dark:bg-zinc-800/50 scale-[0.99] ring-1 ring-inset ring-white/30 dark:ring-blue-500/30" 
                    : "hover:bg-white/5 dark:hover:bg-zinc-800/20"
                )}
              >
                {/* Visual day number */}
                <span className={cn(
                  "text-[10px] sm:text-xs font-black px-1 sm:px-1.5 py-0.5 rounded-md",
                  isToday && !isSelected && "text-blue-600 bg-white font-black dark:text-blue-400 dark:bg-zinc-800",
                  isToday && isSelected && "text-white font-black"
                )}>
                  {cell.dayNumber}
                </span>

                {/* Legend indicator dots at bottom-right or in row */}
                <div className="flex gap-0.5 sm:gap-1 flex-wrap mt-1 select-none">
                  {hasTask && (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-600 block shadow-sm shadow-blue-500/20" />
                  )}
                  {hasPlan && (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-500 block shadow-sm shadow-amber-500/20" />
                  )}
                  {hasCompleted && (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 block shadow-sm shadow-emerald-500/20" />
                  )}
                </div>

                {/* Subtle visual glow on modern focus */}
                {isSelected && (
                  <motion.div 
                    layoutId="calendarSelectionGlow"
                    className="absolute inset-0 border-2 border-white/20 dark:border-blue-500/30 rounded-lg pointer-events-none" 
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend Panel mimicking bottom area */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-8 pt-6 border-t border-white/10 dark:border-zinc-800/40 text-[10px] font-black uppercase tracking-[0.15em] text-white/70 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block ring-2 ring-white/10 dark:ring-transparent" />
            <span>Tasks</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block ring-2 ring-white/10 dark:ring-transparent" />
            <span>Saved Plans</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block ring-2 ring-white/10 dark:ring-transparent" />
            <span>Completed</span>
          </div>
        </div>

      </div>

      {/* Slide-Down interactive action panel for selecting date and adding nodes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Nodes and schedule checklist */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-150/80 dark:border-zinc-800/50 p-6 sm:p-8 rounded-[2.5rem] shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400 mb-1">
                Agenda Event Details
              </h4>
              <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                {selectedDay === getLocalYYYYMMDD(new Date()) 
                  ? `Today: ${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}` 
                  : formatReadableDate(selectedDay)}
              </h3>
            </div>
            
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95"
            >
              {showAddForm ? <X size={12} /> : <Plus size={12} />}
              {showAddForm ? 'Cancel' : 'Add Event'}
            </button>
          </div>

          {/* Inline slide form for adding nodes */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={addAcademicNode}
                className="p-5 bg-zinc-50 dark:bg-zinc-805/30 rounded-3xl border border-zinc-100 dark:border-zinc-800/50 space-y-4 overflow-hidden"
              >
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Event / Task Title</label>
                  <input 
                    type="text"
                    required
                    maxLength={70}
                    placeholder="e.g. Chemistry Lab Report submission..."
                    value={newNodeTitle}
                    onChange={(e) => setNewNodeTitle(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Calendar Event Type</span>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewNodeType('task')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all text-center",
                        newNodeType === 'task' 
                          ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/10 dark:border-blue-800 dark:text-blue-400" 
                          : "bg-white border-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
                      )}
                    >
                      Task
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewNodeType('plan')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all text-center",
                        newNodeType === 'plan' 
                          ? "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/10 dark:border-amber-800 dark:text-amber-400" 
                          : "bg-white border-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
                      )}
                    >
                      Saved Plan
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewNodeType('completed')}
                      className={cn(
                        "py-3 rounded-xl text-xs font-black uppercase tracking-wider border transition-all text-center",
                        newNodeType === 'completed' 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/10 dark:border-emerald-800 dark:text-emerald-400" 
                          : "bg-white border-zinc-200 text-zinc-400 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500"
                      )}
                    >
                      Completed
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-805 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                  Save to Calendar
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Current Day Agenda Check list */}
          <div className="space-y-3">
            {activeDayNodes.length === 0 ? (
              <div className="py-8 text-center bg-zinc-50 dark:bg-zinc-805/10 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800/60">
                <p className="text-zinc-400 dark:text-zinc-500 font-bold text-xs uppercase tracking-wider">
                  No events or tasks planned for this date.
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-2 text-xs font-black text-blue-600 hover:underline tracking-wider uppercase"
                >
                  + Add First Entry
                </button>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {activeDayNodes.map((node) => {
                  const isEditing = editingNodeId === node.id;
                  return (
                    <motion.div
                      key={node.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/50 rounded-2xl group hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center gap-4.5 flex-1 min-w-0">
                        {/* Interactive dynamic checkbox for completing tasks */}
                        <button
                          type="button"
                          onClick={() => toggleNodeComplete(node.id)}
                          className={cn(
                            "w-5 h-5 rounded-md flex items-center justify-center border transition-all active:scale-90 cursor-pointer flex-shrink-0",
                            node.type === 'completed'
                              ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                              : node.type === 'task'
                                ? "bg-white border-blue-400 hover:bg-blue-50/50 hover:border-blue-500 dark:bg-zinc-950 dark:border-zinc-700"
                                : "bg-white border-amber-405 hover:bg-amber-50/50 hover:border-amber-500 dark:bg-zinc-950 dark:border-zinc-700"
                          )}
                          title="Toggle Task Status"
                        >
                          {node.type === 'completed' ? (
                            <Check size={12} strokeWidth={3} />
                          ) : (
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full opacity-50",
                              node.type === 'task' ? "bg-blue-600" : "bg-amber-500"
                            )} />
                          )}
                        </button>
                        
                        <div className="space-y-0.5 flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <input
                                type="text"
                                value={editingNodeTitle}
                                onChange={(e) => setEditingNodeTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditingNode(node.id);
                                  if (e.key === 'Escape') setEditingNodeId(null);
                                }}
                                className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm font-semibold text-zinc-850 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={() => saveEditingNode(node.id)}
                                className="p-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                                title="Save changes"
                              >
                                <Check size={13} strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => setEditingNodeId(null)}
                                className="p-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 hover:bg-zinc-300 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                                title="Cancel"
                              >
                                <X size={13} strokeWidth={2.5} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className={cn(
                                "font-semibold text-sm truncate",
                                node.type === 'completed' 
                                  ? "text-zinc-400 dark:text-zinc-500 line-through font-medium" 
                                  : "text-zinc-805 dark:text-zinc-200 font-bold"
                              )}>
                                {node.title}
                              </p>
                              <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">
                                {node.type === 'task' ? 'Assignment / Task' :
                                 node.type === 'plan' ? 'Saved Milestone' : 'Task Completed'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {!isEditing && (
                          <button
                            onClick={() => startEditingNode(node.id, node.title)}
                            className="p-1.5 text-zinc-400 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                            title="Edit Task Title"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNode(node.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-650 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                          title="Remove Event"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Info card mimicking the side panel */}
        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-150/60 dark:border-zinc-800/40 p-10 rounded-[2.5rem] space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm flex-shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500 mb-0.5">
                Daily Targets
              </h4>
              <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                Study Goals
              </h3>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-950 p-4.5 rounded-2xl border border-zinc-150/80 dark:border-zinc-805 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Today's Target Goal:</span>
              <span className="text-sm font-black text-zinc-850 dark:text-white">{(dailyMinutesGoal / 60).toFixed(1)} Hours</span>
            </div>
            
            {/* Goal decrement / increment controls */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => changeDailyGoal(dailyMinutesGoal - 15)}
                className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 flex items-center justify-center font-black text-zinc-700 dark:text-white cursor-pointer active:scale-95 transition-all outline-none"
                title="Decrease by 15 mins"
              >
                -
              </button>
              
              <div className="text-center">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{dailyMinutesGoal} mins</span>
              </div>

              <button
                type="button"
                onClick={() => changeDailyGoal(dailyMinutesGoal + 15)}
                className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 flex items-center justify-center font-black text-zinc-700 dark:text-white cursor-pointer active:scale-95 transition-all outline-none"
                title="Increase by 15 mins"
              >
                +
              </button>
            </div>
          </div>

          <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed font-semibold">
            Track and check off your school homework, assignments, and milestones. Focus sprints inside the Focus Room contribute directly toward your chosen daily goal!
          </p>
          
          <div className="pt-4 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-4 text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <span className="text-[9px]">Total Current Tasks</span>
              <span className="text-zinc-900 dark:text-white font-black">{nodes.filter(n => n.type === 'task').length}</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <span className="text-[9px]">Saved Milestones</span>
              <span className="text-zinc-900 dark:text-white font-black">{nodes.filter(n => n.type === 'plan').length}</span>
            </div>
            <div className="flex justify-between items-center bg-white dark:bg-zinc-800 p-3.5 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <span className="text-[9px]">Tasks Completed</span>
              <span className="text-emerald-500 font-black">{nodes.filter(n => n.type === 'completed').length}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
