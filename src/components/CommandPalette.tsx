import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, CornerDownLeft, ArrowUpDown, X, Sparkles, Command,
  Home, MessageSquare, GraduationCap, FileText, Calendar, Brain, 
  Map, Target, Users, UserPlus, User, HeartHandshake, Settings, LogOut, Sun, Moon
} from 'lucide-react';
import { cn } from '../lib/utils';

// Shared type for command options
interface CommandItem {
  id: string;
  label: string;
  description: string;
  category: 'Ecosystem Modules' | 'System Utilities';
  icon: React.ComponentType<any>;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  toggleDarkMode: () => void;
  isDarkMode: boolean;
  openSettings: () => void;
  logout: () => void;
  navItems: Array<{
    icon: React.ComponentType<any>;
    label: string;
    path: string;
  }>;
}

export default function CommandPalette({
  isOpen,
  onClose,
  toggleDarkMode,
  isDarkMode,
  openSettings,
  logout,
  navItems
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Define static commands & dynamically mapped nav items
  const items: CommandItem[] = [
    // 1. Ecosystem Navigations
    ...navItems.map(item => ({
      id: `nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`,
      label: item.label,
      description: `Navigate to TeenGenius ${item.label}`,
      category: 'Ecosystem Modules' as const,
      icon: item.icon,
      action: () => {
        navigate(item.path);
        onClose();
      }
    })),
    // 2. Control Utilities
    {
      id: 'util-dark-mode',
      label: 'Toggle Visual Theme',
      description: isDarkMode ? 'Switch to responsive Light Mode workspace' : 'Switch to eye-safe Dark Mode workspace',
      category: 'System Utilities' as const,
      icon: isDarkMode ? Sun : Moon,
      shortcut: 'T',
      action: () => {
        toggleDarkMode();
        onClose();
      }
    },
    {
      id: 'util-settings',
      label: 'Open Account Registry',
      description: 'Manage API configurations, storage instances, and profiles',
      category: 'System Utilities' as const,
      icon: Settings,
      shortcut: 'S',
      action: () => {
        openSettings();
        onClose();
      }
    },
    {
      id: 'util-logout',
      label: 'Terminate Secure Session',
      description: 'Log out of current TeenGenius authorization lease',
      category: 'System Utilities' as const,
      icon: LogOut,
      shortcut: 'Q',
      action: () => {
        logout();
        onClose();
      }
    }
  ];

  // Filter commands by search query
  const filteredItems = items.filter(item => {
    const searchLower = search.toLowerCase().trim();
    if (!searchLower) return true;
    return (
      item.label.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower) ||
      item.category.toLowerCase().includes(searchLower)
    );
  });

  // Keep index scoped to filtered list bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Handle global key triggers for Cmd+K / Ctrl+K & other modal keyboard listeners
  useEffect(() => {
    if (!isOpen) return;

    // Focus input instantly on open
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.altKey || e.ctrlKey || e.metaKey) {
        // Prevent intercepting hotkeys
        return;
      } else if (search === '' && e.key.length === 1) {
        // Direct alphanumeric shortcuts when search is empty (S: settings, T: style, Q: logout)
        const pressedChar = e.key.toUpperCase();
        if (pressedChar === 'T') {
          e.preventDefault();
          toggleDarkMode();
          onClose();
        } else if (pressedChar === 'S') {
          e.preventDefault();
          openSettings();
          onClose();
        } else if (pressedChar === 'Q') {
          e.preventDefault();
          logout();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, search, onClose, toggleDarkMode, openSettings, logout]);

  // Ensure selected list item stays inside visible scroll area automatically
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const selectedElement = scrollContainer.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (!selectedElement) return;

    const containerHeight = scrollContainer.clientHeight;
    const elementTop = selectedElement.offsetTop;
    const elementHeight = selectedElement.offsetHeight;

    if (elementTop + elementHeight > scrollContainer.scrollTop + containerHeight) {
      scrollContainer.scrollTop = elementTop + elementHeight - containerHeight;
    } else if (elementTop < scrollContainer.scrollTop) {
      scrollContainer.scrollTop = elementTop;
    }
  }, [selectedIndex]);

  // Group filtered items into structured headings
  const categories = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Compute indices for flat-list matching across visual groups
  let absoluteItemCount = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="teengenius-command-palette-portal" className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh] md:pt-[15vh]">
          {/* Ambient Blurred Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/45 backdrop-blur-sm cursor-pointer"
            onClick={onClose}
          />

          {/* Core Interactive Command Dialog Box */}
          <motion.div
            id="teengenius-command-modal-content"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[50vh] md:max-h-[60vh]"
          >
            {/* Elegant Search Bar Header */}
            <div className="flex items-center gap-3.5 px-4 h-14 border-b border-zinc-150 dark:border-zinc-800 shrink-0 relative bg-zinc-50/55 dark:bg-zinc-900/55">
              <Search className="text-zinc-400 dark:text-zinc-500 shrink-0" size={18} strokeWidth={2.4} />
              <input
                id="command-palette-global-search-input"
                ref={inputRef}
                type="text"
                placeholder="Where should we navigate today, Genius?"
                className="flex-1 bg-transparent border-0 outline-none select-text text-sm font-black text-zinc-950 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 leading-none h-full w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/80 rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-zinc-450 dark:text-zinc-550 select-none">ESC</span>
                <button 
                  onClick={onClose}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                  title="Close command workspace"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Structured Search Results List */}
            <div 
              id="command-palette-scroller"
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-2 py-3.5 space-y-4 scrollbar-hide max-h-[35vh] md:max-h-[45vh]"
            >
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-full text-zinc-400 mb-3 animate-pulse">
                    <Sparkles size={18} />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">No execution targets found</h3>
                  <p className="text-xs text-zinc-400 max-w-sm">No modules or system macros match your current query. Try typing 'ai', 'focus', or 'profile'.</p>
                </div>
              ) : (
                Object.entries(categories).map(([category, catItems]) => (
                  <div key={category} className="space-y-1">
                    {/* Visual Segment Headers */}
                    <div className="px-3.5 mb-1.5">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-450 dark:text-zinc-500 italic">
                        {category}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      {catItems.map((item) => {
                        const currentRefIndex = absoluteItemCount;
                        absoluteItemCount++;
                        const isItemSelected = currentRefIndex === selectedIndex;

                        return (
                          <div
                            key={item.id}
                            data-index={currentRefIndex}
                            onClick={item.action}
                            onMouseEnter={() => setSelectedIndex(currentRefIndex)}
                            className={cn(
                              "flex items-center justify-between px-3.5 py-3 rounded-xl transition-all cursor-pointer relative group",
                              isItemSelected 
                                ? "bg-blue-600 dark:bg-blue-500 shadow-md shadow-blue-500/10 scale-[1.01]" 
                                : "hover:bg-zinc-150/45 dark:hover:bg-zinc-800/40"
                            )}
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              {/* Left icon node */}
                              <div className={cn(
                                "p-2 rounded-lg shrink-0 transition-all",
                                isItemSelected 
                                  ? "bg-white/10 text-white" 
                                  : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white"
                              )}>
                                <item.icon size={15} strokeWidth={2.4} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  "text-xs font-black truncate leading-tight",
                                  isItemSelected ? "text-white" : "text-zinc-900 dark:text-zinc-50"
                                )}>
                                  {item.label}
                                </p>
                                <p className={cn(
                                  "text-[10px] truncate leading-tight mt-0.5",
                                  isItemSelected ? "text-blue-100" : "text-zinc-450 dark:text-zinc-450"
                                )}>
                                  {item.description}
                                </p>
                              </div>
                            </div>

                            {/* Right action visual hooks */}
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {item.shortcut && (
                                <kbd className={cn(
                                  "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border",
                                  isItemSelected 
                                    ? "bg-white/10 border-white/20 text-white" 
                                    : "bg-white dark:bg-zinc-800 border-zinc-200/65 dark:border-zinc-700/60 text-zinc-450 dark:text-zinc-400"
                                )}>
                                  {item.shortcut}
                                </kbd>
                              )}
                              
                              {isItemSelected && (
                                <motion.span 
                                  layoutId="enterChevron"
                                  className="text-white shrink-0 bg-white/15 p-1 rounded"
                                >
                                  <CornerDownLeft size={10} strokeWidth={2.5} />
                                </motion.span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Unified Instructional Footer of Command Workspace */}
            <div className="h-10 border-t border-zinc-150 dark:border-zinc-800 px-4 flex items-center justify-between shrink-0 bg-zinc-50/70 dark:bg-zinc-900/70 text-[9px] font-bold text-zinc-400 select-none">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <ArrowUpDown size={11} className="text-zinc-400" />
                  <span>Navigate items</span>
                </span>
                <span className="hidden sm:flex items-center gap-1.5">
                  <CornerDownLeft size={11} className="text-zinc-400" />
                  <span>Execute target</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Command size={10} />
                <span>+ K to toggle anywhere</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
