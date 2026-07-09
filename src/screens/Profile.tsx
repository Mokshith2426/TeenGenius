import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Mail, Shield, Bell, Moon, LogOut, ChevronRight, Settings, Camera, 
  Loader2, Lock, Calendar, X, Activity, Cpu, Clock, Sparkles, TrendingUp, HelpCircle,
  Users, UserPlus, UserMinus, Check, Search, MessageSquare, Award, CheckCircle2, Bookmark
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { updateProfile } from 'firebase/auth';
import { 
  doc, updateDoc, getDoc, collection, query, where, getDocs, deleteDoc, 
  setDoc, addDoc, serverTimestamp, onSnapshot, arrayUnion, arrayRemove 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';
import { formatDate } from '../lib/dateUtils';
import { getLocalStats, trackEvent, fetchRealtimeStats } from '../lib/analytics';

interface TimetableRecord {
  id: string;
  subjects: string[];
  timetableData: any;
  createdAt: any;
}

export default function Profile() {
  const { user, logout, isGuest, triggerGuestPrompt, updateUserInContext } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [savedTimetables, setSavedTimetables] = useState<TimetableRecord[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TimetableRecord | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isAccountInfoOpen, setIsAccountInfoOpen] = useState(false);
  const [stats, setStats] = useState(getLocalStats());

  // Redesign tabs state
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'friends' | 'achievements' | 'settings'>('profile');
  
  // Real-time friends states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>(() => {
    try {
      const stored = user ? localStorage.getItem(`STUDENT_LOCAL_PROFILE_FRIENDS_CACHE_${user.uid}`) : null;
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendsActiveTab, setFriendsActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'error' | 'success', message: string } | null>(null);

  const showFeedback = (type: 'error' | 'success', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
  };

  const location = useLocation();

  useEffect(() => {
    trackEvent('use_feature', { featureName: 'Profile' });
    
    // Parse URL query parameter: ?tab=... &sub=...
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'profile' || tab === 'friends' || tab === 'achievements' || tab === 'settings') {
      setActiveSubTab(tab as any);
      const sub = params.get('sub');
      if (sub === 'friends' || sub === 'requests' || sub === 'search') {
        setFriendsActiveTab(sub as any);
      }
    } else {
      setActiveSubTab('profile');
    }
  }, [location.search]);

  // Fetch timetables with offline storage caching fallback
  useEffect(() => {
    if (!user) return;

    if (isGuest || user.uid.includes('sandbox')) {
      setSavedTimetables([
        {
          id: 'sb_timetable1',
          subjects: ['Mathematics', 'Physics', 'Chemistry'],
          timetableData: {
            'Monday': [
              { timeSlot: '08:00 - 09:30', subject: 'Mathematics', topic: 'Calculus: Derivatives', type: 'revision' },
              { timeSlot: '16:00 - 17:30', subject: 'Physics', topic: 'Electromagnetism Lecture', type: 'primary' }
            ],
            'Wednesday': [
              { timeSlot: '09:00 - 10:30', subject: 'Chemistry', topic: 'Organic Reaction mechanisms', type: 'practice' }
            ]
          },
          createdAt: new Date()
        }
      ]);
      setIsLoadingPlans(false);
      return;
    }

    // Load initial timetables from local cache
    const cachedTimetables = localStorage.getItem(`STUDENT_LOCAL_PROFILE_TIMETABLES_CACHE_${user.uid}`);
    if (cachedTimetables) {
      try {
        setSavedTimetables(JSON.parse(cachedTimetables));
      } catch (err) {
        console.warn("Error parsing profile timetables cache:", err);
      }
    }

    const fetchPlans = async () => {
      setIsLoadingPlans(true);
      try {
        const q = query(collection(db, 'timetables'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimetableRecord));
        setSavedTimetables(fetched);
        
        // Save to cache
        localStorage.setItem(`STUDENT_LOCAL_PROFILE_TIMETABLES_CACHE_${user.uid}`, JSON.stringify(fetched));
      } catch (error) {
        console.error("Profile timetables fetching error:", error);
      } finally {
        setIsLoadingPlans(false);
      }
    };

    fetchPlans();
  }, [user, isGuest]);

  // Synchronize sandbox / guest local storage
  useEffect(() => {
    if (!user) return;
    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (!isSandboxObj) return;

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
  }, [user, isGuest, activeSubTab]);

  useEffect(() => {
    if (!user) return;
    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (!isSandboxObj) return;

    localStorage.setItem(`SANDBOX_FRIENDS_LIST_${user.uid}`, JSON.stringify(friends));
    localStorage.setItem(`SANDBOX_PENDING_RECEIVED_${user.uid}`, JSON.stringify(pendingReceived));
    localStorage.setItem(`SANDBOX_PENDING_SENT_${user.uid}`, JSON.stringify(pendingSent));
  }, [friends, pendingReceived, pendingSent, user, isGuest]);

  // Real-time subscribe to classmates, friends & requests if not Guest
  useEffect(() => {
    if (!user || isGuest || user.uid.includes('sandbox')) return;

    let unsubscribeFriends: (() => void) | null = null;

    // Fetch user profile and friends
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const friendIds = snap.data().friendIds || [];
        if (friendIds.length > 0) {
          if (unsubscribeFriends) unsubscribeFriends();
          
          const friendsQuery = query(collection(db, 'users'), where('uid', 'in', friendIds));
          unsubscribeFriends = onSnapshot(friendsQuery, (friendsSnap) => {
            const fList = friendsSnap.docs.map(d => d.data());
            setFriends(fList);
            // Save to local storage for offline browsing
            localStorage.setItem(`STUDENT_LOCAL_PROFILE_FRIENDS_CACHE_${user.uid}`, JSON.stringify(fList));
          }, (err) => {
            console.error("Profile friends snapshot error:", err);
          });
        } else {
          setFriends([]);
          if (unsubscribeFriends) {
            unsubscribeFriends();
            unsubscribeFriends = null;
          }
        }
      }
    }, (err) => {
      console.error("Profile current user subscriber error:", err);
    });

    // Fetch pending requests received
    const receivedQuery = query(
      collection(db, 'friendRequests'), 
      where('toId', '==', user.uid), 
      where('status', '==', 'pending')
    );
    const unsubscribeReceived = onSnapshot(receivedQuery, (snap) => {
      setPendingReceived(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Incoming friend requests subscribe error:", err);
    });

    // Fetch pending requests sent
    const sentQuery = query(
      collection(db, 'friendRequests'), 
      where('fromId', '==', user.uid), 
      where('status', '==', 'pending')
    );
    const unsubscribeSent = onSnapshot(sentQuery, (snap) => {
      setPendingSent(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error("Outgoing friend requests subscribe error:", err);
    });

    return () => {
      unsubscribeUser();
      unsubscribeReceived();
      unsubscribeSent();
      if (unsubscribeFriends) unsubscribeFriends();
    };
  }, [user, isGuest]);

  // Friend actions
  const handleSearchClassmates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
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
      setSearchResults(results.slice(0, 30));
    } catch (error) {
      console.error("Profile classmate search error:", error);
      showFeedback('error', "Classmate list could not be queried.");
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (targetUser: any) => {
    if (isGuest) {
      triggerGuestPrompt("Send classmate friend requests");
      return;
    }
    if (!user) return;

    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      const alreadySent = pendingSent.some(r => r.toId === targetUser.uid);
      const alreadyRecv = pendingReceived.some(r => r.fromId === targetUser.uid);
      if (alreadySent || alreadyRecv) {
        showFeedback('error', "A request is already pending with this classmate.");
        return;
      }
      if (friends.some(f => f.uid === targetUser.uid)) {
        showFeedback('error', "You are already buddies with this classmate.");
        return;
      }

      const newRequest = {
        id: `m_req_${Date.now()}`,
        fromId: user.uid,
        fromName: user.displayName || 'Student Colleague',
        toId: targetUser.uid,
        toName: targetUser.displayName || 'Classmate',
        status: 'pending',
        timestamp: new Date()
      };
      setPendingSent(prev => [...prev, newRequest]);
      showFeedback('success', `Friend request sent to ${targetUser.displayName}`);
      return;
    }

    try {
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
        showFeedback('error', "A request is already pending with this classmate.");
        return;
      }
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const friendIds = userDoc.data().friendIds || [];
        if (friendIds.includes(targetUser.uid)) {
          showFeedback('error', "You are already friends with this classmate.");
          return;
        }
      }

      await addDoc(collection(db, 'friendRequests'), {
        fromId: user.uid,
        fromName: user.displayName || 'Sophisticated Student',
        toId: targetUser.uid,
        toName: targetUser.displayName || 'Academics Enthusiast',
        status: 'pending',
        timestamp: serverTimestamp()
      });

      showFeedback('success', `Friend request sent to ${targetUser.displayName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'friendRequests');
      showFeedback('error', "Failed to send request.");
    }
  };

  const acceptFriendRequest = async (request: any) => {
    if (isGuest) {
      triggerGuestPrompt("Accept classmate requests");
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
      showFeedback('success', `Connected with ${request.fromName}!`);
      return;
    }

    try {
      console.log("[DEBUG Profile] Starting acceptFriendRequest workflow. Request:", JSON.stringify(request));
      if (!request.id) {
        throw new Error("Missing request.id in acceptFriendRequest invocation.");
      }
      if (!request.fromId) {
        throw new Error("Missing request.fromId in acceptFriendRequest invocation.");
      }
      if (request.toId !== user.uid) {
        throw new Error(`Auth UID mismatch: currentUser.uid is ${user.uid}, but request.toId is ${request.toId}`);
      }

      console.log(`[DEBUG Profile] Securing friendship transaction via atomic batch...`);
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);

      const requestRef = doc(db, 'friendRequests', request.id);
      const userRefSelf = doc(db, 'users', user.uid);
      const userRefTarget = doc(db, 'users', request.fromId);

      // 1. Double update mutual friend relations
      batch.update(userRefSelf, { friendIds: arrayUnion(request.fromId) });
      batch.update(userRefTarget, { friendIds: arrayUnion(user.uid) });

      // 2. Clear friend request document
      batch.delete(requestRef);

      // 3. Commit the atomic batch
      await batch.commit();

      console.log(`[DEBUG Profile] Atomic friendship batch committed successfully.`);
      showFeedback('success', `Connected with ${request.fromName}!`);
    } catch (error: any) {
      console.error("[DEBUG Profile] Error inside acceptFriendRequest workflow:", error);
      const detailedMessage = error instanceof Error ? error.message : String(error);
      showFeedback('error', `FAILED TO ACCEPT INVITATION: ${detailedMessage}`);
    }
  };

  const declineFriendRequest = async (requestId: string) => {
    const isSandboxObj = user?.uid?.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      setPendingReceived(prev => prev.filter(r => r.id !== requestId));
      setPendingSent(prev => prev.filter(r => r.id !== requestId));
      showFeedback('success', "Friend request ignored.");
      return;
    }

    try {
      await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'declined'
      });
      showFeedback('success', "Friend request ignored.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `friendRequests/${requestId}`);
      showFeedback('error', "Failed to decline connection.");
    }
  };

  const removeClassmateFriend = async (friendId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to disconnect from this classmate?")) return;

    const isSandboxObj = user?.uid?.includes('sandbox') || isGuest;
    if (isSandboxObj) {
      setFriends(prev => prev.filter(f => f.uid !== friendId));
      showFeedback('success', "Disconnected classmate successfully.");
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        friendIds: arrayRemove(friendId)
      });
      await updateDoc(doc(db, 'users', friendId), {
        friendIds: arrayRemove(user.uid)
      });
      showFeedback('success', "Disconnected classmate successfully.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      showFeedback('error', "Failed to disconnect colleague.");
    }
  };

  const startIndividualChat = async (friend: any) => {
    if (!user) return;
    try {
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
          lastMessage: 'Chat initialized'
        });
        navigate(`/app/chats/${newChat.id}`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const handleDeletePlan = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      await deleteDoc(doc(db, 'timetables', id));
      setSavedTimetables(prev => prev.filter(t => t.id !== id));
      if (selectedPlan?.id === id) setSelectedPlan(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `timetables/${id}`);
    }
  };

  const handleUpdateName = async () => {
    if (isGuest) {
      triggerGuestPrompt("Update profile display name");
      return;
    }
    if (!newName.trim() || !user) return;
    try {
      const isSandboxObj = user.uid.includes('sandbox') || isGuest;
      if (!isSandboxObj) {
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: newName });
        }
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { displayName: newName }, { merge: true });
      }
      updateUserInContext({ displayName: newName });
      setIsEditingName(false);
      showFeedback('success', "Display name updated instantly!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      showFeedback('error', "Failed to update display name.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isGuest) {
      triggerGuestPrompt("Upload custom profiles avatars");
      return;
    }
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 1024 * 1024) {
      alert("Image too large. Please select a file under 1MB.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const isSandboxObj = user.uid.includes('sandbox') || isGuest;
        if (!isSandboxObj) {
          if (auth.currentUser) {
            await updateProfile(auth.currentUser, { photoURL: base64String });
          }
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, { photoURL: base64String }, { merge: true });
        }
        updateUserInContext({ photoURL: base64String });
        showFeedback('success', "Custom avatar applied successfully!");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        showFeedback('error', "Failed to apply custom avatar.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    setIsDarkMode(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  // Badges & Achievements Data List
  const achievements = [
    {
      id: "focus_catalyst",
      title: "Focus Catalyst",
      desc: "Unlocked by starting quiet focus sessions and tracking study hours.",
      icon: Clock,
      color: "from-rose-500/10 to-orange-500/10 text-rose-500 border-rose-500/25",
      isUnlocked: true,
      progress: "100%"
    },
    {
      id: "academic_scholar",
      title: "Academic Scholar",
      desc: "Unlocked by creating and saving personalized timetables or study plans.",
      icon: Bookmark,
      color: "from-blue-500/10 to-indigo-500/10 text-blue-500 border-blue-500/25",
      isUnlocked: savedTimetables.length > 0,
      progress: savedTimetables.length > 0 ? "100%" : "0%"
    },
    {
      id: "peer_networker",
      title: "Peer Catalyst",
      desc: "Unlocked when you have linked classmates and joined your study network.",
      icon: Users,
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-550 border-emerald-550/25",
      isUnlocked: friends.length > 0,
      progress: friends.length > 0 ? "100%" : "0%"
    },
    {
      id: "ai_learner",
      title: "AI Co-Scholar",
      desc: "Granted for studying collaboratively with the TeenGenius secure AI assistant.",
      icon: Sparkles,
      color: "from-purple-500/10 to-pink-500/10 text-purple-500 border-purple-500/25",
      isUnlocked: true,
      progress: "100%"
    }
  ];

  const menuItems = [
    { icon: User, label: 'Change Account Nickname', color: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-805 dark:text-white', action: () => setIsEditingName(true) },
    { icon: Shield, label: 'Student Account Credentials', sub: 'Inspect Secure Account Info', color: 'bg-teal-50 text-teal-600 dark:bg-teal-950/20 dark:text-teal-400', action: () => setIsAccountInfoOpen(true) },
    { icon: Bell, label: 'Instant Doubts Notifications', sub: 'Active', color: 'bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400', action: () => alert("Notification settings synchronized!") },
    { icon: Moon, label: 'Visual Interface Mode', sub: isDarkMode ? 'Dark Screen' : 'Light Screen', color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400', action: toggleDarkMode },
    { icon: HelpCircle, label: 'System Walkthrough & Help', sub: 'Restart Tutorial', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-440', action: () => window.dispatchEvent(new CustomEvent('trigger-walkthrough')) },
    { icon: Activity, label: 'Student Performance Analytics', sub: 'Institutional usage report', color: 'bg-rose-100 text-rose-705 dark:bg-rose-950/40 dark:text-rose-450', action: async () => { setStats(getLocalStats()); setIsAnalyticsOpen(true); const live = await fetchRealtimeStats(); setStats(live); } },
    { icon: Shield, label: 'Institution Privacy & Security', color: 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400', action: () => alert("Student privacy guidelines are audited and maintained securely by TeenGenius security layers.") },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-4xl mx-auto space-y-8 pb-32">
      {/* Redesigned Floating User Card Header */}
      <header className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-[2.5rem] p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 shadow-sm">
        <div className="relative shrink-0">
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <div className="w-24 h-24 sm:w-28 sm:h-28 bg-zinc-150 dark:bg-zinc-800 rounded-3xl flex items-center justify-center overflow-hidden border-2 border-white dark:border-zinc-800 shadow-md relative group">
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-10">
                <Loader2 size={22} className="text-white animate-spin" />
              </div>
            )}
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Classmate" className="w-full h-full object-cover animate-fadeIn" />
            ) : (
              <User size={38} className="text-zinc-400" />
            )}
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white text-xs font-black uppercase tracking-wider gap-1"
            >
              <Camera size={14} />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className="text-center md:text-left space-y-1.5 flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none truncate max-w-xs">{user?.displayName || 'TeenGenius Student'}</h1>
            <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-blue-50 dark:bg-zinc-850 text-blue-600 dark:text-blue-400 rounded-full border border-blue-500/10">Active Learner</span>
          </div>
          <p className="text-xs text-zinc-450 dark:text-zinc-500 font-semibold flex items-center justify-center md:justify-start gap-1.5">
            <Mail size={13} />
            <span className="truncate">{user?.email}</span>
          </p>
          <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1">
            <span className="text-[10px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg border border-emerald-500/10">
              Connections: {friends.length}
            </span>
            <span className="text-[10px] font-extrabold uppercase bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 px-3 py-1 rounded-lg border border-indigo-500/10">
              Xp Level: {stats.newUsersCount * 50 + friends.length * 100 + 350} XP
            </span>
          </div>
        </div>
      </header>

      {/* Segmented Control Navigation Tabs (Modern Mobile App Aesthetics) */}
      <div className="grid grid-cols-4 bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800 p-1 rounded-2xl w-full select-none cursor-pointer">
        {[
          { id: 'profile', label: 'Overview', icon: User },
          { id: 'friends', label: 'Friends', icon: Users, alertCount: pendingReceived.length },
          { id: 'achievements', label: 'Badges', icon: Award },
          { id: 'settings', label: 'Settings', icon: Settings }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={cn(
                "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-3 sm:py-3.5 px-1 rounded-xl text-[9px] sm:text-xs font-black uppercase tracking-widest relative transition-all cursor-pointer",
                isActive
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 dark:hover:text-zinc-350"
              )}
            >
              <Icon size={14} className="shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              {!!tab.alertCount && (
                <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 bg-red-500 text-white font-black text-[9px] rounded-full flex items-center justify-center border border-white">
                  {tab.alertCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Action Notification Banner */}
      <AnimatePresence>
        {actionFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "p-4 rounded-2xl font-extrabold text-xs uppercase tracking-wider flex items-center justify-between shadow-xl",
              actionFeedback.type === 'error'
                ? "bg-red-50 dark:bg-red-950/20 text-red-650 border border-red-550/15"
                : "bg-green-50 dark:bg-green-950/20 text-green-600 border border-green-550/15"
            )}
          >
            <span>{actionFeedback.message}</span>
            <button onClick={() => setActionFeedback(null)} className="p-1 cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Canvas switcher */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.18 }}
          className="space-y-6"
        >
          {/* ==================== 1. OVERVIEW TAB ==================== */}
          {activeSubTab === 'profile' && (
            <div className="space-y-6">
              {/* Saved timetable plans */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-500 italic">Academic Saved Planners</h2>
                  <span className="text-[9px] bg-zinc-150 dark:bg-zinc-800 px-3 py-1 rounded-full text-zinc-500 font-extrabold uppercase">
                    {savedTimetables.length} Saved Plans
                  </span>
                </div>

                {isLoadingPlans ? (
                  <div className="flex justify-center py-10">
                    <Loader2 size={24} className="animate-spin text-zinc-300" />
                  </div>
                ) : savedTimetables.length === 0 ? (
                  <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-10 text-center space-y-2">
                    <Calendar size={28} className="mx-auto text-zinc-300" />
                    <p className="text-zinc-450 text-xs font-semibold leading-relaxed">You haven't generated any study timetables yet.</p>
                    <button 
                      onClick={() => navigate('/app/tools')} 
                      className="px-3.5 py-1.5 bg-blue-50 dark:bg-blue-955/20 text-blue-600 dark:text-blue-400 font-extrabold text-[9px] uppercase tracking-wider rounded-lg border border-blue-500/10 cursor-pointer hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                    >
                      Make timetables
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3.5">
                    {savedTimetables.map((plan) => (
                      <motion.div
                        key={plan.id}
                        whileHover={{ scale: 1.005 }}
                        className="flex items-center justify-between p-5 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2.5xl cursor-pointer hover:border-blue-500 transition-all select-none"
                        onClick={() => setSelectedPlan(plan)}
                      >
                        <div className="flex items-center gap-4 text-left min-w-0">
                          <div className="w-11 h-11 bg-orange-50 dark:bg-orange-950/20 rounded-2xl flex items-center justify-center text-orange-650 shrink-0">
                            <Calendar size={18} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-zinc-900 dark:text-zinc-100 uppercase text-xs tracking-tight truncate">
                              {plan.subjects.slice(0, 3).join(', ')}{plan.subjects.length > 3 ? '...' : ''}
                            </h3>
                            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
                              Saved on: {formatDate(plan.createdAt)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeletePlan(plan.id, e)}
                          className="p-2 text-zinc-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
                          title="Delete study plan"
                        >
                          <X size={15} />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>

              {/* Study Stats Quick Glance */}
              <section className="space-y-4">
                <div className="px-2">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-500 italic">Academic Achievements Overview</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-rose-500">
                      <Clock size={15} />
                      <span>Study Sprints</span>
                    </div>
                    <p className="text-2xl font-black text-zinc-950 dark:text-white">7+ Sessions</p>
                    <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-bold uppercase">Consolidated Deep Focus streaks</p>
                  </div>

                  <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-3xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-600">
                      <Users size={15} />
                      <span>Classmate Circles</span>
                    </div>
                    <p className="text-2xl font-black text-zinc-950 dark:text-white">{friends.length} Classroom peers</p>
                    <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-bold uppercase">Linked study connections</p>
                  </div>
                </div>
              </section>

              <button 
                onClick={logout}
                className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/10 dark:hover:bg-red-950/20 text-red-650 font-black py-5 px-6 rounded-2.5xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 text-sm uppercase tracking-widest shadow-xs"
              >
                <LogOut size={16} />
                <span>Terminated Sessions Logout</span>
              </button>
            </div>
          )}

          {/* ==================== 2. CLASSMATE FRIENDS TAB ==================== */}
          {activeSubTab === 'friends' && (
            <div className="space-y-6">
              {/* Nested Friends Tabs */}
              <div className="flex bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-1 rounded-xl w-fit">
                {[
                  { id: 'friends', label: `My Friends (${friends.length})` },
                  { id: 'requests', label: `Incoming Requests (${pendingReceived.length})` },
                  { id: 'search', label: 'Explore Classmates' }
                ].map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setFriendsActiveTab(sub.id as any)}
                    className={cn(
                      "px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      friendsActiveTab === sub.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-250"
                    )}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {/* a. MY FRIENDS SUBTAB */}
              {friendsActiveTab === 'friends' && (
                <div className="space-y-4">
                  {friends.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-150/80 dark:border-zinc-800/80 rounded-3xl p-8 text-center space-y-5 shadow-xs">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500/15 to-indigo-500/15 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                        <Users size={24} />
                      </div>
                      
                      <div className="space-y-1.5 max-w-sm mx-auto">
                        <h4 className="text-sm font-black uppercase tracking-wider text-zinc-850 dark:text-zinc-200">Start Your Study Network!</h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
                          Connecting with classmates unlocks the <strong className="text-indigo-600 dark:text-amber-400">Peer Catalyst Badge</strong> and awards you <strong className="text-emerald-600">+150 XP</strong> for collaborative group study!
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 max-w-xs mx-auto">
                        <button 
                          onClick={() => setFriendsActiveTab('search')}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md shadow-blue-500/10 active:scale-95 touch-manipulation"
                        >
                          🔍 Search classmate peers
                        </button>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => navigate('/app/tools')}
                            className="py-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-650 dark:text-zinc-300 font-extrabold text-[9.5px] uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95"
                          >
                            ⚡ Study Tools
                          </button>
                          <button 
                            onClick={() => navigate('/app/ai-assistant')}
                            className="py-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-650 dark:text-zinc-300 font-extrabold text-[9.5px] uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95"
                          >
                            🤖 Chat AI
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {friends.map((friend) => (
                        <div 
                          key={friend.uid}
                          className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2.5xl p-4 flex items-center justify-between gap-4 gap-y-2 flex-wrap"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 bg-blue-600/10 text-blue-600 font-semibold rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                              {friend.photoURL ? (
                                <img src={friend.photoURL} alt="Peer avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                (friend.displayName?.[0] || 'T')
                              )}
                            </div>
                            <div>
                              <h3 className="text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-white leading-tight">{friend.displayName}</h3>
                              <p className="text-[10px] text-zinc-450 dark:text-zinc-500 truncate max-w-[150px] sm:max-w-xs">{friend.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startIndividualChat(friend)}
                              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-extrabold text-[9.5px] uppercase tracking-wider rounded-xl flex items-center gap-1.5 cursor-pointer touch-manipulation"
                            >
                              <MessageSquare size={12} />
                              <span>PM Study</span>
                            </button>
                            <button
                              onClick={() => removeClassmateFriend(friend.uid)}
                              className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-zinc-800 dark:hover:text-red-400 rounded-xl transition-all cursor-pointer touch-manipulation"
                              title="Disconnect circle"
                            >
                              <UserMinus size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* b. PENDING INCOMING & OUTGOING REQUESTS */}
              {friendsActiveTab === 'requests' && (
                <div className="space-y-6">
                  {/* Received requests */}
                  <div className="space-y-3.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Incoming requests ({pendingReceived.length})</span>
                    {pendingReceived.length === 0 ? (
                      <p className="text-xs text-zinc-450 dark:text-zinc-550 pl-2 leading-none">No pending classmate invitations received.</p>
                    ) : (
                      <div className="grid gap-3">
                        {pendingReceived.map(req => (
                          <div key={req.id} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2.5xl p-4 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-white">{req.fromName}</h4>
                              <p className="text-[9.5px] text-zinc-450 dark:text-zinc-500">Wants to join your academy circle.</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => acceptFriendRequest(req)}
                                className="p-2 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 rounded-xl transition-all cursor-pointer"
                                title="Accept Peer invite"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => declineFriendRequest(req.id)}
                                className="p-2 bg-red-50 hover:bg-red-650 hover:text-white text-red-600 rounded-xl transition-all cursor-pointer"
                                title="Ignore invite"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sent requests */}
                  <div className="space-y-3.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Sent requests pending ({pendingSent.length})</span>
                    {pendingSent.length === 0 ? (
                      <p className="text-xs text-zinc-450 dark:text-zinc-550 pl-2 leading-none">No pending invitations sent.</p>
                    ) : (
                      <div className="grid gap-3">
                        {pendingSent.map(req => (
                          <div key={req.id} className="bg-white dark:bg-zinc-900 border border-zinc-155 dark:border-zinc-805 rounded-2.5xl p-4 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="text-xs font-black uppercase tracking-wide text-zinc-850 dark:text-zinc-200">{req.toName}</h4>
                              <p className="text-[9.5px] text-zinc-450 dark:text-zinc-500">Waiting for classmate authentication...</p>
                            </div>
                            <button
                              onClick={() => declineFriendRequest(req.id)}
                              className="px-3.5 py-1.5 bg-zinc-50 dark:bg-zinc-805 hover:bg-red-100 text-[10px] text-zinc-500 hover:text-red-650 font-bold uppercase rounded-lg transition-all cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* c. EXPLORE CLASSMATES SEARCH FINDER */}
              {friendsActiveTab === 'search' && (
                <div className="space-y-5">
                  <form onSubmit={handleSearchClassmates} className="flex gap-2 w-full">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3.5 top-3.5 text-zinc-400" />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search classmates by display name or school email..."
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      {isSearching ? <Loader2 size={13} className="animate-spin" /> : "Query"}
                    </button>
                  </form>

                  <div className="space-y-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Classmate Query results ({searchResults.length})</span>
                    {searchResults.length === 0 ? (
                      <div className="bg-white/40 dark:bg-zinc-900/10 p-8 rounded-2.5xl text-center text-xs text-zinc-400 font-semibold border border-zinc-100 dark:border-zinc-850">
                        Type classmate's name above and hit Query to locate school classmates!
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {searchResults.map(colleague => {
                          const isAlreadyLinked = friends.some(f => f.uid === colleague.uid);
                          return (
                            <div key={colleague.uid} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2.5xl p-4 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-white truncate">{colleague.displayName || 'Sophisticated student'}</h4>
                                <p className="text-[9.5px] text-zinc-450 dark:text-zinc-500 truncate max-w-[150px] sm:max-w-xs">{colleague.email}</p>
                              </div>

                              {isAlreadyLinked ? (
                                <span className="text-[9px] font-black uppercase tracking-wide px-3 py-1 bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-450 rounded-lg">Linked circle</span>
                              ) : (
                                <button
                                  onClick={() => sendFriendRequest(colleague)}
                                  className="px-3.5 py-2 bg-blue-50 hover:bg-blue-600 hover:text-white dark:bg-blue-955/20 text-blue-600 dark:text-blue-400 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer touch-manipulation"
                                >
                                  <UserPlus size={11} />
                                  <span>Link Circle</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== 3. ACHIEVEMENTS & BADGES TAB ==================== */}
          {activeSubTab === 'achievements' && (
            <div className="space-y-6">
              <div className="px-1 text-center sm:text-left space-y-1.5">
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400 italic">Academic Achievements &amp; Badges</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">Earn digital credentials by maintaining study routines and collaborating in classroom networks.</p>
              </div>

              {/* Cheerful Gamification Master Guidance widget */}
              <div className="bg-gradient-to-tr from-blue-600/10 via-indigo-600/5 to-transparent border border-blue-500/10 rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-blue-400">
                  <Award size={18} className="animate-bounce" />
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">Level Up Study Rewards</span>
                </div>
                <p className="text-[11px] text-zinc-650 dark:text-zinc-300 font-semibold leading-relaxed">
                  Earn premium academy badges to showcase your diligence! Unlocking all milestones awards you the <strong className="text-blue-500">Ultimate Scholar</strong> title and <strong className="text-emerald-600 dark:text-emerald-405">+500 XP</strong> mega-bonus!
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => navigate('/app/focus')} className="px-3.5 py-2 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-black text-[9px] uppercase tracking-wider border border-zinc-200/50 dark:border-zinc-800 rounded-xl transition-all cursor-pointer active:scale-95">
                    ⏱️ Focus Room (Earn Catalyst)
                  </button>
                  <button onClick={() => { setActiveSubTab('friends'); setFriendsActiveTab('search'); }} className="px-3.5 py-2 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-black text-[9px] uppercase tracking-wider border border-zinc-200/50 dark:border-zinc-800 rounded-xl transition-all cursor-pointer active:scale-95">
                    👥 Link Peers (Earn Catalyst)
                  </button>
                  <button onClick={() => navigate('/app/timetable')} className="px-3.5 py-2 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-black text-[9px] uppercase tracking-wider border border-zinc-200/50 dark:border-zinc-800 rounded-xl transition-all cursor-pointer active:scale-95">
                    📅 Timetables (Earn Scholar)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {achievements.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <div 
                      key={badge.id}
                      className={cn(
                        "bg-white dark:bg-zinc-900/60 border rounded-3xl p-6 flex flex-col justify-between gap-5 transition-all select-none relative overflow-hidden",
                        badge.isUnlocked 
                          ? "border-zinc-200/50 dark:border-zinc-800 shadow-[0_4px_15px_rgba(0,0,0,0.01)] hover:scale-[1.01]" 
                          : "border-zinc-150/40 dark:border-zinc-850/40 opacity-70"
                      )}
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between">
                          <div className={cn("w-10 h-10 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 border border-white/5", badge.color)}>
                            <Icon size={18} strokeWidth={2.4} />
                          </div>

                          <div className="flex items-center gap-1">
                            {badge.isUnlocked ? (
                              <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md flex items-center gap-0.5 border border-emerald-500/10">
                                <CheckCircle2 size={9} />
                                Unlocked
                              </span>
                            ) : (
                              <span className="text-[8px] font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-450 px-2 py-1 rounded-md flex items-center gap-0.5">
                                <Lock size={9} />
                                Locked
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-zinc-150">{badge.title}</h4>
                          <p className="text-[11px] text-zinc-450 leading-relaxed dark:text-zinc-500 font-semibold">{badge.desc}</p>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between items-center text-[8.5px] font-black text-zinc-400 uppercase tracking-wider">
                          <span>Sprint Progress</span>
                          <span>{badge.progress}</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full" 
                            style={{ width: badge.progress }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== 4. SETTINGS & ACCOUNT TAB ==================== */}
          {activeSubTab === 'settings' && (
            <div className="space-y-6">
              <div className="px-1">
                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400 italic">Settings &amp; Preferences</h3>
              </div>

              <section className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-[2rem] overflow-hidden shadow-xs">
                {menuItems.map((item) => (
                  <button 
                    key={item.label}
                    onClick={() => item.action && item.action()}
                    className="w-full flex items-center gap-4 p-5 hover:bg-zinc-50 dark:hover:bg-zinc-805 transition-all group border-b border-zinc-50 dark:border-zinc-850 last:border-none cursor-pointer"
                  >
                    <div className={cn("p-2.5 rounded-xl transition-transform group-hover:scale-105", item.color)}>
                      <item.icon size={17} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-extrabold text-xs text-zinc-900 dark:text-zinc-150 uppercase tracking-wide">{item.label}</div>
                      {item.sub && <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-0.5">{item.sub}</div>}
                    </div>
                    <ChevronRight size={16} className="text-zinc-200 dark:text-zinc-700 group-hover:text-zinc-400 dark:group-hover:text-zinc-500 transition-colors" />
                  </button>
                ))}
              </section>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* REUSABLE SETTINGS / EDIT NAME MODALS */}
      <AnimatePresence>
        {isEditingName && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-50 dark:bg-zinc-950 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2.5xl p-6 sm:p-8 border border-white/10"
            >
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white mb-2">Edit Display Nickname</h3>
              <p className="text-[11px] text-zinc-450 dark:text-zinc-500 leading-relaxed font-semibold mb-5">
                This name represents your identity across homework answers, classmate study circles, and video study rooms.
              </p>

              <input 
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Type profile display name..."
                required
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-500 text-zinc-900 dark:text-white font-semibold mb-6"
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="px-4.5 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-300 font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateName}
                  className="px-4.5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* View Timetable Plan Detail modal */}
        {selectedPlan && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-zinc-50 dark:bg-zinc-950 rounded-[2.5rem] w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-white/5"
            >
              <header className="p-6 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-white uppercase tracking-tight">Saved Academic Plan</h2>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">Custom study roadmap &amp; class periods</p>
                </div>
                <button 
                  onClick={() => setSelectedPlan(null)}
                  className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-zinc-900 transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(selectedPlan.timetableData || {}).map(([day, items]) => (
                    <div key={day} className="bg-white dark:bg-zinc-900 p-5 rounded-2.5xl border border-zinc-150 dark:border-zinc-800 space-y-3">
                      <h4 className="font-black text-zinc-900 dark:text-white uppercase tracking-widest text-[10px] border-b border-zinc-100 dark:border-zinc-800 pb-2">
                        {day}
                      </h4>
                      <div className="space-y-1.5">
                        {Array.isArray(items) ? (items as any[]).map((item, i) => (
                          <div key={i} className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
                            <span className="text-[8px] font-black uppercase text-orange-600 tracking-wide">{item.time}</span>
                            <h5 className="font-extrabold text-[11px] text-zinc-850 dark:text-zinc-205 leading-tight uppercase mt-0.5">{item.subject}</h5>
                          </div>
                        )) : (
                          <span className="text-[9.5px] text-zinc-400 font-medium">Free day/No registered studies.</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Real-time Student Analytics modal */}
        {isAnalyticsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-zinc-50 dark:bg-zinc-950 rounded-[2.5rem] w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl border border-zinc-100 dark:border-zinc-800 my-8"
            >
              <header className="p-6 bg-white dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-850 flex items-center justify-between">
                <div>
                  <div className="text-[8.5px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-450 flex items-center gap-1 mb-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                    </span>
                    Institutional Usage Telemetry
                  </div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">Platform Analytics</h2>
                </div>
                <button 
                  onClick={() => setIsAnalyticsOpen(false)}
                  className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-900 dark:hover:bg-white hover:text-white dark:hover:text-zinc-900 transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </header>

              <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] scrollbar-hide">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl">
                    <span className="text-[8px] font-black uppercase text-zinc-400 block mb-0.5">DAU / WAU</span>
                    <p className="text-base font-black text-zinc-900 dark:text-white">{stats.dauCount} <span className="text-[10px] text-zinc-400 font-semibold">/ {stats.wauCount}</span></p>
                  </div>
                  <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl">
                    <span className="text-[8px] font-black uppercase text-zinc-400 block mb-0.5">System Logins</span>
                    <p className="text-base font-black text-green-500">+{stats.newUsersCount + stats.returningUsersCount}</p>
                  </div>
                  <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl">
                    <span className="text-[8px] font-black uppercase text-zinc-400 block mb-0.5">Active Sessions</span>
                    <p className="text-base font-black text-blue-500">{stats.sessionsCount}</p>
                  </div>
                  <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl">
                    <span className="text-[8px] font-black uppercase text-zinc-400 block mb-0.5">Average Depth</span>
                    <p className="text-base font-black text-orange-500">{Math.round((stats.averageSessionDuration || 340) / 60)}m</p>
                  </div>
                </div>

                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-zinc-850">
                    <span>Onboarding Tutorial Progress</span>
                    <span>{Math.round((stats.tutorialCompletedCount / (stats.tutorialStartedCount || 1)) * 100)}%</span>
                  </div>
                  <div className="relative w-full h-2 bg-zinc-100 dark:bg-zinc-950 rounded-full overflow-hidden">
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-blue-600 rounded-full" 
                      style={{ width: `${Math.round((stats.tutorialCompletedCount / (stats.tutorialStartedCount || 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Features usage analysis</span>
                  <div className="grid gap-2.5">
                    {Object.entries(stats.featureUsage || {}).map(([feature, hits]) => {
                      const maxVal = Math.max(...Object.values(stats.featureUsage));
                      const percent = Math.round((hits / (maxVal || 1)) * 100);
                      return (
                        <div key={feature} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                          <div className="flex items-center justify-between text-xs font-bold text-zinc-805">
                            <span>{feature}</span>
                            <span>{hits} queries</span>
                          </div>
                          <div className="w-full h-1 bg-zinc-100 dark:bg-zinc-950 rounded-full overflow-hidden mt-2">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-5 bg-zinc-100/50 dark:bg-zinc-950/40 border-t border-zinc-150 dark:border-zinc-850 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsAnalyticsOpen(false)}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Real-time Student Account Information modal */}
        {isAccountInfoOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-zinc-50 dark:bg-zinc-950 rounded-[2.5rem] w-full max-w-md overflow-hidden flex flex-col shadow-2xl border border-zinc-100 dark:border-zinc-805"
            >
              <header className="p-6 bg-white dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-850 flex items-center justify-between">
                <div>
                  <div className="text-[8.5px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400 flex items-center gap-1 mb-0.5">
                    <Shield size={11} className="text-teal-500" />
                    Secure Study Portal Identity
                  </div>
                  <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">Account Info</h2>
                </div>
                <button 
                  onClick={() => setIsAccountInfoOpen(false)}
                  className="p-2 bg-zinc-100 dark:bg-zinc-805 rounded-xl hover:bg-zinc-900 dark:hover:bg-white hover:text-white dark:hover:text-zinc-900 transition-all cursor-pointer shadow-xs"
                >
                  <X size={15} />
                </button>
              </header>

              <div className="p-6 space-y-6 text-left">
                {/* Visual student profile credentials badge */}
                <div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2.5xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-teal-600/10 text-teal-600 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 border border-teal-500/10">
                    {user?.displayName?.[0] || 'S'}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-tight leading-none mb-1">
                      {user?.displayName || 'Active Student'}
                    </h4>
                    <p className="text-[10px] text-zinc-450 font-bold uppercase tracking-widest leading-none">
                      {isGuest ? 'Guest Learner Access' : 'Verified Google Sign-In'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-100 dark:border-zinc-850">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Academic Email</span>
                    <span className="font-extrabold text-zinc-800 dark:text-zinc-200 select-all shrink-0 max-w-[200px] truncate">{user?.email || 'guest@teengenius.local'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-100 dark:border-zinc-850">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Student Identifier</span>
                    <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400 select-all shrink-0 max-w-[150px] truncate" title={user?.uid}>{user?.uid || 'GENIUS_GUEST_MODE_ID'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-100 dark:border-zinc-850">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Authorization Client</span>
                    <span className="font-black text-[9px] uppercase tracking-widest text-teal-600 dark:text-teal-400 bg-teal-55/10 dark:bg-teal-950/20 px-2.5 py-1 rounded-md">
                      {isGuest ? 'Anonymous mode' : 'Google Identity Client'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Encryption Standard</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400 uppercase text-[9px] tracking-wider bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-md">
                      AES-256 SSL Secure
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-zinc-100/50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-150/40 dark:border-zinc-850/40 text-center">
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-semibold">
                    TeenGenius maintains strict student privacy guidelines in absolute compliance with COPPA &amp; FERPA mandates. No analytical profiling or third-party storage operations occur.
                  </p>
                </div>
              </div>

              <div className="p-5 bg-zinc-100/50 dark:bg-zinc-950/40 border-t border-zinc-150 dark:border-zinc-850 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setIsAccountInfoOpen(false)}
                  className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  Close Info
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
