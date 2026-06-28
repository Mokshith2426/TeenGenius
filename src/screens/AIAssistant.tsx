import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, Sparkles, User, Bot, Loader2, Image as ImageIcon, X, List, History, Plus, Trash2, MessageSquare, PanelLeftOpen, PanelLeftClose, ChevronLeft, Check, CheckCheck, Copy, Trophy, Award, ArrowRight, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn, preprocessLaTeX } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, writeBatch, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { formatTime } from '../lib/dateUtils';
import { safeFetch, getApiUrl } from '../lib/api';
import { awardGamificationPoints } from '../lib/gamification';

import Logo from '../components/Logo';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  timestamp?: any;
  status?: 'sending' | 'delivered' | 'read' | 'processed';
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  lastUpdatedAt: any;
}

export default function AIAssistant() {
  const { user, isGuest, triggerGuestPrompt } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [gamificationAlert, setGamificationAlert] = useState<{ xp: number; badges: string[] } | null>(null);
  const [streamResponse, setStreamResponse] = useState(true);

  // Voice Input (Speech to Text) States
  const [speechState, setSpeechState] = useState<'idle' | 'listening' | 'processing' | 'completed' | 'error'>('idle');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        } catch (err) {}
      }
    };
  }, []);

  const startSpeechRecognition = async () => {
    try {
      console.log("[SPEECH]: Requesting microphone device authorization...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setSpeechState('listening');
      setSpeechError(null);
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; 
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setSpeechState('processing');
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            try {
              const base64Data = (reader.result as string).split(',')[1];
              const response = await safeFetch('/api/gemini/transcribe', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  audioData: base64Data,
                  mimeType: mimeType || 'audio/webm'
                })
              });

              if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to transcribe audio clip");
              }

              const result = await response.json();
              if (result.transcript && result.transcript.trim()) {
                setInput(result.transcript.trim());
                setSpeechState('completed');
              } else {
                setSpeechState('error');
                setSpeechError('Transcribed text was empty. Please speak clearer next time.');
              }
            } catch (err: any) {
              console.error("Transcription pipeline error:", err);
              setSpeechState('error');
              setSpeechError(err.message || 'Error occurred during transcription.');
            } finally {
              setTimeout(() => {
                setSpeechState(prev => prev === 'completed' ? 'idle' : prev);
              }, 2000);
            }
          };
        } catch (err: any) {
          console.error("Audio block conversion error:", err);
          setSpeechState('error');
          setSpeechError(err.message || 'Error processing speech.');
        }
      };

      mediaRecorder.start();
    } catch (err: any) {
      console.error("Microphone permission denied:", err);
      setSpeechState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setSpeechError('Microphone permission denied. TeenGenius needs your microphone to record your study query. Please check your browser address bar permissions to allow access.');
      } else {
        setSpeechError('Could not gain audio device interface access: ' + err.message);
      }
    }
  };

  const stopSpeechRecognition = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.warn("Error stopping media recorder:", e);
      }
    }
  };

  const toggleSpeechRecognition = () => {
    if (speechState === 'listening') {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  };

  // Quick Quiz States
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quickQuiz, setQuickQuiz] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const handleOpenQuickQuiz = async () => {
    if (messages.length === 0) return;
    
    setIsQuizOpen(true);
    setQuizLoading(true);
    setQuizError("");
    setQuickQuiz(null);
    setQuizCompleted(false);
    
    try {
      const chatText = messages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');
        
      const response = await safeFetch('/api/gemini/quick-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatText })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate quick quiz.");
      }
      
      if (data.quiz && data.quiz.questions && data.quiz.questions.length > 0) {
        setQuickQuiz(data.quiz);
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setIsAnswerSubmitted(false);
        setQuizScore(0);
        setQuizAnswers([]);
      } else {
        throw new Error("Invalid quiz structure returned from system.");
      }
    } catch (err: any) {
      console.error(err);
      setQuizError(err.message || "An unexpected error occurred while compiling your quiz.");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSelectQuizOption = (index: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(index);
  };

  const handleSubmitQuizAnswer = () => {
    if (selectedOption === null || isAnswerSubmitted || !quickQuiz) return;
    
    setIsAnswerSubmitted(true);
    const question = quickQuiz.questions[currentQuestionIndex];
    const isCorrect = selectedOption === question.correctAnswerIndex;
    
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
    setQuizAnswers(prev => [...prev, selectedOption]);
  };

  const handleNextQuizQuestion = async () => {
    if (!quickQuiz) return;
    
    if (currentQuestionIndex < quickQuiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizCompleted(true);
      
      // Award gamification points for completing the evaluation module
      if (user?.uid && !isGuest) {
        try {
          const res = await awardGamificationPoints(user.uid, 'FINISH_AI_QUIZ');
          if (res.xpAwarded > 0) {
            triggerAlert(res.xpAwarded, res.newBadgesEarned);
          }
        } catch (err) {
          console.warn("Failed to award quiz completion points:", err);
        }
      }
    }
  };

  const triggerAlert = (xp: number, badges: string[]) => {
    setGamificationAlert({ xp, badges });
    setTimeout(() => {
      setGamificationAlert(null);
    }, 4000);
  };
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sessions on mount with offline caching
  useEffect(() => {
    if (!user) return;
    if (isGuest || user.uid.includes('sandbox')) {
      setSessions([]);
      return;
    }

    // Load initial list from local storage cache
    const cachedSessionsRaw = localStorage.getItem(`STUDENT_LOCAL_CHATS_LIST_CACHE_${user.uid}`);
    if (cachedSessionsRaw) {
      try {
        setSessions(JSON.parse(cachedSessionsRaw));
      } catch (err) {
        console.warn("Error parsing cached sessions:", err);
      }
    }

    const q = query(
      collection(db, 'aiChats'),
      where('userId', '==', user.uid),
      orderBy('lastUpdatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
       const s = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
       setSessions(s);
       // Save to local cache
       localStorage.setItem(`STUDENT_LOCAL_CHATS_LIST_CACHE_${user.uid}`, JSON.stringify(s));
    }, (err) => {
       console.error("[FIRESTORE SYSTEM EVENT]: Session snapshot error encountered:", err);
       // Suppress raw throws in event streams to avoid disrupting React rendering
    });

    return () => unsubscribe();
  }, [user, isGuest]);

  // Check for auto-triggered initial prompt from onboarding walkthrough
  const location = useLocation();
  const hasTriggeredInitialPrompt = useRef(false);

  useEffect(() => {
    if (location.state?.initialPrompt && !hasTriggeredInitialPrompt.current) {
      hasTriggeredInitialPrompt.current = true;
      const initialText = location.state.initialPrompt;
      
      // Clear navigation state history
      window.history.replaceState({}, document.title);
      
      setTimeout(() => {
        handleSend(initialText);
      }, 700);
    }
  }, [location.state]);

  // Load pending prompts from interactive landing screen buttons
  useEffect(() => {
    const pendingVal = localStorage.getItem('pending_study_prompt');
    if (pendingVal) {
      localStorage.removeItem('pending_study_prompt');
      setInput(pendingVal);
    }
  }, []);

  // Load messages when currentSessionId changes with offline caching fallback
  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }

    if (currentSessionId.startsWith('local_')) {
      // Keep existing memory messages, don't execute snapshot
      return;
    }

    // Try loading initial messages from local cache first
    const cachedMessagesRaw = localStorage.getItem(`STUDENT_LOCAL_MESSAGES_CACHE_${currentSessionId}`);
    if (cachedMessagesRaw) {
      try {
        setMessages(JSON.parse(cachedMessagesRaw));
      } catch (err) {
        console.warn("Error parsing cached messages:", err);
      }
    }

    console.log("[FIRESTORE SYSTEM EVENT - INITIATING SUBSCRIPTION]: Subscribing to session messages query. Session ID:", currentSessionId);
    const q = query(
      collection(db, 'aiChats', currentSessionId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("[FIRESTORE SYSTEM EVENT - SNAPSHOT RECEIVED]: Syncing data. Documents count:", snapshot.docs.length);
      const m = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      
      // Update local state with latest persisted items
      setMessages(m);
      
      // Stop layout spinning gears or loading overlays safely
      setIsLoading(false);

      // Save to local storage for offline browsing
      localStorage.setItem(`STUDENT_LOCAL_MESSAGES_CACHE_${currentSessionId}`, JSON.stringify(m));
    }, (err) => {
      console.error("[FIRESTORE SYSTEM EVENT]: Messages snapshot error encountered:", err);
      // Safe reset on failure so the screen doesn't lock in spin state
      setIsLoading(false);
    });

    return () => {
      console.log("[FIRESTORE SYSTEM EVENT - TERMINATING SUBSCRIPTION]: Unsubscribing from session:", currentSessionId);
      unsubscribe();
    };
  }, [currentSessionId]);

  // Automated background query synchronization when connection status returns
  useEffect(() => {
    const handleOnline = () => {
      console.log("[CONNECTION STATUS NOTICE]: back online, syncing pending student transcripts...");
      syncOfflineQueue();
    };
    window.addEventListener('online', handleOnline);
    
    // Check synchronization immediately on mount if active connection exists
    if (navigator.onLine) {
      syncOfflineQueue();
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const syncOfflineQueue = async () => {
    const queueRaw = localStorage.getItem('STUDENT_OFFLINE_QUEUED_MESSAGES');
    if (!queueRaw) return;
    try {
      const queue = JSON.parse(queueRaw);
      if (!queue || queue.length === 0) return;
      
      console.log("[SYNC ENGINE]: Transmitting deferred buffers. Total items:", queue.length);
      
      // Clear queue so we don't duplicate
      localStorage.setItem('STUDENT_OFFLINE_QUEUED_MESSAGES', '[]');
      
      // Process sequential uploads
      for (const item of queue) {
        if (item.content) {
          // If we weren't on a session before, use their queued session
          if (item.sessionId && !item.sessionId.startsWith('local_offline_')) {
            setCurrentSessionId(item.sessionId);
          }
          await handleSend(item.content);
        }
      }
    } catch (e) {
      console.error("[SYNC ENGINE ERROR]: Processing queue pipeline issue:", e);
    }
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Instant local scroll adjustment to bottom on key message/state list updates
    container.scrollTop = container.scrollHeight;

    // Maintain position during streaming or late layout updates (like KaTeX math rendering)
    const observer = new ResizeObserver(() => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      // Preserve user's reading position if they're scrolling up or reading previous history.
      // Auto-scroll to show streaming responses only if they're near the bottom.
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [messages, isLoading, streamingText]);

  const createNewSession = async (firstMessage?: string) => {
    if (!user) return null;
    if (isGuest) {
      const tempId = 'local_' + Date.now();
      setCurrentSessionId(tempId);
      return tempId;
    }
    try {
      const docRef = await addDoc(collection(db, 'aiChats'), {
        userId: user.uid,
        title: firstMessage ? (firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage) : 'New Transmission',
        lastMessage: firstMessage || 'Establishing sync...',
        lastUpdatedAt: serverTimestamp()
      });
      setCurrentSessionId(docRef.id);
      return docRef.id;
    } catch (err: any) {
      console.warn("Session creation was buffered locally due to connectivity status:", err);
      // For local fallback, let's generate a temporary session ID so the student is never blocked
      const tempId = 'local_' + Date.now();
      setCurrentSessionId(tempId);
      return tempId;
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Abort this transmission sequence? Data will be purged.')) return;
    try {
      if (currentSessionId === sessionId) setCurrentSessionId(null);
      await deleteDoc(doc(db, 'aiChats', sessionId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `aiChats/${sessionId}`);
    }
  };

  const clearAllHistory = async () => {
    if (!user || !sessions.length) return;
    if (!confirm('Wipe all neural logs? This action is irreversible.')) return;
    
    try {
      const batch = writeBatch(db);
      sessions.forEach(s => {
        batch.delete(doc(db, 'aiChats', s.id));
      });
      await batch.commit();
      setCurrentSessionId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'aiChats (batch)');
    }
  };

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
    if (file.size > 4 * 1024 * 1024) {
      alert("Image too large. Please select a file under 4MB.");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : input;
    if ((!textToSend.trim() && !selectedFile) || isLoading || !user) {
      console.warn("[EXECUTION TRACE - SKIP]: Empty prompt, already loading, or unauthenticated user.");
      return;
    }

    console.log("[EXECUTION TRACE - STEP 1 - USER INPUT]: Input accepted:", {
      textLength: textToSend.length,
      hasFile: !!selectedFile,
      userId: user.uid
    });

    const currentInput = textToSend;
    const currentFile = selectedFile;
    const currentImagePreview = imagePreview;

    setInput('');
    setSelectedFile(null);
    setImagePreview(null);
    setIsLoading(true);

    let sessionId = currentSessionId;

    // Gracefully handle AI Offline with friendly message queueing
    if (!navigator.onLine) {
      console.log("[EXECUTION TRACE - OFFLINE]: Intercepting prompt transmission since system is offline...");
      
      if (!sessionId) {
        sessionId = 'local_offline_' + Date.now();
        setCurrentSessionId(sessionId);
        
        // Add a temporary local session in the sidebar
        const newLocalSession: ChatSession = {
          id: sessionId,
          title: currentInput.length > 30 ? currentInput.substring(0, 30) + '...' : currentInput,
          lastMessage: currentInput,
          lastUpdatedAt: new Date()
        };
        setSessions(prev => [newLocalSession, ...prev]);
        const cachedSessionsRaw = localStorage.getItem(`STUDENT_LOCAL_CHATS_LIST_CACHE_${user.uid}`) || '[]';
        try {
          const s = JSON.parse(cachedSessionsRaw);
          localStorage.setItem(`STUDENT_LOCAL_CHATS_LIST_CACHE_${user.uid}`, JSON.stringify([newLocalSession, ...s]));
        } catch(e){}
      }
      
      const userMsg: Message = {
        id: 'queued_u_' + Date.now(),
        role: 'user',
        content: currentInput,
        status: 'sending',
        timestamp: new Date()
      };
      if (currentImagePreview) {
        userMsg.image = currentImagePreview;
      }
      
      const updatedList = [...messages, userMsg];
      setMessages(updatedList);
      localStorage.setItem(`STUDENT_LOCAL_MESSAGES_CACHE_${sessionId}`, JSON.stringify(updatedList));
      
      // Queue the unsent action in local storage
      const queueRaw = localStorage.getItem('STUDENT_OFFLINE_QUEUED_MESSAGES') || '[]';
      try {
        const queueObj = JSON.parse(queueRaw);
        queueObj.push({
          id: userMsg.id,
          sessionId: sessionId,
          content: currentInput,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('STUDENT_OFFLINE_QUEUED_MESSAGES', JSON.stringify(queueObj));
      } catch(e){}
      
      // Trigger a beautiful, friendly assistant message explaining the situation
      setTimeout(() => {
        const assistantMsg: Message = {
          id: 'sys_queued_a_' + Date.now(),
          role: 'assistant',
          content: "🔮 **TeenGenius AI Study-Pod Offline Cache Active**\n\nAI queries require cloud assistance to connect. I have securely stored and queued your message inside your browser's private vault.\n\nYour study query will automatically sync and fetch answers once your internet returns! Feel free to continue reading and browsing previous neural histories in the left history list.",
          timestamp: new Date()
        };
        const finalCachedList = [...updatedList, assistantMsg];
        setMessages(finalCachedList);
        localStorage.setItem(`STUDENT_LOCAL_MESSAGES_CACHE_${sessionId}`, JSON.stringify(finalCachedList));
      }, 700);
      
      setIsLoading(false);
      return;
    }
    
    console.log("[EXECUTION TRACE - STEP 2 - SESSION CHECK]: Existing Session ID:", sessionId);
    if (!sessionId) {
      console.log("[EXECUTION TRACE - STEP 2 - SESSION CHECK]: No Session ID found. Creating new chat session...");
      sessionId = await createNewSession(currentInput);
      console.log("[EXECUTION TRACE - STEP 2 - SESSION CHECK]: Session creation completed. New Session ID:", sessionId);
    }
    
    if (!sessionId) {
      console.error("[EXECUTION TRACE - FAILURE]: No session ID could be established. Halting execution.");
      setIsLoading(false);
      return;
    }

    try {
      let finalImageUrl: string | null = null;
      
      // 1. If there's an image, upload it to the server first
      if (currentFile) {
        console.log("[EXECUTION TRACE - STEP 3 - IMAGE UPLOAD]: Found attached file. Ready to call /api/upload...");
        const formData = new FormData();
        formData.append('file', currentFile);
        
        const uploadRes = await safeFetch('/api/upload', {
          method: 'POST',
          body: formData,
          timeout: 25000 // 25s timeout for file uploads
        });
        
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          finalImageUrl = uploadData.url;
          console.log("[EXECUTION TRACE - STEP 3 - IMAGE UPLOAD]: Upload succeeded. URL mapped to:", finalImageUrl);
        } else {
          console.error("[EXECUTION TRACE - STEP 3 - IMAGE UPLOAD]: Image upload failed, falling back to cached local storage data URL representation");
          if (currentImagePreview && currentImagePreview.length < 500000) {
            finalImageUrl = currentImagePreview;
          }
        }
      }

      // 2. Save User Message to Firestore
      console.log("[EXECUTION TRACE - STEP 4 - FIRESTORE WRITE]: Formulating user message payload for Firestore...");
      const userMessageContent = currentInput || (finalImageUrl ? "Image Transmission" : "");
      
      const userMessage: any = { 
        role: 'user', 
        content: userMessageContent,
        status: 'sending'
      };
      
      if (finalImageUrl) userMessage.image = finalImageUrl;

      console.log("[EXECUTION TRACE - STEP 4.1 - UI OPTIMISTIC RENDER]: Rendering user message to the UI screen immediately...");
      setMessages(prev => [...prev, { ...userMessage, id: 'temp_' + Date.now(), timestamp: new Date() }]);

      if (sessionId && !sessionId.startsWith('local_')) {
        console.log("[EXECUTION TRACE - STEP 4.2 - FIRESTORE DISPATCH]: Executing concurrently to Firestore...");
        addDoc(collection(db, 'aiChats', sessionId, 'messages'), {
          ...userMessage,
          timestamp: serverTimestamp()
        }).then((docRef) => {
          if (docRef) {
            console.log("[EXECUTION TRACE - STEP 4.2 - FIRESTORE DISPATCH]: Successfully persisted message. Mapped ID:", docRef.id);
            updateDoc(doc(db, 'aiChats', sessionId), {
              lastMessage: userMessageContent,
              lastUpdatedAt: serverTimestamp()
            }).then(() => {
              console.log("[EXECUTION TRACE - STEP 4.2 - FIRESTORE DISPATCH]: Metadate of chat session doc updated successfully.");
            }).catch((err) => {
              console.warn("Session update doc warning:", err);
            });
          }
        }).catch((fsErr) => {
          console.warn("[EXECUTION TRACE - STEP 4.2 - FIRESTORE DISPATCH WARNING]: Firestore write deferred/operating offline:", fsErr);
        });
      }

      // 3. Prepare AI Request
      console.log("[EXECUTION TRACE - STEP 5 - AI REQUEST CREATION]: Assembling memory context history and image structures...");
      const historyPayload = messages.map(m => {
        const parts: any[] = [{ text: m.content }];
        if (m.image) {
          if (m.image.startsWith('/uploads/')) {
            parts.push({ imageUrl: m.image });
          } else if (m.image.startsWith('data:')) {
            parts.push({
              inlineData: {
                data: m.image.split(',')[1],
                mimeType: m.image.split(';')[0].split(':')[1]
              }
            });
          }
        }
        return {
          role: m.role === 'user' ? 'user' : 'model',
          parts
        };
      });

      const currentMessageImage = finalImageUrl && finalImageUrl.startsWith('/uploads/') 
        ? { url: finalImageUrl }
        : (currentImagePreview ? { data: currentImagePreview.split(',')[1], mimeType: currentFile?.type || 'image/jpeg' } : null);

      const isMobileDevice = typeof navigator !== "undefined" && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isCapacitor = typeof window !== "undefined" && (
        window.location.protocol === "capacitor:" ||
        window.location.origin.startsWith("capacitor://") ||
        window.location.origin.startsWith("http://localhost") && window.location.port !== "3000" && window.location.port !== "5173" ||
        window.location.hostname === "localhost" && window.location.port !== "3000" && window.location.port !== "5173" ||
        (window as any).Capacitor !== undefined
      );
      
      const shouldStream = streamResponse && !isMobileDevice && !isCapacitor;
      console.log("[EXECUTION TRACE - STEP 5 - AI REQUEST CREATION]: Delivery setup complete:", { shouldStream, lengthOfHistory: historyPayload.length });

      // 4. Contact Backend Gemini endpoint with explicit timeout configuration override
      console.log("[EXECUTION TRACE - STEP 6 - GEMINI API CALL]: Initiating POST request to /api/gemini/chat...");
      const response = await safeFetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: currentInput || (finalImageUrl ? "What is in this image?" : ""), 
          history: historyPayload,
          image: currentMessageImage,
          stream: shouldStream
        }),
        timeout: 35000 // Explicit 35-second total HTTP gateway limit
      });

      console.log("[EXECUTION TRACE - STEP 7 - GEMINI RESPONSE]: Response received. Status code:", response.status);
      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown response body");
        console.error("[EXECUTION TRACE - EXCEPTION]: API request failed. Status:", response.status, "Body:", errText);
        let errData: any = {};
        try {
          errData = JSON.parse(errText);
        } catch (_) {}
        throw new Error(errData?.error || `Lost connection to AI Study Partner (HTTP ${response.status}).`);
      }

      // Clone response for safe, undisturbed body text fallback if stream read fails
      const responseClone = response.clone();
      setIsLoading(false); // Disable core spinning wheel to indicate communication has finished
      setStreamingText("");
      let finalFullText = "";

      if (shouldStream) {
        console.group("[EXECUTION TRACE - STEP 7.1 - DIRECT STREAM READING]");
        console.log("Response categorized as EventStream. Initializing direct chunk extraction...");
        const reader = response.body ? response.body.getReader() : null;
        const decoder = new TextDecoder("utf-8");
        
        if (reader) {
          let doneReading = false;
          let chunkCount = 0;
          try {
            while (!doneReading) {
              const { value, done } = await reader.read();
              doneReading = done;
              if (value) {
                const chunk = decoder.decode(value, { stream: !done });
                finalFullText += chunk;
                setStreamingText(finalFullText);
                chunkCount++;
              }
            }
            console.log("Completed extracting full stream cleanly. Total length:", finalFullText.length);
          } catch (streamErr: any) {
            console.warn("Direct chunk read failed, transitioning instantly to undisturbed response clone text fallback:", streamErr?.message || streamErr);
            if (!finalFullText) {
              try {
                finalFullText = await responseClone.text();
                setStreamingText(finalFullText);
                console.log("Fallback success: Read entire text from undisturbed response clone successfully. Size:", finalFullText.length);
              } catch (cloneErr: any) {
                console.error("Fallback failure: Failed to read from response clone:", cloneErr);
                throw new Error(`Streaming read aborted: ${streamErr?.message || streamErr}. Fallback failed: ${cloneErr?.message || cloneErr}`);
              }
            } else {
              console.log("Partial content preserved. Using accumulated chunks:", finalFullText.length);
            }
          } finally {
            console.groupEnd();
          }
        } else {
          console.warn("reader.getReader() not supported in this runtime environment. Falling back to body text from clone...");
          try {
            finalFullText = await responseClone.text();
            setStreamingText(finalFullText);
          } catch (err: any) {
            console.error("Failed to read body text from clone:", err);
            throw err;
          }
        }
      } else {
        console.log("[EXECUTION TRACE - STEP 7.2 - REGULAR JSON READING]: Parsing standard non-streaming package structure...");
        try {
          const data = await response.json();
          console.log("[EXECUTION TRACE - STEP 7.2 - REGULAR JSON]: Resolved JSON object directly:", data);
          finalFullText = data.text || "";
          setStreamingText(finalFullText);
          console.log("Extraction complete. Content length:", finalFullText.length);
        } catch (jsonErr: any) {
          console.error("[EXECUTION TRACE - STEP 7.2 - REGULAR JSON EXCEPTION]: Failed to parse body as JSON:", jsonErr);
          // Try reading as text as fallback
          try {
            finalFullText = await responseClone.text();
            setStreamingText(finalFullText);
          } catch (txtErr: any) {
            throw new Error(`Failed to parse response as JSON / Text: ${jsonErr?.message}`);
          }
        }
      }

      if (!finalFullText) {
        throw new Error("Connection closed with empty response or request aborted because of network timeout.");
      }

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: finalFullText,
        status: 'processed'
      };
      
      console.log("[EXECUTION TRACE - STEP 8 - FIRESTORE UPDATE]: Appending generated assistant bubble to state...");
      setMessages(prev => [...prev, { ...assistantMessage, id: 'assistant_' + Date.now(), timestamp: new Date() }]);

      // Award points for using AI Tutor node
      if (user?.uid && !isGuest) {
        awardGamificationPoints(user.uid, 'USE_AI_TUTOR').then((res) => {
          if (res.xpAwarded > 0) {
            triggerAlert(res.xpAwarded, res.newBadgesEarned);
          }
        }).catch(err => console.warn("Failed to award AI tutor points:", err));
      }
      
      // Persist to Firestore in the background
      if (sessionId && !sessionId.startsWith('local_')) {
        console.log("[EXECUTION TRACE - STEP 8.1 - FIRESTORE ASSISTANT DISPATCH]: Persisting AI Response write back...");
        addDoc(collection(db, 'aiChats', sessionId, 'messages'), {
          ...assistantMessage,
          timestamp: serverTimestamp()
        }).then((docRef) => {
          if (docRef) {
            console.log("[EXECUTION TRACE - STEP 8.1 - FIRESTORE ASSISTANT DISPATCH]: Success. Doc reference mapped ID:", docRef.id);
            updateDoc(doc(db, 'aiChats', sessionId), {
              lastUpdatedAt: serverTimestamp()
            }).catch(() => {});
          }
        }).catch((fsErr) => {
          console.warn("[EXECUTION TRACE - STEP 8.1 - FIRESTORE WRITING DEFERRED]: Assistant write failed online, saved in offline Firestore cache:", fsErr);
        });
      }
      
      console.log("[EXECUTION TRACE - STEP 9 - UI RENDERING]: Complete interaction loop executed successfully.");
    } catch (error: any) {
      console.error('[API CONNECTIVITY DIAGNOSTIC]: Detailed error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      console.error('[SYSTEM CONNECTIVITY CHECK]: Host origin:', window.location.origin, 'API Endpoint URL resolves to:', getApiUrl('/api/gemini/chat'));
      
      const errorMessage: Message = {
        role: 'assistant',
        content: `⚠️ **AI Study Partner Connection Issue**\n\n*What happened:* \`${error?.message || "We could not connect to your study partner"}\`\n\n*What to check:* Make sure you are connected to the internet and that the Gemini API key is configured.`,
        status: 'processed'
      };
      
      console.log("[EXECUTION TRACE - FAILURE BLOCK]: Displaying error warning message into chat list...");
      setMessages(prev => [...prev, { ...errorMessage, id: 'err_' + Date.now(), timestamp: new Date() }]);

      if (sessionId && !sessionId.startsWith('local_')) {
        addDoc(collection(db, 'aiChats', sessionId, 'messages'), {
          ...errorMessage,
          timestamp: serverTimestamp()
        }).catch(fsErr => {
          console.warn("Firestore error message write failed, continuing locally:", fsErr);
        });
      }
    } finally {
      console.log("[EXECUTION TRACE - FINALLY]: Clearing all state loads. setIsLoading to false.");
      setIsLoading(false);
      setStreamingText(null);
    }
  };

  const suggestions = [
    "Explain a Class 10 Science concept",
    "Create a study plan for my exams",
    "Quiz me on Mathematics",
    "Summarize a chapter",
    "Help me prepare for tomorrow's test",
    "Generate revision notes",
    "Create flashcards"
  ];

  return (
    <div className="flex h-full bg-white dark:bg-zinc-950 transition-colors overflow-hidden relative">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (window.innerWidth < 768 ? '100%' : '320px') : '0px',
          x: isSidebarOpen ? 0 : (window.innerWidth < 768 ? -window.innerWidth : -320)
        }}
        className={cn(
          "fixed md:relative inset-y-0 left-0 bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800 z-[70] overflow-hidden flex flex-col transition-all duration-300 ease-in-out shadow-2xl md:shadow-none",
          !isSidebarOpen && "pointer-events-none md:pointer-events-auto"
        )}
      >
        <div className="p-6 md:p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xs">TG</div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-900 dark:text-white">My Chats</h2>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 mb-6 space-y-3">
          <button 
            onClick={() => {
              setCurrentSessionId(null);
              setIsSidebarOpen(false);
            }}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-zinc-200/20 dark:shadow-none"
          >
            <Plus size={16} /> New Chat
          </button>
          
          <button 
            onClick={clearAllHistory}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-500 hover:border-red-500 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all"
          >
            <Trash2 size={14} /> Clear Chat History
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-10">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => {
                setCurrentSessionId(s.id);
                setIsSidebarOpen(false);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setCurrentSessionId(s.id);
                  setIsSidebarOpen(false);
                }
              }}
              className={cn(
                "w-full group p-4 rounded-2xl transition-all border text-left flex items-start gap-3 relative cursor-pointer",
                currentSessionId === s.id 
                  ? "bg-white dark:bg-zinc-800 border-blue-500 shadow-sm" 
                  : "bg-transparent border-transparent hover:bg-white dark:hover:bg-zinc-800/50"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                currentSessionId === s.id ? "bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
              )}>
                <MessageSquare size={14} />
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <p className={cn(
                  "text-xs font-bold truncate mb-1 uppercase tracking-tight",
                  currentSessionId === s.id ? "text-blue-600" : "text-zinc-900 dark:text-white"
                )}>{s.title || 'Untitled Sync'}</p>
                <p className="text-[10px] text-zinc-400 truncate tracking-tight">{s.lastMessage}</p>
              </div>
              <button 
                onClick={(e) => deleteSession(s.id, e)}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-2 text-zinc-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10"
                aria-label="Delete Session"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="py-20 text-center">
              <History size={48} className="mx-auto text-zinc-100 dark:text-zinc-800 mb-4" strokeWidth={1} />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">No logs found</p>
            </div>
          )}
        </div>
      </motion.aside>

      <div 
        className="flex-1 flex flex-col h-full max-w-5xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8 relative overflow-hidden"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <AnimatePresence>
          {isDragging && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-blue-600/10 backdrop-blur-[2px] border-4 border-dashed border-blue-600 rounded-[3rem] z-[100] flex flex-col items-center justify-center pointer-events-none"
            >
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4">
                <ImageIcon size={48} className="text-blue-600 animate-bounce" />
                <p className="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-white">Drop to Analyze</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
  
        <header className="flex items-center justify-between gap-2 md:gap-6 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-5 flex-1 min-w-0">
            <button
              onClick={() => navigate('/app')}
              className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl text-zinc-400 hover:text-blue-600 active:scale-90 flex-shrink-0 shadow-sm md:hidden"
              aria-label="Back to Dashboard"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn(
                "p-2.5 md:p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl md:rounded-2xl text-zinc-400 hover:text-blue-600 transition-all active:scale-90 flex-shrink-0 shadow-sm",
                isSidebarOpen && "md:block hidden"
              )}
              aria-label="Toggle Sidebar"
            >
              <PanelLeftOpen size={20} className="md:w-6 md:h-6" />
            </button>
            <div className="flex flex-col min-w-0">
              <h2 className={cn(
                "text-xs md:text-sm font-black uppercase tracking-widest truncate transition-colors",
                currentSessionId ? "text-blue-600" : "text-zinc-900 dark:text-white"
              )}>
                {currentSessionId 
                  ? (sessions.find(s => s.id === currentSessionId)?.title || 'Chat Session')
                  : 'AI Study Partner'
                }
              </h2>
              <p className="text-[8px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-tighter truncate">
                {currentSessionId ? 'Ready' : 'Ready to start'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStreamResponse(!streamResponse)}
              className={cn(
                "px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border cursor-pointer",
                streamResponse
                  ? "bg-blue-600/10 text-blue-600 border-blue-500/30 animate-pulse"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent hover:text-zinc-500"
              )}
              title="Toggle real-time streaming output"
            >
              Stream: {streamResponse ? "Active" : "Standard"}
            </button>
            <div className="px-3 py-1.5 md:px-4 md:py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap hidden lg:block">Online & Ready</div>
            <div className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-600/10 text-blue-600 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap hidden lg:block">Study Assistant</div>
          </div>
          <div className="flex items-center gap-2">
            {currentSessionId && messages.length > 0 && (
              <button
                onClick={handleOpenQuickQuiz}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl md:rounded-2xl hover:bg-blue-700 transition-all font-black text-[10px] md:text-xs uppercase tracking-wider scale-100 hover:scale-[1.02] active:scale-95 shadow-md flex-shrink-0"
                title="Generate Chat History Quiz"
              >
                <Award size={13} className="shrink-0 animate-pulse" />
                <span>Quick Quiz</span>
              </button>
            )}
            {currentSessionId && (
              <button 
                onClick={(e) => deleteSession(currentSessionId, e)}
                className="p-2.5 md:p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl md:rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
                title="Terminate Stream"
              >
                <Trash2 size={18} className="md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </header>
  
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-4 md:space-y-8 mb-4 scrollbar-hide pr-1 md:pr-2"
        >
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 md:p-8 max-w-4xl mx-auto space-y-8 my-auto">
              <div className="space-y-3">
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-4 py-1.5 rounded-full">
                  🎓 Welcome to TeenGenius
                </span>
                <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                  Your AI-powered study companion
                </h1>
                <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed font-semibold">
                  Deepen your understanding of homework concepts, create custom calendars, test your skills, and solve curriculum questions instantly using advanced educational intelligence.
                </p>
              </div>

              <div className="w-full space-y-4">
                <div className="flex items-center gap-2 text-zinc-400 text-[9px] font-black uppercase tracking-widest justify-center">
                  <div className="h-0.5 w-8 bg-zinc-200 dark:bg-zinc-805" />
                  <span>Choose an Interactive Starter Option</span>
                  <div className="h-0.5 w-8 bg-zinc-200 dark:bg-zinc-850" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl mx-auto">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-left p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 hover:border-blue-500 hover:bg-blue-50/10 transition-all active:scale-[0.98] group cursor-pointer shadow-sm flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-blue-500 group-hover:text-blue-600">Starter Topic</p>
                        <p className="text-xs font-bold text-zinc-850 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white transition-colors leading-relaxed">{s}</p>
                      </div>
                      <ArrowRight size={14} className="text-zinc-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
  
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={m.id || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3 md:gap-4 max-w-[95%] md:max-w-[90%]",
                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 mt-1 shadow-lg",
                m.role === 'user' ? "bg-zinc-900 text-white" : "bg-blue-600 text-white"
              )}>
                {m.role === 'user' ? <User size={14} className="md:w-[18px]" /> : <Sparkles size={14} className="md:w-[18px]" />}
              </div>
              <div className={cn(
                "px-4 py-3 md:px-6 md:py-5 rounded-2xl md:rounded-[2rem] text-sm leading-relaxed shadow-xl overflow-hidden",
                m.role === 'user' 
                  ? "bg-zinc-900 text-white rounded-tr-none" 
                  : "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none"
              )}>
                {m.image && (
                  <img 
                    src={m.image} 
                    alt="User uploaded" 
                    className="max-w-full h-auto rounded-xl md:rounded-2xl mb-4 border border-white/10" 
                  />
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-headings:text-zinc-900 dark:prose-headings:text-white prose-strong:text-blue-600 prose-ul:list-disc prose-ol:list-decimal overflow-x-auto whitespace-pre-wrap">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      a: ({ href, children, ...props }) => {
                        const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                          e.preventDefault();
                          const textContent = String(children || '').toLowerCase().trim();
                          const hrefLower = String(href || '').toLowerCase();
                          if (
                            textContent.includes('focus zone') || 
                            textContent.includes('focus room') || 
                            hrefLower.includes('focus')
                          ) {
                            navigate('/app/focus');
                          } else if (
                            textContent.includes('homework solver') || 
                            textContent.includes('equation analyzer') ||
                            hrefLower.includes('homework') || 
                            hrefLower.includes('solve-homework')
                          ) {
                            navigate('/app/homework-solver');
                          } else if (
                            textContent.includes('notes lab') || 
                            textContent.includes('notes synthesizer') || 
                            textContent.includes('notes generator') ||
                            hrefLower.includes('notes')
                          ) {
                            navigate('/app/notes');
                          } else if (
                            textContent.includes('roadmap') || 
                            textContent.includes('roadmap architect') ||
                            hrefLower.includes('roadmap')
                          ) {
                            navigate('/app/roadmap');
                          } else if (
                            textContent.includes('memory lab') || 
                            textContent.includes('memory palace') || 
                            textContent.includes('loci') ||
                            hrefLower.includes('memory') || 
                            hrefLower.includes('mnemonic')
                          ) {
                            navigate('/app/memory-lab');
                          } else if (
                            textContent.includes('timetable') || 
                            textContent.includes('schedule') || 
                            hrefLower.includes('timetable')
                          ) {
                            navigate('/app/timetable');
                          } else {
                            const path = href || '';
                            if (path.startsWith('/') || path.startsWith('#')) {
                              navigate(path);
                            } else {
                              const matchApp = path.match(/\/(app\/[a-zA-Z0-9_\-]+)/);
                              if (matchApp) {
                                navigate(`/${matchApp[1]}`);
                              } else {
                                window.open(path, '_blank', 'noopener,noreferrer');
                              }
                            }
                          }
                        };
                        return (
                          <a 
                            href={href} 
                            onClick={handleClick} 
                            className="text-blue-600 hover:underline font-bold cursor-pointer inline-flex items-center gap-0.5"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }
                    }}
                  >
                    {preprocessLaTeX(typeof m.content === 'string' ? m.content : JSON.stringify(m.content || ''))}
                  </ReactMarkdown>
                </div>
                <div className={cn(
                  "mt-3 md:mt-4 flex items-center gap-3",
                  m.role === 'user' ? "justify-end" : "justify-between"
                )}>
                  {m.role === 'assistant' && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(m.content);
                        // Optional: toast or state feedback
                      }}
                      className="p-1 px-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg hover:bg-zinc-100 transition-all flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-zinc-400 group/copy"
                    >
                      <Copy size={10} className="group-hover/copy:text-blue-500" />
                      Copy
                    </button>
                  )}
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-2">
                      {m.role === 'user' ? 'You' : 'AI Study Partner'}
                      <span>•</span>
                      {formatTime(m.timestamp)}
                    </div>
                    {m.role === 'user' && m.status && (
                      <div className={cn(
                        "transition-all flex items-center",
                        m.status === 'processed' ? "text-blue-500 scale-110" : "text-zinc-400 opacity-50"
                      )}>
                        {m.status === 'sending' ? <Check size={8} className="animate-pulse" /> :
                         m.status === 'delivered' ? <Check size={8} /> :
                         <CheckCheck size={10} />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          {streamingText !== null && (
            <motion.div
              key="streaming-message"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 md:gap-4 max-w-[95%] md:max-w-[90%]"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 mt-1 shadow-lg bg-blue-600 text-white">
                <Sparkles size={14} className="md:w-[18px]" />
              </div>
              <div className="px-4 py-3 md:px-6 md:py-5 rounded-2xl md:rounded-[2rem] text-sm leading-relaxed shadow-xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none">
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-headings:text-zinc-900 dark:prose-headings:text-white prose-strong:text-blue-600 prose-ul:list-disc prose-ol:list-decimal overflow-x-auto whitespace-pre-wrap">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      a: ({ href, children, ...props }) => {
                        const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                          e.preventDefault();
                          const textContent = String(children || '').toLowerCase().trim();
                          const hrefLower = String(href || '').toLowerCase();
                          if (
                            textContent.includes('focus zone') || 
                            textContent.includes('focus room') || 
                            hrefLower.includes('focus')
                          ) {
                            navigate('/app/focus');
                          } else if (
                            textContent.includes('homework solver') || 
                            textContent.includes('equation analyzer') ||
                            hrefLower.includes('homework') || 
                            hrefLower.includes('solve-homework')
                          ) {
                            navigate('/app/homework-solver');
                          } else if (
                            textContent.includes('notes lab') || 
                            textContent.includes('notes synthesizer') || 
                            textContent.includes('notes generator') ||
                            hrefLower.includes('notes')
                          ) {
                            navigate('/app/notes');
                          } else if (
                            textContent.includes('roadmap') || 
                            textContent.includes('roadmap architect') ||
                            hrefLower.includes('roadmap')
                          ) {
                            navigate('/app/roadmap');
                          } else if (
                            textContent.includes('memory lab') || 
                            textContent.includes('memory palace') || 
                            textContent.includes('loci') ||
                            hrefLower.includes('memory') || 
                            hrefLower.includes('mnemonic')
                          ) {
                            navigate('/app/memory-lab');
                          } else if (
                            textContent.includes('timetable') || 
                            textContent.includes('schedule') || 
                            hrefLower.includes('timetable')
                          ) {
                            navigate('/app/timetable');
                          } else {
                            const path = href || '';
                            if (path.startsWith('/') || path.startsWith('#')) {
                              navigate(path);
                            } else {
                              const matchApp = path.match(/\/(app\/[a-zA-Z0-9_\-]+)/);
                              if (matchApp) {
                                navigate(`/${matchApp[1]}`);
                              } else {
                                window.open(path, '_blank', 'noopener,noreferrer');
                              }
                            }
                          }
                        };
                        return (
                          <a 
                            href={href} 
                            onClick={handleClick} 
                            className="text-blue-600 hover:underline font-bold cursor-pointer inline-flex items-center gap-0.5"
                            {...props}
                          >
                            {children}
                          </a>
                        );
                      }
                    }}
                  >
                    {preprocessLaTeX(streamingText)}
                  </ReactMarkdown>
                </div>
                
                {/* Subtle Pulse & Typing Dots indicator inside the active streaming bubble */}
                <span className="inline-flex mt-4 items-center gap-2 bg-blue-50/50 dark:bg-blue-950/20 px-3 py-1.5 rounded-xl border border-blue-100/30 dark:border-blue-900/20">
                  <span className="flex gap-1 items-center justify-center select-none h-2">
                    <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }} />
                    <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1.2s' }} />
                    <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1.2s' }} />
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 animate-pulse">AI is thinking</span>
                </span>

                <div className="mt-3 md:mt-4 flex items-center justify-between">
                  <div className="flex flex-col items-start gap-1">
                    <div className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-2">
                      AI Study Partner
                      <span>•</span>
                      Writing
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
          
          {isLoading && (
            <div className="flex gap-4 max-w-[85%] animate-fade-in">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 animate-pulse shadow-lg">
                <Sparkles size={18} />
              </div>
              <div className="px-6 py-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2rem] rounded-tl-none shadow-xl space-y-3 w-full max-w-md">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest animate-pulse">TeenGenius is thinking...</span>
                </div>
                <div className="space-y-2.5 animate-pulse">
                  <div className="h-3 bg-zinc-150 dark:bg-zinc-800 rounded-full w-11/12" />
                  <div className="h-3 bg-zinc-150 dark:bg-zinc-800 rounded-full w-4/5" />
                  <div className="h-3 bg-zinc-150 dark:bg-zinc-800 rounded-full w-2/3" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
  
        <div className="sticky bottom-0 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-xl pt-4 pb-24 md:pb-6 flex-shrink-0">
        {messages.length > 0 && (
          <div className="flex gap-2 max-w-4xl mx-auto px-1 md:px-0 mb-3 overflow-x-auto scrollbar-hide py-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="bg-zinc-100/80 hover:bg-blue-50 hover:text-blue-600 dark:bg-zinc-800/80 dark:hover:bg-blue-950/40 dark:hover:text-blue-400 text-zinc-750 dark:text-zinc-200 font-black px-4 py-2 rounded-full text-[10px] md:text-xs tracking-tight transition-all border border-zinc-200/40 dark:border-zinc-750/40 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 hover:scale-102 active:scale-95"
              >
                <Sparkles size={11} className="text-blue-500 shrink-0" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        )}
        <AnimatePresence>
          {imagePreview && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="relative inline-block mb-4 ml-4"
            >
              <img 
                src={imagePreview} 
                alt="Preview" 
                className="w-24 h-24 object-cover rounded-[1.5rem] border-4 border-white dark:border-zinc-900 shadow-2xl" 
              />
              <button 
                onClick={() => { setSelectedFile(null); setImagePreview(null); }}
                className="absolute -top-3 -right-3 p-2 bg-zinc-900 text-white rounded-full shadow-lg hover:bg-red-600 transition-all active:scale-90"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Speech Recognition Tool Status Indicator Banner */}
        <AnimatePresence>
          {speechState !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="max-w-4xl mx-auto px-1 md:px-0 mb-4"
              id="speech-recognition-status-overlay"
            >
              <div className={cn(
                "p-4 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-md",
                speechState === 'listening' ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400" :
                speechState === 'processing' ? "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400" :
                speechState === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-750 dark:text-emerald-400" :
                "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner relative overflow-hidden",
                    speechState === 'listening' ? "bg-rose-500/20 text-rose-600 dark:text-rose-450 animate-pulse" :
                    speechState === 'processing' ? "bg-blue-500/20 text-blue-600 dark:text-blue-450" :
                    speechState === 'completed' ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-450" :
                    "bg-amber-500/20 text-amber-600 dark:text-amber-450"
                  )}>
                    {speechState === 'listening' ? (
                      <>
                        <Mic size={18} className="animate-bounce" />
                        <span className="absolute inset-0 bg-rose-500/10 animate-ping rounded-full pointer-events-none" />
                      </>
                    ) :
                     speechState === 'processing' ? <Loader2 size={18} className="animate-spin" /> :
                     speechState === 'completed' ? <Check size={18} /> :
                     <MicOff size={18} />}
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider leading-none">
                      {speechState === 'listening' ? '🎙️ Ready & Listening...' :
                       speechState === 'processing' ? '⚙️ Processing Voice...' :
                       speechState === 'completed' ? '✨ Transcription Completed!' :
                       '⚠️ Microphone Assistant Alert'}
                    </h4>
                    <p className="text-[11px] md:text-xs font-bold mt-1 opacity-95 leading-relaxed">
                      {speechState === 'listening' ? 'Speak clearly as TeenGenius transcribes your words into the chat box automatically.' :
                       speechState === 'processing' ? 'Converting your acoustic profile into a written query with neural Web Speech nodes...' :
                       speechState === 'completed' ? 'Successfully converted voice to text! You can edit the text before sending.' :
                       speechError || 'Your microphone permission is currently blocked. Click the lock/permission icon in your address bar to grant access.'}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2 shrink-0">
                  {speechState === 'listening' && (
                    <button
                      onClick={stopSpeechRecognition}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                      id="speech-stop-button"
                    >
                      Stop
                    </button>
                  )}
                  {speechState === 'error' && (
                    <button
                      onClick={() => setSpeechState('idle')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                      id="speech-dismiss-button"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex items-center gap-2 md:gap-3 max-w-4xl mx-auto px-1 md:px-0">
          <AnimatePresence>
            {showPromptMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full left-0 right-0 md:left-0 md:right-auto mb-4 md:w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl overflow-hidden z-50 p-2"
              >
                <div className="px-6 py-4 border-b border-zinc-50 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Suggested Prompts</h3>
                  <button onClick={() => setShowPromptMenu(false)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <div className="max-h-60 md:max-h-64 overflow-y-auto p-2 space-y-1">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => {
                        setInput(s);
                        setShowPromptMenu(false);
                      }}
                      className="w-full text-left p-3 md:p-4 rounded-xl md:rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all group"
                    >
                      <p className="text-[11px] md:text-xs font-bold text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 transition-colors uppercase tracking-tight">{s}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
 
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-12 w-12 md:h-16 md:w-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl md:rounded-[1.5rem] flex items-center justify-center text-zinc-400 hover:text-blue-600 transition-all active:scale-95 shadow-lg group flex-shrink-0 cursor-pointer"
              aria-label="Upload Image"
            >
              <ImageIcon size={20} className="md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
            </button>
            <button
              onClick={() => setShowPromptMenu(!showPromptMenu)}
              className={cn(
                "h-12 w-12 md:h-16 md:w-16 border rounded-2xl md:rounded-[1.5rem] flex items-center justify-center transition-all active:scale-95 shadow-lg group flex-shrink-0 cursor-pointer",
                showPromptMenu 
                  ? "bg-blue-600 border-blue-600 text-white" 
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-blue-600"
              )}
              aria-label="Prompt Library"
            >
              <List size={20} className="md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
            </button>
            <button
              onClick={toggleSpeechRecognition}
              className={cn(
                "h-12 w-12 md:h-16 md:w-16 border rounded-2xl md:rounded-[1.5rem] flex items-center justify-center transition-all active:scale-95 shadow-lg group flex-shrink-0 relative overflow-hidden cursor-pointer",
                speechState === 'listening' || speechState === 'processing'
                  ? "bg-rose-600 border-rose-600 text-white"
                  : speechState === 'completed'
                  ? "bg-emerald-600 border-emerald-600 text-white animate-pulse"
                  : speechState === 'error'
                  ? "bg-amber-600 border-amber-600 text-white text-rose-200"
                  : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-450"
              )}
              aria-label="Voice Input"
              id="speech-trigger-button"
            >
              {speechState === 'listening' ? (
                <>
                  <Mic size={20} className="md:w-6 md:h-6 animate-pulse" />
                  <span className="absolute inset-0 bg-rose-500/25 animate-ping rounded-full pointer-events-none" />
                </>
              ) : speechState === 'processing' ? (
                <Loader2 size={20} className="md:w-6 md:h-6 animate-spin" />
              ) : speechState === 'completed' ? (
                <Check size={20} className="md:w-6 md:h-6" />
              ) : speechState === 'error' ? (
                <MicOff size={20} className="md:w-6 md:h-6" />
              ) : (
                <Mic size={20} className="md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
              )}
            </button>
          </div>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={speechState === 'listening' ? "Speak to input query..." : "Stream query..."}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl md:rounded-[1.5rem] px-4 md:px-8 py-3.5 md:py-5 pr-14 md:pr-20 font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xl placeholder:italic placeholder:text-zinc-400 text-sm md:text-base"
              id="chat-query-input-box"
            />
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !selectedFile) || isLoading}
              className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 h-10 w-10 md:h-12 md:w-12 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl md:rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-20 shadow-lg"
            >
              <Send size={16} className="md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Pop-up Celebration Badge Alert overlay */}
      <AnimatePresence>
        {gamificationAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] bg-zinc-90 w-full max-w-sm bg-zinc-900 dark:bg-zinc-800 border border-zinc-800 dark:border-zinc-750 text-white rounded-[2rem] p-6 shadow-2xl flex items-center gap-5"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-yellow-500/20">
              <Trophy size={28} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400">Learning Milestone Unlocked!</span>
              <h3 className="text-base font-black uppercase tracking-tight text-white mt-0.5 animate-pulse">Personal Growth!</h3>
              <p className="text-xs font-bold text-zinc-350 mt-1">
                You earned <span className="text-blue-400 font-black">+{gamificationAlert.xp} credits</span> for consulting the AI Tutor.
              </p>
              {gamificationAlert.badges?.length > 0 && (
                <div className="mt-2 text-[8px] font-black uppercase tracking-widest text-green-400 bg-green-950/45 px-2.5 py-1 rounded-md border border-green-800/40 w-fit">
                  🏆 Badge Earned: {gamificationAlert.badges.join(', ')}!
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Quiz Modal Overlay */}
      <AnimatePresence>
        {isQuizOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-lg border border-zinc-150 dark:border-zinc-850 rounded-[2.5rem] shadow-2xl p-6 md:p-8 overflow-hidden relative flex flex-col max-h-[85vh]"
            >
              <button
                onClick={() => setIsQuizOpen(false)}
                className="absolute top-6 right-6 p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-50 dark:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close Quiz"
              >
                <X size={16} />
              </button>

              {quizLoading && (
                <div className="py-16 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-955 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-450 animate-spin">
                    <Loader2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Reading Our Chats</h3>
                    <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">We are looking at our chats to make a custom practice quiz for you!</p>
                  </div>
                </div>
              )}

              {quizError && (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-12 h-12 bg-red-105 dark:bg-red-955 text-red-650 dark:text-red-400 rounded-full flex flex-row items-center justify-center font-black text-lg">!</div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-white">Oops! Could not load the quiz</h3>
                    <p className="text-xs text-red-500 mt-1 max-w-xs leading-relaxed">{quizError}</p>
                  </div>
                  <button
                    onClick={handleOpenQuickQuiz}
                    className="mt-2 px-6 py-3 bg-zinc-90 w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!quizLoading && !quizError && quickQuiz && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="mb-4 pr-8">
                    <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/55 px-2.5 py-1 rounded-md">
                      Study Practice Quiz
                    </span>
                    <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mt-2 truncate">
                      {quickQuiz.title || "Self-Assessment Quiz"}
                    </h3>
                  </div>

                  {!quizCompleted ? (
                    <div className="flex-1 flex flex-col overflow-y-auto pr-1">
                      {/* Progress header */}
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold mb-2">
                        <span>QUESTION_STAGE: {currentQuestionIndex + 1} / {quickQuiz.questions.length}</span>
                        <span>SCORE: {quizScore} / {quickQuiz.questions.length}</span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="bg-zinc-100 dark:bg-zinc-800 h-1.5 w-full rounded-full overflow-hidden mb-6">
                        <motion.div 
                          className="bg-blue-600 h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${((currentQuestionIndex + (isAnswerSubmitted ? 1 : 0)) / quickQuiz.questions.length) * 100}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>

                      {/* Question Text */}
                      <p className="text-sm md:text-base font-bold text-zinc-800 dark:text-zinc-100 mb-6 leading-relaxed">
                        {quickQuiz.questions[currentQuestionIndex].question}
                      </p>

                      {/* Options */}
                      <div className="space-y-3 mb-6">
                        {quickQuiz.questions[currentQuestionIndex].options.map((option: string, idx: number) => {
                          const isSelected = selectedOption === idx;
                          const isCorrect = idx === quickQuiz.questions[currentQuestionIndex].correctAnswerIndex;
                          
                          let optionStyle = "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-750 bg-transparent";
                          if (isSelected) {
                            optionStyle = "border-blue-500 bg-blue-50/10 text-blue-600 dark:text-blue-400";
                          }
                          if (isAnswerSubmitted) {
                            if (isCorrect) {
                              optionStyle = "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400 font-bold";
                            } else if (isSelected) {
                              optionStyle = "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400";
                            } else {
                              optionStyle = "border-zinc-200 dark:border-zinc-800 opacity-60 bg-transparent";
                            }
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => handleSelectQuizOption(idx)}
                              disabled={isAnswerSubmitted}
                              className={cn(
                                "w-full text-left p-4 rounded-2xl border text-xs md:text-sm transition-all flex items-start gap-3",
                                optionStyle,
                                !isAnswerSubmitted && "cursor-pointer hover:scale-[1.01]"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 border",
                                isSelected 
                                  ? "bg-blue-600 text-white border-blue-600" 
                                  : "border-zinc-200 dark:border-zinc-850 text-zinc-400"
                              )}>
                                {String.fromCharCode(65 + idx)}
                              </div>
                              <span className="leading-relaxed">{option}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Reveal */}
                      {isAnswerSubmitted && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-805 rounded-2xl mb-6 text-xs leading-relaxed"
                        >
                          <span className="font-black uppercase text-[9px] tracking-widest text-blue-600 dark:text-blue-400 block mb-1.5 font-mono">TUTOR INSIGHT:</span>
                          <span className="text-zinc-600 dark:text-zinc-300 font-medium">
                            {quickQuiz.questions[currentQuestionIndex].explanation}
                          </span>
                        </motion.div>
                      )}

                      {/* Control buttons */}
                      <div className="mt-auto">
                        {!isAnswerSubmitted ? (
                          <button
                            onClick={handleSubmitQuizAnswer}
                            disabled={selectedOption === null}
                            className="w-full py-4 bg-zinc-90 w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-95 disabled:opacity-20 transition-all cursor-pointer"
                          >
                            Validate Selection
                          </button>
                        ) : (
                          <button
                            onClick={handleNextQuizQuestion}
                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
                          >
                            {currentQuestionIndex < quickQuiz.questions.length - 1 ? "Next Challenge" : "Complete Assessment"}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col overflow-y-auto pr-1">
                      {/* Score display */}
                      <div className="text-center py-6 flex flex-col items-center gap-3">
                        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 mb-2 border border-amber-500/20">
                          <Trophy size={36} />
                        </div>
                        <h4 className="text-base font-black uppercase tracking-widest text-zinc-900 dark:text-white">Assessment Complete</h4>
                        <div className="flex items-baseline justify-center">
                          <span className="text-4xl font-black text-blue-600 font-mono">{quizScore}</span>
                          <span className="text-lg font-bold text-zinc-400 font-mono ml-2">/ {quickQuiz.questions.length}</span>
                        </div>
                        <p className="text-xs text-zinc-450 dark:text-zinc-400 max-w-xs leading-relaxed">
                          {quizScore === quickQuiz.questions.length 
                            ? "Absolute mastery synchrony! You retained 100% of the cognitive concepts discussed in your neural logs." 
                            : "Excellent work! Keep utilizing the AI Assistant node to solidify your core syllabus mastery."}
                        </p>
                      </div>

                      {/* Question review */}
                      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6 space-y-6 mb-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Response Review</h4>
                        {quickQuiz.questions.map((q: any, i: number) => {
                          const wasCorrect = quizAnswers[i] === q.correctAnswerIndex;
                          return (
                            <div key={i} className="border-b border-zinc-100 dark:border-zinc-800/50 pb-4 space-y-2">
                              <p className="text-xs font-bold leading-relaxed text-zinc-800 dark:text-zinc-100">
                                {i + 1}. {q.question}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className={cn(
                                  "px-2.5 py-1 rounded-md font-black text-[9px] uppercase tracking-wider",
                                  wasCorrect ? "bg-green-150 text-green-700 dark:bg-green-950/45 dark:text-green-400" : "bg-red-155 text-red-700 dark:bg-red-950/45 dark:text-red-400"
                                )}>
                                  {wasCorrect ? "Correct" : "Incorrect"}
                                </span>
                                <span className="text-zinc-500">
                                  Your selection: <strong className="text-zinc-700 dark:text-zinc-300">{q.options[quizAnswers[i]] || "None"}</strong>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => setIsQuizOpen(false)}
                        className="w-full py-4 bg-zinc-90 w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.01] active:scale-95 transition-all cursor-pointer"
                      >
                        Dismiss Interface
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  </div>
);
}
