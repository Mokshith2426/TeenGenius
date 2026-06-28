import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Bell, 
  BookOpen, 
  Award, 
  UserPlus, 
  Clock, 
  MessageSquare, 
  FileText, 
  HelpCircle, 
  CheckCircle2, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

interface AssignmentTask {
  id: string;
  classroomId: string;
  classroomName: string;
  text: string;
  completed: boolean;
  dueDate?: string;
}

interface Announcement {
  id: string;
  classroomId: string;
  classroomName: string;
  title?: string;
  content: string;
  authorName: string;
  timestamp: Date;
}

interface QuizChallenge {
  id: string;
  classroomId: string;
  classroomName: string;
  title: string;
  topic?: string;
}

interface BuddyRequest {
  id: string;
  fromId: string;
  fromName: string;
  fromEmail: string;
}

interface AcademicResource {
  id: string;
  classroomId: string;
  classroomName: string;
  title: string;
  type: string;
  fileUrl?: string;
}

export default function AcademicActivityFeed() {
  const { user, isGuest, userRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'work' | 'announcements' | 'quizzes' | 'buddies'>('work');
  
  // Real datasets loaded from Firestore
  const [assignments, setAssignments] = useState<AssignmentTask[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [quizzes, setQuizzes] = useState<QuizChallenge[]>([]);
  const [buddyRequests, setBuddyRequests] = useState<BuddyRequest[]>([]);
  const [resources, setResources] = useState<AcademicResource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const isSandbox = isGuest || user.uid.includes('sandbox');

    if (isSandbox) {
      // Setup pristine, contextual mock data that represents natural classroom databases
      setAssignments([
        { id: 'sb_a1', classroomId: 'sb_group1', classroomName: 'AP Calculus BC Study Circle', text: 'Revise Taylor series convergence sheet', completed: false, dueDate: 'Today, 11:59 PM' },
        { id: 'sb_a2', classroomId: 'sb_group1', classroomName: 'AP Calculus BC Study Circle', text: 'Submit Euler approximation worksheets', completed: false, dueDate: 'Tomorrow' },
        { id: 'sb_a3', classroomId: 'sb_group2', classroomName: 'Quantum Physics Peer Cohort', text: 'Formulate Schrodinger standard equations', completed: false, dueDate: 'May 30' }
      ]);
      setAnnouncements([
        { id: 'sb_an1', classroomId: 'sb_group1', classroomName: 'AP Calculus BC Study Circle', title: 'Calculus BC Mock Exam Schedule', content: 'Our comprehensive integrals review starts tomorrow morning at 9:00 AM CST. Live focus lobbies will be active.', authorName: 'Dr. Evelyn Foster', timestamp: new Date() },
        { id: 'sb_an2', classroomId: 'sb_group2', classroomName: 'Quantum Physics Peer Cohort', title: 'Chapter 4 Waveparticle Solutions published', content: 'I uploaded step-by-step breakdowns of the photoelectric equations. Please see the notes tab.', authorName: 'Marcus Vance (TA)', timestamp: new Date(Date.now() - 3600000) }
      ]);
      setQuizzes([
        { id: 'sb_q1', classroomId: 'sb_group1', classroomName: 'AP Calculus BC Study Circle', title: 'Taylor & Maclaurin Convergence Assessment', topic: 'Calculus BC Series' },
        { id: 'sb_q2', classroomId: 'sb_group2', classroomName: 'Quantum Physics Peer Cohort', title: 'Heisenberg Uncertainty Principle Challenge', topic: 'Quantum States' }
      ]);
      setBuddyRequests([
        { id: 'sb_br1', fromId: 'sb_f4', fromName: 'Rohan Gupta', fromEmail: 'rohan@teengenius.edu' },
        { id: 'sb_br2', fromId: 'sb_f5', fromName: 'Zoe Martinez', fromEmail: 'zoe@teengenius.edu' }
      ]);
      setResources([
        { id: 'sb_res1', classroomId: 'sb_group1', classroomName: 'AP Calculus BC Study Circle', title: 'Calculus BC Integration Cheat Sheet.pdf', type: 'PDF' },
        { id: 'sb_res2', classroomId: 'sb_group2', classroomName: 'Quantum Physics Peer Cohort', title: 'Double Slit Experiment Wave Equations.xlsx', type: 'spreadsheet' }
      ]);
      setLoading(false);
      return;
    }

    // --- REAL FIRESTORE SUBSCRIPTION BINDINGS ---
    setLoading(true);

    // 1. Subscribe to Pending Buddy Requests (friendRequests where status is pending)
    const buddyQ = query(
      collection(db, 'friendRequests'),
      where('toId', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubBuddy = onSnapshot(buddyQ, (snap) => {
      setBuddyRequests(snap.docs.map(doc => ({
        id: doc.id,
        fromId: doc.data().fromId || '',
        fromName: doc.data().fromName || 'Student Peer',
        fromEmail: doc.data().fromEmail || 'peer@teengenius.edu'
      })));
    }, () => setBuddyRequests([]));

    // 2. Subscribe to user's classrooms to fetch subcollections
    const classroomsQ = query(
      collection(db, 'studyGroups'),
      where('memberIds', 'array-contains', user.uid)
    );

    const activeSubcollectionUnsubscribeMap: Record<string, () => void> = {};

    const unsubClassrooms = onSnapshot(classroomsQ, (snap) => {
      const activeClassroomIds = snap.docs.map(doc => doc.id);
      const classroomNames: Record<string, string> = {};
      snap.docs.forEach(doc => {
        classroomNames[doc.id] = doc.data().name;
      });

      // Clear any previous active subcollection listeners for classrooms no longer in this snapshot
      Object.keys(activeSubcollectionUnsubscribeMap).forEach(key => {
        const [classroomId] = key.split(':');
        if (!activeClassroomIds.includes(classroomId)) {
          activeSubcollectionUnsubscribeMap[key]();
          delete activeSubcollectionUnsubscribeMap[key];
        }
      });

      if (activeClassroomIds.length === 0) {
        setAssignments([]);
        setAnnouncements([]);
        setQuizzes([]);
        setResources([]);
        setLoading(false);
        return;
      }

      // Aggregate classroom details
      const tempAssignments: AssignmentTask[] = [];

      // Extract tasks from groups themselves
      snap.docs.forEach(docInst => {
        const data = docInst.data();
        const rawTasks = data.tasks || [];
        rawTasks.forEach((t: any, idx: number) => {
          if (!t.completed) {
            tempAssignments.push({
              id: t.id || `task_${docInst.id}_${idx}`,
              classroomId: docInst.id,
              classroomName: data.name,
              text: t.text,
              completed: !!t.completed,
              dueDate: t.dueDate || 'Ongoing'
            });
          }
        });
      });
      setAssignments(tempAssignments);

      // Now query up to 5 classrooms for new notes (announcements) and doubts (upcoming challenges)
      const visibleClassroomIds = activeClassroomIds.slice(0, 5);
      let loadedClassroomsCount = 0;

      const aggregatedAnnouncements: Announcement[] = [];
      const aggregatedQuizzes: QuizChallenge[] = [];
      const aggregatedResources: AcademicResource[] = [];

      visibleClassroomIds.forEach(id => {
        const notesKey = `${id}:notes`;
        const doubtsKey = `${id}:doubts`;

        // Only create dynamic onSnapshot bindings if they don't already exist for this group
        if (!activeSubcollectionUnsubscribeMap[notesKey]) {
          const notesRef = query(collection(db, 'studyGroups', id, 'notes'), orderBy('timestamp', 'desc'), limit(5));
          const unsubNotes = onSnapshot(notesRef, (notesSnap) => {
            // Filter list to keep it local to this snapshot to avoid duplicate accumulation
            const otherAnnouncements = aggregatedAnnouncements.filter(a => a.classroomId !== id);
            const otherResources = aggregatedResources.filter(r => r.classroomId !== id);
            
            notesSnap.docs.forEach(nDoc => {
              const nData = nDoc.data();
              const timestamp = nData.timestamp?.toDate() || new Date();
              
              if (nData.type === 'image' || nData.fileUrl) {
                otherResources.push({
                  id: nDoc.id,
                  classroomId: id,
                  classroomName: classroomNames[id],
                  title: nData.title || `Resource File`,
                  type: nData.fileUrl?.includes('.pdf') ? 'PDF' : 'IMAGE',
                  fileUrl: nData.fileUrl
                });
              } else {
                otherAnnouncements.push({
                  id: nDoc.id,
                  classroomId: id,
                  classroomName: classroomNames[id],
                  title: nData.title || 'Classroom announcement',
                  content: nData.content,
                  authorName: nData.authorName || 'Teacher',
                  timestamp
                });
              }
            });

            // Re-aggregate and set state
            aggregatedAnnouncements.length = 0;
            aggregatedAnnouncements.push(...otherAnnouncements);
            aggregatedResources.length = 0;
            aggregatedResources.push(...otherResources);

            setAnnouncements([...aggregatedAnnouncements].sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()));
            setResources([...aggregatedResources]);
          });
          activeSubcollectionUnsubscribeMap[notesKey] = unsubNotes;
        }

        if (!activeSubcollectionUnsubscribeMap[doubtsKey]) {
          const doubtsRef = query(collection(db, 'studyGroups', id, 'doubts'), limit(5));
          const unsubDoubts = onSnapshot(doubtsRef, (doubtsSnap) => {
            const otherQuizzes = aggregatedQuizzes.filter(q => q.classroomId !== id);

            doubtsSnap.docs.forEach(dDoc => {
              const dData = dDoc.data();
              if (!dData.isSolved) {
                otherQuizzes.push({
                  id: dDoc.id,
                  classroomId: id,
                  classroomName: classroomNames[id],
                  title: dDoc.data().title || 'Solve peer assessment challenge',
                  topic: 'Peer doubts session'
                });
              }
            });

            aggregatedQuizzes.length = 0;
            aggregatedQuizzes.push(...otherQuizzes);
            setQuizzes([...aggregatedQuizzes]);
            
            loadedClassroomsCount++;
            if (loadedClassroomsCount === visibleClassroomIds.length) {
              setLoading(false);
            }
          });
          activeSubcollectionUnsubscribeMap[doubtsKey] = unsubDoubts;
        }
      });

      // Simple safety fallback
      setTimeout(() => setLoading(false), 2000);
    }, () => setLoading(false));

    return () => {
      unsubBuddy();
      unsubClassrooms();
      Object.values(activeSubcollectionUnsubscribeMap).forEach(unsub => unsub());
    };
  }, [user, isGuest]);

  if (loading) {
    return (
      <div className="p-8 text-center bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-3xl animate-pulse space-y-4">
        <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4 mx-auto" />
        <div className="h-12 bg-zinc-150 dark:bg-zinc-850 rounded-2xl w-full" />
        <div className="space-y-2">
          <div className="h-10 bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
          <div className="h-10 bg-zinc-100 dark:bg-zinc-900 rounded-xl" />
        </div>
      </div>
    );
  }

  // Count headers dynamically
  const workCount = assignments.length;
  const announcCount = announcements.length;
  const quizCount = quizzes.length;
  const buddyCount = buddyRequests.length;

  return (
    <div className="p-5 sm:p-7 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 rounded-3xl md:rounded-[2.5rem] space-y-6">
      
      {/* Header section with status ticker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-full">
            <BookOpen size={12} />
            <span>Academic Command Feed</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">Active Classroom Agenda</h3>
          <p className="text-xs text-zinc-455 dark:text-zinc-500 font-semibold leading-none">
            Consolidated agenda pulled instantly from your enrolled school spaces.
          </p>
        </div>
        
        {/* Real-time status badge */}
        <span className="px-3.5 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-xl text-[10px] font-mono font-black uppercase text-zinc-500 dark:text-zinc-650 self-start sm:self-center">
          ● Synced Offline Mode
        </span>
      </div>

      {/* Tabs list specifically tailored */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 bg-zinc-50 dark:bg-zinc-950 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('work')}
          className={cn(
            "py-3 px-3 rounded-xl font-bold text-[10.5px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'work' 
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-black border border-zinc-100 dark:border-zinc-800" 
              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 dark:hover:text-zinc-350"
          )}
        >
          <Calendar size={13} />
          <span>Assignments</span>
          {workCount > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-[9px] font-extrabold font-mono">{workCount}</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('announcements')}
          className={cn(
            "py-3 px-3 rounded-xl font-bold text-[10.5px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'announcements' 
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-black border border-zinc-100 dark:border-zinc-800" 
              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 dark:hover:text-zinc-350"
          )}
        >
          <Bell size={13} />
          <span>Announcements</span>
          {announcCount > 0 && (
            <span className="px-1.5 py-0.5 bg-purple-500 text-white rounded text-[9px] font-extrabold font-mono">{announcCount}</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('quizzes')}
          className={cn(
            "py-3 px-3 rounded-xl font-bold text-[10.5px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'quizzes' 
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-black border border-zinc-100 dark:border-zinc-800" 
              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 dark:hover:text-zinc-350"
          )}
        >
          <Sparkles size={13} />
          <span>Quizzes & Doubts</span>
          {quizCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500 text-black rounded text-[9px] font-black font-mono">{quizCount}</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('buddies')}
          className={cn(
            "py-3 px-3 rounded-xl font-bold text-[10.5px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2",
            activeTab === 'buddies' 
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-black border border-zinc-100 dark:border-zinc-800" 
              : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 dark:hover:text-zinc-350"
          )}
        >
          <UserPlus size={13} />
          <span>Buddy Requests</span>
          {buddyCount > 0 && (
            <span className="px-1.5 py-0.5 bg-emerald-500 text-white rounded text-[9px] font-extrabold font-mono">{buddyCount}</span>
          )}
        </button>
      </div>

      {/* Tabs content containers */}
      <div className="space-y-3">
        
        {/* ==================== ASSIGNMENTS & DEADLINES TAB ==================== */}
        {activeTab === 'work' && (
          <div className="space-y-3 animate-fadeIn">
            {assignments.length === 0 ? (
              <div className="py-12 text-center rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-dashed border-zinc-200 dark:border-zinc-800 px-6 space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 animate-pulse" />
                <h4 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200">No Pending Homework</h4>
                <p className="text-[10.5px] text-zinc-400 font-semibold max-w-sm mx-auto leading-relaxed">
                  Excellent! You have marked all classroom tasks and textbook assignments complete. Launch focus timers to start revising chapters.
                </p>
              </div>
            ) : (
              assignments.map(ass => (
                <div 
                  key={ass.id} 
                  onClick={() => navigate(`/app/study-groups/${ass.classroomId}`)}
                  className="p-4 bg-zinc-50/70 dark:bg-zinc-955/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 border border-zinc-150/60 dark:border-zinc-850 rounded-2xl flex items-center justify-between gap-4 transition-all cursor-pointer group"
                >
                  <div className="space-y-1 min-w-0">
                    <span className="text-[9.5px] font-mono font-black text-blue-600 dark:text-blue-450 uppercase tracking-wider block">
                      {ass.classroomName}
                    </span>
                    <p className="text-xs font-bold text-zinc-805 dark:text-zinc-200 line-clamp-1">
                      {ass.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right select-none">
                      <span className="text-[9px] font-black uppercase text-zinc-400 block leading-none">Deadline</span>
                      <span className="text-[10px] font-mono font-black text-rose-550 dark:text-rose-400 block mt-0.5">{ass.dueDate || 'Today'}</span>
                    </div>
                    <ChevronRight size={14} className="text-zinc-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== ANNOUNCEMENTS & RECENT ACTIVITY TAB ==================== */}
        {activeTab === 'announcements' && (
          <div className="space-y-3.5 animate-fadeIn">
            {announcements.length === 0 ? (
              <div className="py-12 text-center rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-dashed border-zinc-200 dark:border-zinc-800 px-6 space-y-2">
                <Bell size={32} className="mx-auto text-zinc-400 dark:text-zinc-650" />
                <h4 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200">Silence is Golden</h4>
                <p className="text-[10.5px] text-zinc-400 font-semibold max-w-sm mx-auto leading-relaxed">
                  No notifications recorded from your registered academic workspaces. Announcements posted by tutors will show up instantly.
                </p>
              </div>
            ) : (
              announcements.map(ann => (
                <div 
                  key={ann.id}
                  onClick={() => navigate(`/app/study-groups/${ann.classroomId}`)}
                  className="p-4 bg-zinc-50/70 dark:bg-zinc-955/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 border border-zinc-150/60 dark:border-zinc-850 rounded-2xl space-y-2 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between gap-4 select-none">
                    <span className="text-[9.5px] font-mono font-black text-purple-600 dark:text-purple-450 uppercase tracking-wider block">
                      {ann.classroomName}
                    </span>
                    <span className="text-[9.5px] font-mono text-zinc-400">
                      {new Date(ann.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {ann.title && (
                    <h4 className="text-xs font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{ann.title}</h4>
                  )}
                  <p className="text-[11px] text-zinc-500 leading-relaxed font-semibold">
                    {ann.content}
                  </p>
                  <div className="border-t border-zinc-150/40 dark:border-zinc-850/50 pt-2 flex items-center justify-between select-none">
                    <span className="text-[9.5px] font-black text-zinc-400">Posted by: <b className="text-zinc-500 dark:text-zinc-350">{ann.authorName}</b></span>
                    <span className="text-[9.5px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                      Go to Classroom <ChevronRight size={11} />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== QUIZZES, CHALLENGES & RESOURCES TAB ==================== */}
        {activeTab === 'quizzes' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Real resources list inside groups */}
            {resources.length > 0 && (
              <div className="space-y-2.5">
                <span className="text-[9.5px] font-black uppercase tracking-widest text-zinc-400 select-none">New Resources Added</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {resources.map(res => (
                    <div 
                      key={res.id}
                      onClick={() => navigate(`/app/study-groups/${res.classroomId}`)}
                      className="p-3 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 dark:border-blue-500/5 rounded-xl flex items-center gap-3 transition-all cursor-pointer"
                    >
                      <div className="p-2 bg-blue-600 text-white rounded-lg select-none">
                        <FileText size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[8.5px] font-mono font-black uppercase text-blue-600 dark:text-blue-400 leading-none truncate">{res.classroomName}</span>
                        <span className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 truncate leading-tight">{res.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quizzes list */}
            <div className="space-y-2.5">
              <span className="text-[9.5px] font-black uppercase tracking-widest text-zinc-400 select-none">Classroom Quiz Challenges</span>
              {quizzes.length === 0 ? (
                <div className="py-8 text-center rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-dashed border-zinc-200 dark:border-zinc-800 px-6 space-y-2">
                  <Sparkles size={28} className="mx-auto text-amber-500 animate-pulse" />
                  <h4 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-100">AI Quizzes Up-to-Date</h4>
                  <p className="text-[10px] text-zinc-400 font-semibold max-w-sm mx-auto leading-relaxed">
                    No open quiz boards or assessment challenges. Generate a custom concept check anytime using our server-side AI Tutor or inside Classrooms!
                  </p>
                </div>
              ) : (
                quizzes.map(qz => (
                  <div 
                    key={qz.id}
                    onClick={() => navigate(`/app/study-groups/${qz.classroomId}?tab=quiz`)}
                    className="p-4 bg-zinc-50/70 dark:bg-zinc-955/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40 border border-zinc-150/60 dark:border-zinc-850 rounded-2xl flex items-center justify-between gap-4 transition-all cursor-pointer group"
                  >
                    <div className="space-y-1 min-w-0">
                      <span className="text-[9.5px] font-mono font-black text-amber-600 dark:text-amber-500 uppercase tracking-wider block leading-none">
                        {qz.classroomName}
                      </span>
                      <h4 className="text-xs font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{qz.title}</h4>
                      {qz.topic && (
                        <p className="text-[10.5px] text-zinc-500 font-semibold italic">Topic: {qz.topic}</p>
                      )}
                    </div>
                    <span className="text-[9.5px] text-amber-600 dark:text-amber-500 font-bold flex items-center gap-0.5 shrink-0 select-none group-hover:translate-x-1 transition-transform">
                      Take Quiz <ChevronRight size={13} />
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==================== STUDY BUDDY REQUESTS TAB ==================== */}
        {activeTab === 'buddies' && (
          <div className="space-y-3 animate-fadeIn">
            {buddyRequests.length === 0 ? (
              <div className="py-12 text-center rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 border border-dashed border-zinc-200 dark:border-zinc-800 px-6 space-y-2">
                <UserPlus size={32} className="mx-auto text-zinc-400 dark:text-zinc-650" />
                <h4 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200">No Pending Requests</h4>
                <p className="text-[10.5px] text-zinc-400 font-semibold max-w-sm mx-auto leading-relaxed">
                  No pending buddy invitations from other students. Share your custom Classrooms or Direct Message links to invite your school colleagues!
                </p>
                <button 
                  onClick={() => navigate('/app/community?tab=buddies')}
                  className="px-4 py-2 text-[10px] uppercase font-black tracking-wider bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  Discover Classmates
                </button>
              </div>
            ) : (
              buddyRequests.map(req => (
                <div 
                  key={req.id}
                  className="p-4 bg-zinc-50/70 dark:bg-zinc-955/30 border border-zinc-150/60 dark:border-zinc-850 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-xs font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">{req.fromName}</h4>
                    <span className="text-[10.5px] text-zinc-500 font-semibold font-mono block leading-none">{req.fromEmail}</span>
                  </div>
                  
                  <button
                    onClick={() => navigate('/app/community?tab=buddies-requests')}
                    className="px-4.5 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 active:scale-95 transition-all self-start sm:self-center cursor-pointer"
                  >
                    Manage Requests
                  </button>
                </div>
              ))
            )}
          </div>
        )}

      </div>

    </div>
  );
}
