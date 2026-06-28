import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Copy, Check, History, BookOpen, Image as ImageIcon, Trash2, X, GraduationCap, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../lib/language';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn, preprocessLaTeX, compressImage, dataURLtoFile } from '../lib/utils';
import { safeFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';

interface SolutionHistoryItem {
  id: string;
  userId: string;
  subject: string;
  question: string;
  imageUrl?: string;
  solution: string;
  createdAt: any;
  languageCode?: string;
}

export default function HomeworkSolver() {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [subject, setSubject] = useState('Mathematics');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubjectManuallySelected, setIsSubjectManuallySelected] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  
  const [solution, setSolution] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyItems, setHistoryItems] = useState<SolutionHistoryItem[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<SolutionHistoryItem | null>(null);
  const [loadingState, setLoadingState] = useState('');
  const [activeLang, setActiveLang] = useState('auto');
  const [initialLangLoaded, setInitialLangLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize global language on mounting
  useEffect(() => {
    const systemLang = localStorage.getItem('TEEN_GENIUS_LANGUAGE') || 'auto';
    setActiveLang(systemLang);
    setInitialLangLoaded(true);
  }, []);

  const autoDetectSubject = (text: string): string | null => {
    const lower = text.toLowerCase();
    if (/\b(solve|equation|matrix|matrices|integral|integration|derivative|calculus|algebra|theorem|triangle|geometry|fraction|trigonometry|logarithm|sum|probability|ratio|percentage|\+|-|\*|\/|=)\b/.test(lower)) {
      return 'Mathematics';
    }
    if (/\b(force|velocity|acceleration|gravity|photon|quantum|optics|lens|relativity|thermodynamics|energy|power|watt|joule|friction|motion|magnet|electricity|ohm|voltage)\b/.test(lower)) {
      return 'Physics';
    }
    if (/\b(reaction|acid|base|ph|molecule|atom|element|organic|valency|solution|catalyst|chemistry|covalent|ionic|gas|liquid|solid|periodic table)\b/.test(lower)) {
      return 'Chemistry';
    }
    if (/\b(cell|mitosis|meiosis|photosynthesis|dna|rna|gene|genetics|evolution|organism|bacteria|virus|plant|animal|species|human body|anatomy|ecology|respiration)\b/.test(lower)) {
      return 'Biology';
    }
    if (/\b(programming|code|binary|python|javascript|java|compiler|algorithm|loop|array|variable|database|sql|html|css|software|hardware|network|server)\b/.test(lower)) {
      return 'Computer Science';
    }
    if (/\b(telugu|andhra|telangana)\b/.test(lower)) {
      return 'Telugu';
    }
    if (/\b(hindi|bharat|constitution|swaraj)\b/.test(lower)) {
      return 'Hindi';
    }
    if (/\b(essay|poem|grammar|literature|noun|verb|adjective|tense|vocabulary|shakespeare|sonnet|pronoun|paragraph)\b/.test(lower)) {
      return 'English';
    }
    if (/\b(history|social|geography|revolution|civic|economics|democracy|freedom|constitution|continent|ocean|climate|map)\b/.test(lower)) {
      return 'Social Science';
    }
    if (/\b(science|experiment|laboratory|scientific|hypothesis|phenomenon)\b/.test(lower)) {
      return 'Science';
    }
    return null;
  };

  useEffect(() => {
    if (isSubjectManuallySelected) return;
    const textToScan = `${question} ${selectedFile ? selectedFile.name : ''}`;
    const detected = autoDetectSubject(textToScan);
    if (detected) {
      setSubject(detected);
    }
  }, [question, selectedFile, isSubjectManuallySelected]);

  // Automatically trigger regeneration if language changes and solution is active
  useEffect(() => {
    if (initialLangLoaded && solution && !selectedHistoryItem && !isLoading && (question.trim() || selectedFile)) {
      handleSolve();
    }
  }, [activeLang]);

  const subjects = [
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'English',
    'Social Science',
    'Computer Science',
    'Economics',
    'Accountancy',
    'Business Studies',
    'Political Science',
    'Geography',
    'History',
    'Civics',
    'General Science',
    'Custom'
  ];

  // Load history from Firestore on mount with local storage caching fallback
  useEffect(() => {
    if (!user) return;

    // Load initial homework entries from local storage cache
    const cachedHomework = localStorage.getItem(`STUDENT_LOCAL_HOMEWORK_CACHE_${user.uid}`);
    if (cachedHomework) {
      try {
        setHistoryItems(JSON.parse(cachedHomework));
      } catch (err) {
        console.warn("Error parsing homework cache:", err);
      }
    }

    const isSandboxObj = user.uid.includes('sandbox') || (user as any).isGuest;
    if (isSandboxObj) {
      return () => {};
    }

    const q = query(
      collection(db, 'homeworkSolutions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SolutionHistoryItem));
      setHistoryItems(items);
      // Cache values locally
      localStorage.setItem(`STUDENT_LOCAL_HOMEWORK_CACHE_${user.uid}`, JSON.stringify(items));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'homeworkSolutions'));

    return () => unsubscribe();
  }, [user]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setLoadingState('Optimizing image...');
    const reader = new FileReader();
    reader.onloadend = async () => {
      const originalBase64 = reader.result as string;
      try {
        const compressedBase64 = await compressImage(originalBase64);
        setImagePreview(compressedBase64);
        const compressedFile = dataURLtoFile(compressedBase64, file.name || 'image.jpg');
        setSelectedFile(compressedFile);
      } catch (err) {
        console.warn("Client compression failed, using original:", err);
        setSelectedFile(file);
        setImagePreview(originalBase64);
      } finally {
        setLoadingState('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const getFriendlyErrorMessage = (err: any): string => {
    const msg = (err?.message || String(err)).toLowerCase();
    
    if (msg.includes("failed to fetch") || msg.includes("network error")) {
      return `### 🔌 Connection Blocked or Network Offline
The application was unable to establish a connection with the backend services.

**Potential Causes & Checklist**:
1. **Local Network Offline**: Check if your computer has lost network connectivity.
2. **CORS or Sandbox Constraint**: The browser blocked the request because of cross-origin security rules or an iframe sandboxing restriction.
3. **Backend Service Offline**: The TeenGenius backend server might contain configuration abnormalities. Try reloading the web app or returning to the main dashboard.`;
    }
    
    if (msg.includes("timed out") || msg.includes("timeout") || msg.includes("aborted")) {
      return `### ⏱️ Cognitive Synchrony Timeout
The request to the TeenGenius solvers timed out.

**Potential Causes**:
1. **Complex Problem Derivation**: The homework query is extremely comprehensive and took more than 30 seconds to run.
2. **Slow Internet Connection**: High latency matches with unstable transfer speeds.
3. **Gemini Latency**: The Google Generative AI API is experiencing an unusually high load. Please click the **Get Step-by-Step Answer** button to retry!`;
    }
    
    if (msg.includes("auth") || msg.includes("key") || msg.includes("credentials") || msg.includes("unauthorized") || msg.includes("401") || msg.includes("403")) {
      return `### 🔑 Authentication Credentials Issue
Access to the Gemini-3.5-family cognitive pathways was suspended.

**Potential Causes**:
1. **Invalid Gemini Key**: A custom key was entered incorrectly under the Secret Developer module.
2. **System Rule Restriction**: The backend rejected the requests due to safety limits or missing service tokens.`;
    }

    if (msg.includes("gemini") || msg.includes("api") || msg.includes("quota") || msg.includes("limit")) {
      return `### 🧠 Gemini Cognitive Node Error
The Google Generative AI core returned an exception structure.

**Potential Causes**:
1. **API Quota Exceeded**: Google's free/paid tier limits may have been exhausted temporarily.
2. **Safety Block**: The model has flagged your question context under creative content filters.`;
    }

    return `### ⚠️ Cognitive Synapse Intermission
An unexpected system error occurred during problem analysis.

**Error Signature**: \`${err?.message || err}\`

**Recommendation**: Please click **Get Step-by-Step Answer** again to trigger safety-fallback solver pipelines.`;
  };

  const handleSolve = async () => {
    if (!question.trim() && !selectedFile) return;
    if (!navigator.onLine) {
      setSolution(`### 🔌 Homework Solver Offline\n\nAI step-by-step homework resolution requires an active internet connection to contact Gemini-Flash nodes.\n\nYour current question has been cached in memory. Please recover a stable internet connection to start solving!\n\n**Note**: You can still scroll down and read previously solved historical answers under the **Previously Solved** list!`);
      return;
    }
    setIsLoading(true);
    setSolution('');
    setSelectedHistoryItem(null);
    setLoadingState('Digitization mapping initialized...');

    try {
      let finalImageUrl = '';

      // 1. If an image is selected, upload it
      if (selectedFile) {
        setLoadingState('Transmitting visual raster cells...');
        const formData = new FormData();
        formData.append('file', selectedFile);

        console.log(`[HOMEWORK SOLVER TRACING]: Initiating Image Upload...`);
        console.log(`[HOMEWORK SOLVER TRACING]: Target Endpoint URL: /api/upload`);
        console.log(`[HOMEWORK SOLVER TRACING]: Payload Body: FormData with file [${selectedFile.name}, size: ${selectedFile.size} bytes]`);

        const uploadRes = await safeFetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        console.log(`[HOMEWORK SOLVER TRACING]: Image Upload Response Status: ${uploadRes.status}`);

        if (uploadRes.ok) {
          const uploadData = await uploadRes.clone().json();
          console.log(`[HOMEWORK SOLVER TRACING]: Image Upload Response Body:`, JSON.stringify(uploadData, null, 2));
          finalImageUrl = uploadData.url;
        } else {
          const rawErr = await uploadRes.clone().text().catch(() => "");
          console.error(`[HOMEWORK SOLVER TRACING]: Image Upload Failed with status ${uploadRes.status}, body: ${rawErr}`);
        }
      }

      // 2. Query Homework Solver AI Core
      setLoadingState('Processing with Flash-3.5 cognitive pathways...');
      const finalSubject = subject === 'Custom' ? (customSubject.trim() || 'Custom Subject') : subject;
      const reqPayload: any = {
        question: question || 'Please solve the problem in the attached image.',
        subject: finalSubject,
      };

      if (finalImageUrl) {
        reqPayload.image = { url: finalImageUrl };
      } else if (imagePreview) {
        reqPayload.image = { data: imagePreview.split(',')[1], mimeType: selectedFile?.type || 'image/jpeg' };
      }

      console.log("[HOMEWORK SOLVER TRACING]: Initiating Solve Action...");
      console.log(`[HOMEWORK SOLVER TRACING]: Target Endpoint URL: /api/gemini/solve-homework`);
      console.log(`[HOMEWORK SOLVER TRACING]: Payload Body:`, JSON.stringify(reqPayload, null, 2));

      // Retry mechanism (up to 2 attempts) for transient errors/network spikes
      let res: Response | null = null;
      let attempts = 0;
      const maxAttempts = 2;
      let lastFetchError: any = null;

      while (attempts < maxAttempts) {
        try {
          res = await safeFetch('/api/gemini/solve-homework', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-language-setting': activeLang
            },
            body: JSON.stringify(reqPayload),
            timeout: 120000 // Generous 2-minute timeout for comprehensive step-by-step master class solutions
          });

          console.log(`[HOMEWORK SOLVER TRACING] [Attempt ${attempts + 1}/${maxAttempts}]: Response Status: ${res.status}`);

          if (res.ok) {
            break;
          }

          const errorText = await res.clone().text().catch(() => "Unknown response body");
          console.warn(`[HOMEWORK SOLVER TRACING] [Attempt ${attempts + 1}/${maxAttempts}]: Received non-ok response. Body:`, errorText);

          if (res.status >= 500 && attempts < maxAttempts - 1) {
            attempts++;
            setLoadingState(`Transient node error (Status ${res.status}). Retrying (Attempt ${attempts + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
          } else {
            throw new Error(errorText || `HTTP Exception ${res.status}`);
          }
        } catch (fetchErr: any) {
          lastFetchError = fetchErr;
          console.error(`[HOMEWORK SOLVER TRACING] [Attempt ${attempts + 1}/${maxAttempts}]: Thrown Exception caught during fetch:`, fetchErr);
          
          attempts++;
          if (attempts >= maxAttempts) {
            throw fetchErr;
          }
          setLoadingState(`Network latency detected. Reallocating cognitive nodes (Attempt ${attempts + 1}/${maxAttempts})...`);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      if (!res || !res.ok) {
        const fallbackText = lastFetchError?.message || res?.statusText || "Solve sequence interrupted.";
        throw new Error(fallbackText);
      }

      const data = await res.json();
      console.log(`[HOMEWORK SOLVER TRACING]: Solve Action Succeeded! Highly-dense LaTeX Solution text length: ${data.solution?.length || 0} characters.`);
      setSolution(data.solution);

      // 3. Save to Firestore if authenticated
      if (user) {
        const isSandboxObj = user.uid.includes('sandbox') || (user as any).isGuest;
        if (isSandboxObj) {
          const mockItem: SolutionHistoryItem = {
            id: `sb_hw_${Date.now()}`,
            userId: user.uid,
            subject: finalSubject,
            question: question || 'Visual query representation.',
            imageUrl: finalImageUrl || '',
            solution: data.solution,
            createdAt: { toDate: () => new Date(), seconds: Date.now() / 1000 },
            languageCode: activeLang
          };
          const updatedHistory = [mockItem, ...historyItems];
          setHistoryItems(updatedHistory);
          localStorage.setItem(`STUDENT_LOCAL_HOMEWORK_CACHE_${user.uid}`, JSON.stringify(updatedHistory));
        } else {
          setLoadingState('Securing solutions matrix in neural storage...');
          try {
            await addDoc(collection(db, 'homeworkSolutions'), {
              userId: user.uid,
              subject: finalSubject,
              question: question || 'Visual query representation.',
              imageUrl: finalImageUrl || '',
              solution: data.solution,
              createdAt: serverTimestamp(),
              languageCode: activeLang
            });
          } catch (fsErr) {
            console.warn("Firestore save failed in HomeworkSolver, continuing locally:", fsErr);
          }
        }
      }

      // Clean input file
      setSelectedFile(null);
      setImagePreview(null);
    } catch (err: any) {
      console.error("[HOMEWORK SOLVER TRACING]: Thrown Exception caught during execution flow:", err);
      const friendlyDetails = getFriendlyErrorMessage(err);
      setSolution(`### Synapse Connection Fault\n\n${friendlyDetails}`);
    } finally {
      setIsLoading(false);
      setLoadingState('');
    }
  };

  const copyToClipboard = () => {
    const textToCopy = selectedHistoryItem ? selectedHistoryItem.solution : solution;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Smooth scroll to solution when it becomes active
  useEffect(() => {
    if (solution || selectedHistoryItem) {
      setTimeout(() => {
        const scrollContainer = document.getElementById('main-scroll-container');
        if (scrollContainer) {
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [solution, selectedHistoryItem]);

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Purge this solution matrix from neural record database?')) return;
    try {
      const isSandboxObj = user?.uid?.includes('sandbox') || (user as any)?.isGuest;
      if (isSandboxObj) {
        const updated = historyItems.filter(h => h.id !== id);
        setHistoryItems(updated);
        localStorage.setItem(`STUDENT_LOCAL_HOMEWORK_CACHE_${user?.uid || 'guest'}`, JSON.stringify(updated));
        if (selectedHistoryItem?.id === id) {
          setSelectedHistoryItem(null);
        }
      } else {
        await deleteDoc(doc(db, 'homeworkSolutions', id));
        if (selectedHistoryItem?.id === id) {
          setSelectedHistoryItem(null);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `homeworkSolutions/${id}`);
    }
  };

  return (
    <div className="p-5 space-y-6 bg-zinc-50 dark:bg-zinc-950 min-h-full transition-colors pb-10">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest bg-clip-border">
          <GraduationCap size={12} fill="currentColor" className="fill-blue-100 dark:fill-blue-900/10" /> AI Study Partner
        </div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Homework Solver</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold italic leading-relaxed">
          Snap a photo or type your problem to get step-by-step master class solutions instantly in real-time.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {/* Input panel & drag drop */}
        <div className="space-y-5">
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "p-5 whitespace-normal bg-white dark:bg-zinc-900 border rounded-[2rem] shadow-sm space-y-5 relative transition-all duration-300",
              isDragging ? "border-blue-500 bg-blue-50/10 dark:bg-blue-950/10 scale-[1.01]" : "border-zinc-150 dark:border-zinc-800"
            )}
          >
            {/* 1. Subject Selection */}
            <div className="space-y-2 animate-fade-in">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block flex items-center gap-1.5">
                <GraduationCap size={13} /> Select Subject
              </label>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setIsSubjectManuallySelected(true);
                }}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 focus:ring-2 focus:ring-blue-500 rounded-2xl px-4 py-3.5 text-xs text-zinc-900 dark:text-white outline-none font-bold transition-all cursor-pointer"
              >
                {subjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {subject === 'Custom' && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                  Enter Subject
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="E.g., Sanskrit, Astrology, Music Theory..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 focus:ring-2 focus:ring-blue-550 rounded-2xl px-4 py-3 text-xs text-zinc-900 dark:text-white outline-none font-semibold transition-all focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            {/* 2. Question Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                Question Statement
              </label>
              <textarea 
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Paste homework instructions or prompt..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 focus:ring-2 focus:ring-blue-500 rounded-2xl p-4 h-28 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/10 outline-none transition-all resize-none text-zinc-900 dark:text-zinc-100 text-xs leading-relaxed font-semibold placeholder:font-normal placeholder:italic placeholder:text-zinc-400"
              />
              <p className="text-[10px] text-zinc-400 dark:text-zinc-550 italic font-semibold flex items-center gap-1 mt-1 pl-1">
                <span>✨ Subject-aware solver optimized automatically</span>
              </p>
            </div>

            {/* 3. Upload Homework Image (Optional) */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                Upload Homework Image (Optional)
              </label>
              <input 
                type="type" // dummy to ensure it's simple or hidden input block
                className="hidden"
              />
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />

              <AnimatePresence mode="wait">
                {imagePreview ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-750 shadow-inner group aspect-video"
                  >
                    <img 
                      src={imagePreview} 
                      alt="Attach Preview" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex items-center justify-center gap-2.5">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-white text-zinc-900 rounded-xl hover:scale-105 transition-transform font-black text-[9px] uppercase tracking-wider"
                      >
                        Change
                      </button>
                      <button 
                        onClick={() => { setSelectedFile(null); setImagePreview(null); }}
                        className="p-2 bg-red-600 text-white rounded-xl hover:scale-105 transition-transform"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-dashed border-zinc-300 dark:border-zinc-805 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-all flex flex-col items-center justify-center gap-2 aspect-video group"
                  >
                    <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl group-hover:scale-105 transition-transform text-zinc-400 dark:text-zinc-500">
                      <ImageIcon size={22} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-200 block">Upload Question Snap</span>
                      <span className="text-[8px] uppercase font-bold text-zinc-400 block mt-0.5">Drag & drop or Click to capture</span>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={handleSolve}
              disabled={(!question.trim() && !selectedFile) || isLoading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-505 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-650 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-xl shadow-blue-500/10 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  Finding step-by-step answers...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Get Step-by-Step Answer
                </>
              )}
            </button>
          </div>

          {/* Quick instructions panel */}
          <div className="bg-zinc-900 dark:bg-zinc-900/50 border border-zinc-950 dark:border-zinc-850 p-5 rounded-[2rem] text-white">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-blue-400 flex items-center gap-1.5 mb-3">
              <BookOpen size={14} strokeWidth={2.5} /> How to get answers
            </h3>
            <ul className="space-y-2 text-[10px] font-semibold text-zinc-400 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-blue-500 font-extrabold">01</span>
                <span>Select a subject or let our AI automatically detect it from your text.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-extrabold">02</span>
                <span>Type your question or upload a photo of your assignment scan.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-extrabold font-black">03</span>
                <span>The system automatically detects the language and compiles clear answers in English.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Output and History panel */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col min-h-[440px] transition-colors">
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-805 dark:text-zinc-200">
                  {selectedHistoryItem ? `${selectedHistoryItem.subject} Explanation` : "Step-by-Step Explanation"}
                </h3>
              </div>
              
              {(solution || selectedHistoryItem) && (
                <div className="flex gap-2">
                  <button 
                    onClick={copyToClipboard}
                    className="p-2.5 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  {selectedHistoryItem && (
                    <button 
                      onClick={() => { setSelectedHistoryItem(null); setSolution(''); }}
                      className="p-2.5 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-805 transition-all text-zinc-400 dark:text-zinc-500 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-5 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed markdown-container">
              {(solution || selectedHistoryItem) && (
                <div className="mb-4 pb-3 border-b border-zinc-150 dark:border-zinc-805 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">Solution Blueprint</span>
                  <span className="text-[9px] px-2.5 py-1 font-black bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-405 rounded-full uppercase">
                    Subject: {selectedHistoryItem ? selectedHistoryItem.subject : (subject === 'Custom' ? (customSubject || 'Custom') : subject)}
                  </span>
                </div>
              )}
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-16">
                  <Loader2 size={32} className="animate-spin text-blue-600" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">{loadingState}</p>
                    <p className="text-[8px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-tighter">Computing neural mathematical bounds...</p>
                  </div>
                </div>
              ) : selectedHistoryItem ? (
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-150 dark:border-zinc-850 text-[11px] font-semibold text-zinc-500 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Question Ref:</p>
                    <p className="text-zinc-750 dark:text-zinc-300 italic">"{selectedHistoryItem.question}"</p>
                    {selectedHistoryItem.imageUrl && (
                      <img 
                        src={selectedHistoryItem.imageUrl} 
                        alt="Question context" 
                        className="max-h-36 rounded-lg mt-2 object-contain border border-zinc-200 dark:border-zinc-707"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(selectedHistoryItem.solution)}</ReactMarkdown>
                  </div>
                </div>
              ) : solution ? (
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap animate-fade-in">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(solution)}</ReactMarkdown>
                </div>
              ) : (
                <div className="h-full py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-30 px-6">
                  <GraduationCap size={44} className="text-zinc-400 dark:text-zinc-700 animate-pulse" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-200">Awaiting Query Request</p>
                    <p className="text-[8px] uppercase font-bold text-zinc-400 mt-1 max-w-[240px]">Enter subject query or load memory logs from Vault below.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History Vault section */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-150 dark:border-zinc-805 space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <History size={14} /> Knowledge Vault Logs
            </h3>
            
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
              {historyItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedHistoryItem(item);
                    if (item.languageCode) {
                      setActiveLang(item.languageCode);
                    }
                  }}
                  className={cn(
                    "p-3 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between gap-2.5 group relative select-none",
                    selectedHistoryItem?.id === item.id 
                      ? "bg-blue-50/10 dark:bg-blue-950/10 border-blue-500"
                      : "bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-808"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[7.5px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 font-black rounded-md uppercase truncate leading-none">
                        {item.subject}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-zinc-750 dark:text-zinc-200 truncate pr-6 leading-none">
                      {item.question}
                    </p>
                  </div>

                  <button
                    onClick={(e) => handleDeleteHistory(item.id, e)}
                    className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer"
                    title="Purge solution record"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}

              {historyItems.length === 0 && (
                <div className="py-8 text-center text-zinc-400 dark:text-zinc-500">
                  <History size={28} className="mx-auto mb-2 opacity-30" strokeWidth={1} />
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-450">Knowledge Vault empty</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
