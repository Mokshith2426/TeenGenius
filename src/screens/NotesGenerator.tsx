import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Sparkles, Loader2, Copy, Check, Download, History, List, 
  Tag, AlertTriangle, Search, Trash2, Calendar, FolderOpen, Info,
  Upload, X, Image as ImageIcon, Globe, FileUp, Clipboard, Eye, BookOpen, GraduationCap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn, preprocessLaTeX } from '../lib/utils';
import { safeFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { SUPPORTED_LANGUAGES } from '../lib/language';

interface SavedNote {
  id: string;
  title: string;
  content: string;
  focus: string;
  notes: string;
  subject: string;
  importance: 'High' | 'Medium' | 'Low';
  createdAt: string;
  languageCode?: string;
}

interface UploadedFile {
  name: string;
  mimeType: string;
  data: string; // Base64 representation (excluding metadata prefix)
  url?: string; // Preview URL for images
}

const PRESET_SUBJECTS = [
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

const NOTE_STYLES = [
  { value: 'Short Notes', label: 'Short Notes 📝', desc: 'Concise summary of essentials' },
  { value: 'Detailed Notes', label: 'Detailed Notes 📖', desc: 'In-depth comprehensive chapters' },
  { value: 'Chapter-wise Notes', label: 'Chapter-wise Notes 🗂️', desc: 'Divided into clear chapters' },
  { value: 'Topic-wise Notes', label: 'Topic-wise Notes 🎯', desc: 'Separated by key subject topics' },
  { value: 'Bullet Point Notes', label: 'Bullet Point Notes 📋', desc: 'Pure nested bullets and structure' },
  { value: 'Teacher-style Notes', label: 'Teacher-style Notes 🧑‍🏫', desc: 'Uses analogies and visual maps' },
  { value: 'Revision Notes', label: 'Revision Notes ⚡', desc: 'Mnemonic memory hooks & recall questions' },
  { value: 'Last-minute Exam Notes', label: 'Last-minute Exam Notes 🚨', desc: 'High-yield exam prep & formulas' },
];

const SUBJECT_COLORS: Record<string, string> = {
  'Mathematics': 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
  'Science': 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-450 border-amber-200 dark:border-amber-900/50',
  'Physics': 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/50',
  'Chemistry': 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-900/50',
  'Biology': 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  'English': 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900/50',
  'Social Science': 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50',
  'Computer Science': 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50',
  'Economics': 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-450 border-rose-200 dark:border-rose-900/50',
  'Accountancy': 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-900/50',
  'Business Studies': 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-900/50',
  'Political Science': 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50',
  'Geography': 'bg-fuchsia-50 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-200 dark:border-fuchsia-900/50',
  'History': 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  'Civics': 'bg-lime-50 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400 border-lime-200 dark:border-lime-900/50',
  'General Science': 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
};

const getSubjectBadgeStyle = (sub: string) => {
  return SUBJECT_COLORS[sub] || 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-450 border-zinc-200 dark:border-zinc-700';
};

const IMPORTANCE_CLASSES: Record<'High' | 'Medium' | 'Low', string> = {
  'High': 'bg-red-50 dark:bg-red-950/40 text-red-655 dark:text-red-400 border-red-200 dark:border-red-900/50',
  'Medium': 'bg-amber-50 dark:bg-amber-955/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
  'Low': 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
};

// Simple Markdown to HTML parser for DOCX and printing exports
function renderMarkdownToHtml(md: string): string {
  if (!md) return "";
  
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Code sections
  html = html.replace(/```([\s\S]*?)```/g, '<pre style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace;"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 2px 5px; border-radius: 4px; font-family: monospace;">$1</code>');
  
  // Structured Headers
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  
  // Custom styled bolding and italics
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  
  // Quotes & Callouts
  html = html.replace(/^> (.*?)$/gm, '<div style="border-left: 4px solid #3b82f6; padding-left: 15px; margin: 15px 0; color: #475569; font-style: italic;">$1</div>');
  
  // Dividers
  html = html.replace(/^---$/gm, '<hr style="border: 0; border-top: 1.5px dashed #cbd5e1; margin: 20px 0;" />');
  
  // Render tables
  const lines = html.split('\n');
  let inTable = false;
  let tableRows: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line);
      lines[i] = '<!--TABLE_CELL_STUB-->';
    } else {
      if (inTable) {
        const tableHtml = compileTableHtml(tableRows);
        lines[i - 1] = tableHtml;
        inTable = false;
      }
    }
  }
  if (inTable) {
    const tableHtml = compileTableHtml(tableRows);
    lines[lines.length - 1] = tableHtml;
  }
  
  html = lines.filter(l => l !== '<!--TABLE_CELL_STUB-->').join('\n');
  
  // Master lists builder
  html = html.replace(/^\s*[-*+]\s+(.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>)/gs, '<ul style="margin-left: 20px; margin-bottom: 12px; list-style-type: disc;">$1<\/ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');
  
  // Numbered list compiler
  html = html.replace(/^\s*\d+\.\s+(.*?)$/gm, '<num-item>$1</num-item>');
  html = html.replace(/(<num-item>.*?<\/num-item>)/gs, '<ol style="margin-left: 20px; margin-bottom: 12px; list-style-type: decimal;">$1<\/ol>');
  html = html.replace(/<num-item>/g, '<li>').replace(/<\/num-item>/g, '</li>');
  html = html.replace(/<\/ol>\s*<ol>/g, '');

  // Render paragraphs cleanly
  const paragraphs = html.split('\n');
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (p && 
        !p.startsWith('<h') && 
        !p.startsWith('<ul') && 
        !p.startsWith('</ul') && 
        !p.startsWith('<ol') && 
        !p.startsWith('</ol') && 
        !p.startsWith('<li') && 
        !p.startsWith('</li') && 
        !p.startsWith('<pre') && 
        !p.startsWith('</pre') && 
        !p.startsWith('<div') && 
        !p.startsWith('</div') && 
        !p.startsWith('<table') && 
        !p.startsWith('</table') && 
        !p.startsWith('<tr') && 
        !p.startsWith('</tr') && 
        !p.startsWith('<td') && 
        !p.startsWith('</td') && 
        !p.startsWith('<hr') && 
        !p.startsWith('<!--')) {
      paragraphs[i] = `<p style="margin-bottom: 10px;">${p}</p>`;
    }
  }
  
  return paragraphs.join('\n');
}

function compileTableHtml(rows: string[]): string {
  let tableHtml = '<table style="border-collapse: collapse; width: 100%; margin: 15px 0;">';
  let firstRow = true;
  for (const row of rows) {
    if (row.includes('---')) continue; // Skip lines dividers
    tableHtml += '<tr>';
    const cells = row.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
    for (const cell of cells) {
      if (firstRow) {
        tableHtml += `<th style="border: 1px solid #cbd5e1; padding: 8px 12px; background-color: #f8fafc; font-weight: bold; text-align: left; color: #1e3a8a;">${cell}</th>`;
      } else {
        tableHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left;">${cell}</td>`;
      }
    }
    tableHtml += '</tr>';
    firstRow = false;
  }
  tableHtml += '</table>';
  return tableHtml;
}

export default function NotesGenerator() {
  const { user } = useAuth();

  // Input states
  const [content, setContent] = useState('');
  const [focus, setFocus] = useState('');
  const [subject, setSubject] = useState('Mathematics');
  const [isSubjectManuallySelected, setIsSubjectManuallySelected] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [importance, setImportance] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [noteStyle, setNoteStyle] = useState('Short Notes');
  const [summaryLength, setSummaryLength] = useState('Standard');
  const [activeLang, setActiveLang] = useState('auto');

  // Multi-input files and drag states
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status indicators
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Saved library and navigation controls
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'library'>('active');

  // Filtering controls
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterImportance, setFilterImportance] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const [initialLangLoaded, setInitialLangLoaded] = useState(false);

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
    const fileNames = uploadedFiles.map(f => f.name).join(' ');
    const textToScan = `${content} ${focus} ${fileNames}`;
    const detected = autoDetectSubject(textToScan);
    if (detected) {
      setSubject(detected);
    }
  }, [content, focus, uploadedFiles, isSubjectManuallySelected]);

  const handleLanguageChange = (code: string) => {
    setActiveLang(code);
    localStorage.setItem('TEEN_GENIUS_LANGUAGE', code);
    window.dispatchEvent(new Event('language-changed'));
  };

  // Automatically trigger regeneration if language changes and notes are active
  useEffect(() => {
    if (initialLangLoaded && notes && (content.trim() || uploadedFiles.length > 0) && !isLoading) {
      handleGenerate();
    }
  }, [activeLang]);

  // Hybrid Cloud Firestore + LocalStorage fallback
  useEffect(() => {
    let unsubscribe = () => {};
    
    if (user) {
      const isSandboxObj = user.uid.includes('sandbox') || (user as any).isGuest;
      if (isSandboxObj) {
        loadLocalHistory();
        return () => {};
      }
      console.log("[Notes Lab]: Initializing Cloud Sync with Firestore...");
      const q = query(
        collection(db, 'notesLab'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const cloudList: SavedNote[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          cloudList.push({
            id: doc.id,
            title: data.title || 'Untitled',
            content: data.content || '',
            focus: data.focus || '',
            notes: data.notes || '',
            subject: data.subject || 'General',
            importance: data.importance || 'Medium',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
            languageCode: data.languageCode || 'auto'
          });
        });
        setSavedNotes(cloudList);
        localStorage.setItem('STUDENT_SAVED_NOTES_TAGGED', JSON.stringify(cloudList));
      }, (err) => {
        console.error("Firestore synchronizer failed, adopting LocalStorage offline:", err);
        loadLocalHistory();
      });
    } else {
      loadLocalHistory();
    }
    
    return () => unsubscribe();
  }, [user]);

  const loadLocalHistory = () => {
    const localData = localStorage.getItem('STUDENT_SAVED_NOTES_TAGGED');
    if (localData) {
      try {
        setSavedNotes(JSON.parse(localData));
      } catch (err) {
        console.error("Failed to compile local cached notes:", err);
      }
    }
  };

  // Drag & drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processIncomingFiles(e.target.files);
    }
  };

  const processIncomingFiles = (filesList: FileList) => {
    const verifiedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      if (!verifiedTypes.includes(file.type)) {
        setError("❌ Unsupported file type. Please upload only images (JPEG, PNG, WEBP) or PDF documents.");
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError("❌ File is too large. Maximum supported size is 8MB.");
        continue;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64Content = dataUrl.split(',')[1];
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          mimeType: file.type,
          data: base64Content,
          url: file.type.startsWith('image/') ? dataUrl : undefined
        }]);
        setError(null);
      };
    }
  };

  const clearUploadedFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Generate Title from MD
  const deriveTitle = (generatedNotes: string, focusKeyword: string, inputTxt: string) => {
    const hOneMatch = generatedNotes.match(/^#+\s+(.+)$/m);
    if (hOneMatch && hOneMatch[1]) {
      return hOneMatch[1].trim().replace(/[*_#`:]/g, '');
    }
    if (focusKeyword && focusKeyword.trim().length > 2) {
      return `Study Guide: ${focusKeyword.trim()}`;
    }
    const txtLine = inputTxt.trim().replace(/[#*`_:]/g, '');
    if (txtLine.length > 5) {
      const firstFew = txtLine.split(/\s+/).slice(0, 4).join(' ');
      return firstFew.length > 3 ? `${firstFew}...` : 'Study Synopsis Matrix';
    }
    return 'Structured Study Guide';
  };

  // Central Notes Generator Handler
  const handleGenerate = async () => {
    if (!content.trim() && uploadedFiles.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const finalSubject = subject === 'Custom' ? (customSubject.trim() || 'Custom Subject') : subject;
      
      const response = await safeFetch('/api/gemini/notes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-language-setting': activeLang
        },
        body: JSON.stringify({ 
          content, 
          focus, 
          noteStyle, 
          summaryLength,
          subject: finalSubject,
          files: uploadedFiles.map(f => ({ name: f.name, data: f.data, mimeType: f.mimeType }))
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data?.error || "Study synopsis generation interrupted.");
      }

      const rawNotes = data.notes || '';
      setNotes(rawNotes);

      const computedTitle = deriveTitle(rawNotes, focus, content);
      const noteToSave = {
        title: computedTitle,
        content: content,
        focus: focus,
        notes: rawNotes,
        subject: finalSubject,
        importance: importance,
        languageCode: activeLang
      };

      if (user) {
        const isSandboxObj = user.uid.includes('sandbox') || (user as any).isGuest;
        if (isSandboxObj) {
          const localId = 'note_' + Date.now();
          const newLocalNote: SavedNote = {
            ...noteToSave,
            id: localId,
            createdAt: new Date().toISOString()
          };
          const updated = [newLocalNote, ...savedNotes];
          setSavedNotes(updated);
          localStorage.setItem('STUDENT_SAVED_NOTES_TAGGED', JSON.stringify(updated));
          setActiveNoteId(localId);
        } else {
          try {
            const docRef = await addDoc(collection(db, 'notesLab'), {
              ...noteToSave,
              userId: user.uid,
              createdAt: serverTimestamp()
            });
            setActiveNoteId(docRef.id);
          } catch (dbErr) {
            console.error("Error saving note to cloud Firestore, backing up locally:", dbErr);
            const localId = 'note_' + Date.now();
            const newLocalNote: SavedNote = {
              ...noteToSave,
              id: localId,
              createdAt: new Date().toISOString()
            };
            const updated = [newLocalNote, ...savedNotes];
            setSavedNotes(updated);
            localStorage.setItem('STUDENT_SAVED_NOTES_TAGGED', JSON.stringify(updated));
            setActiveNoteId(localId);
          }
        }
      } else {
        const localId = 'note_' + Date.now();
        const newLocalNote: SavedNote = {
          ...noteToSave,
          id: localId,
          createdAt: new Date().toISOString()
        };
        const updated = [newLocalNote, ...savedNotes];
        setSavedNotes(updated);
        localStorage.setItem('STUDENT_SAVED_NOTES_TAGGED', JSON.stringify(updated));
        setActiveNoteId(localId);
      }

      setActiveTab('active');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Notes generation failed. Standard diagnostics running.");
    } finally {
      setIsLoading(false);
    }
  };

  // Exports utilities
  const copyToClipboard = () => {
    navigator.clipboard.writeText(notes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportAsMsWord = () => {
    if (!notes) return;
    const activeNote = savedNotes.find(n => n.id === activeNoteId);
    const titleVal = activeNote ? activeNote.title : 'Study_Guide';
    const subVal = activeNote ? activeNote.subject : (subject === 'Other' ? customSubject : subject);
    const impVal = activeNote ? activeNote.importance : importance;

    const htmlWrapper = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${titleVal}</title>
        <style>
          body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #1a1a1a; padding: 40px; }
          h1 { color: #1e3a8a; font-size: 24pt; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; margin-top: 0; }
          h2 { color: #0f172a; font-size: 16pt; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          h3 { color: #2563eb; font-size: 12pt; margin-top: 16px; }
          p { font-size: 11pt; margin-bottom: 12px; }
          ul, ol { margin-left: 20px; margin-bottom: 16px; }
          li { font-size: 11pt; margin-bottom: 6px; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 10pt; }
          th { background-color: #f8fafc; font-weight: bold; color: #1e3a8a; }
          blockquote { border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0; color: #475569; font-style: italic; }
          .meta-info { margin-bottom: 30px; padding: 12px; background: #f8fafc; border: 1px dashed #e2e8f0; font-size: 10pt; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="meta-info">
          <strong>Subject Category:</strong> ${subVal} | 
          <strong>Importance Level:</strong> ${impVal} | 
          <strong>Date Generated:</strong> ${new Date().toLocaleDateString()}
        </div>
        <h1>${titleVal}</h1>
        <div>
          ${renderMarkdownToHtml(notes)}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlWrapper], { type: 'application/msword;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.setAttribute('download', `${titleVal.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_study_guide.doc`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const exportAsPdf = () => {
    if (!notes) return;
    const activeNote = savedNotes.find(n => n.id === activeNoteId);
    const titleVal = activeNote ? activeNote.title : 'Study_Notes';
    const subVal = activeNote ? activeNote.subject : (subject === 'Other' ? customSubject : subject);
    const impVal = activeNote ? activeNote.importance : importance;

    const printIframe = document.createElement('iframe');
    printIframe.id = 'notes-print-iframe';
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = '0';
    document.body.appendChild(printIframe);

    const docRef = printIframe.contentWindow?.document || printIframe.contentDocument;
    if (!docRef) return;

    const htmlContent = `
      <html>
      <head>
        <title>${titleVal}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #1a1a1a; padding: 35px; }
          h1 { color: #1e3a8a; font-size: 24pt; border-bottom: 2.5px solid #2563eb; padding-bottom: 8px; margin-top: 0; }
          h2 { color: #0f172a; font-size: 16pt; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; page-break-after: avoid; }
          h3 { color: #2563eb; font-size: 12pt; margin-top: 16px; page-break-after: avoid; }
          p { font-size: 11pt; margin-bottom: 12px; text-align: justify; }
          ul, ol { margin-left: 20px; margin-bottom: 16px; }
          li { font-size: 11pt; margin-bottom: 6px; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; page-break-inside: avoid; }
          th, td { border: 1px solid #94a3b8; padding: 10px; text-align: left; font-size: 10pt; }
          th { background-color: #f1f5f9; font-weight: bold; color: #1e3a8a; }
          blockquote { border-left: 4.5px solid #2563eb; padding-left: 16px; margin: 16px 0; color: #475569; font-style: italic; page-break-inside: avoid; }
          .syllabus-header { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 25px; font-size: 10pt; }
          @media print {
            body { padding: 15px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="syllabus-header">
          <strong>Subject Category:</strong> ${subVal} | 
          <strong>Importance Priority:</strong> ${impVal} | 
          <strong>Format Style:</strong> PDF Study Vector Document
        </div>
        <h1>${titleVal}</h1>
        <div>${renderMarkdownToHtml(notes)}</div>
      </body>
      </html>
    `;

    docRef.open();
    docRef.write(htmlContent);
    docRef.close();

    setTimeout(() => {
      printIframe.contentWindow?.focus();
      printIframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printIframe);
      }, 1000);
    }, 500);
  };

  const exportAsMarkdown = () => {
    if (!notes) return;
    const activeNote = savedNotes.find(n => n.id === activeNoteId);
    const titleVal = activeNote ? activeNote.title : 'Study_Guide';
    const subVal = activeNote ? activeNote.subject : (subject === 'Other' ? customSubject : subject);
    const impVal = activeNote ? activeNote.importance : importance;

    const fileHeader = `---
Subject: ${subVal}
Importance: ${impVal}
Generated: ${new Date().toLocaleString()}
Format: Structured Markdown Note
---\n\n`;

    const blob = new Blob([fileHeader + notes], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.setAttribute('download', `${titleVal.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_study_notes.md`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Historic guide loader
  const loadSavedNote = (note: SavedNote) => {
    setContent(note.content || '');
    setFocus(note.focus || '');
    setNotes(note.notes || '');
    setSubject(PRESET_SUBJECTS.includes(note.subject) ? note.subject : 'Custom');
    setCustomSubject(PRESET_SUBJECTS.includes(note.subject) ? '' : note.subject);
    setImportance(note.importance || 'Medium');
    if (note.languageCode) {
      setActiveLang(note.languageCode);
      localStorage.setItem('TEEN_GENIUS_LANGUAGE', note.languageCode);
    }
    setActiveNoteId(note.id);
    setActiveTab('active');
  };

  // Delete historic guide
  const deleteSavedNote = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    
    const updated = savedNotes.filter(n => n.id !== noteId);
    setSavedNotes(updated);
    localStorage.setItem('STUDENT_SAVED_NOTES_TAGGED', JSON.stringify(updated));

    if (activeNoteId === noteId) {
      setActiveNoteId(null);
      setNotes('');
    }

    if (user && !noteId.startsWith('note_')) {
      try {
        await deleteDoc(doc(db, 'notesLab', noteId));
      } catch (err) {
        console.error("Failed to delete note from Cloud Firestore:", err);
      }
    }
  };

  // Tags quick tuning
  const handleUpdateActiveNoteTags = async (newSub: string, newImp: 'High' | 'Medium' | 'Low') => {
    if (!activeNoteId) return;

    const updatedState = savedNotes.map(n => {
      if (n.id === activeNoteId) {
        return { ...n, subject: newSub, importance: newImp };
      }
      return n;
    });
    setSavedNotes(updatedState);
    localStorage.setItem('STUDENT_SAVED_NOTES_TAGGED', JSON.stringify(updatedState));

    if (user && !activeNoteId.startsWith('note_')) {
      try {
        await updateDoc(doc(db, 'notesLab', activeNoteId), {
          subject: newSub,
          importance: newImp
        });
      } catch (err) {
        console.error("Failed to update cloud note metadata tags:", err);
      }
    }
  };

  // Auto-scrolling on replies
  useEffect(() => {
    if (notes && activeTab === 'active') {
      setTimeout(() => {
        const docContainer = document.getElementById('main-scroll-container');
        if (docContainer) {
          docContainer.scrollTo({
            top: docContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 150);
    }
  }, [notes, activeTab]);

  // Filters application
  const filteredNotes = savedNotes.filter(n => {
    const term = searchQuery.toLowerCase();
    const queryMatch = 
      n.title.toLowerCase().includes(term) || 
      n.notes.toLowerCase().includes(term) || 
      n.subject.toLowerCase().includes(term);
    
    const subjectMatch = filterSubject === 'All' || n.subject === filterSubject;
    const priorityMatch = filterImportance === 'All' || n.importance === filterImportance;
    
    return queryMatch && subjectMatch && priorityMatch;
  }).sort((a, b) => {
    const epochA = new Date(a.createdAt).getTime();
    const epochB = new Date(b.createdAt).getTime();
    return sortBy === 'newest' ? epochB - epochA : epochA - epochB;
  });

  return (
    <div className="p-5 md:p-6 space-y-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-wider">
          <FileText size={12} /> Notes Lab 🔬
        </div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">Notes Lab & Study compiler</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-xs italic font-semibold leading-relaxed">
          Produce master-style exam preparation notes, syllabus structures, LaTeX formulations, and flash recall modules from textbooks, transcripts, images, or PDFs instantly.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Settings Panel */}
        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-150/70 dark:border-zinc-800 shadow-sm space-y-5">
            
            {/* 2. Notes Type */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <BookOpen size={13} /> Notes Type
              </label>
              <select
                value={noteStyle}
                onChange={(e) => setNoteStyle(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 focus:ring-2 focus:ring-indigo-550 rounded-2xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white outline-none font-bold transition-all cursor-pointer"
              >
                {NOTE_STYLES.map(style => (
                  <option key={style.value} value={style.value}>{style.label}</option>
                ))}
              </select>
            </div>

            {/* 3. Summary Length */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={13} /> Summary Length
              </label>
              <select
                value={summaryLength}
                onChange={(e) => setSummaryLength(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 focus:ring-2 focus:ring-indigo-550 rounded-2xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white outline-none font-bold transition-all cursor-pointer"
              >
                <option value="Brief">Brief (Condensed) ⚡</option>
                <option value="Standard">Standard (Comprehensive) 📚</option>
                <option value="Detailed">Detailed (Elaborate) 📝</option>
              </select>
            </div>

            {/* Subject Selection */}
            <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-800 pt-4 animate-fade-in">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <GraduationCap size={13} /> Select Subject
              </label>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setIsSubjectManuallySelected(true);
                }}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 focus:ring-2 focus:ring-indigo-550 rounded-2xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white outline-none font-bold transition-all cursor-pointer"
              >
                {PRESET_SUBJECTS.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {subject === 'Custom' && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                  Enter Subject
                </label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  placeholder="E.g., Sanskrit, Sociology..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-805 focus:ring-2 focus:ring-indigo-550 rounded-2xl px-3.5 py-2 text-xs text-zinc-900 dark:text-white outline-none font-semibold transition-all focus:ring-2"
                />
              </div>
            )}

            {/* 4. Input (Text/Image/PDF) */}
            <div className="space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                  <List size={13} /> Input (Text/Image/PDF)
                </label>
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste textbook passages, syllabus, prompt, or reference materials here..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-indigo-500 rounded-2xl p-4 h-32 text-xs text-zinc-900 dark:text-white leading-relaxed placeholder:font-normal placeholder:italic outline-none resize-none transition-all"
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-550 italic font-semibold flex items-center gap-1 mt-1 pl-1">
                  <span>✨ Subject-aware notes optimized and structured automatically</span>
                </p>
              </div>

              {/* Upload Document / Reference Images */}
              <div className="space-y-1.5">
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 bg-zinc-50/20 dark:bg-zinc-950/20",
                    dragActive ? "border-indigo-500 bg-indigo-50/10" : "",
                    uploadedFiles.length > 0 ? "py-2" : "py-4"
                  )}
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  <Upload size={18} className={cn("text-zinc-400 mb-1.5", dragActive ? "text-indigo-500 scale-110" : "")} />
                  <p className="text-[10px] font-bold text-zinc-700 dark:text-zinc-350">Drag & drop files or <span className="text-indigo-600 dark:text-indigo-400">browse</span></p>
                  <p className="text-[8px] text-zinc-400 italic mt-0.5 font-semibold">Supports Images & PDF Documents</p>
                </div>

                {/* Uploaded File chips */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {uploadedFiles.map((file, idx) => (
                      <div 
                        key={idx}
                        className="px-3 py-1.5 bg-indigo-50/60 dark:bg-zinc-950 border border-indigo-100 dark:border-zinc-800 rounded-xl flex items-center gap-2 max-w-[200px] text-[10px] font-semibold text-zinc-800 dark:text-zinc-200"
                      >
                        {file.url ? (
                          <img src={file.url} alt="Preview" className="w-5 h-5 object-cover rounded" />
                        ) : (
                          <ImageIcon size={14} className="text-indigo-500 shrink-0" />
                        )}
                        <span className="truncate flex-1">{file.name}</span>
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); clearUploadedFile(idx); }}
                          className="p-1 hover:bg-indigo-100 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-red-500 transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50/50 dark:bg-red-950/10 text-red-600 dark:text-red-400 text-xs font-semibold rounded-2xl border border-red-200 dark:border-red-900/30">
                {error}
              </div>
            )}

            {/* 5. Generate Notes */}
            <button 
              onClick={handleGenerate}
              disabled={(!content.trim() && uploadedFiles.length === 0) || isLoading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-650 text-white font-black text-[10px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Synthesizing custom materials...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Compile Study Guide
                </>
              )}
            </button>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-950 p-5 rounded-[2rem] text-white">
            <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-1.5 text-indigo-400 mb-3">
              <History size={16} /> Structured Notes Lab Guide
            </h3>
            <ul className="space-y-2.5 text-[11px] text-zinc-400 font-semibold leading-relaxed">
              <li className="flex gap-2">
                <span className="text-indigo-500 font-extrabold">01</span>
                <span>Compile notes of different formats: bullet lists, teacher guides, equation derivations or comprehensive chapters.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-extrabold">02</span>
                <span>Simultaneously import math diagrams, paper clippings, worksheets, or long PDF modules.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-500 font-extrabold">03</span>
                <span>Exports completely in print vector PDF format, standard Word documents, or light plaintext Markdown sheets.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Output Side */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-150/80 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col min-h-[550px]">
            {/* Nav and exports menu */}
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-950/20">
              <div className="flex bg-zinc-100/80 dark:bg-zinc-950 p-1 rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className={cn(
                    "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTab === 'active' 
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" 
                      : "text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-350"
                  )}
                >
                  <Sparkles size={13} className={activeTab === 'active' ? "text-indigo-500" : ""} />
                  Active Guide
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('library')}
                  className={cn(
                    "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTab === 'library' 
                      ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" 
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-350"
                  )}
                >
                  <FolderOpen size={13} className={activeTab === 'library' ? "text-indigo-500" : ""} />
                  Notes Library ({savedNotes.length})
                </button>
              </div>

              {/* Exports panel */}
              {activeTab === 'active' && notes && (
                <div className="relative flex gap-2 self-end">
                  <button 
                    onClick={copyToClipboard}
                    className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-750 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all text-zinc-650 dark:text-zinc-300 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Clipboard size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>

                  <div className="relative">
                    <button 
                      onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                      className="p-2.5 bg-indigo-600 border border-indigo-700 text-white rounded-xl hover:bg-indigo-505 transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest cursor-pointer"
                    >
                      <Download size={14} />
                      Export Document
                    </button>

                    <AnimatePresence>
                      {exportDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setExportDropdownOpen(false)} />
                          <motion.div 
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-xl py-2 z-20 overflow-hidden font-extrabold text-[10px] uppercase tracking-wider text-zinc-750 dark:text-zinc-350"
                          >
                            <button
                              onClick={() => { exportAsPdf(); setExportDropdownOpen(false); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all flex items-center gap-2 text-zinc-905 dark:text-white"
                            >
                              <span>🖨️ PDF Document (.pdf)</span>
                            </button>
                            <button
                              onClick={() => { exportAsMsWord(); setExportDropdownOpen(false); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex items-center gap-2 text-zinc-905 dark:text-white"
                            >
                              <span>📑 MS Word (.docx)</span>
                            </button>
                            <button
                              onClick={() => { exportAsMarkdown(); setExportDropdownOpen(false); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors flex items-center gap-2 text-zinc-905 dark:text-white"
                            >
                              <span>📝 Markdown (.md)</span>
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {activeTab === 'library' && savedNotes.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm("Do you want to clear your local historic collection completely? This cannot be undone.")) {
                      setSavedNotes([]);
                      localStorage.setItem('STUDENT_SAVED_NOTES_TAGGED', JSON.stringify([]));
                      setActiveNoteId(null);
                      setNotes('');
                    }
                  }}
                  className="px-3.5 py-2 border border-red-200 dark:border-red-900/40 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 text-[9px] font-black uppercase tracking-wider transition-all self-end cursor-pointer"
                >
                  Wipe library
                </button>
              )}
            </div>

            {/* Render view of active study sheet */}
            {activeTab === 'active' && (
              <div className="flex-1 flex flex-col min-h-0">
                {notes && activeNoteId && (
                  <div className="mx-5 my-3 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none flex items-center gap-1">
                        <Info size={11} /> Classification Badges
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <span className={cn("px-2.5 py-0.5 text-[9px] font-black rounded-full border uppercase leading-relaxed", getSubjectBadgeStyle(savedNotes.find(n => n.id === activeNoteId)?.subject || ''))}>
                          {savedNotes.find(n => n.id === activeNoteId)?.subject}
                        </span>
                        <span className={cn("px-2.5 py-0.5 text-[9px] font-black rounded-full border uppercase flex items-center gap-1", IMPORTANCE_CLASSES[savedNotes.find(n => n.id === activeNoteId)?.importance || 'Medium'])}>
                          <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                            savedNotes.find(n => n.id === activeNoteId)?.importance === 'High' ? 'bg-red-500' :
                            savedNotes.find(n => n.id === activeNoteId)?.importance === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                          )} />
                          {savedNotes.find(n => n.id === activeNoteId)?.importance} Priority
                        </span>
                      </div>
                    </div>

                    {/* Metadata editor widget */}
                    <div className="flex items-center gap-2 pt-1 md:pt-0">
                      <div className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Modify Tags:</div>
                      <div className="flex gap-1.5">
                        <select
                          value={savedNotes.find(n => n.id === activeNoteId)?.subject || ''}
                          onChange={(e) => {
                            const active = savedNotes.find(n => n.id === activeNoteId);
                            if (active) handleUpdateActiveNoteTags(e.target.value, active.importance);
                          }}
                          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-705 outline-none rounded-xl px-2 py-1 text-[9px] font-bold uppercase text-zinc-700 dark:text-zinc-300 transition-all focus:ring-2 focus:ring-indigo-500"
                        >
                          {PRESET_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                          {!PRESET_SUBJECTS.includes(savedNotes.find(n => n.id === activeNoteId)?.subject || '') && (
                            <option value={savedNotes.find(n => n.id === activeNoteId)?.subject}>
                              {savedNotes.find(n => n.id === activeNoteId)?.subject} (Custom)
                            </option>
                          )}
                        </select>

                        <select
                          value={savedNotes.find(n => n.id === activeNoteId)?.importance || 'Medium'}
                          onChange={(e) => {
                            const active = savedNotes.find(n => n.id === activeNoteId);
                            if (active) handleUpdateActiveNoteTags(active.subject, e.target.value as any);
                          }}
                          className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-705 outline-none rounded-xl px-2 py-1 text-[9px] font-bold uppercase text-zinc-700 dark:text-zinc-300 transition-all focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="High">🔴 High</option>
                          <option value="Medium">🟡 Medium</option>
                          <option value="Low">🟢 Low</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                 <div className="flex-1 overflow-auto p-6 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed markdown-container animate-fade-in">
                  {notes && (
                    <div className="mb-4 pb-3 border-b border-zinc-150 dark:border-zinc-805 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-zinc-450 tracking-wider">Generated Study Guide</span>
                      <span className="text-[9px] px-2.5 py-1 font-black bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-450 rounded-full uppercase">
                        Subject: {savedNotes.find(n => n.id === activeNoteId)?.subject || (subject === 'Custom' ? (customSubject || 'Custom') : subject)}
                      </span>
                    </div>
                  )}
                  {notes ? (
                    <div className="markdown-body prose dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{preprocessLaTeX(notes)}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="h-full py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-55 px-6">
                      <div className="w-16 h-16 bg-indigo-50 dark:bg-zinc-850 rounded-3xl flex items-center justify-center text-indigo-500">
                        <FileText size={32} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-wider text-zinc-805 dark:text-white">Active study notes will compile here</p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 max-w-sm mt-0.5">Enter textbook readings, attach illustrations, choose study compilers, and select languages to compile structured revision material.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Render view of historical guides */}
            {activeTab === 'library' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 bg-zinc-50/75 dark:bg-zinc-950/40 border-b border-zinc-150 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-3">
                  
                  <div className="md:col-span-4 relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search compiled notes..."
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-900 dark:text-white outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <select
                      value={filterSubject}
                      onChange={(e) => setFilterSubject(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 outline-none transition-all font-bold"
                    >
                      <option value="All">All Subjects ({savedNotes.length})</option>
                      {PRESET_SUBJECTS.map(s => {
                        const count = savedNotes.filter(n => n.subject === s).length;
                        return <option key={s} value={s}>{s} ({count})</option>;
                      })}
                      {savedNotes.some(n => !PRESET_SUBJECTS.includes(n.subject)) && (
                        <option value="Other">Specialty Tag Matches</option>
                      )}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <select
                      value={filterImportance}
                      onChange={(e) => setFilterImportance(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 outline-none transition-all font-bold"
                    >
                      <option value="All">All Priorities</option>
                      <option value="High">🔴 High Importance</option>
                      <option value="Medium">🟡 Medium Importance</option>
                      <option value="Low">🟢 Low Importance</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-2 text-xs text-zinc-700 dark:text-zinc-300 outline-none transition-all font-bold"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filteredNotes.length > 0 ? (
                      filteredNotes.map((note) => (
                        <motion.div
                          key={note.id}
                          layout
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          onClick={() => loadSavedNote(note)}
                          className={cn(
                            "group p-4 bg-zinc-50/50 hover:bg-neutral-50 dark:bg-zinc-950/30 dark:hover:bg-zinc-950/70 border rounded-2xl transition-all cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 active:scale-[0.99]",
                            activeNoteId === note.id ? "border-indigo-500 shadow-sm" : "border-zinc-150 dark:border-zinc-850"
                          )}
                        >
                          <div className="space-y-1.5 flex-1 w-full min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white group-hover:text-indigo-500 dark:group-hover:text-indigo-400 truncate transition-colors uppercase leading-none">
                                {note.title}
                              </h4>
                              {activeNoteId === note.id && (
                                <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-black px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider shrink-0">
                                  Loaded
                                </span>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn("px-2 py-0.5 text-[8px] font-black rounded border uppercase leading-relaxed", getSubjectBadgeStyle(note.subject))}>
                                {note.subject}
                              </span>
                              <span className={cn("px-2 py-0.5 text-[8px] font-black rounded border uppercase flex items-center gap-1", IMPORTANCE_CLASSES[note.importance])}>
                                <span className={cn("w-1 h-1 rounded-full", 
                                  note.importance === 'High' ? 'bg-red-500' :
                                  note.importance === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                                )} />
                                {note.importance}
                              </span>
                              <span className="text-[9px] text-zinc-400 font-bold flex items-center gap-1">
                                <Calendar size={10} />
                                {new Date(note.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 sm:self-center self-end">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); loadSavedNote(note); }}
                              className="p-2 text-zinc-450 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-xl transition-all"
                              title="Load study guide"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => deleteSavedNote(e, note.id)}
                              className="p-2 text-zinc-450 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                              title="Delete guide"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-zinc-800 flex items-center justify-center text-indigo-500 shrink-0">
                          <FileText size={22} />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">No notes found</p>
                          <p className="text-[10px] text-zinc-455 dark:text-zinc-500 max-w-sm mt-1 mx-auto leading-relaxed font-semibold">
                            {savedNotes.length === 0 
                              ? "Your Study Notes library is currently empty. Get started by populating reading notes on structural studies."
                              : "No saved notes match your active filter categories. Alter your filter query sets."}
                          </p>
                        </div>
                        
                        {savedNotes.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setFilterSubject('All');
                              setFilterImportance('All');
                            }}
                            className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-250 text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all"
                          >
                            Reset filters
                          </button>
                        )}
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
