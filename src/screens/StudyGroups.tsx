import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, addDoc, serverTimestamp, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, GraduationCap, Users, Search, BookOpen, Key, Link2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Group {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  ownerId: string;
  inviteCode?: string;
}

export default function StudyGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [discoverGroups, setDiscoverGroups] = useState<Group[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'discover'>('my');
  const [searchQuery, setSearchQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [joiningGroupIds, setJoiningGroupIds] = useState<Record<string, boolean>>({});
  const [isCreatingSubmitting, setIsCreatingSubmitting] = useState(false);
  
  // Invite Code States
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);

  const { user, isGuest, isSandbox, triggerGuestPrompt } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    
    if (isSandbox) {
      setGroups([
        { id: 'sb_group1', name: 'AP Calculus BC Study Circle', description: 'Advanced derivatives and integrations sync node Room', ownerId: 'f1', memberIds: [user.uid, 'f1', 'f2'] },
        { id: 'sb_group2', name: 'Quantum Physics Peer Cohort', description: 'Wave mechanics particle physics prep room', ownerId: 'f2', memberIds: [user.uid, 'f2', 'f3'] }
      ]);
      return () => {};
    }

    // Listen to my groups
    const myQuery = query(
      collection(db, 'studyGroups'),
      where('memberIds', 'array-contains', user.uid)
    );
    const unsubscribeMy = onSnapshot(myQuery, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
    }, (error) => {
      console.warn("My groups subscription failed: ", error.message);
    });

    return () => unsubscribeMy();
  }, [user, isGuest]);

  const handleSearch = async () => {
    const q = query(
      collection(db, 'studyGroups'),
      where('name', '>=', searchQuery),
      where('name', '<=', searchQuery + '\uf8ff')
    );
    const snap = await getDocs(q);
    const gData = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Group))
      .filter(g => !g.memberIds.includes(user?.uid || ''));
    setDiscoverGroups(gData);
  };

  const joinGroup = async (groupId: string) => {
    if (isGuest) {
      triggerGuestPrompt("Join Study Circles");
      return;
    }
    if (!user) return;
    setJoiningGroupIds(prev => ({ ...prev, [groupId]: true }));
    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        memberIds: arrayUnion(user.uid)
      });
      setActiveTab('my');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `studyGroups/${groupId}`);
    } finally {
      setJoiningGroupIds(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const generateInviteCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude confusing chars like I, O, 0, 1
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'TG-' + result;
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest) {
      triggerGuestPrompt("Join Study Circles by Invite Code");
      return;
    }
    const cleanCode = inviteCodeInput.trim().toUpperCase();
    if (!cleanCode || !user) return;

    setIsJoiningByCode(true);
    setInviteError('');
    try {
      const q = query(
        collection(db, 'studyGroups'),
        where('inviteCode', '==', cleanCode)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setInviteError("Study group invite code not found. Please verify!");
        setIsJoiningByCode(false);
        return;
      }

      const groupDoc = snap.docs[0];
      const gData = groupDoc.data() as Group;
      if (gData.memberIds.includes(user.uid)) {
        // Already a member! Just navigate to details
        navigate(`/app/study-groups/${groupDoc.id}`);
      } else {
        await updateDoc(doc(db, 'studyGroups', groupDoc.id), {
          memberIds: arrayUnion(user.uid)
        });
        navigate(`/app/study-groups/${groupDoc.id}`);
      }
    } catch (err: any) {
      setInviteError("Failed to join. Please check your network connection.");
      console.error(err);
    } finally {
      setIsJoiningByCode(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newName.trim() || !user) return;
    const path = 'studyGroups';
    setIsCreatingSubmitting(true);
    try {
      await addDoc(collection(db, 'studyGroups'), {
        name: newName,
        description: 'New study group',
        ownerId: user.uid,
        memberIds: [user.uid],
        inviteCode: generateInviteCode(),
        createdAt: serverTimestamp()
      });
      setNewName('');
      setIsCreating(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsCreatingSubmitting(false);
    }
  };

  return (
    <div className="p-5 md:p-6 space-y-6">
      <header className="flex flex-col gap-3 justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase">
            Study <span className="text-blue-600">Circles</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 italic text-xs font-semibold leading-relaxed">Collaborate and solve problems together.</p>
        </div>
        <button 
          onClick={() => {
            if (isGuest) {
              triggerGuestPrompt("Create private Study Circles");
            } else {
              setIsCreating(true);
            }
          }}
          className="bg-zinc-900 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-5 py-3 rounded-2xl flex items-center justify-center gap-2.5 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-zinc-200/50 dark:shadow-none hover:bg-black transition-all active:scale-95 self-start"
        >
          <Plus size={16} />
          Create Circle
        </button>
      </header>

      {/* Tabs */}
      <div className="flex bg-zinc-100 dark:bg-zinc-850 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('my')}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer",
            activeTab === 'my' 
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm" 
              : "text-zinc-455 hover:text-zinc-650 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
        >
          <Users size={14} />
          My Circles
        </button>
        <button
          onClick={() => setActiveTab('discover')}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer",
            activeTab === 'discover' 
              ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm" 
              : "text-zinc-455 hover:text-zinc-650 dark:text-zinc-400 dark:hover:text-zinc-200"
          )}
        >
          <Search size={14} />
          Discover
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'my' ? (
          <motion.div
            key="my"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 gap-4"
          >
            {/* Join Circle with Code Box */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150/80 dark:border-zinc-800/80 rounded-[2rem] p-6 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Key size={14} className="text-zinc-400" />
                    Join a Private Study Room
                  </h3>
                  <p className="text-xs text-zinc-455 dark:text-zinc-500 font-semibold italic">
                    Have an invite code? Type it below to join your friends' circle instantly!
                  </p>
                </div>
                <form onSubmit={handleJoinByCode} className="flex gap-2 w-full md:w-auto max-w-sm">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      placeholder="e.g. TG-B47ZAX"
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest placeholder:font-normal placeholder:normal-case placeholder:italic outline-none focus:ring-1 focus:ring-blue-500"
                      value={inviteCodeInput}
                      onChange={(e) => {
                        setInviteCodeInput(e.target.value);
                        setInviteError('');
                      }}
                      required
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={isJoiningByCode}
                    className="px-5 py-3 bg-zinc-950 dark:bg-blue-600 hover:bg-zinc-900 dark:hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {isJoiningByCode ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Join"
                    )}
                  </button>
                </form>
              </div>
              {inviteError && (
                <p className="text-[10px] text-red-500 font-black uppercase tracking-wider mt-2.5">
                  ⚠️ {inviteError}
                </p>
              )}
            </div>

            {groups.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6">
                <GraduationCap size={40} className="mx-auto text-zinc-200 dark:text-zinc-700 mb-3" />
                <p className="text-zinc-400 dark:text-zinc-500 text-xs font-medium italic">You haven't joined any circles yet.</p>
              </div>
            ) : (
              groups.map((group, i) => (
                <Link 
                  key={group.id}
                  to={`/app/study-groups/${group.id}`}
                  className="block bg-white dark:bg-zinc-900 border border-zinc-150/80 dark:border-zinc-800/80 rounded-[2rem] p-6 hover:shadow-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group relative overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-850 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white dark:group-hover:text-white transition-all shadow-sm text-zinc-700 dark:text-zinc-300">
                      <GraduationCap size={20} />
                    </div>
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                      {group.name}
                    </h3>
                    <p className="text-xs font-semibold text-zinc-450 dark:text-zinc-400 mt-2 line-clamp-2 italic leading-relaxed">
                      {group.description}
                    </p>
                    
                    <div className="flex items-center gap-4 mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
                      <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-450 dark:text-zinc-400 uppercase tracking-widest">
                        <Users size={12} />
                        {group.memberIds.length} Students
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="discover"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex gap-2.5">
              <input 
                type="text"
                placeholder="Search circles..."
                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white placeholder:font-normal placeholder:italic focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                onClick={handleSearch}
                className="px-5 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all"
              >
                Search
              </button>
            </div>

            <div className="space-y-4">
              {discoverGroups.map(group => (
                <div 
                  key={group.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-150/80 dark:border-zinc-800/80 rounded-[2rem] p-6 shadow-sm"
                >
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4">
                    <GraduationCap size={20} />
                  </div>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                    {group.name}
                  </h3>
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-550 mt-2 line-clamp-2 italic mb-5 leading-relaxed">
                    {group.description}
                  </p>
                  
                  <button 
                    onClick={() => joinGroup(group.id)}
                    disabled={joiningGroupIds[group.id]}
                    className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 text-zinc-900 dark:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {joiningGroupIds[group.id] ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                        <span>Joining...</span>
                      </>
                    ) : (
                      "Join Circle"
                    )}
                  </button>
                </div>
              ))}
              {searchQuery && discoverGroups.length === 0 && (
                <div className="text-center py-12 italic text-zinc-400 dark:text-zinc-500 text-xs font-medium">
                  No public circles found matching your search.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isCreating && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[1000] flex items-center justify-center p-5"
          onClick={() => setIsCreating(false)}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2.5rem] p-6 w-full max-w-md shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight uppercase leading-none">New Study Circle</h2>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black mt-1">Setup Collaborative Workspace</p>
            </div>
            
            <input 
              autoFocus
              type="text"
              placeholder="e.g. Organic Chemistry Prep"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-2xl p-4 text-xs font-bold text-zinc-900 dark:text-white placeholder:font-normal placeholder:italic focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateGroup();
                }
              }}
            />
            
            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setIsCreating(false)}
                className="flex-1 px-5 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-wider text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all hover:text-zinc-900 dark:hover:text-white"
                disabled={isCreatingSubmitting}
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateGroup}
                className="flex-1 px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                disabled={isCreatingSubmitting || !newName.trim()}
              >
                {isCreatingSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  "Create Circle"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
