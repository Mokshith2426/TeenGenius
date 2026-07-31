import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, Sparkles, User, Bot, Loader2, Image as ImageIcon, X,
  BookOpen, GraduationCap, CheckCircle2, ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { safeFetch } from '../lib/api';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp?: any;
}

export default function HomeworkSolver() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [subject, setSubject] = useState('General');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subjects = [
    'General', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
    'English', 'History', 'Geography', 'Computer Science', 'Economics'
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input || 'Please solve this homework problem',
      timestamp: new Date()
    };

    if (imagePreview) {
      userMessage.image = imagePreview;
    }

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedFile(null);
    setImagePreview(null);
    setIsLoading(true);

    try {
      let finalImageUrl: string | null = null;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await safeFetch('/api/upload', {
          method: 'POST',
          body: formData,
          timeout: 25000
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalImageUrl = uploadData.url;
        }
      }

      const response = await safeFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input || 'Please help me solve this homework problem step by step',
          history: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          })),
          image: finalImageUrl ? { url: finalImageUrl } : undefined
        }),
        timeout: 45000
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get solution');
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.text,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Save to Firestore if user is logged in
      if (user && !user.uid.includes('sandbox')) {
        try {
          await addDoc(collection(db, 'homeworkSolutions'), {
            userId: user.uid,
            question: input,
            solution: data.text,
            subject,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          console.error('Failed to save homework solution:', err);
        }
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage: Message = {
        role: 'assistant',
        content: `⚠️ **Error**: ${err.message || 'Failed to solve homework. Please try again.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 4 * 1024 * 1024) {
        alert('Image too large. Please select a file under 4MB.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setImagePreview(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest">
          <BookOpen size={12} /> AI Homework Solver
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">
          Homework Solver
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-xs md:text-sm max-w-2xl">
          Upload images of your homework problems or type them out. Get step-by-step solutions with detailed explanations.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-150/70 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <GraduationCap size={13} /> Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500 rounded-2xl px-3 py-2.5 text-xs text-zinc-900 dark:text-white outline-none font-bold"
              >
                {subjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-2xl space-y-2">
              <h3 className="text-xs font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={14} /> How to Use
              </h3>
              <ul className="space-y-1.5 text-[11px] text-blue-800 dark:text-blue-300 font-semibold leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-blue-600 font-extrabold">01</span>
                  <span>Select your subject area</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-extrabold">02</span>
                  <span>Type or upload your homework question</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-extrabold">03</span>
                  <span>Get step-by-step solutions with explanations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-8">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-150/80 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full py-20 flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-zinc-800 rounded-3xl flex items-center justify-center text-blue-500">
                    <BookOpen size={32} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-white">
                      Ready to solve homework
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500 max-w-sm">
                      Type your question or upload an image to get started with step-by-step solutions
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex gap-3 max-w-[90%]",
                      message.role === 'user' ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                      message.role === 'user' ? "bg-zinc-900 text-white" : "bg-blue-600 text-white"
                    )}>
                      {message.role === 'user' ? <User size={14} /> : <Sparkles size={14} />}
                    </div>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      message.role === 'user'
                        ? "bg-zinc-900 text-white rounded-tr-none"
                        : "bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none"
                    )}>
                      {message.image && (
                        <img
                          src={message.image}
                          alt="Uploaded"
                          className="max-w-full h-auto rounded-xl mb-3 border border-white/10"
                        />
                      )}
                      <MarkdownRenderer content={message.content} />
                    </div>
                  </motion.div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 animate-pulse">
                    <Sparkles size={14} />
                  </div>
                  <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl rounded-tl-none">
                    <div className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-blue-600" />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold">
                        Solving problem...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-zinc-100 dark:border-zinc-800 p-4">
              {imagePreview && (
                <div className="relative inline-block mb-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-20 w-20 object-cover rounded-xl border-2 border-zinc-200 dark:border-zinc-700"
                  />
                  <button
                    onClick={clearFile}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all text-zinc-600 dark:text-zinc-400"
                  title="Upload image"
                >
                  <ImageIcon size={18} />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      handleSend();
                    }
                  }}
                  placeholder="Type your homework question here..."
                  className="flex-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !selectedFile) || isLoading}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send size={14} />
                  Solve
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}