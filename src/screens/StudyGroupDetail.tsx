import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, onSnapshot, query, addDoc, serverTimestamp, orderBy, getDocs, updateDoc, arrayUnion, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { awardGamificationPoints } from '../lib/gamification';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, FileText, Image as ImageIcon, Send, Users, Info, BookOpen, Paperclip, X, Loader2, ShieldCheck, Lock, Palette, Edit3, LayoutGrid, Award, Brain, CheckCircle2, ChevronRight, HelpCircle, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import CollaborativeWhiteboard from '../components/CollaborativeWhiteboard';
import { formatDate } from '../lib/dateUtils';
import { safeFetch } from '../lib/api';

interface Note {
  id: string;
  title?: string;
  content: string;
  authorId: string;
  authorName?: string;
  type: 'text' | 'image';
  timestamp: any;
  fileUrl?: string;
}

export default function StudyGroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user, isGuest, isSandbox, triggerGuestPrompt } = useAuth();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'whiteboard' | 'scratchpad' | 'tasks' | 'quiz' | 'doubts' | 'modules'>('notes');
  const [doubts, setDoubts] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [isAddingDoubt, setIsAddingDoubt] = useState(false);
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [newDoubt, setNewDoubt] = useState({ title: '', content: '' });
  const [newModule, setNewModule] = useState({ title: '', description: '' });
  const [newDoubtAnswer, setNewDoubtAnswer] = useState<{ [doubtId: string]: string }>({});
  const [gamificationAlert, setGamificationAlert] = useState<{ xp: number; badges: string[] } | null>(null);
  const [scratchpad, setScratchpad] = useState('');
  const [tasks, setTasks] = useState<any[]>([]);
  const [editorLanguage, setEditorLanguage] = useState('javascript');
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorNotes, setEditorNotes] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all');
  const [doubtSearchQuery, setDoubtSearchQuery] = useState('');
  const [isJoinedLounge, setIsJoinedLounge] = useState(false);
  const [milestonesChecked, setMilestonesChecked] = useState<Record<string, boolean>>({});
  const scratchpadTimeout = useRef<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');

  // Quiz Generator States
  const [quizTopic, setQuizTopic] = useState("");
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);

  // Update default task assignee when user object is loaded
  useEffect(() => {
    if (user?.uid) {
      setTaskAssigneeId(user.uid);
    }
  }, [user]);

  // Fetch profiles of group members
  useEffect(() => {
    if (!group?.memberIds || group.memberIds.length === 0) return;

    const fetchMembers = async () => {
      try {
        const q = query(collection(db, 'users'), where('uid', 'in', group.memberIds.slice(0, 30)));
        const snap = await getDocs(q);
        setMembers(snap.docs.map(d => d.data()));
      } catch (err) {
        console.error("Error fetching group members:", err);
      }
    };
    fetchMembers();
  }, [group?.memberIds]);

  useEffect(() => {
    if (!groupId || !user) return;

    const isSandboxObj = isSandbox || groupId.startsWith('sb_');
    if (isSandboxObj) {
      setLoading(false);
      const isG1 = groupId === 'sb_group1';
      setGroup({
        name: isG1 ? 'AP Calculus BC Study Circle' : 'Quantum Physics Peer Cohort',
        description: isG1 ? 'Advanced derivatives and integrations sync node Room' : 'Wave mechanics particle physics prep room',
        ownerId: isG1 ? 'f1' : 'f2',
        memberIds: [user.uid, 'f1', 'f2', 'f3'],
        createdAt: new Date(),
        scratchpad: 'Welcome to this collaborative study node!\nUse this whiteboard and scratchpad to brainstorm.',
        whiteboardLines: [],
        tasks: [
          { id: 't1', text: isG1 ? 'Watch video series on integration by parts' : 'Solve Schrondinger wave practice problems', completed: false },
          { id: 't2', text: isG1 ? 'Review derivatives limits cheat sheet' : 'Read relativity notes', completed: true }
        ]
      });
      setNotes([
        { id: 'n1', authorId: 'f1', authorName: 'Alex Rivera', type: 'text', title: 'Calculus Session 1 notes', content: 'Here are the formulas we discussed today for quick reference.', timestamp: new Date() }
      ]);
      setDoubts([
        { id: 'd1', title: isG1 ? 'Integration of sec(x)^3dx' : 'Photoelectric effect wave vs particle model', content: isG1 ? 'How to approach this integral? I get stuck in a recursive loop using by-parts.' : 'Why did wave theory fail to explain the intensity independent threshold frequency?', authorId: 'f2', authorName: 'Emily Chen', createdAt: new Date(), isSolved: false, answers: [] }
      ]);
      setModules([
        { id: 'm1', title: isG1 ? 'Module 1: Advanced Integration Methods' : 'Module 1: Special Relativity Basics', createdBy: 'f1', createdAt: new Date(), completedBy: [] }
      ]);
      return () => {};
    }

    const unsubscribeGroup = onSnapshot(doc(db, 'studyGroups', groupId), (snap) => {
      setLoading(false);
      if (snap.exists()) {
        const data = snap.data();
        setGroup(data);
        if (data.scratchpad !== undefined) {
          setScratchpad(data.scratchpad);
        }
        if (data.tasks) {
          setTasks(data.tasks);
        }
      } else {
        setErrorOccurred(true);
      }
    }, (err) => {
      console.warn("Failed to subscribe/get studyGroup:", err);
      setLoading(false);
      setErrorOccurred(true);
    });

    const q = query(
      collection(db, 'studyGroups', groupId, 'notes'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeNotes = onSnapshot(q, (snapshot) => {
      setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
    }, (error) => {
      console.warn("Failed to subscribe notes:", error);
    });

    const doubtsQ = query(collection(db, 'studyGroups', groupId, 'doubts'), orderBy('createdAt', 'desc'));
    const unsubscribeDoubts = onSnapshot(doubtsQ, (snap) => {
      setDoubts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("Doubts subscription issue:", err);
    });

    const modulesQ = query(collection(db, 'studyGroups', groupId, 'modules'), orderBy('createdAt', 'desc'));
    const unsubscribeModules = onSnapshot(modulesQ, (snap) => {
      setModules(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("Modules subscription issue:", err);
    });

    const fetchFriends = async () => {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      if (userSnap.exists()) {
        const friendIds = userSnap.data().friendIds || [];
        if (friendIds.length > 0) {
          const friendsQuery = query(collection(db, 'users'), where('uid', 'in', friendIds));
          const friendsSnap = await getDocs(friendsQuery);
          setFriends(friendsSnap.docs.map(d => d.data()));
        }
      }
    };
    fetchFriends();

    return () => {
      unsubscribeGroup();
      unsubscribeNotes();
      unsubscribeDoubts();
      unsubscribeModules();
    };
  }, [groupId, user]);

  const handleScratchpadChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setScratchpad(newVal);

    if (isGuest) return; // Allow typing locally but don't persist to other group members

    if (scratchpadTimeout.current) clearTimeout(scratchpadTimeout.current);
    scratchpadTimeout.current = setTimeout(async () => {
      if (!groupId) return;
      try {
        await updateDoc(doc(db, 'studyGroups', groupId), {
          scratchpad: newVal
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `studyGroups/${groupId}`);
      }
    }, 1000);
  };

  const handleAIEditorAssist = async (action: 'refactor' | 'complete') => {
    if (isGuest) {
      triggerGuestPrompt("Use AI assistance");
      return;
    }
    if (!scratchpad.trim()) {
      setEditorNotes("Please write some code or text first so the AI can assist you!");
      return;
    }
    setEditorLoading(true);
    setEditorNotes(`AI is processing your ${editorLanguage} workspace...`);
    try {
      const res = await safeFetch('/api/gemini/editor-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scratchpad,
          language: editorLanguage,
          action
        })
      });
      const data = await res.json();
      if (data.result) {
        setScratchpad(data.result);
        setEditorNotes(action === 'refactor' ? "✨ Successfully optimized draft logic!" : "📝 Successfully generated text continuation!");
        if (groupId) {
          await updateDoc(doc(db, 'studyGroups', groupId), {
            scratchpad: data.result
          });
        }
      } else {
        setEditorNotes("AI did not produce a result. Please retry.");
      }
    } catch (err: any) {
      console.error(err);
      setEditorNotes("Failed to invoke AI Editor companion.");
    } finally {
      setEditorLoading(false);
    }
  };

  const inviteFriend = async (friendId: string) => {
    if (isGuest) {
      triggerGuestPrompt("Invite Friends");
      return;
    }
    if (!groupId) return;
    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        memberIds: arrayUnion(friendId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `studyGroups/${groupId}`);
    }
  };

  const triggerAlert = (xp: number, badges: string[]) => {
    setGamificationAlert({ xp, badges });
    setTimeout(() => setGamificationAlert(null), 6000);
  };

  const handleAddDoubt = async () => {
    if (isGuest) {
      triggerGuestPrompt("Ask peer doubts");
      return;
    }
    if (!newDoubt.title.trim() || !newDoubt.content.trim() || !groupId || !user) return;
    try {
      await addDoc(collection(db, 'studyGroups', groupId, 'doubts'), {
        title: newDoubt.title.trim(),
        content: newDoubt.content.trim(),
        authorId: user.uid,
        authorName: user.displayName || 'Circle Member',
        createdAt: serverTimestamp(),
        isSolved: false,
        answers: []
      });
      setNewDoubt({ title: '', content: '' });
      setIsAddingDoubt(false);
    } catch (err) {
      console.error("Error adding doubt:", err);
    }
  };

  const handleAddAnswer = async (doubtId: string) => {
    if (isGuest) {
      triggerGuestPrompt("Answer peer doubts");
      return;
    }
    const text = newDoubtAnswer[doubtId];
    if (!text || !text.trim() || !groupId || !user) return;
    try {
      const doubtRef = doc(db, 'studyGroups', groupId, 'doubts', doubtId);
      const answer = {
        id: Math.random().toString(36).substring(2, 11),
        content: text.trim(),
        authorId: user.uid,
        authorName: user.displayName || 'Circle Member',
        createdAt: new Date().toISOString()
      };
      await updateDoc(doubtRef, {
        answers: arrayUnion(answer)
      });
      setNewDoubtAnswer(prev => ({ ...prev, [doubtId]: '' }));
    } catch (err) {
      console.error("Error adding answer:", err);
    }
  };

  const handleAcceptAnswer = async (doubtId: string, answer: any) => {
    if (!groupId) return;
    try {
      const doubtRef = doc(db, 'studyGroups', groupId, 'doubts', doubtId);
      await updateDoc(doubtRef, {
        isSolved: true,
        acceptedAnswerId: answer.id
      });
      const res = await awardGamificationPoints(answer.authorId, 'RESOLVE_PEER_DOUBT');
      if (res.xpAwarded > 0) {
        triggerAlert(res.xpAwarded, res.newBadgesEarned);
      }
    } catch (err) {
      console.error("Error accepting answer:", err);
    }
  };

  const handleAddModule = async () => {
    if (isGuest) {
      triggerGuestPrompt("Publish study modules");
      return;
    }
    if (!newModule.title.trim() || !groupId || !user) return;
    try {
      await addDoc(collection(db, 'studyGroups', groupId, 'modules'), {
         title: newModule.title.trim(),
         description: newModule.description.trim(),
         createdBy: user.uid,
         createdAt: serverTimestamp(),
         completedBy: []
       });
      setNewModule({ title: '', description: '' });
      setIsAddingModule(false);
    } catch (err) {
      console.error("Error adding module:", err);
    }
  };

  const handleCompleteModule = async (moduleId: string) => {
    if (isGuest) {
      triggerGuestPrompt("Track interactive module progress");
      return;
    }
    if (!groupId || !user) return;
    try {
      const moduleRef = doc(db, 'studyGroups', groupId, 'modules', moduleId);
      await updateDoc(moduleRef, {
        completedBy: arrayUnion(user.uid)
      });
      const res = await awardGamificationPoints(user.uid, 'COMPLETE_STUDY_MODULE');
      if (res.xpAwarded > 0) {
        triggerAlert(res.xpAwarded, res.newBadgesEarned);
      }
    } catch (err) {
      console.error("Error completing module:", err);
    }
  };

  const toggleMilestone = async (moduleId: string, milestoneIndex: number) => {
    const key = `${moduleId}-${milestoneIndex}`;
    const newVal = !milestonesChecked[key];
    const newChecked = { ...milestonesChecked, [key]: newVal };
    setMilestonesChecked(newChecked);

    const m0 = newChecked[`${moduleId}-0`], m1 = newChecked[`${moduleId}-1`], m2 = newChecked[`${moduleId}-2`];
    const isCompletedAlready = modules.find(m => m.id === moduleId)?.completedBy?.includes(user?.uid);
    if (m0 && m1 && m2 && !isCompletedAlready) {
      await handleCompleteModule(moduleId);
    }
  };

  const handleAddTask = async (text: string, assigneeId?: string, taskNotes?: string) => {
    if (isGuest) {
      triggerGuestPrompt("Add group tasks");
      return;
    }
    if (!text.trim() || !groupId) return;
    const newTask = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      notes: taskNotes || '',
      completed: false,
      assigneeId: assigneeId !== undefined ? assigneeId : (user?.uid || ''),
      priority: taskPriority || 'medium'
    };
    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        tasks: arrayUnion(newTask)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `studyGroups/${groupId}`);
    }
  };

  const handleTogglePriority = async (taskId: string) => {
    if (isGuest) {
      triggerGuestPrompt("Modify task severity levels");
      return;
    }
    if (!groupId) return;
    const priorityCycle: Record<string, string> = {
      'low': 'medium',
      'medium': 'high',
      'high': 'urgent',
      'urgent': 'low'
    };
    const newTasks = tasks.map(t => {
      if (t.id === taskId) {
        const currentP = t.priority || 'medium';
        const nextP = priorityCycle[currentP] || 'medium';
        return { ...t, priority: nextP };
      }
      return t;
    });
    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        tasks: newTasks
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `studyGroups/${groupId}`);
    }
  };

  const handleReassignTask = async (taskId: string, newAssigneeId: string) => {
    if (isGuest) {
      triggerGuestPrompt("Reassign group tasks");
      return;
    }
    if (!groupId) return;
    const newTasks = tasks.map(t => t.id === taskId ? { ...t, assigneeId: newAssigneeId } : t);
    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        tasks: newTasks
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `studyGroups/${groupId}`);
    }
  };

  const toggleTask = async (taskId: string) => {
    if (isGuest) {
      triggerGuestPrompt("Complete tasks");
      return;
    }
    if (!groupId) return;
    const newTasks = tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        tasks: newTasks
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `studyGroups/${groupId}`);
    }
  };

  const removeTask = async (taskId: string) => {
    if (isGuest) {
      triggerGuestPrompt("Remove group tasks");
      return;
    }
    if (!groupId) return;
    const newTasks = tasks.filter(t => t.id !== taskId);
    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        tasks: newTasks
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `studyGroups/${groupId}`);
    }
  };

  const handleAddNote = async () => {
    if (isGuest) {
      triggerGuestPrompt("Upload notes & media assets");
      return;
    }
    if ((!newNote.content.trim() && !selectedFile) || !groupId || !user) return;
    setUploading(true);
    const notesPath = `studyGroups/${groupId}/notes`;
    try {
      let fileUrl = '';
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await safeFetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          fileUrl = uploadData.url;
        }
      }

      await addDoc(collection(db, 'studyGroups', groupId, 'notes'), {
        groupId,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        title: newNote.title || 'Untitled Note',
        content: newNote.content,
        fileUrl,
        type: fileUrl ? (selectedFile?.type.startsWith('image/') ? 'image' : 'text') : 'text',
        timestamp: serverTimestamp()
      });
      setNewNote({ title: '', content: '' });
      setSelectedFile(null);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, notesPath);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateQuiz = async (topicString?: string) => {
    const topicToUse = topicString || quizTopic;
    if (!topicToUse || !topicToUse.trim()) {
      setQuizError("Please enter or select a topic for your quiz.");
      return;
    }
    setQuizLoading(true);
    setQuizError("");
    setCurrentQuiz(null);
    setQuizCompleted(false);
    
    try {
      const response = await safeFetch("/api/gemini/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: topicToUse }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate quiz.");
      }
      if (data.quiz && data.quiz.questions && data.quiz.questions.length > 0) {
        setCurrentQuiz(data.quiz);
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setIsAnswerSubmitted(false);
        setQuizScore(0);
        setQuizAnswers([]);
      } else {
        throw new Error("Invalid quiz structure returned from AI.");
      }
    } catch (err: any) {
      console.error(err);
      setQuizError(err.message || "An unexpected error occurred while generating your quiz.");
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSelectOption = (index: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(index);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null || isAnswerSubmitted) return;
    
    setIsAnswerSubmitted(true);
    const question = currentQuiz.questions[currentQuestionIndex];
    if (selectedOption === question.correctAnswerIndex) {
      setQuizScore(prev => prev + 1);
    }
    setQuizAnswers(prev => [...prev, selectedOption]);
  };

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
    } else {
      setQuizCompleted(true);
      if (user?.uid) {
        const res = await awardGamificationPoints(user.uid, 'FINISH_AI_QUIZ');
        if (res.xpAwarded > 0) {
          triggerAlert(res.xpAwarded, res.newBadgesEarned);
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-xs font-bold text-zinc-400 mt-3 uppercase tracking-widest">Accessing Circle Workspace...</p>
      </div>
    );
  }

  if (errorOccurred || !group) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mb-6">
          <Lock size={32} />
        </div>
        <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Access Locked or Circle Not Found</h2>
        <p className="text-xs text-zinc-400 max-w-sm font-semibold italic mt-1.5 leading-relaxed">
          You lack authorization key tags to enter this neural node space, or the requested room does not exist.
        </p>
        <button
          onClick={() => navigate('/app/study-groups')}
          className="mt-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
        >
          Return to Study Circles
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-4 md:px-6 md:py-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3 md:gap-6">
          <button onClick={() => navigate('/app/study-groups')} className="p-2 md:p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white uppercase truncate max-w-[150px] md:max-w-none">
              {group?.name || 'Study Group'}
            </h1>
            <div className="flex items-center gap-3 md:gap-4 mt-0.5 md:mt-1">
              <span className="flex items-center gap-1 text-[8px] md:text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <Users size={12} /> {group?.memberIds?.length || 0}
              </span>
              <span className="flex items-center gap-1 text-[8px] md:text-[10px] font-bold text-green-500 uppercase tracking-widest">
                <div className="w-1 md:w-1.5 h-1 md:h-1.5 bg-green-500 rounded-full animate-pulse" /> Live
              </span>
              {group?.inviteCode && (
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(group.inviteCode);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[8px] md:text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200/40 select-none cursor-pointer hover:bg-blue-100/50 outline-none"
                  title="Click to copy invite code"
                >
                  {copiedCode ? "Copied!" : `Code: ${group.inviteCode}`}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <button 
            onClick={() => setIsInviting(true)}
            className="p-2 md:p-3 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-2xl transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden md:block font-bold text-sm">Invite</span>
          </button>
        </div>
      </header>

      <div className="p-4 md:p-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-10">
        {/* Main Workspace */}
        <div className="lg:col-span-3 space-y-8">
          {/* Tab Selector */}
          <div className="flex bg-white dark:bg-zinc-900 p-1.5 md:p-2 rounded-[2rem] md:rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm w-fit max-w-full overflow-x-auto no-scrollbar">
            {[
              { id: 'notes', label: 'Resources', icon: BookOpen },
              { id: 'whiteboard', label: 'Board', icon: Palette },
              { id: 'scratchpad', label: 'Live Draft', icon: Edit3 },
              { id: 'tasks', label: 'Tasks', icon: LayoutGrid },
              { id: 'doubts', label: 'Doubts Forum', icon: HelpCircle },
              { id: 'modules', label: 'Study Modules', icon: CheckCircle2 },
              { id: 'quiz', label: 'AI Quiz', icon: Award },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl md:rounded-2xl font-bold text-[10px] md:text-xs uppercase tracking-widest transition-all whitespace-nowrap",
                  activeTab === tab.id 
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-lg shadow-zinc-200 dark:shadow-none" 
                    : "text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                )}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="min-h-[600px]">
            {activeTab === 'notes' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold tracking-tight">Shared Notes & Docs</h2>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all flex items-center gap-2 font-bold text-sm"
                  >
                    <Plus size={20} /> Add New
                  </button>
                </div>

                <AnimatePresence>
                  {notes.map((note, i) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-8 rounded-[2.5rem] shadow-sm hover:border-zinc-200 transition-all relative group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl">
                          <FileText size={24} />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-300">
                          {formatDate(note.timestamp)}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight uppercase mb-2">
                        {note.title}
                      </h3>
                      {note.content && (
                        <p className="text-sm text-zinc-500 leading-relaxed whitespace-pre-wrap mb-4">
                          {note.content}
                        </p>
                      )}
                      {note.fileUrl && (
                        <div className="mt-4">
                          {note.type === 'image' ? (
                            <div className="rounded-[2rem] overflow-hidden border border-zinc-100 dark:border-zinc-800 shadow-sm">
                              <img src={note.fileUrl} alt={note.title} className="w-full h-auto max-h-96 object-cover" />
                            </div>
                          ) : (
                            <a href={note.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700">
                              <Paperclip size={18} className="text-zinc-400" />
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white truncate">Resource Attached</p>
                                <p className="text-[10px] text-zinc-500 truncate">{note.fileUrl.split('/').pop()}</p>
                              </div>
                            </a>
                          )}
                        </div>
                      )}
                      
                      <div className="mt-8 pt-6 border-t border-zinc-50 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center font-black text-[10px]">
                            {note.authorName?.[0] || '?'}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-900 dark:text-white italic">
                            {note.authorName || 'Student'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {notes.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-300">
                    <BookOpen size={64} strokeWidth={1} />
                    <p className="mt-4 font-medium italic">No notes shared yet.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'whiteboard' && groupId && (
              <CollaborativeWhiteboard groupId={groupId} userId={user?.uid || ''} />
            )}

            {activeTab === 'scratchpad' && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8 md:p-10 min-h-[620px] flex flex-col shadow-sm gap-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black tracking-widest uppercase px-2.5 py-1 bg-violet-50 dark:bg-violet-955/20 text-violet-600 rounded-full">Collaborative Draft</span>
                    <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Workspace Code & Notes Editor</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 italic">Synchronized multi-editor workspace companion</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <select
                      value={editorLanguage}
                      onChange={(e) => setEditorLanguage(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-150 dark:border-zinc-700 text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer text-zinc-600 dark:text-zinc-300 shadow-sm"
                    >
                      <option value="plaintext">📄 Plain Text</option>
                      <option value="javascript">🌐 JavaScript</option>
                      <option value="python">🐍 Python</option>
                      <option value="markdown">📝 Markdown</option>
                      <option value="html">🌐 HTML/CSS</option>
                    </select>
                  </div>
                </div>

                {/* AI Assistant pane */}
                <div className="p-4 bg-violet-500/5 border border-violet-500/10 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-medium">
                  <div className="space-y-1">
                    <p className="font-extrabold uppercase text-[9px] tracking-widest text-violet-600">✨ Realtime AI Copilot Assisted actions</p>
                    <p className="text-zinc-550 dark:text-zinc-400">Optimize scripts, complete notes, or format drafts instantly using our specialized Gemini Core compiler.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAIEditorAssist('refactor')}
                      disabled={editorLoading}
                      className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      {editorLoading ? "Processing..." : "✨ Optimize Draft"}
                    </button>
                    <button
                      onClick={() => handleAIEditorAssist('complete')}
                      disabled={editorLoading}
                      className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-55 text-white dark:text-zinc-900 disabled:opacity-50 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      {editorLoading ? "Processing..." : "📝 Complete text"}
                    </button>
                  </div>
                </div>

                {editorNotes && (
                  <div className="px-4 py-2 px-6 bg-zinc-50 dark:bg-zinc-800/40 text-[10px] font-semibold text-zinc-500 rounded-xl leading-relaxed italic border-l-4 border-violet-500">
                    {editorNotes}
                  </div>
                )}

                {/* Editor textarea container with code line-numbers simulation */}
                <div className="flex-1 w-full bg-zinc-950 rounded-2xl border border-zinc-850 flex overflow-hidden font-mono text-zinc-300 min-h-[350px]">
                  {/* Simulated Line numbers */}
                  <div className="py-6 px-4 bg-zinc-900/50 border-r border-zinc-900 text-right select-none font-sans text-xs text-zinc-600 font-extrabold flex flex-col gap-[4.5px]">
                    {Array.from({ length: Math.min(25, scratchpad.split('\n').length + 1) }).map((_, i) => (
                      <span key={i}>{i + 1}</span>
                    ))}
                  </div>

                  <textarea
                    value={scratchpad}
                    onChange={handleScratchpadChange}
                    placeholder={`[// Write your shared ${editorLanguage} content or general notes guidelines here...]`}
                    className="flex-1 w-full bg-transparent p-6 text-xs md:text-sm leading-6 text-zinc-100 border-none outline-none resize-none font-mono placeholder-zinc-700"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Auto-Synched Cloud Slate</span>
                  </div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Character Count: {scratchpad.length}</span>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-6 md:p-10 min-h-[600px] flex flex-col shadow-sm gap-6 animate-fadeIn">
                <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <span className="text-[9px] font-black tracking-widest uppercase px-2.5 py-1 bg-amber-50 dark:bg-amber-955/20 text-amber-600 rounded-full">Workspace Board</span>
                    <h2 className="text-xl font-bold tracking-tight mb-1 uppercase text-zinc-900 dark:text-white">Workspace Priority Board</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Keep track of tasks with your friends by urgency metrics</p>
                  </div>
                  {/* Priority/Severity Filtering Switchers */}
                  <div className="flex bg-zinc-50 dark:bg-zinc-800 p-1.5 rounded-2xl gap-1.5 self-start sm:self-auto shrink-0 border border-zinc-150 dark:border-zinc-700/65 shadow-sm">
                    {['all', 'urgent', 'high', 'medium', 'low'].map((pFilter) => (
                      <button
                        key={pFilter}
                        onClick={() => setTaskPriorityFilter(pFilter)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                          taskPriorityFilter === pFilter
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                            : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        )}
                      >
                        {pFilter}
                      </button>
                    ))}
                  </div>
                </header>

                <div className="flex flex-col gap-4 mb-2 bg-zinc-50 dark:bg-zinc-800 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
                  <div className="flex flex-col md:flex-row gap-3">
                    <input 
                      type="text"
                      placeholder="Identify new objective..."
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl px-5 py-3.5 font-bold text-sm text-zinc-850 dark:text-zinc-100 border-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/10 outline-none transition-all placeholder-zinc-400 shadow-sm"
                    />
                    <select
                      value={taskAssigneeId}
                      onChange={(e) => setTaskAssigneeId(e.target.value)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 text-xs font-black uppercase tracking-widest px-4 py-3 rounded-2xl cursor-pointer shadow-sm hover:border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-700 dark:text-zinc-300"
                    >
                      <option value="">Unassigned</option>
                      <option value={user?.uid}>For Me</option>
                      {members.filter(m => m.uid !== user?.uid).map(member => (
                        <option key={member.uid} value={member.uid}>
                          For {member.displayName || 'Circle Member'}
                        </option>
                      ))}
                    </select>

                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 text-xs font-black uppercase tracking-widest px-4 py-3 rounded-2xl cursor-pointer shadow-sm hover:border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-700 dark:text-zinc-300"
                    >
                      <option value="low">🟡 Low Priority</option>
                      <option value="medium">🔵 Medium Priority</option>
                      <option value="high">🟠 High Priority</option>
                      <option value="urgent">🔴 Urgent Severity</option>
                    </select>
                  </div>

                  <input 
                    type="text"
                    placeholder="Provide additional task notes context / goals (optional)..."
                    value={newTaskNotes}
                    onChange={(e) => setNewTaskNotes(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-900 rounded-2xl px-5 py-3.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-500/10 outline-none transition-all placeholder-zinc-400 shadow-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTaskText.trim()) {
                        handleAddTask(newTaskText, taskAssigneeId, newTaskNotes);
                        setNewTaskText('');
                        setNewTaskNotes('');
                      }
                    }}
                  />

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => {
                        if (newTaskText.trim()) {
                          handleAddTask(newTaskText, taskAssigneeId, newTaskNotes);
                          setNewTaskText('');
                          setNewTaskNotes('');
                        }
                      }}
                      disabled={!newTaskText.trim()}
                      className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer shadow-md"
                    >
                      <Plus size={16} />
                      Publish Objective
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <AnimatePresence>
                    {tasks
                      .filter(t => taskPriorityFilter === 'all' || (t.priority || 'medium') === taskPriorityFilter)
                      .map((task) => {
                        const prio = task.priority || 'medium';
                        return (
                          <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className={cn(
                              "flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-5 rounded-3xl border transition-all gap-4",
                              task.completed 
                                ? "bg-zinc-50 dark:bg-zinc-850/50 border-transparent opacity-60 font-mono" 
                                : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 hover:shadow-md"
                            )}
                          >
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              <button 
                                onClick={() => toggleTask(task.id)}
                                className={cn(
                                  "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 cursor-pointer",
                                  task.completed 
                                    ? "bg-blue-600 border-blue-600 text-white" 
                                    : "border-zinc-200 dark:border-zinc-700 text-transparent hover:border-blue-500"
                                )}
                              >
                                <ShieldCheck size={14} />
                              </button>
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className={cn(
                                    "font-black text-sm",
                                    task.completed ? "line-through text-zinc-400" : "text-zinc-900 dark:text-white"
                                  )}>
                                    {task.text}
                                  </span>
                                  
                                  {/* Severity/Priority cycles on badge click! */}
                                  <button
                                    onClick={() => handleTogglePriority(task.id)}
                                    title="Click to cycle priority"
                                    className={cn(
                                      "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md border cursor-pointer select-none transition-all hover:scale-105 active:scale-95 whitespace-nowrap",
                                      prio === 'urgent' && "bg-red-50 text-red-650 border-red-200 dark:bg-red-955/20 dark:text-red-400",
                                      prio === 'high' && "bg-amber-50 text-amber-650 border-amber-200 dark:bg-amber-955/20 dark:text-amber-400",
                                      prio === 'medium' && "bg-blue-50 text-blue-600 border-blue-250 dark:bg-blue-955/20 dark:text-blue-400",
                                      prio === 'low' && "bg-zinc-50 text-zinc-500 border-zinc-250 dark:bg-zinc-800 dark:text-zinc-400"
                                    )}
                                  >
                                    ● {prio}
                                  </button>
                                </div>
                                {task.notes && (
                                  <p className={cn(
                                    "text-xs italic font-semibold leading-relaxed block",
                                    task.completed ? "text-zinc-400" : "text-zinc-550 dark:text-zinc-400"
                                  )}>
                                    {task.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-zinc-100 dark:border-zinc-800">
                              <select
                                value={task.assigneeId || ''}
                                onChange={(e) => handleReassignTask(task.id, e.target.value)}
                                className="bg-zinc-50 dark:bg-zinc-800 border bg-white dark:bg-zinc-800 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500/20 text-zinc-550 dark:text-zinc-400"
                              >
                                <option value="">Unassigned</option>
                                <option value={user?.uid}>Me</option>
                                {members.filter(m => m.uid !== user?.uid).map(member => (
                                  <option key={member.uid} value={member.uid}>
                                    {member.displayName || 'Circle Member'}
                                  </option>
                                ))}
                              </select>

                              <button 
                                onClick={() => removeTask(task.id)}
                                className="p-2 text-zinc-350 hover:text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                  </AnimatePresence>

                  {tasks.filter(t => taskPriorityFilter === 'all' || (t.priority || 'medium') === taskPriorityFilter).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-300 italic">
                      <LayoutGrid size={48} strokeWidth={1} />
                      <p className="mt-4 text-xs font-black uppercase tracking-widest text-zinc-400">No active objectives for this priority.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'quiz' && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-6 md:p-10 min-h-[600px] flex flex-col shadow-sm">
                <header className="mb-8">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-full mb-3 inline-block">
                    Practice Quiz
                  </span>
                  <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase text-zinc-900 dark:text-white flex items-center gap-2">
                    <Brain className="text-blue-600 flex-shrink-0" size={24} />
                    Practice Quiz Maker
                  </h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">
                    Test your friends and practice what you learned together using custom AI quizzes!
                  </p>
                </header>

                {quizError && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-955/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold leading-relaxed flex items-center gap-3">
                    <Info size={16} />
                    <span>{quizError}</span>
                  </div>
                )}

                {/* Loading State */}
                {quizLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl scale-125 animate-pulse" />
                      <Loader2 className="animate-spin text-blue-600 relative z-10" size={56} />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-100 mb-2">
                      Preparing Study Exercises
                    </h3>
                    <p className="text-xs text-zinc-500 max-w-sm italic">
                      Formulating premium high-fidelity multiple-choice structures, calibrating plausible distractors, and writing concepts guidelines...
                    </p>
                  </div>
                )}

                {/* Setup Mode */}
                {!quizLoading && !currentQuiz && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="p-6 bg-zinc-50 dark:bg-zinc-800/40 rounded-3xl border border-zinc-100/50 dark:border-zinc-800/40">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 block ml-1">
                          Define Assessment Topic or Domain
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Krebs Cycle, French Revolution, Quantum Mechanics, Python OOP..."
                          value={quizTopic}
                          onChange={(e) => setQuizTopic(e.target.value)}
                          className="w-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl px-5 py-4 font-bold text-sm border border-zinc-100 dark:border-zinc-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-zinc-400"
                        />
                      </div>

                      {/* Notes-based Quick Generation */}
                      {notes.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
                            Generate from Shared Resources
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {notes.slice(0, 4).map((note) => (
                              <button
                                key={note.id}
                                onClick={() => {
                                  const titleToUse = note.title || "Shared Note";
                                  setQuizTopic(titleToUse);
                                  handleGenerateQuiz(note.content || note.title);
                                }}
                                className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl text-left hover:border-blue-500 dark:hover:border-blue-500 shadow-sm transition-all group cursor-pointer"
                              >
                                <div className="p-2 bg-blue-50 dark:bg-blue-955/40 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors flex-shrink-0">
                                  <FileText size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-zinc-900 dark:text-white truncate uppercase tracking-tight">
                                    {note.title || "Untitled Document"}
                                  </p>
                                  <p className="text-[9px] text-zinc-400 tracking-wider truncate font-mono uppercase mt-0.5">
                                    Click to formulate instant quiz
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Predefined Categories */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
                          Suggested Subject Topics
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {[
                            "Cellular Respiration",
                            "Linear Algebra Basics",
                            "World War I Catalyst",
                            "Mechanics & Thermodynamics",
                            "Standard English Grammar",
                            "Trigonometric Identities"
                          ].map((suggested) => (
                            <button
                              key={suggested}
                              onClick={() => {
                                setQuizTopic(suggested);
                                handleGenerateQuiz(suggested);
                              }}
                              className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold rounded-xl border border-zinc-100 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:border-zinc-300 transition-all cursor-pointer"
                            >
                              {suggested}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleGenerateQuiz()}
                      disabled={!quizTopic.trim()}
                      className="w-full mt-10 py-5 bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-zinc-100 dark:shadow-none transition-all cursor-pointer"
                    >
                      <Brain size={18} />
                      Generate Custom AI Challenge
                    </button>
                  </div>
                )}

                {/* Active Assessment Mode */}
                {!quizLoading && currentQuiz && !quizCompleted && (
                  <div className="flex-1 flex flex-col justify-between" id="group-quiz-view-container">
                    <div>
                      {/* Circular Progress Nodes */}
                      <div className="mb-8 space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center block">
                          Evaluation Loops (Active Circles)
                        </label>
                        <div className="flex justify-center items-center gap-3">
                          {currentQuiz.questions.map((_: any, qIdx: number) => {
                            const isCurrent = qIdx === currentQuestionIndex;
                            const isAnswered = qIdx < currentQuestionIndex;
                            return (
                              <div
                                key={qIdx}
                                className={cn(
                                  "w-12 h-12 rounded-full border-2 flex items-center justify-center text-xs font-black transition-all duration-200 shadow-sm",
                                  isCurrent
                                    ? "bg-blue-600 border-blue-600 text-white ring-4 ring-blue-500/20 scale-110"
                                    : isAnswered
                                      ? "bg-green-500 border-green-500 text-white"
                                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-250 dark:border-zinc-750"
                                )}
                              >
                                {qIdx + 1}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-zinc-400 px-1 pt-1">
                          <span>Progress: {Math.round(((currentQuestionIndex) / currentQuiz.questions.length) * 100)}% Complete</span>
                          <span className="text-blue-600 dark:text-blue-400 font-mono">Current Score: {quizScore} / {currentQuiz.questions.length}</span>
                        </div>
                      </div>

                      {/* Question Content */}
                      <div className="mb-8 p-6 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/40 rounded-3xl">
                        <h3 className="text-base md:text-lg font-bold text-zinc-900 dark:text-white leading-snug">
                          {currentQuiz.questions[currentQuestionIndex].question}
                        </h3>
                      </div>

                      {/* Choices */}
                      <div className="space-y-3">
                        {currentQuiz.questions[currentQuestionIndex].options.map((option: string, idx: number) => {
                          const isSelected = selectedOption === idx;
                          const isCorrect = idx === currentQuiz.questions[currentQuestionIndex].correctAnswerIndex;
                          
                          let btnStyle = "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200";
                          if (!isAnswerSubmitted) {
                            btnStyle = isSelected 
                              ? "bg-blue-50 dark:bg-blue-950/20 border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/20" 
                              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-350 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-200";
                          } else {
                            if (isCorrect) {
                              btnStyle = "bg-green-50 dark:bg-green-955/30 border-green-500 text-green-900 dark:text-green-300 ring-2 ring-green-500/10";
                            } else if (isSelected) {
                              btnStyle = "bg-red-50 dark:bg-red-955/30 border-red-500 text-red-900 dark:text-red-300 ring-2 ring-red-500/10";
                            } else {
                              btnStyle = "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 opacity-60";
                            }
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => handleSelectOption(idx)}
                              disabled={isAnswerSubmitted}
                              className={cn(
                                "w-full p-5 border rounded-2xl font-bold text-sm text-left transition-all flex items-center justify-between group cursor-pointer",
                                btnStyle
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <span className={cn(
                                  "w-8 h-8 rounded-full text-xs font-black flex items-center justify-center border-2 flex-shrink-0 transition-all",
                                  isSelected 
                                    ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                                    : "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border-zinc-250 dark:border-zinc-750"
                                )}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span className="text-zinc-800 dark:text-zinc-150 leading-snug">{option}</span>
                              </div>
                              
                              {/* Inline status icon once submitted */}
                              {isAnswerSubmitted && (
                                <div className="flex-shrink-0 ml-3">
                                  {isCorrect ? (
                                    <CheckCircle2 size={18} className="text-green-600 mr-1" />
                                  ) : isSelected ? (
                                    <X size={18} className="text-red-600 mr-1" />
                                  ) : null}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Callout */}
                      {isAnswerSubmitted && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 p-6 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100/60 dark:border-blue-900/10 rounded-3xl"
                        >
                          <div className="flex gap-2 items-center mb-1 text-blue-700 dark:text-blue-300">
                            <HelpCircle size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              Conceptual Insight
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
                            {currentQuiz.questions[currentQuestionIndex].explanation}
                          </p>
                        </motion.div>
                      )}
                    </div>

                    {/* Quiz Controls */}
                    <div className="mt-10">
                      {!isAnswerSubmitted ? (
                        <button
                          onClick={handleSubmitAnswer}
                          disabled={selectedOption === null}
                          className="w-full py-5 bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-105 text-white dark:text-zinc-900 font-black text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          Confirm Selection
                        </button>
                      ) : (
                        <button
                          onClick={handleNextQuestion}
                          className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          {currentQuestionIndex < currentQuiz.questions.length - 1 ? (
                            <>
                              Next Question
                              <ChevronRight size={16} />
                            </>
                          ) : (
                            <>
                              Finish Assessment
                              <Trophy size={16} />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Score Summary Completed */}
                {!quizLoading && quizCompleted && currentQuiz && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* Reward Badge Card */}
                      <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] mb-8 relative overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500/5 dark:bg-blue-400/5 blur-3xl scale-125" />
                        <div className="inline-flex p-5 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-600 rounded-[2rem] border border-yellow-105/40 dark:border-yellow-900/30 mb-4 animate-bounce relative z-10">
                          <Trophy size={48} />
                        </div>
                        <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-1 relative z-10">
                          Assessment Complete
                        </h3>
                        {quizScore >= 4 ? (
                          <span className="text-[10px] font-black uppercase tracking-widest text-green-600 relative z-10">
                            Gold Level Proficiency! Excellent performance.
                          </span>
                        ) : quizScore >= 2 ? (
                          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 relative z-10">
                            Silver Mastery Achieved. Good retention!
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 relative z-10">
                            Challenge Conquered. Revision suggested.
                          </span>
                        )}

                        <div className="mt-6 flex justify-center items-baseline gap-1 relative z-10">
                          <span className="text-5xl font-black tracking-tighter text-blue-600 dark:text-blue-400">{quizScore}</span>
                          <span className="text-sm font-bold text-zinc-400 font-mono">/ {currentQuiz.questions.length}</span>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium italic mt-2 relative z-10">
                          Retained {Math.round((quizScore / currentQuiz.questions.length) * 100)}% of targeted evaluation metrics
                        </p>
                      </div>

                      {/* Detailed Revision Review Section */}
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
                          Assessment Revision Breakdown
                        </h4>
                        
                        {currentQuiz.questions.map((q: any, i: number) => {
                          const chosenIdx = quizAnswers[i];
                          const correctIdx = q.correctAnswerIndex;
                          const wasChoiceCorrect = chosenIdx === correctIdx;

                          return (
                            <div
                              key={i}
                              className="p-5 border border-zinc-100 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 space-y-3 shadow-sm"
                            >
                              <div className="flex gap-2 items-start justify-between">
                                <span className="text-[10px] font-black font-mono text-zinc-300 dark:text-zinc-650 uppercase mt-0.5 whitespace-nowrap">
                                  Q{i + 1}
                                </span>
                                <h5 className="flex-1 font-bold text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed pr-2">
                                  {q.question}
                                </h5>
                                <span className={cn(
                                  "px-2.5 py-1 text-[8px] font-black uppercase tracking-widest rounded-md",
                                  wasChoiceCorrect 
                                    ? "bg-green-50 dark:bg-green-955/20 text-green-600 border border-green-150/40" 
                                    : "bg-red-50 dark:bg-red-955/20 text-red-600 border border-red-150/40"
                                )}>
                                  {wasChoiceCorrect ? "Correct" : "Incorrect"}
                                </span>
                              </div>

                              <div className="text-[11px] space-y-1 bg-zinc-50 dark:bg-zinc-850/40 p-3 rounded-xl border border-zinc-100/50 dark:border-zinc-800/60 font-medium">
                                <div className="flex gap-1">
                                  <span className="text-zinc-450 text-[10px] font-bold uppercase tracking-wide">Your Choice:</span>
                                  <span className={cn(wasChoiceCorrect ? "text-green-600" : "text-red-500", "font-bold")}>
                                    {chosenIdx !== undefined && q.options[chosenIdx] ? q.options[chosenIdx] : "None"}
                                  </span>
                                </div>
                                {!wasChoiceCorrect && (
                                  <div className="flex gap-1 pt-0.5">
                                    <span className="text-zinc-450 text-[10px] font-bold uppercase tracking-wide">Expected Correct:</span>
                                    <span className="text-green-600 font-bold">
                                      {q.options[correctIdx]}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <p className="text-[10px] text-zinc-500 italic leading-relaxed border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                                {q.explanation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setCurrentQuiz(null);
                        setQuizTopic("");
                        setQuizCompleted(false);
                      }}
                      className="w-full mt-10 py-5 bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Brain size={18} />
                      Configure New Challenge
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'doubts' && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-6 md:p-10 min-h-[600px] flex flex-col shadow-sm gap-8 animate-fadeIn">
                <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 dark:bg-amber-955/40 px-3 py-1.5 rounded-full mb-3 inline-block">
                      Collaborative Forum
                    </span>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase text-zinc-900 dark:text-white flex items-center gap-2">
                      <HelpCircle className="text-amber-500 flex-shrink-0" size={24} />
                      Peer Doubts Forum
                    </h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">
                      Post your doubts, help your classmates, and unlock knowledge milestones (+50 growth credits per accepted doubt solved)
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsAddingDoubt(!isAddingDoubt)}
                    className="p-3 bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0 transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm"
                  >
                    <Plus size={16} />
                    {isAddingDoubt ? "Hide Form" : "Post a Doubt"}
                  </button>
                </header>

                {/* Add Doubt Form */}
                {isAddingDoubt && (
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-850 rounded-[2rem] border border-zinc-150/40 dark:border-zinc-800 space-y-4 shadow-sm animate-fadeIn">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Ask a New Doubt</h3>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Doubt Title (e.g., Chemistry Periodic Trends)"
                        value={newDoubt.title}
                        onChange={(e) => setNewDoubt(p => ({ ...p, title: e.target.value }))}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-800 dark:text-white placeholder:text-zinc-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                      />
                      <textarea
                        placeholder="Explain your doubt in detail. Paste instructions/problems so classmates can reconstruct it..."
                        value={newDoubt.content}
                        onChange={(e) => setNewDoubt(p => ({ ...p, content: e.target.value }))}
                        rows={4}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-800 dark:text-white placeholder:text-zinc-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none resize-none"
                      />
                      <button
                        onClick={handleAddDoubt}
                        disabled={!newDoubt.title.trim() || !newDoubt.content.trim()}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-sm shadow-blue-500/15"
                      >
                        Submit Doubt
                      </button>
                    </div>
                  </div>
                )}

                {/* Doubts List */}
                <div className="space-y-6">
                  {doubts.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-850 rounded-[2.5rem] p-8 flex flex-col justify-center items-center gap-3">
                      <HelpCircle size={40} className="text-zinc-300" />
                      <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Collaborative slate is empty</p>
                      <p className="text-[10px] text-zinc-400 max-w-sm italic">Classmates haven't raised any doubts yet. If you are stuck, create one above!</p>
                    </div>
                  ) : (
                    doubts.map((doubt: any) => (
                      <div key={doubt.id} className="p-6 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] bg-zinc-50/40 dark:bg-zinc-900/40 space-y-6 shadow-sm shadow-zinc-100/10">
                        {/* Header details */}
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-black uppercase tracking-tight text-zinc-900 dark:text-white">{doubt.title}</h3>
                              {doubt.isSolved ? (
                                <span className="bg-green-100 dark:bg-green-955/20 text-green-650 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full border border-green-200/30">Resolved</span>
                              ) : (
                                <span className="bg-amber-100 dark:bg-amber-955/20 text-amber-600 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full border border-amber-200/30">Active Doubt</span>
                              )}
                            </div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-1">Raised by {doubt.authorName} • {doubt.createdAt ? new Date(doubt.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}</p>
                          </div>
                        </div>

                        {/* Doubt description */}
                        <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm text-xs font-medium text-zinc-700 dark:text-zinc-350 leading-relaxed italic">
                          "{doubt.content}"
                        </div>

                        {/* Answers block */}
                        <div className="space-y-4">
                          <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Classroom Answers ({doubt.answers?.length || 0})</h4>
                          
                          {doubt.answers?.length > 0 && (
                            <div className="space-y-3.5 pl-4 border-l-2 border-zinc-150/60 dark:border-zinc-800">
                              {doubt.answers.map((answer: any) => {
                                const isAccepted = doubt.acceptedAnswerId === answer.id;
                                return (
                                  <div key={answer.id} className={cn("p-4 rounded-2xl space-y-2.5 transition-all text-xs border shadow-sm", isAccepted ? "bg-green-50/50 dark:bg-green-955/10 border-green-200" : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-850")}>
                                    <div className="flex justify-between items-center">
                                      <span className="font-black uppercase text-[9px] tracking-widest text-zinc-400">{answer.authorName} answered:</span>
                                      {isAccepted && (
                                        <span className="text-[8px] font-black uppercase tracking-widest text-green-600 flex items-center gap-1 bg-green-100 dark:bg-green-950/40 border border-green-200 px-2 py-0.5 rounded-md">
                                          <CheckCircle2 size={10} /> Accepted Solution
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{answer.content}</p>
                                    
                                    {/* Author actions */}
                                    {!doubt.isSolved && doubt.authorId === user?.uid && (
                                      <button 
                                        onClick={() => handleAcceptAnswer(doubt.id, answer)}
                                        className="py-1.5 px-3 bg-green-600 hover:bg-green-700 text-white font-black text-[8px] uppercase tracking-widest rounded-md cursor-pointer transition-all border border-green-500 shadow-sm"
                                      >
                                        Accept Solution & Award Growth Credits
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Write Answer Form */}
                          {!doubt.isSolved && (
                            <div className="flex gap-2.5">
                              <input
                                type="text"
                                placeholder="Post an educational answer/hint to help..."
                                value={newDoubtAnswer[doubt.id] || ''}
                                onChange={(e) => setNewDoubtAnswer(prev => ({ ...prev, [doubt.id]: e.target.value }))}
                                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-3.5 text-xs font-bold text-zinc-800 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                              />
                              <button
                                onClick={() => handleAddAnswer(doubt.id)}
                                disabled={!(newDoubtAnswer[doubt.id] || '').trim()}
                                className="px-5 bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer disabled:opacity-45 transition-all border border-zinc-200 dark:border-zinc-700"
                              >
                                Answer
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'modules' && (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-6 md:p-10 min-h-[600px] flex flex-col shadow-sm gap-8">
                <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 dark:bg-rose-955/20 px-3 py-1.5 rounded-full mb-3 inline-block">
                      Learning Syllabus
                    </span>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase text-zinc-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 className="text-rose-500 flex-shrink-0" size={24} />
                      Syllabus Study Modules
                    </h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-1">
                      Complete learning modules curated by circle admins, earn +100 growth credits, and master requirements
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsAddingModule(!isAddingModule)}
                    className="p-3 bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0 transition-all border border-zinc-200 dark:border-zinc-700 shadow-sm"
                  >
                    <Plus size={16} />
                    {isAddingModule ? "Hide Form" : "Create Module"}
                  </button>
                </header>

                {/* Create Module Form */}
                {isAddingModule && (
                  <div className="p-6 bg-zinc-50 dark:bg-zinc-850 rounded-[2rem] border border-zinc-150/40 dark:border-zinc-800 space-y-4 shadow-sm animate-fadeIn">
                    <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Curate New Syllabus Module</h3>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Module Title (e.g., Module 1: Pre-Calculus Limits & Continuity)"
                        value={newModule.title}
                        onChange={(e) => setNewModule(p => ({ ...p, title: e.target.value }))}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-800 dark:text-white placeholder:text-zinc-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Core guidelines/reading reference details..."
                        value={newModule.description}
                        onChange={(e) => setNewModule(p => ({ ...p, description: e.target.value }))}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-800 dark:text-white placeholder:text-zinc-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                      />
                      <button
                        onClick={handleAddModule}
                        disabled={!newModule.title.trim()}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer shadow-sm shadow-blue-500/15"
                      >
                        Publish Study Module
                      </button>
                    </div>
                  </div>
                )}

                {/* Modules List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                  {modules.length === 0 ? (
                    <div className="py-20 text-center border-2 border-dashed border-zinc-100 dark:border-zinc-850 rounded-[2.5rem] p-8 col-span-2 flex flex-col justify-center items-center gap-3">
                      <CheckCircle2 size={40} className="text-zinc-300 animate-pulse" />
                      <p className="text-xs font-black uppercase tracking-wider text-zinc-400">No active study modules curated</p>
                      <p className="text-[10px] text-zinc-400 max-w-sm italic">Define collaborative reading requirements using the module creator above!</p>
                    </div>
                  ) : (
                    modules.map((m: any) => {
                      const isCompleted = m.completedBy?.includes(user?.uid);
                      return (
                        <div key={m.id} className={cn("p-6 border rounded-[2.5rem] bg-zinc-50/40 dark:bg-zinc-900/40 space-y-4 relative overflow-hidden flex flex-col justify-between transition-all", isCompleted ? "border-green-200" : "border-zinc-100 dark:border-zinc-800 hover:scale-[1.01]")}>
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-4">
                              <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white text-wrap pr-4">{m.title}</h3>
                              {isCompleted ? (
                                <span className="bg-green-105 text-green-750 dark:bg-green-955/20 dark:text-green-400 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full border border-green-150 whitespace-nowrap">Completed</span>
                              ) : (
                                <span className="bg-blue-50 text-blue-600 dark:bg-blue-955/20 dark:text-blue-400 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full border border-blue-150 animate-pulse whitespace-nowrap">In Progress</span>
                              )}
                            </div>
                            <p className="text-xs italic text-zinc-500 font-medium leading-relaxed">"{m.description || 'No instructions specified.'}"</p>
                          </div>

                          <div className="flex items-center justify-between gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-[8.5px] font-black uppercase tracking-widest text-zinc-400 font-mono">Completed by: {m.completedBy?.length || 0} classmates</span>
                            {!isCompleted ? (
                              <button
                                onClick={() => handleCompleteModule(m.id)}
                                className="py-2 bg-zinc-900 hover:bg-zinc-850 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0"
                              >
                                Complete (+100 Credits)
                              </button>
                            ) : (
                              <span className="text-[9px] font-black uppercase tracking-widest text-green-600 flex items-center gap-1 font-mono">Done✓</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/20 blur-[60px] rounded-full" />
            <h3 className="font-bold text-xl mb-6 tracking-tight italic underline decoration-blue-500 underline-offset-8">
              Study Mission
            </h3>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed mb-6 italic">
              "To master the complexities of our syllabus through collaborative inquiry and mutual support."
            </p>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2 block">Circle Engagement</span>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Resources</span>
                  <span className="font-bold">{notes.length}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Board Complexity</span>
                  <span className="font-bold">{group?.whiteboardLines?.length || 0} strokes</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] p-8">
            <h3 className="font-bold text-lg mb-6 tracking-tight uppercase">Study Chat</h3>
            <button 
              onClick={() => navigate('/app/chats')}
              className="w-full py-4 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
            >
              <Send size={14} /> Group Messages
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isInviting && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-black tracking-tight uppercase mb-6 text-zinc-900 dark:text-white">
                Invite <span className="text-blue-600">Peers</span>
              </h2>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                {friends.filter(f => !group?.memberIds?.includes(f.uid)).length === 0 ? (
                  <p className="text-zinc-400 text-center py-10 italic">No friends to invite.</p>
                ) : (
                  friends.filter(f => !group?.memberIds?.includes(f.uid)).map(friend => (
                    <div key={friend.uid} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-xs font-bold text-zinc-500">
                          {friend.displayName?.[0]}
                        </div>
                        <span className="font-bold text-sm text-zinc-900 dark:text-white">{friend.displayName}</span>
                      </div>
                      <button 
                        onClick={() => inviteFriend(friend.uid)}
                        className="text-blue-600 hover:bg-blue-600 hover:text-white p-2 rounded-xl transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button 
                onClick={() => setIsInviting(false)}
                className="w-full mt-6 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-xs uppercase tracking-widest"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}

        {isAdding && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 w-full max-w-2xl shadow-2xl"
            >
              <header className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-3 text-zinc-900 dark:text-white">
                  <div className="w-2 h-8 bg-blue-600 rounded-full" />
                  Add Shared Resource
                </h2>
              </header>

              <div className="space-y-4">
                <input 
                  type="text"
                  placeholder="Resource Title"
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl px-6 py-4 font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  value={newNote.title}
                  onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                />
                <textarea 
                  placeholder="Context or findings..."
                  rows={6}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl px-6 py-6 text-zinc-600 dark:text-zinc-400 focus:ring-2 focus:ring-blue-500 transition-all resize-none outline-none font-medium italic"
                  value={newNote.content}
                  onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                />
                
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 ml-2">Attached Material</span>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  {!selectedFile ? (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full p-6 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] text-zinc-400 hover:border-blue-500 hover:text-blue-600 transition-all flex flex-col items-center gap-2 group"
                    >
                      <Paperclip size={24} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest italic">Attach Document or Diagram</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <FileText className="text-blue-600" size={20} />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-blue-900 dark:text-blue-100 truncate uppercase">{selectedFile.name}</p>
                          <p className="text-[10px] text-blue-400 uppercase">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedFile(null)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all uppercase text-xs tracking-widest"
                >
                  Discard
                </button>
                <button 
                  onClick={handleAddNote}
                  disabled={uploading}
                  className="flex-1 px-6 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all flex items-center justify-center gap-2 uppercase text-xs tracking-widest disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  {uploading ? 'Transmitting...' : 'Publish'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <span className="text-[9px] font-black uppercase tracking-widest text-yellow-400">Milestone Achievement!</span>
              <h3 className="text-base font-black uppercase tracking-tight text-white mt-0.5 animate-pulse">Growth Unlocked!</h3>
              <p className="text-xs font-bold text-zinc-350 mt-1">
                You gained <span className="text-blue-400 font-black">+{gamificationAlert.xp} growth credits</span> for your focus milestone.
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
    </div>
  );
}
