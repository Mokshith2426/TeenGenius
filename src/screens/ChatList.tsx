import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, getDoc, doc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, MessageSquare, Search, ShieldCheck, Lock, X, Users, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatTime } from '../lib/dateUtils';
import OnboardingTooltip from '../components/OnboardingTooltip';

interface Chat {
  id: string;
  type: string;
  memberIds: string[];
  lastMessage: string;
  lastUpdatedAt: any;
  name?: string; // For group chats
}

export default function ChatList() {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [isForgeModalOpen, setIsForgeModalOpen] = useState(false);
  const [forgeSearch, setForgeSearch] = useState('');

  const [showExplanation, setShowExplanation] = useState(() => {
    return !localStorage.getItem('chats_guide_seen');
  });

  // Friend list fetching for standard chats
  useEffect(() => {
    if (!user) return;

    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      setFriends([
        { uid: 'f1', displayName: 'Alex Rivera', email: 'alex@teengenius.edu', isOnline: true },
        { uid: 'f2', displayName: 'Emily Chen', email: 'emily@teengenius.edu', isOnline: false }
      ]);
      return () => {};
    }

    let unsubscribeFriends: (() => void) | null = null;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const friendIds = snap.data().friendIds || [];
        if (friendIds.length > 0) {
          if (unsubscribeFriends) unsubscribeFriends();
          const friendsQuery = query(collection(db, 'users'), where('uid', 'in', friendIds));
          unsubscribeFriends = onSnapshot(friendsQuery, (friendsSnap) => {
            setFriends(friendsSnap.docs.map(d => d.data()));
          }, (err) => handleFirestoreError(err, OperationType.LIST, 'users_friends'));
        } else {
          setFriends([]);
          if (unsubscribeFriends) {
            unsubscribeFriends();
            unsubscribeFriends = null;
          }
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    return () => {
      unsubscribeUser();
      if (unsubscribeFriends) unsubscribeFriends();
    };
  }, [user, isGuest]);

  // Standard encrypted chat rooms fetching
  useEffect(() => {
    if (!user) return;

    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      setChats([
        { id: 'sb_chat1', type: 'private', memberIds: [user.uid, 'f1'], lastMessage: 'Let’s sync up for the physics task.', lastUpdatedAt: { seconds: Math.floor(Date.now()/1000) } as any, name: 'Alex Rivera' },
        { id: 'sb_chat2', type: 'group', memberIds: [user.uid, 'f1', 'f2'], lastMessage: 'I uploaded the chemistry notes!', lastUpdatedAt: { seconds: Math.floor(Date.now()/1000) - 3600 } as any, name: 'Chemistry Study Crew' }
      ]);
      return () => {};
    }

    const q = query(
      collection(db, 'chats'),
      where('memberIds', 'array-contains', user.uid),
      orderBy('lastUpdatedAt', 'desc')
    );

    const path = 'chats';
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatData = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data() as Chat;
        const id = d.id;
        
        // If it's a private chat and has no name, try to find the other member's name
        if (data.type === 'private' && !data.name) {
          const otherId = data.memberIds.find(m => m !== user.uid);
          if (otherId) {
            const userSnap = await getDoc(doc(db, 'users', otherId));
            if (userSnap.exists()) {
              return { ...data, id, name: userSnap.data().displayName };
            }
          }
        }
        return { ...data, id };
      }));
      setChats(chatData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  const startChat = async (friend: any) => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'chats'), 
        where('type', '==', 'private'),
        where('memberIds', 'array-contains', user.uid)
      );
      const snap = await getDocs(q);
      const existingChat = snap.docs.find(d => d.data().memberIds.includes(friend.uid));

      if (existingChat) {
        navigate(`/app/chats/${existingChat.id}`);
      } else {
        const newChat = await addDoc(collection(db, 'chats'), {
          type: 'private',
          memberIds: [user.uid, friend.uid],
          lastUpdatedAt: serverTimestamp(),
          lastMessage: 'Chat started'
        });
        navigate(`/app/chats/${newChat.id}`);
      }
      setIsForgeModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const filteredFriends = friends.filter(f => 
    f.displayName?.toLowerCase().includes(forgeSearch.toLowerCase()) ||
    f.email?.toLowerCase().includes(forgeSearch.toLowerCase())
  );

  const filteredChats = chats.filter(chat => 
    chat.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-zinc-900 dark:text-white uppercase leading-none flex items-center gap-3">
            Peer <span className="text-blue-600">Chats</span>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
              <ShieldCheck size={20} />
            </div>
          </h1>
          <p className="text-zinc-500 font-semibold text-xs leading-relaxed flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5"><Lock size={12} className="text-blue-500 shrink-0" /> Safe peer-to-peer messaging with classmates.</span>
            <span className="text-purple-600 dark:text-purple-400 font-extrabold select-none flex items-center gap-1">🔮 Looking for the AI Tutor? Ask "TeenGenius AI" instead!</span>
          </p>
        </div>
        {!showExplanation && (
          <button
            onClick={() => setShowExplanation(true)}
            className="self-start md:self-center flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="See how we keep chats safe"
          >
            How it Works
          </button>
        )}
      </header>

      <AnimatePresence>
        {showExplanation && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <OnboardingTooltip 
              onClose={() => {
                localStorage.setItem('chats_guide_seen', 'true');
                setShowExplanation(false);
              }}
              onComplete={() => {
                localStorage.setItem('chats_guide_seen', 'true');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600 transition-colors" size={20} />
          <input 
            type="text"
            placeholder="Intercept messages or users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2rem] py-5 pl-16 pr-6 font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-lg shadow-zinc-100/30"
          />
        </div>
        <button
          onClick={() => setIsForgeModalOpen(true)}
          className="px-6 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all active:scale-95 shadow-lg shadow-blue-500/20 cursor-pointer shrink-0"
        >
          <Plus size={18} />
          Start New Chat
        </button>
      </div>

      <div className="grid gap-3">
        {filteredChats.length === 0 ? (
          <div className="text-center py-24 bg-zinc-50 dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[3rem] px-6 space-y-4">
            <MessageSquare size={48} className="text-zinc-300 dark:text-zinc-700 mx-auto" />
            <div className="space-y-1">
              <p className="text-zinc-500 dark:text-zinc-400 font-black uppercase text-xs tracking-widest">No Chats Yet</p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">You haven't started any chats yet. Start a secure private chat to talk with your friends!</p>
            </div>
            <button
              onClick={() => setIsForgeModalOpen(true)}
              className="mx-auto px-6 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl flex items-center gap-2 text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Plus size={14} />
              Start New Chat
            </button>
          </div>
        ) : (
          filteredChats.map((chat, i) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link 
                to={`/app/chats/${chat.id}`}
                className="flex items-center gap-5 p-6 bg-white dark:bg-zinc-900 border border-zinc-50 dark:border-zinc-800 hover:border-blue-500 rounded-[2.5rem] transition-all group relative overflow-hidden block"
              >
                <div className="flex items-center gap-5 w-full">
                  <div className="w-16 h-16 bg-zinc-900 dark:bg-zinc-100 rounded-3xl flex items-center justify-center font-black text-white dark:text-zinc-900 text-2xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg group-hover:shadow-blue-200 shrink-0">
                    {chat.name ? chat.name[0] : '#'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-black text-zinc-900 dark:text-white uppercase tracking-tight text-lg truncate">
                        {chat.name || `Unit ${chat.memberIds.length}`}
                      </h3>
                      <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest bg-zinc-50 dark:bg-zinc-800 px-2 py-1 rounded-full shrink-0">
                        {formatTime(chat.lastUpdatedAt)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 truncate italic font-medium">
                      {chat.lastMessage || 'Channel established... awaiting comms.'}
                    </p>
                  </div>
                </div>
                {i === 0 && <div className="absolute top-0 right-0 w-20 h-20 bg-blue-600/5 rounded-full -translate-y-10 translate-x-10" />}
              </Link>
            </motion.div>
          ))
        )}
      </div>

      {/* Forge Chat Modal (TeenGenius Local Comms) */}
      <AnimatePresence>
        {isForgeModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsForgeModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6"
            >
              {/* Modal Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]"
              >
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
                      <Plus className="text-blue-600" size={22} /> New <span className="text-blue-600 font-extrabold">Chat</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1 font-medium">Start a safe, private chat room with a friend.</p>
                  </div>
                  <button
                    onClick={() => setIsForgeModalOpen(false)}
                    className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Search */}
                {friends.length > 0 && (
                  <div className="p-6 md:px-8 border-b border-zinc-100 dark:border-zinc-800/50 shrink-0">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-600 transition-colors" size={16} />
                      <input
                        type="text"
                        placeholder="Search peers inside your network..."
                        value={forgeSearch}
                        onChange={(e) => setForgeSearch(e.target.value)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-sans"
                      />
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-3">
                  {friends.length === 0 ? (
                    <div className="text-center py-10 space-y-4">
                      <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <Users size={24} />
                      </div>
                      <h4 className="text-lg font-bold text-zinc-900 dark:text-white">Communication Array Empty</h4>
                      <p className="text-sm text-zinc-400 max-w-xs mx-auto">
                        In order to forge a secure transmission line, you must first connect with other academic minds.
                      </p>
                      <button
                        onClick={() => {
                          setIsForgeModalOpen(false);
                          navigate('/app/friends');
                        }}
                        className="px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-black select-none transition-all active:scale-95 shadow-md inline-flex items-center gap-2 cursor-pointer"
                      >
                        Explore Network <ArrowRight size={12} />
                      </button>
                    </div>
                  ) : filteredFriends.length === 0 ? (
                    <div className="text-center py-10">
                      <Search size={32} className="mx-auto text-zinc-300 mb-2 animate-pulse" />
                      <p className="text-sm text-zinc-400 italic">No peers match "{forgeSearch}"</p>
                    </div>
                  ) : (
                    filteredFriends.map(friend => (
                      <button
                        key={friend.uid}
                        onClick={() => startChat(friend)}
                        className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/30 hover:bg-blue-600/5 dark:hover:bg-blue-500/5 border border-zinc-100 dark:border-zinc-800 rounded-2xl transition-all cursor-pointer group text-left"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 bg-zinc-900 text-white rounded-xl flex items-center justify-center font-bold text-sm uppercase shrink-0 font-sans">
                            {friend.displayName?.[0] || '?'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate uppercase tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {friend.displayName}
                            </h4>
                            <p className="text-[10px] text-zinc-400 font-mono truncate">{friend.email}</p>
                          </div>
                        </div>
                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200/50 dark:border-zinc-700 text-zinc-400 group-hover:text-blue-600 group-hover:border-blue-500/30 transition-all shrink-0">
                          <MessageSquare size={14} />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
