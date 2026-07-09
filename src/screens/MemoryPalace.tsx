import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Sparkles, BookOpen, Lightbulb, Copy, Check, Zap, Upload, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { safeFetch } from '../lib/api';

interface SavedNote {
  id: string;
  title: string;
  content: string;
  focus: string;
  notes: string;
  subject: string;
  importance: 'High' | 'Medium' | 'Low';
  createdAt: string;
}

export default function MemoryPalace() {
  const [activeTab, setActiveTab] = useState<'mnemonics' | 'flashcards'>('mnemonics');
  const [topic, setTopic] = useState('');
  
  // Flashcards generation mode: 'topic' or 'import'
  const [flashcardMode, setFlashcardMode] = useState<'topic' | 'import'>('import');
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [notesContent, setNotesContent] = useState<string>('');
  const [importedFileName, setImportedFileName] = useState<string>('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mnemonics, setMnemonics] = useState<string[]>([]);
  const [flashcards, setFlashcards] = useState<{ q: string; a: string }[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Load saved study notes, flashcards, and mnemonics from localStorage cache on mount
  useEffect(() => {
    const historical = localStorage.getItem('STUDENT_SAVED_NOTES_TAGGED');
    if (historical) {
      try {
        setSavedNotes(JSON.parse(historical));
      } catch (e) {
        console.error("Error loading saved notes collection:", e);
      }
    }

    const cachedFlashcards = localStorage.getItem('STUDENT_LOCAL_FLASHCARDS_CACHE');
    const cachedMnemonics = localStorage.getItem('STUDENT_LOCAL_MNEMONICS_CACHE');
    if (cachedFlashcards) {
      try {
        setFlashcards(JSON.parse(cachedFlashcards));
      } catch (e) {
        console.error("Error loading cached flashcards:", e);
      }
    }
    if (cachedMnemonics) {
      try {
         setMnemonics(JSON.parse(cachedMnemonics));
      } catch (e) {
         console.error("Error loading cached mnemonics:", e);
      }
    }
  }, []);

  // Save generated cardsets or mnemonics to local storage whenever they change
  useEffect(() => {
    if (flashcards.length > 0) {
      localStorage.setItem('STUDENT_LOCAL_FLASHCARDS_CACHE', JSON.stringify(flashcards));
    }
  }, [flashcards]);

  useEffect(() => {
    if (mnemonics.length > 0) {
      localStorage.setItem('STUDENT_LOCAL_MNEMONICS_CACHE', JSON.stringify(mnemonics));
    }
  }, [mnemonics]);

  const handleSelectSavedNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    if (!noteId) {
      setNotesContent('');
      setImportedFileName('');
      return;
    }
    const selected = savedNotes.find(n => n.id === noteId);
    if (selected) {
      // Notes generator saves note body in `notes` or `content`
      const bodyText = selected.notes || selected.content;
      setNotesContent(bodyText);
      setImportedFileName(`Imported: ${selected.title}`);
      setError(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readNoteFile(file);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    const parsed: { q: string; a: string }[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      
      let parts: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.trim().replace(/^["']|["']$/g, ''));

      // Clean empty columns
      const cleanParts = parts.filter(p => p !== undefined);
      if (cleanParts.length >= 2) {
        parsed.push({ q: cleanParts[0], a: cleanParts[1] });
      } else if (cleanParts.length === 1 && cleanParts[0]) {
        parsed.push({ q: cleanParts[0], a: "Active Recall Card" });
      }
    }
    return parsed;
  };

  const readNoteFile = (file: File) => {
    const isCSV = file.name.toLowerCase().endsWith('.csv');
    if (file.type !== 'text/plain' && !file.name.endsWith('.txt') && !file.name.endsWith('.md') && !isCSV) {
      setError("Please import a valid text file (.txt, .md) or a flashcard CSV file (.csv).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        if (isCSV) {
          const parsed = parseCSV(text);
          if (parsed.length === 0) {
            setError("No valid flashcards found in the CSV. Format must be: Question, Answer");
            return;
          }
          setFlashcards(parsed);
          setReviewIndex(0);
          setShowAnswer(false);
          setImportedFileName(file.name);
          setNotesContent(`[CSV Flashcard Deck: ${parsed.length} items loaded]`);
          setSelectedNoteId('');
          setError(null);
        } else {
          setNotesContent(text);
          setImportedFileName(file.name);
          setSelectedNoteId(''); // clear dropdown option of saved notes
          setError(null);
        }
      }
    };
    reader.onerror = () => {
      setError("Failed to read the imported file.");
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readNoteFile(file);
    }
  };

  const generateContent = async () => {
    const isImportMode = activeTab === 'flashcards' && flashcardMode === 'import';
    
    if (!navigator.onLine) {
      setError("🔌 Compilation is offline. AI Mnemonics and Flashcards compilation requires an active internet connection. Please connect to continue mapping new modules!");
      return;
    }
    
    if (isImportMode) {
      if (!notesContent.trim()) {
        setError("Please import or enter your notes content first.");
        return;
      }
    } else {
      if (!topic.trim()) {
        setError("Please enter a topic first.");
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    try {
      if (activeTab === 'mnemonics') {
        const response = await safeFetch('/api/gemini/mnemonic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic }),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data?.error || "Mnemonic sequence initialization failed.");
        }
        setMnemonics(data.mnemonics || []);
      } else {
        const payload: any = {};
        if (isImportMode) {
          payload.notesContent = notesContent;
        } else {
          payload.topic = topic;
        }

        const response = await safeFetch('/api/gemini/flashcards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data?.error || "Flashcard sequence compilation failed.");
        }
        setFlashcards(data.flashcards || []);
        setReviewIndex(0);
        setShowAnswer(false);
      }
    } catch (err: any) {
      console.error("Generation Error:", err);
      setError(err?.message || "Synapse transfer failed. Offline local sandbox core loaded context instead.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-12 pb-24">
      <header className="text-center space-y-4">
        <div className="w-16 h-16 bg-zinc-900 dark:bg-zinc-800 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl">
          <Brain size={32} />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase">
            Memory <span className="text-blue-600">Lab</span>
          </h1>
          <p className="text-zinc-500 font-medium italic">Advanced cognitive tools for rapid retention.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex justify-center">
        <div className="flex gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('mnemonics')}
            className={cn(
              "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all focus:outline-none",
              activeTab === 'mnemonics' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400"
            )}
          >
            Mnemonics
          </button>
          <button 
            onClick={() => setActiveTab('flashcards')}
            className={cn(
              "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all focus:outline-none",
              activeTab === 'flashcards' ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-400"
            )}
          >
            Flashcards
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab === 'mnemonics' ? 'mnemonics-view' : 'flashcards-view'}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-10 rounded-[3rem] shadow-xl shadow-zinc-200/50 dark:shadow-none space-y-8"
        >
          {activeTab === 'mnemonics' ? (
            /* Mnemonics Mode View */
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 block px-2">
                Target Topic
              </label>
              <div className="relative">
                <input 
                  type="text"
                  placeholder="e.g., Order of planets, Periodic Table..."
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl px-6 py-5 font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none pr-16"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generateContent()}
                />
                <button 
                  onClick={generateContent}
                  disabled={isGenerating}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-3 rounded-xl hover:scale-105 transition-all disabled:opacity-50"
                >
                  <Zap size={20} className={cn(isGenerating && "animate-pulse")} />
                </button>
              </div>
            </div>
          ) : (
            /* Flashcards Mode View with Import Options */
            <div className="space-y-6">
              {/* Flashcards Sub-toggle: Concept Keyword vs Import Notes */}
              <div className="flex gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <button
                  type="button"
                  onClick={() => setFlashcardMode('topic')}
                  className={cn(
                    "text-xs font-black uppercase tracking-wider pb-1 transition-all",
                    flashcardMode === 'topic' ? "text-blue-600 border-b-2 border-blue-600" : "text-zinc-400 hover:text-zinc-650"
                  )}
                >
                  By Topic Topic
                </button>
                <button
                  type="button"
                  onClick={() => setFlashcardMode('import')}
                  className={cn(
                    "text-xs font-black uppercase tracking-wider pb-1 transition-all flex items-center gap-1.5",
                    flashcardMode === 'import' ? "text-blue-600 border-b-2 border-blue-600" : "text-zinc-400 hover:text-zinc-650"
                  )}
                >
                  <Upload size={14} /> Import Study Notes
                </button>
              </div>

              {flashcardMode === 'topic' ? (
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 block px-2">
                    Enter Topic Keyword
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="e.g., Physics Quantum Mechanics, Calculus Limits..."
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl px-6 py-5 font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none pr-16"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && generateContent()}
                    />
                    <button 
                      onClick={generateContent}
                      disabled={isGenerating}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-3 rounded-xl hover:scale-105 transition-all disabled:opacity-50"
                    >
                      <Zap size={20} className={cn(isGenerating && "animate-pulse")} />
                    </button>
                  </div>
                </div>
              ) : (
                /* Note Import Fields and Dropzones */
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Select from existing library notes */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block">
                        Select from TeenGenius Library
                      </label>
                      <select
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 font-semibold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none text-xs"
                        value={selectedNoteId}
                        onChange={(e) => handleSelectSavedNote(e.target.value)}
                      >
                        <option value="">-- Choose saved note --</option>
                        {savedNotes.map(n => (
                          <option key={n.id} value={n.id}>
                            {n.title} ({n.subject})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Drag and Drop Notes/Flashcards File */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block">
                        Upload Notes or CSV Flashcards
                      </label>
                      <label 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                          "flex items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-2.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all text-xs font-semibold",
                          isDraggingFile ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 text-blue-600" : "border-zinc-200 dark:border-zinc-700 text-zinc-500"
                        )}
                      >
                        <Upload size={14} />
                        <span>{importedFileName ? "Change file" : "Drag or select .txt, .md, or .csv"}</span>
                        <input 
                          type="file" 
                          accept=".txt,.md,.csv" 
                          className="hidden" 
                          onChange={handleFileUpload}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Note text field */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 block">
                        Paste or Edit Raw Note Content
                      </label>
                      {importedFileName && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-900/35 flex items-center gap-1.5">
                          <FileText size={10} /> {importedFileName}
                        </span>
                      )}
                    </div>
                    <textarea
                      placeholder="Paste your revision notes, transcript drafts, or course modules here..."
                      className="w-full min-h-[140px] bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl px-5 py-4 font-semibold text-xs leading-relaxed text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                      value={notesContent}
                      onChange={(e) => {
                        setNotesContent(e.target.value);
                        if (selectedNoteId) setSelectedNoteId(''); // clear dropdown option of saved notes
                        if (importedFileName && !importedFileName.startsWith("Custom pasted")) {
                          setImportedFileName(`Custom edited: ${importedFileName}`);
                        }
                      }}
                    />
                  </div>

                  {/* Submission and trigger */}
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={generateContent}
                      disabled={isGenerating || !notesContent.trim()}
                      className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:scale-[1.03] active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      <Zap size={14} className={cn(isGenerating && "animate-spin")} />
                      Generate Flashcard Set
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 min-h-[200px]">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-655 dark:text-red-400 text-xs font-semibold rounded-2xl border border-red-155 dark:border-red-900/30">
                {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-20 text-center space-y-4"
                >
                  <div className="flex justify-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                  </div>
                  <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Architecting Knowledge with AI...</p>
                </motion.div>
              ) : activeTab === 'mnemonics' ? (
                mnemonics.length > 0 ? (
                  <motion.div 
                    key="mnemonics-list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid gap-4"
                  >
                    {mnemonics.map((m, i) => (
                      <div 
                        key={i}
                        className="p-6 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-3xl flex items-center justify-between group hover:border-blue-500 transition-all"
                      >
                        <p className="font-bold text-zinc-900 dark:text-white group-hover:text-blue-600 transition-colors leading-relaxed">
                          {m.replace(/^\d+\.\s*/, '')}
                        </p>
                        <button 
                          onClick={() => copyToClipboard(m, i)}
                          className="p-3 text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all"
                        >
                          {copiedIndex === i ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                        </button>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="py-20 text-center border-2 border-dashed border-zinc-50 dark:border-zinc-800 rounded-[2.5rem]">
                    <Lightbulb size={40} className="mx-auto text-zinc-150 dark:text-zinc-800 mb-4" />
                    <p className="text-zinc-400 text-sm font-medium italic">Summarize topics into memorable catchphrases.</p>
                  </div>
                )
              ) : (
                flashcards.length > 0 ? (
                  <motion.div 
                    key="flashcards-deck"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-8"
                  >
                    <div 
                      onClick={() => setShowAnswer(!showAnswer)}
                      className="relative w-full min-h-[240px] md:min-h-[280px] cursor-pointer perspective-1000 group mb-4"
                    >
                      <motion.div 
                        className="w-full h-full min-h-[240px] md:min-h-[280px] relative transition-all duration-700 preserve-3d"
                        animate={{ rotateY: showAnswer ? 180 : 0 }}
                      >
                        {/* Front */}
                        <div className="absolute inset-0 h-full w-full bg-blue-600 rounded-[2.2rem] p-6 md:p-10 flex flex-col items-center justify-center text-center backface-hidden">
                          <span className="text-[9px] font-black tracking-widest text-blue-200 uppercase mb-3 italic">Question</span>
                          <p className="text-base xs:text-lg sm:text-xl md:text-2xl font-black text-white leading-tight break-words max-w-full">
                            {flashcards[reviewIndex].q}
                          </p>
                          <p className="absolute bottom-4 text-[9px] text-blue-200 font-bold uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">
                            Tap to reveal answer
                          </p>
                        </div>
                        {/* Back */}
                        <div className="absolute inset-0 h-full w-full bg-zinc-900 rounded-[2.2rem] p-6 md:p-10 flex flex-col items-center justify-center text-center backface-hidden [transform:rotateY(180deg)]">
                          <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase mb-3 italic">Answer</span>
                          <p className="text-base xs:text-lg sm:text-xl md:text-2xl font-black text-white leading-tight break-words max-w-full">
                            {flashcards[reviewIndex].a}
                          </p>
                          <p className="absolute bottom-4 text-[9px] text-zinc-500 font-bold uppercase tracking-widest opacity-80">
                            Tap to inspect question
                          </p>
                        </div>
                      </motion.div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-black text-zinc-400 tabular-nums">
                        {reviewIndex + 1} / {flashcards.length}
                      </span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setReviewIndex(prev => Math.max(0, prev - 1)); setShowAnswer(false); }}
                          className="px-6 py-3 bg-zinc-150 dark:bg-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30 text-zinc-800 dark:text-white"
                          disabled={reviewIndex === 0}
                        >
                          Previous
                        </button>
                        <button 
                          onClick={() => { setReviewIndex(prev => Math.min(flashcards.length - 1, prev + 1)); setShowAnswer(false); }}
                          className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                          disabled={reviewIndex === flashcards.length - 1}
                        >
                          Next Card
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="py-20 text-center border-2 border-dashed border-zinc-50 dark:border-zinc-800 rounded-[2.5rem]">
                    <Sparkles size={40} className="mx-auto text-zinc-150 dark:text-zinc-800 mb-4" />
                    <p className="text-zinc-400 text-sm font-medium italic">Generate flashcards for active recall testing.</p>
                  </div>
                )
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Memory Tips Section */}
      <section className="space-y-8">
        <h2 className="text-xs font-black uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-3">
          <div className="w-10 h-0.5 bg-zinc-100" /> Neuro-Science Hacks
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { title: 'The P.E.G. System', info: 'Associate numbers with rhyming words to create a mental chain.', icon: Sparkles },
            { title: 'Method of Loci', icon: BookOpen, info: 'Visualize a familiar room and place facts in specific corners.' },
            { title: 'Chunking', icon: Brain, info: 'Break large strings of data into groups of 3-4 items.' },
            { title: 'Visual association', icon: Lightbulb, info: 'Create a vivid, even ridiculous, mental image relating concepts.' },
          ].map(tip => (
            <div key={tip.title} className="p-8 bg-zinc-900 border border-zinc-800 rounded-[3rem] text-white space-y-4">
              <tip.icon size={24} className="text-blue-500" />
              <h3 className="text-xl font-black uppercase tracking-tight">{tip.title}</h3>
              <p className="text-zinc-400 text-sm italic">{tip.info}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
