/**
 * CreateNotes — the central study-notes experience.
 *
 * Flow: SOURCE -> GENERATE -> NOTES.
 *
 * Sources:
 *   - Link : YouTube URL (server-side transcript) or article/blog URL
 *            (server-side readable-text extraction). The browser never
 *            scrapes, and the URL is never handed to the LLM as-is.
 *   - File : the image/PDF uploads the Notes Lab already supported.
 *   - Text : pasted study material.
 *
 * Reuses the existing Notes Lab infrastructure: the same /api/ai/notes
 * pipeline, the same Firestore `notesLab` collection, the same localStorage
 * fallback, and the same copy/download exports.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Link2, FileText, Type, Upload, Sparkles, Loader2, Copy, Check, Download,
  Trash2, X, Search, Library, AlertCircle, Youtube, Globe, Plus, ChevronDown,
  ExternalLink, Info,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { safeFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import {
  collection, addDoc, query, where, orderBy, onSnapshot, doc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import MarkdownRenderer from '../components/MarkdownRenderer';

type SourceMode = 'link' | 'file' | 'text';

interface SavedNote {
  id: string;
  title: string;
  notes: string;
  subject: string;
  sourceType: string;
  sourceUrl: string;
  sourceTitle: string;
  createdAt: string;
}

interface UploadedFile {
  name: string;
  mimeType: string;
  data: string; // base64, no data-url prefix
  url?: string; // object URL for image previews
}

interface SourceMeta {
  type: 'youtube' | 'article' | 'text' | 'file';
  label: string;
  title: string;
  url: string;
  chars?: number;
}

const STORAGE_KEY = 'TEEN_GENIUS_SAVED_NOTES';
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

/** Advanced styles live behind "More options" — never the default screen. */
const NOTE_STYLES = [
  { value: 'Short Notes', label: 'Short Notes (default)' },
  { value: 'Revision Notes', label: 'Revision + memory hooks' },
  { value: 'Last-minute Exam Notes', label: 'Last-minute exam sheet' },
  { value: 'Detailed Notes', label: 'Detailed study notes' },
  { value: 'Topic-wise Notes', label: 'Topic-wise breakdown' },
  { value: 'Teacher-style Notes', label: 'Teacher-style explanation' },
];

const STAGES = [
  { key: 'fetching', label: 'Reading the source' },
  { key: 'writing', label: 'Writing your notes' },
];

const tabCls =
  'flex-1 min-h-[44px] px-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5';

export default function CreateNotes() {
  const { user, isGuest } = useAuth();

  const [mode, setMode] = useState<SourceMode>('link');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showOptions, setShowOptions] = useState(false);
  const [noteStyle, setNoteStyle] = useState('Short Notes');
  const [focus, setFocus] = useState('');

  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState<SourceMeta | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [search, setSearch] = useState('');
  const [showLibrary, setShowLibrary] = useState(false);

  const isGenerating = stage !== null;
  const inFlightRef = useRef(false);
  const fileUrlsRef = useRef<string[]>([]);

  // ── Saved notes (Firestore + local fallback) ─────────────────────────────
  const loadLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedNotes(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const persistLocal = useCallback((list: SavedNote[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* quota / private mode */
    }
  }, []);

  useEffect(() => {
    if (!user || isGuest) {
      loadLocal();
      return;
    }
    const q = query(
      collection(db, 'notesLab'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: SavedNote[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || 'Untitled',
            notes: data.notes || '',
            subject: data.subject || 'General',
            sourceType: data.sourceType || 'text',
            sourceUrl: data.sourceUrl || '',
            sourceTitle: data.sourceTitle || '',
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : data.createdAt || new Date().toISOString(),
          };
        });
        setSavedNotes(list);
        persistLocal(list);
      },
      () => loadLocal(), // Firestore unavailable -> local library
    );
    return () => unsubscribe();
  }, [user, isGuest, loadLocal, persistLocal]);

  // Revoke preview object URLs on unmount.
  useEffect(
    () => () => {
      fileUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    },
    [],
  );

  // ── Source validation (mirrors the server rules, for instant feedback) ───
  const looksLikeUrl = useMemo(
    () =>
      /^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim()) ||
      /^[\w-]+(\.[\w-]+)+([/?#].*)?$/i.test(url.trim()),
    [url],
  );

  const urlHint = useMemo(() => {
    const raw = url.trim();
    if (!raw) return null;
    if (!looksLikeUrl) {
      return { tone: 'error' as const, text: 'That does not look like a link. Paste a full URL.' };
    }
    if (/(^|\/\/)(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|\[?::1\]?)/i.test(raw)) {
      return { tone: 'error' as const, text: 'Private and local addresses cannot be opened.' };
    }
    if (/youtu\.?be|youtube\.com/i.test(raw)) {
      return { tone: 'ok' as const, text: 'YouTube link detected — we will read the video transcript.' };
    }
    return { tone: 'ok' as const, text: 'Article link detected — we will extract the readable text.' };
  }, [url, looksLikeUrl]);

  const canGenerate =
    !isGenerating &&
    (mode === 'link'
      ? looksLikeUrl && !!url.trim()
      : mode === 'file'
        ? files.length > 0
        : text.trim().length > 0);

  // ── Files ────────────────────────────────────────────────────────────────
  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;

    const usable = Array.from(list).filter(
      (f) => ACCEPTED_FILE_TYPES.includes(f.type) && f.size <= MAX_FILE_BYTES,
    );
    if (usable.length !== list.length) {
      setError('Some files were skipped. Use images (JPEG, PNG, WEBP, GIF) or a PDF under 8MB.');
      setErrorCode('UNSUPPORTED_FILE');
    } else {
      setError(null);
      setErrorCode(null);
    }
    if (usable.length === 0) return;

    const added = usable.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      fileUrlsRef.current.push(previewUrl);
      return { name: file.name, mimeType: file.type, data: '', url: previewUrl };
    });

    setMode('file');
    setFiles((prev) => [...prev, ...added]);

    // Files are read into memory for the multipart upload (same as the old lab).
    usable.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = String(reader.result || '');
        const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        setFiles((prev) => {
          const idx = prev.findIndex((f) => f.name === file.name && !f.data);
          if (idx === -1) return prev;
          const copy = [...prev];
          copy[idx] = { ...copy[idx], data: base64 };
          return copy;
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const target = prev[idx];
      if (target?.url) {
        URL.revokeObjectURL(target.url);
        fileUrlsRef.current = fileUrlsRef.current.filter((u) => u !== target.url);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  // ── Title derivation ─────────────────────────────────────────────────────
  const deriveTitle = (generated: string, fallbackUrl: string) => {
    const heading = generated.match(/^#\s+(.+)$/m)?.[1]?.trim();
    if (heading && heading.length > 2) return heading.replace(/[*_#`:]/g, '').slice(0, 120);
    if (fallbackUrl) {
      try {
        return new URL(fallbackUrl).hostname.replace(/^www\./, '');
      } catch {
        return fallbackUrl.slice(0, 60);
      }
    }
    const firstLine = text.trim().split('\n')[0]?.replace(/[#*`_:]/g, '').trim();
    return firstLine ? firstLine.slice(0, 60) : 'Study Notes';
  };

  // ── Persistence for a finished note ──────────────────────────────────────
  const saveNote = async (record: Omit<SavedNote, 'id' | 'createdAt'>) => {
    if (user && !isGuest) {
      try {
        const ref = await addDoc(collection(db, 'notesLab'), {
          ...record,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        setActiveNoteId(ref.id);
        return;
      } catch (err) {
        console.warn('[CreateNotes] Cloud save failed, using local library:', err);
      }
    }
    const localId = `note_${Date.now()}`;
    const next = [{ ...record, id: localId, createdAt: new Date().toISOString() }, ...savedNotes];
    setSavedNotes(next);
    persistLocal(next);
    setActiveNoteId(localId);
  };

  // ── Generate: LINK ───────────────────────────────────────────────────────
  const generateFromLink = async (trimmedUrl: string) => {
    setStage(STAGES[0].key);
    const response = await safeFetch('/api/ai/notes/from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmedUrl, noteStyle, focus, subject: 'Auto-Detect' }),
      timeout: 60000,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      setError(data?.error || 'We could not turn that link into notes.');
      setErrorCode(data?.code || 'URL_FAILED');
      return;
    }

    setStage(STAGES[1].key);
    const generated = data.notes || '';
    const meta: SourceMeta = {
      type: data.source?.type === 'youtube' ? 'youtube' : 'article',
      label: data.source?.label || 'Article',
      title: data.source?.title || 'Source',
      url: data.source?.url || trimmedUrl,
      chars: data.source?.chars,
    };
    setSource(meta);
    setNotes(generated);
    await saveNote({
      title: deriveTitle(generated, meta.url),
      notes: generated,
      subject: 'General',
      sourceType: meta.type,
      sourceUrl: meta.url,
      sourceTitle: meta.title,
    });
  };

  // ── Generate: TEXT / FILE ────────────────────────────────────────────────
  const generateFromMaterial = async () => {
    setStage(STAGES[1].key);
    const form = new FormData();
    form.append('content', mode === 'text' ? text : '');
    form.append('focus', focus);
    form.append('noteStyle', noteStyle);
    form.append('summaryLength', 'Standard');
    form.append('subject', 'Auto-Detect');
    files.forEach((file) => {
      const binary = atob(file.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      form.append('files', new Blob([bytes], { type: file.mimeType }), file.name);
    });

    const response = await safeFetch('/api/ai/notes', {
      method: 'POST',
      body: form,
      timeout: 60000,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.error) {
      setError(data?.error || 'We could not build notes from that material.');
      setErrorCode(data?.code || 'NOTES_FAILED');
      return;
    }

    const generated = data.notes || '';
    const meta: SourceMeta =
      mode === 'text'
        ? {
            type: 'text',
            label: 'Pasted text',
            title: text.trim().split('\n')[0]?.slice(0, 80) || 'Pasted text',
            url: '',
          }
        : {
            type: 'file',
            label: files.length === 1 ? 'Uploaded file' : `${files.length} files`,
            title: files.length === 1 ? files[0].name : `${files.length} study files`,
            url: '',
          };
    setSource(meta);
    setNotes(generated);
    await saveNote({
      title: deriveTitle(generated, ''),
      notes: generated,
      subject: 'General',
      sourceType: meta.type,
      sourceUrl: '',
      sourceTitle: meta.title,
    });
  };

  const generate = async () => {
    if (!canGenerate || inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setErrorCode(null);
    setNotes('');
    setSource(null);
    setActiveNoteId(null);

    try {
      if (mode === 'link') await generateFromLink(url.trim());
      else await generateFromMaterial();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong while generating notes.');
      setErrorCode('NOTES_FAILED');
    } finally {
      setStage(null);
      inFlightRef.current = false;
    }
  };

  const reset = () => {
    setNotes('');
    setSource(null);
    setError(null);
    setErrorCode(null);
    setActiveNoteId(null);
  };

  // ── Exports ──────────────────────────────────────────────────────────────
  const copyNotes = async () => {
    if (!notes) return;
    try {
      await navigator.clipboard.writeText(notes);
    } catch {
      // Clipboard API can be blocked (insecure context / permissions).
      const ta = document.createElement('textarea');
      ta.value = notes;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* nothing else to try */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadNotes = () => {
    if (!notes) return;
    const header = source
      ? `> Source: ${source.title}${source.url ? ` — ${source.url}` : ''}\n\n`
      : '';
    const blob = new Blob([`# ${source?.title || 'Study Notes'}\n\n${header}${notes}\n`], {
      type: 'text/markdown;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    const slug = (source?.title || 'study-notes')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    link.download = `${slug || 'study-notes'}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const openSavedNote = (note: SavedNote) => {
    setNotes(note.notes);
    setActiveNoteId(note.id);
    setSource({
      type: (note.sourceType as SourceMeta['type']) || 'text',
      label:
        note.sourceType === 'youtube'
          ? 'YouTube video'
          : note.sourceType === 'article'
            ? 'Article'
            : note.sourceType === 'file'
              ? 'Uploaded file'
              : 'Pasted text',
      title: note.sourceTitle || note.title,
      url: note.sourceUrl || '',
    });
    setShowLibrary(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteSavedNote = async (id: string) => {
    const next = savedNotes.filter((n) => n.id !== id);
    setSavedNotes(next);
    persistLocal(next);
    if (activeNoteId === id) reset();
    if (user && !isGuest && !id.startsWith('note_')) {
      try {
        await deleteDoc(doc(db, 'notesLab', id));
      } catch (err) {
        console.warn('[CreateNotes] Delete failed:', err);
      }
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? savedNotes.filter(
          (n) =>
            n.title.toLowerCase().includes(term) ||
            n.notes.toLowerCase().includes(term) ||
            (n.sourceTitle || '').toLowerCase().includes(term),
        )
      : savedNotes;
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [savedNotes, search]);

  const stageIndex = STAGES.findIndex((s) => s.key === stage);
  const stageLabel = stageIndex >= 0 ? STAGES[stageIndex].label : null;

  const SourceIcon = source
    ? source.type === 'youtube'
      ? Youtube
      : source.type === 'article'
        ? Globe
        : source.type === 'file'
          ? FileText
          : Type
    : FileText;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4 sm:pt-6">
      <header className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
          Create Notes
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Paste a link, drop a file, or type your notes. You get short, revision-ready notes.
        </p>
      </header>

      {/* ── Source picker ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div
          className="flex gap-1.5 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-950"
          role="tablist"
          aria-label="Source type"
        >
          {([
            { key: 'link', icon: Link2, label: 'Link' },
            { key: 'file', icon: Upload, label: 'File' },
            { key: 'text', icon: Type, label: 'Text' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={mode === tab.key}
              onClick={() => setMode(tab.key)}
              className={cn(
                tabCls,
                mode === tab.key
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-500 dark:text-zinc-400',
              )}
            >
              <tab.icon size={15} /> {tab.label}
            </button>
          ))}
        </div>

        {mode === 'link' && (
          <div className="mt-4 space-y-2">
            <label
              htmlFor="source-url"
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-300"
            >
              YouTube or article link
            </label>
            <div className="relative">
              <Link2
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                id="source-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                className="min-h-[48px] w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 pl-9 pr-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-blue-500 dark:focus:bg-zinc-900"
              />
            </div>
            {urlHint && (
              <p
                className={cn(
                  'flex items-start gap-1.5 text-xs',
                  urlHint.tone === 'error'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-zinc-500 dark:text-zinc-400',
                )}
              >
                {urlHint.tone === 'error' ? (
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                ) : (
                  <Info size={13} className="mt-0.5 shrink-0" />
                )}
                <span>{urlHint.text}</span>
              </p>
            )}
            <p className="flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-blue-500" />
              <span>
                For YouTube we read the public transcript. If captions are unavailable we
                tell you instead of guessing.
              </span>
            </p>
          </div>
        )}

        {mode === 'file' && (
          <div className="mt-4 space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              role="button"
              tabIndex={0}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors',
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/25'
                  : 'border-zinc-200 hover:border-blue-400 dark:border-zinc-800 dark:hover:border-zinc-600',
              )}
            >
              <Upload size={22} className="text-zinc-400" />
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                Tap to upload, or drop files here
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Images (JPEG, PNG, WEBP, GIF) or PDF · up to 8MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES.join(',')}
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((file, i) => (
                  <li
                    key={file.url ?? `${file.name}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
                  >
                    {file.mimeType.startsWith('image/') && file.url ? (
                      <img src={file.url} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                        <FileText size={16} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {file.name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {file.data ? 'Ready' : 'Reading…'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      aria-label={`Remove ${file.name}`}
                      className="min-h-[40px] min-w-[40px] rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === 'text' && (
          <div className="mt-4 space-y-2">
            <label
              htmlFor="source-text"
              className="text-xs font-semibold text-zinc-600 dark:text-zinc-300"
            >
              Paste your study material
            </label>
            <textarea
              id="source-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Chapter text, a textbook paragraph, a teacher's summary…"
              rows={7}
              className="w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm leading-relaxed text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:focus:border-blue-500 dark:focus:bg-zinc-900"
            />
            <p className="text-right text-xs text-zinc-400 dark:text-zinc-500">
              {text.trim().length} characters
            </p>
          </div>
        )}

        {/* Advanced options — collapsed by default */}
        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            aria-expanded={showOptions}
            className="flex min-h-[40px] w-full items-center justify-between rounded-lg px-1 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <span className="flex items-center gap-1.5">
              More options
              {noteStyle !== 'Short Notes' && (
                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  1 set
                </span>
              )}
            </span>
            <ChevronDown size={15} className={cn('transition-transform', showOptions && 'rotate-180')} />
          </button>

          <AnimatePresence initial={false}>
            {showOptions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="opt-style"
                      className="text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                    >
                      Note style
                    </label>
                    <select
                      id="opt-style"
                      value={noteStyle}
                      onChange={(e) => setNoteStyle(e.target.value)}
                      className="min-h-[44px] w-full cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                    >
                      {NOTE_STYLES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="opt-focus"
                      className="text-xs font-semibold text-zinc-600 dark:text-zinc-300"
                    >
                      Focus on (optional)
                    </label>
                    <input
                      id="opt-focus"
                      type="text"
                      value={focus}
                      onChange={(e) => setFocus(e.target.value)}
                      placeholder="e.g. exam formulas, step-by-step method"
                      className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white dark:placeholder:text-zinc-500"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Primary action */}
        <button
          type="button"
          onClick={generate}
          disabled={!canGenerate}
          className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {stageLabel || 'Working…'}
            </>
          ) : (
            <>
              <Sparkles size={16} /> Generate short notes
            </>
          )}
        </button>

        {isGenerating && (
          <div className="mt-3 space-y-1.5" aria-live="polite">
            {STAGES.map((s, i) => {
              const done = stageIndex > i;
              const active = stageIndex === i;
              return (
                <div key={s.key} className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-colors',
                      done
                        ? 'bg-emerald-500'
                        : active
                          ? 'animate-pulse bg-blue-500'
                          : 'bg-zinc-300 dark:bg-zinc-700',
                    )}
                  />
                  <span
                    className={
                      done || active
                        ? 'text-zinc-700 dark:text-zinc-200'
                        : 'text-zinc-400 dark:text-zinc-600'
                    }
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Errors */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/25"
            >
              <p className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
              {errorCode === 'YOUTUBE_NO_TRANSCRIPT' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('text');
                    setError(null);
                    setErrorCode(null);
                  }}
                  className="mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:bg-zinc-900 dark:text-rose-300 dark:hover:bg-rose-900/40"
                >
                  <Plus size={13} /> Paste the transcript instead
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {notes && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5"
        >
          {source && (
            <div className="mb-3 flex items-start gap-2.5 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mt-0.5 shrink-0 rounded-lg bg-blue-50 p-1.5 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <SourceIcon size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {source.label}
                </p>
                <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {source.title}
                </p>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <span className="truncate">{source.url}</span>
                    <ExternalLink size={11} className="shrink-0" />
                  </a>
                )}
              </div>
              {activeNoteId && (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  Saved
                </span>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <MarkdownRenderer content={notes} />
          </div>

          <div className="sticky bottom-24 z-10 mt-3 flex gap-2 lg:bottom-4">
            <button
              type="button"
              onClick={copyNotes}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 transition-colors active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={downloadNotes}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 transition-colors active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            >
              <Download size={16} /> Download
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label="Start a new note"
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl bg-zinc-900 text-white transition-colors active:scale-[0.98] dark:bg-white dark:text-zinc-900"
            >
              <Plus size={17} />
            </button>
          </div>
        </motion.section>
      )}

      {/* ── Saved notes library ──────────────────────────────────────── */}
      <section className="mt-6">
        <button
          type="button"
          onClick={() => setShowLibrary((v) => !v)}
          aria-expanded={showLibrary}
          className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-1 text-sm font-bold text-zinc-700 dark:text-zinc-300"
        >
          <span className="flex items-center gap-2">
            <Library size={16} /> Saved notes
            {savedNotes.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {savedNotes.length}
              </span>
            )}
          </span>
          <ChevronDown size={16} className={cn('transition-transform', showLibrary && 'rotate-180')} />
        </button>

        <AnimatePresence initial={false}>
          {showLibrary && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-3">
                {savedNotes.length > 2 && (
                  <div className="relative">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search saved notes"
                      className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    />
                  </div>
                )}

                {filtered.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    {savedNotes.length === 0
                      ? 'Notes you generate are saved here automatically.'
                      : 'No saved notes match that search.'}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {filtered.map((note) => (
                      <li key={note.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openSavedNote(note)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') openSavedNote(note);
                          }}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-3.5 transition-colors active:scale-[0.99] dark:bg-zinc-900',
                            activeNoteId === note.id
                              ? 'border-blue-500 dark:border-blue-600'
                              : 'border-zinc-200 dark:border-zinc-800',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                              {note.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {new Date(note.createdAt).toLocaleDateString()}
                              {note.sourceTitle ? ` · ${note.sourceTitle}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSavedNote(note.id);
                            }}
                            aria-label={`Delete ${note.title}`}
                            className="min-h-[40px] min-w-[40px] rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
