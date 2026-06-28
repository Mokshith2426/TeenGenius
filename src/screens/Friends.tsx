import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, Check, X, MessageCircle, Users, ArrowRight, UserMinus, Clock } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  getDocs, 
  deleteDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Friends() {
  const { user, isGuest, triggerGuestPrompt } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null);
  const [directUsernameInput, setDirectUsernameInput] = useState('');
  const [isSendingDirect, setIsSendingDirect] = useState(false);

  const showFeedback = (type: 'error' | 'success', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
  };

  useEffect(() => {
    if (!user) return;

    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      const cachedFriends = localStorage.getItem(`SANDBOX_FRIENDS_LIST_${user.uid}`) || '[]';
      const cachedReceived = localStorage.getItem(`SANDBOX_PENDING_RECEIVED_${user.uid}`) || '[]';
      const cachedSent = localStorage.getItem(`SANDBOX_PENDING_SENT_${user.uid}`) || '[]';
      
      try {
        setFriends(JSON.parse(cachedFriends));
        setPendingReceived(JSON.parse(cachedReceived));
        setPendingSent(JSON.parse(cachedSent));
      } catch (err) {
        setFriends([]);
        setPendingReceived([]);
        setPendingSent([]);
      }
      return () => {};
    }

    let unsubscribeFriends: (() => void) | null = null;

    // Fetch User and Friends (Real-time)
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const friendIds = snap.data().friendIds || [];
        if (friendIds.length > 0) {
          // Cleanup previous listener
          if (unsubscribeFriends) unsubscribeFriends();
          
          const friendsQuery = query(collection(db, 'users'), where('uid', 'in', friendIds));
          unsubscribeFriends = onSnapshot(friendsQuery, (friendsSnap) => {
            setFriends(friendsSnap.docs.map(d => d.data()));
          }, (err) => {
            console.error("Friends system: Error reading sub-collection of users:", err);
          });
        } else {
          setFriends([]);
          if (unsubscribeFriends) {
            unsubscribeFriends();
            unsubscribeFriends = null;
          }
        }
      } else {
        setFriends([]);
      }
    }, (err) => {
      console.error("Friends system: Error subscribing to current user profile:", err);
    });

    // Fetch Pending Received
    const receivedQuery = query(
      collection(db, 'friendRequests'), 
      where('toId', '==', user.uid), 
      where('status', '==', 'pending')
    );
    const unsubscribeReceived = onSnapshot(receivedQuery, (snap) => {
      setPendingReceived(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Friends system: Error subscribing to incoming friend requests:", err);
    });

    // Fetch Pending Sent
    const sentQuery = query(
      collection(db, 'friendRequests'), 
      where('fromId', '==', user.uid), 
      where('status', '==', 'pending')
    );
    const unsubscribeSent = onSnapshot(sentQuery, (snap) => {
      setPendingSent(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Friends system: Error subscribing to outgoing friend requests:", err);
    });

    return () => {
      unsubscribeUser();
      unsubscribeReceived();
      unsubscribeSent();
      if (unsubscribeFriends) unsubscribeFriends();
    };
  }, [user, isGuest]);

  useEffect(() => {
    if (!user) return;
    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      localStorage.setItem(`SANDBOX_FRIENDS_LIST_${user.uid}`, JSON.stringify(friends));
      localStorage.setItem(`SANDBOX_PENDING_RECEIVED_${user.uid}`, JSON.stringify(pendingReceived));
      localStorage.setItem(`SANDBOX_PENDING_SENT_${user.uid}`, JSON.stringify(pendingSent));
    }
  }, [friends, pendingReceived, pendingSent, user, isGuest]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const isSandboxObj = user?.uid?.includes('sandbox') || isGuest;
      if (isSandboxObj) {
        setIsSearching(false);
        const mockUsers = [
          { uid: 'f1', displayName: 'Alex Rivera', email: 'alex@teengenius.edu', xp: 1450, badges: ['Math Prodigy'], isOnline: true },
          { uid: 'f2', displayName: 'Emily Chen', email: 'emily@teengenius.edu', xp: 1820, badges: ['Physics Champion'], isOnline: false },
          { uid: 'f3', displayName: 'Marcus Vance', email: 'marcus@teengenius.edu', xp: 950, badges: ['Early Bird'], isOnline: true },
          { uid: 'f4', displayName: 'Zara Siddiqui', email: 'zara@teengenius.edu', xp: 1100, badges: ['Bio Master'], isOnline: false },
          { uid: 'f5', displayName: 'Sarah Jenkins', email: 'sarah@teengenius.edu', xp: 1600, badges: ['Coding Wizard'], isOnline: true },
          { uid: 'f6', displayName: 'Oliver Thorne', email: 'oliver@teengenius.edu', xp: 1250, badges: ['History Buff'], isOnline: false },
          { uid: 'f7', displayName: 'Maya Lin', email: 'maya@teengenius.edu', xp: 1350, badges: ['Art Expert'], isOnline: true },
          { uid: 'f8', displayName: 'Leo Maxwell', email: 'leo@teengenius.edu', xp: 850, badges: ['Rookie'], isOnline: true }
        ].filter(u => u.uid !== user?.uid);
        
        const term = searchQuery.toLowerCase().trim();
        const filtered = mockUsers.filter(u => 
          u.displayName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
        );
        setSearchResults(filtered);
        return;
      }

      // Retrieve users up to a reasonable cap and filter client-side for case-insensitive matching
      const snap = await getDocs(query(collection(db, 'users')));
      const term = searchQuery.toLowerCase().trim();
      const results = snap.docs
        .map(d => d.data())
        .filter(u => u.uid !== user?.uid) // Exclude self
        .filter(u => {
          const name = (u.displayName || '').toLowerCase();
          const email = (u.email || '').toLowerCase();
          return name.includes(term) || email.includes(term);
        });
      setSearchResults(results.slice(0, 40));
    } catch (error) {
      console.error("Case-insensitive search matching error:", error);
      showFeedback('error', "Could not complete user search query right now.");
    } finally {
      setIsSearching(false);
    }
  };

  const sendRequest = async (targetUser: any) => {
    if (isGuest) {
      triggerGuestPrompt("Send friend requests");
      return;
    }
    if (!user) return;
    if (user.uid === targetUser.uid) {
      showFeedback('error', "No self-connections. Real peers are more exciting!");
      return;
    }

    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      if (pendingSent.some(r => r.toId === targetUser.uid) || pendingReceived.some(r => r.fromId === targetUser.uid)) {
        showFeedback('error', "A friend request is already pending between you two.");
        return;
      }
      if (friends.some(f => f.uid === targetUser.uid)) {
        showFeedback('error', "Target peer is already a part of your study network.");
        return;
      }
      const newReq = {
        id: 'req_s_' + Math.random().toString(36).substr(2, 9),
        toId: targetUser.uid,
        toName: targetUser.displayName,
        status: 'pending',
        timestamp: new Date()
      };
      setPendingSent(prev => [...prev, newReq]);
      showFeedback('success', `Friend request dispatched to ${targetUser.displayName}`);
      return;
    }

    try {
      // Check if duplicate request exists (or already friends or any direction exists)
      const q1 = query(
        collection(db, 'friendRequests'),
        where('fromId', '==', user.uid),
        where('toId', '==', targetUser.uid),
        where('status', '==', 'pending')
      );
      const q2 = query(
        collection(db, 'friendRequests'),
        where('fromId', '==', targetUser.uid),
        where('toId', '==', user.uid),
        where('status', '==', 'pending')
      );
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      if (!snap1.empty || !snap2.empty) {
        showFeedback('error', "A friend request is already pending between you two.");
        return;
      }
      
      // Check if already friends
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const friendIds = userDoc.data().friendIds || [];
        if (friendIds.includes(targetUser.uid)) {
          showFeedback('error', "Target peer is already a part of your study network.");
          return;
        }
      }

      await addDoc(collection(db, 'friendRequests'), {
        fromId: user.uid,
        fromName: user.displayName || 'Anonymous Peer',
        toId: targetUser.uid,
        toName: targetUser.displayName || 'Anonymous Peer',
        status: 'pending',
        timestamp: serverTimestamp()
      });

      showFeedback('success', `Friend request dispatched to ${targetUser.displayName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'friendRequests');
      showFeedback('error', "Failed to dispatch friend request.");
    }
  };

  const acceptRequest = async (request: any) => {
    if (isGuest) {
      triggerGuestPrompt("Accept friend requests");
      return;
    }
    if (!user) return;

    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      setPendingReceived(prev => prev.filter(r => r.id !== request.id));
      const newFriend = {
        uid: request.fromId,
        displayName: request.fromName,
        email: request.fromEmail || `${request.fromName.toLowerCase().replace(/\s/g, '')}@teengenius.edu`,
        xp: 1200,
        badges: ['Acquaintance'],
        isOnline: Math.random() > 0.5
      };
      setFriends(prev => [...prev, newFriend]);
      showFeedback('success', `Accepted friend request from ${request.fromName}`);
      return;
    }

    try {
      console.log("[DEBUG Friends] Starting acceptRequest workflow. Request:", JSON.stringify(request));
      if (!request.id) {
        throw new Error("Missing request.id in acceptRequest invocation.");
      }
      if (!request.fromId) {
        throw new Error("Missing request.fromId in acceptRequest invocation.");
      }
      if (request.toId !== user.uid) {
        throw new Error(`Auth UID mismatch: currentUser.uid is ${user.uid}, but request.toId is ${request.toId}`);
      }

      console.log(`[DEBUG Friends] Committing atomic friendship update via WriteBatch...`);
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);

      const requestRef = doc(db, 'friendRequests', request.id);
      const userRefSelf = doc(db, 'users', user.uid);
      const userRefTarget = doc(db, 'users', request.fromId);

      // 1. Add both mutual friend relations
      batch.update(userRefSelf, { friendIds: arrayUnion(request.fromId) });
      batch.update(userRefTarget, { friendIds: arrayUnion(user.uid) });

      // 2. Delete the friend request document
      batch.delete(requestRef);

      // 3. Commit the atomic batch
      await batch.commit();

      console.log(`[DEBUG Friends] Atomic friendship batch committed successfully.`);
      showFeedback('success', `Accepted friend request from ${request.fromName}`);
    } catch (error: any) {
      console.error("[DEBUG Friends] Error inside acceptRequest workflow:", error);
      const detailedMessage = error instanceof Error ? error.message : String(error);
      showFeedback('error', `FAILED TO ACCEPT INVITATION: ${detailedMessage}`);
    }
  };

  const declineRequest = async (requestId: string) => {
    const isSandboxObj = user?.uid?.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      setPendingReceived(prev => prev.filter(r => r.id !== requestId));
      setPendingSent(prev => prev.filter(r => r.id !== requestId));
      showFeedback('success', 'Friend request declined.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'friendRequests', requestId));
      showFeedback('success', 'Friend request canceled and cleanly discarded.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `friendRequests/${requestId}`);
      showFeedback('error', 'Failed to decline or cancel friend request.');
    }
  };

  const removeFriend = async (friendId: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to remove this friend?')) return;

    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      setFriends(prev => prev.filter(f => f.uid !== friendId));
      showFeedback('success', 'Removed friend from study network.');
      return;
    }

    try {
      await setDoc(doc(db, 'users', user.uid), {
        friendIds: arrayRemove(friendId)
      }, { merge: true });
      await setDoc(doc(db, 'users', friendId), {
        friendIds: arrayRemove(user.uid)
      }, { merge: true });
      showFeedback('success', 'Removed friend from study network.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      showFeedback('error', 'Failed to remove friend.');
    }
  };

  const handleSendDirectRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameToRequest = directUsernameInput.trim();
    if (!nameToRequest || !user) return;
    setIsSendingDirect(true);

    try {
      const isSandboxObj = user.uid.includes('sandbox') || isGuest;
      if (isSandboxObj) {
        const mockUsers = [
          { uid: 'f1', displayName: 'Alex Rivera', email: 'alex@teengenius.edu', xp: 1450, badges: ['Math Prodigy'], isOnline: true },
          { uid: 'f2', displayName: 'Emily Chen', email: 'emily@teengenius.edu', xp: 1820, badges: ['Physics Champion'], isOnline: false },
          { uid: 'f3', displayName: 'Marcus Vance', email: 'marcus@teengenius.edu', xp: 950, badges: ['Early Bird'], isOnline: true },
          { uid: 'f4', displayName: 'Zara Siddiqui', email: 'zara@teengenius.edu', xp: 1100, badges: ['Bio Master'], isOnline: false },
          { uid: 'f5', displayName: 'Sarah Jenkins', email: 'sarah@teengenius.edu', xp: 1600, badges: ['Coding Wizard'], isOnline: true },
          { uid: 'f6', displayName: 'Oliver Thorne', email: 'oliver@teengenius.edu', xp: 1250, badges: ['History Buff'], isOnline: false },
          { uid: 'f7', displayName: 'Maya Lin', email: 'maya@teengenius.edu', xp: 1350, badges: ['Art Expert'], isOnline: true },
          { uid: 'f8', displayName: 'Leo Maxwell', email: 'leo@teengenius.edu', xp: 850, badges: ['Rookie'], isOnline: true }
        ];

        let target = mockUsers.find(u => u.displayName.toLowerCase() === nameToRequest.toLowerCase());
        if (!target) {
          target = {
            uid: 'sb_custom_' + nameToRequest.toLowerCase().replace(/\s/g, ''),
            displayName: nameToRequest,
            email: `${nameToRequest.toLowerCase().replace(/\s/g, '')}@teengenius.edu`,
            xp: 100,
            badges: ['New Joiner'],
            isOnline: true
          };
        }

        if (pendingSent.some(r => r.toId === target.uid)) {
          showFeedback('error', `A request is already pending for ${target.displayName}.`);
          setIsSendingDirect(false);
          return;
        }

        const newReq = {
          id: 'req_s_' + Math.random().toString(36).substr(2, 9),
          toId: target.uid,
          toName: target.displayName,
          status: 'pending',
          timestamp: new Date()
        };
        setPendingSent(prev => [...prev, newReq]);
        showFeedback('success', `Friend request dispatched to ${target.displayName}`);
        setDirectUsernameInput('');
        setIsSendingDirect(false);
        return;
      }

      // Live Firestore Mode: Query exact or match case-insensitively
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);
      const matchedDoc = snap.docs.find(d => {
        const u = d.data();
        return (u.displayName || '').toLowerCase() === nameToRequest.toLowerCase() || (u.email || '').toLowerCase() === nameToRequest.toLowerCase();
      });

      if (!matchedDoc) {
        showFeedback('error', `No student found with Settings Active Name or Email "${nameToRequest}".`);
        setIsSendingDirect(false);
        return;
      }

      const matchedUser = matchedDoc.data();
      if (matchedUser.uid === user.uid) {
        showFeedback('error', "No self-connections. Real peers are more exciting!");
        setIsSendingDirect(false);
        return;
      }

      await sendRequest(matchedUser);
      setDirectUsernameInput('');
    } catch (err) {
      console.error(err);
      showFeedback('error', 'Error dispatching direct invite request.');
    } finally {
      setIsSendingDirect(false);
    }
  };

  const startChat = async (friend: any) => {
    if (!user) return;
    try {
      // Check if private chat exists
      const chatQuery = query(
        collection(db, 'chats'), 
        where('type', '==', 'private'),
        where('memberIds', 'array-contains', user.uid)
      );
      const snap = await getDocs(chatQuery);
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
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-zinc-900 uppercase">
            Network <span className="text-blue-600">Hub</span>
          </h1>
          <p className="text-zinc-500 mt-1 italic font-medium">Manage your connections and groups.</p>
        </div>
      </header>

      {/* Action Notification Banner */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-between shadow-lg",
              actionFeedback.type === 'error'
                ? "bg-red-50 dark:bg-red-950/20 text-red-600 border border-red-200/50 dark:border-red-800/20 animate-pulse"
                : "bg-green-50 dark:bg-green-950/20 text-green-600 border border-green-200/50 dark:border-green-800/20"
            )}
          >
            <span>{actionFeedback.message}</span>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-zinc-400 hover:text-zinc-650 shrink-0 font-black px-2 cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl w-fit">
        {[
          { id: 'friends', icon: Users, label: 'Friends' },
          { id: 'requests', icon: Clock, label: 'Pending' },
          { id: 'search', icon: Search, label: 'Find' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer",
              activeTab === tab.id 
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm" 
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-350"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Direct Friend Request Card */}
      {(activeTab === 'search' || activeTab === 'requests') && (
        <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 p-6 rounded-[2rem] space-y-4">
          <div>
            <h2 className="text-xs font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-[0.2em] flex items-center gap-1.5 leading-none">
              <UserPlus size={14} className="text-blue-500" /> Connect by Settings Active Name / Username
            </h2>
            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-2 max-w-xl font-medium leading-relaxed">
              Type the exact Active Name your student friend set in their settings tab (or their direct school email) to dispatch an instant friend request connection!
            </p>
          </div>
          <form onSubmit={handleSendDirectRequest} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text"
              required
              placeholder="e.g. Mokshith420, Emily Chen, or student@school.edu..."
              className="flex-1 bg-white dark:bg-zinc-950 border border-zinc-250 dark:border-zinc-750 rounded-2xl px-5 py-3 text-xs font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              value={directUsernameInput}
              onChange={(e) => setDirectUsernameInput(e.target.value)}
            />
            <button 
              type="submit"
              disabled={isSendingDirect}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white dark:bg-blue-500 dark:hover:bg-blue-400 rounded-2xl text-[10px] uppercase font-black tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-200/50 dark:shadow-none disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isSendingDirect ? 'Transmitting...' : 'Send Invite'}
            </button>
          </form>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'search' && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <form onSubmit={handleSearch} className="flex gap-4">
              <input 
                type="text"
                placeholder="Search by name..."
                className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-6 py-4 font-semibold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                type="submit"
                className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all uppercase text-xs tracking-widest shadow-xl shadow-zinc-200/20 dark:shadow-none disabled:opacity-50 cursor-pointer"
                disabled={isSearching}
              >
                {isSearching ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Search'}
              </button>
            </form>

            <div className="grid gap-3">
              {searchResults.map(result => {
                const isFriend = friends.some(f => f.uid === result.uid);
                const isSent = pendingSent.some(r => r.toId === result.uid);
                const isReceived = pendingReceived.some(r => r.fromId === result.uid);

                return (
                  <div key={result.uid} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 sm:p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-zinc-200 dark:hover:border-zinc-750 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 rounded-2xl flex items-center justify-center font-bold uppercase">
                          {result.displayName?.[0] || '?'}
                        </div>
                        {result.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-zinc-900 dark:text-white truncate">{result.displayName}</h3>
                          {result.isOnline && <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0" />}
                        </div>
                        <p className="text-xs text-zinc-450 dark:text-zinc-500 font-mono truncate">{result.email}</p>
                      </div>
                    </div>

                    <div className="flex sm:justify-end shrink-0">
                      {isFriend ? (
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 px-3 py-1.5 rounded-xl uppercase tracking-wider">Friend</span>
                      ) : isSent ? (
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 px-3 py-1.5 rounded-xl uppercase tracking-wider">Request Sent</span>
                      ) : isReceived ? (
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-3 py-1.5 rounded-xl uppercase tracking-wider">Request Pending</span>
                      ) : (
                        <button 
                          onClick={() => sendRequest(result)}
                          className="bg-blue-600 dark:bg-blue-500 text-white p-3 rounded-2xl hover:bg-blue-700 hover:scale-[1.03] transition-all active:scale-95 shadow-lg shadow-blue-200/50 dark:shadow-none font-bold text-xs uppercase flex items-center gap-2 cursor-pointer"
                        >
                          <UserPlus size={16} />
                          <span>Add Classmate</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!isSearching && searchQuery && searchResults.length === 0 && (
                <div className="text-center py-20 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                  <Search size={48} className="mx-auto text-zinc-200 dark:text-zinc-800 mb-4" />
                  <p className="text-zinc-400 dark:text-zinc-500 italic text-sm">No users found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'requests' && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-10"
          >
            <section>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2">
                <Check size={14} /> Received Requests
              </h2>
              <div className="grid gap-3">
                {pendingReceived.length === 0 ? (
                  <p className="text-zinc-400 dark:text-zinc-500 italic text-sm p-10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl text-center bg-white dark:bg-zinc-900">No incoming requests</p>
                ) : (
                  pendingReceived.map(req => (
                    <div key={req.id} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 sm:p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all hover:border-zinc-200 dark:hover:border-zinc-750">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center font-bold text-lg">
                          {req.fromName?.[0] || '?'}
                        </div>
                        <div>
                          <h3 className="font-bold text-zinc-900 dark:text-white">{req.fromName}</h3>
                          <p className="text-xs text-zinc-450 dark:text-zinc-500 font-medium">Wants to study with you</p>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end shrink-0">
                        <button 
                          onClick={() => declineRequest(req.id)}
                          className="p-3 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-all cursor-pointer"
                          title="Decline"
                        >
                          <X size={20} />
                        </button>
                        <button 
                          onClick={() => acceptRequest(req)}
                          className="bg-blue-600 dark:bg-blue-500 text-white px-5 py-3 rounded-2xl hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-200/20 dark:shadow-none flex items-center gap-2 font-bold text-xs uppercase cursor-pointer"
                        >
                          <Check size={16} />
                          <span>Accept</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 mb-6 flex items-center gap-2">
                <ArrowRight size={14} /> Sent Requests
              </h2>
              <div className="grid gap-3 opacity-80">
                {pendingSent.length === 0 ? (
                  <p className="text-zinc-400 dark:text-zinc-500 italic text-sm p-10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl text-center bg-white dark:bg-zinc-900">No outgoing requests</p>
                ) : (
                  pendingSent.map(req => (
                    <div key={req.id} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 sm:p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 text-zinc-450 dark:text-zinc-500 rounded-2xl flex items-center justify-center font-bold">
                          {req.toName?.[0] || '?'}
                        </div>
                        <div>
                          <h3 className="font-bold text-zinc-900 dark:text-white">{req.toName}</h3>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">Waiting for response...</p>
                        </div>
                      </div>
                      <div className="flex justify-end shrink-0">
                        <button 
                          onClick={() => declineRequest(req.id)}
                          className="p-3 text-zinc-450 dark:text-zinc-500 hover:text-red-650 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-955/20 rounded-2xl transition-all cursor-pointer"
                          title="Cancel Request"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'friends' && (
          <motion.div
            key="friends"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="grid gap-4">
              {friends.length === 0 ? (
                <div className="text-center py-24 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2.5rem] shadow-sm">
                  <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                    <Users size={32} className="text-zinc-350 dark:text-zinc-650" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No friends yet</h3>
                  <p className="text-zinc-400 dark:text-zinc-500 mb-8 max-w-xs mx-auto text-sm">Build your study network by finding fellow students.</p>
                  <button 
                    onClick={() => setActiveTab('search')}
                    className="px-8 py-4 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all uppercase text-xs tracking-widest shadow-xl shadow-blue-100 dark:shadow-none cursor-pointer"
                  >
                    Find Students
                  </button>
                </div>
              ) : (
                friends.map(friend => (
                  <div key={friend.uid} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-6 sm:p-8 rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-zinc-200 dark:hover:border-zinc-750 transition-all shadow-sm">
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="relative">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-zinc-900 dark:bg-zinc-805 text-white rounded-[1.5rem] flex items-center justify-center font-bold text-xl sm:text-2xl uppercase shadow-lg shadow-zinc-205/30">
                          {friend.displayName?.[0] || '?'}
                        </div>
                        {friend.isOnline && (
                          <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-green-500 border-4 border-white dark:border-zinc-900 rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                            {friend.displayName}
                          </h3>
                          {friend.isOnline && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span className={cn(
                            "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md",
                            friend.isOnline ? "bg-green-50 dark:bg-green-950/20 text-green-605 dark:text-green-400" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                          )}>
                            {friend.isOnline ? 'Active' : 'Offline'}
                          </span>
                          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono truncate">{friend.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end shrink-0">
                      <button 
                        onClick={() => removeFriend(friend.uid)}
                        className="p-3 text-zinc-350 dark:text-zinc-500 hover:text-red-650 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-955/20 rounded-2xl transition-all active:scale-95 cursor-pointer"
                        title="Remove Friend"
                      >
                        <UserMinus size={20} />
                      </button>
                      <button 
                        onClick={() => startChat(friend)}
                        className="px-5 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl hover:bg-black dark:hover:bg-white transition-all active:scale-95 shadow-xl shadow-zinc-200/50 dark:shadow-none font-bold text-xs uppercase flex items-center gap-2 cursor-pointer"
                        title="Message"
                      >
                        <MessageCircle size={16} />
                        <span>Chat</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
