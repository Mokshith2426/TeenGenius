import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  MessageSquare, 
  Plus, 
  Search, 
  Check, 
  X, 
  Lock, 
  ArrowRight, 
  Clock, 
  UserPlus, 
  UserMinus, 
  GraduationCap, 
  ShieldCheck,
  ChevronRight,
  Key,
  Info
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  addDoc, 
  serverTimestamp, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  setDoc,
  arrayUnion, 
  arrayRemove,
  orderBy,
  getDoc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { formatTime } from '../lib/dateUtils';

interface Group {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  ownerId: string;
  inviteCode?: string;
}

interface Chat {
  id: string;
  type: string;
  memberIds: string[];
  lastMessage: string;
  lastUpdatedAt: any;
  name?: string;
}

export default function CommunityHub() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab');
  const { user, isGuest, userRole, triggerGuestPrompt } = useAuth();

  // Tab State: 'friends' | 'requests' | 'circles' | 'chats'
  const [activeTab, setActiveTab ] = useState<'friends' | 'requests' | 'circles' | 'chats'>(() => {
    if (userRole === 'teacher') {
      if (queryTab === 'chats' || queryTab === 'messages') return 'chats';
      return 'circles'; // Classrooms
    }
    if (queryTab === 'requests' || queryTab === 'buddies-requests' || queryTab === 'requests') return 'requests';
    if (queryTab === 'circles' || queryTab === 'classrooms') return 'circles';
    if (queryTab === 'chats' || queryTab === 'messages') return 'chats';
    if (queryTab === 'friends' || queryTab === 'buddies') return 'friends';
    return 'friends';
  });

  // Track searchParams change
  useEffect(() => {
    const freshTab = searchParams.get('tab');
    if (userRole === 'teacher') {
      if (freshTab === 'chats' || freshTab === 'messages') setActiveTab('chats');
      else setActiveTab('circles');
      return;
    }
    if (freshTab === 'requests' || freshTab === 'buddies-requests') setActiveTab('requests');
    else if (freshTab === 'circles' || freshTab === 'classrooms') setActiveTab('circles');
    else if (freshTab === 'chats' || freshTab === 'messages') setActiveTab('chats');
    else if (freshTab === 'friends' || freshTab === 'buddies') setActiveTab('friends');
  }, [searchParams, userRole]);

  // Sync tab back to URL for consistent browser history and seamless navigation
  const handleTabChange = (tab: 'friends' | 'requests' | 'circles' | 'chats') => {
    setActiveTab(tab);
    let aliasTab = tab;
    if (tab === 'friends') aliasTab = 'buddies' as any;
    else if (tab === 'requests') aliasTab = 'buddies-requests' as any;
    else if (tab === 'circles') aliasTab = 'classrooms' as any;
    else if (tab === 'chats') aliasTab = 'messages' as any;
    setSearchParams({ tab: aliasTab });
  };

  // Universal Feedback Ban
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Friends & User Search States ---
  const [friends, setFriends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // --- Friend Requests States ---
  const [pendingReceived, setPendingReceived] = useState<any[]>([]);
  const [pendingSent, setPendingSent] = useState<any[]>([]);

  // --- Study Circles States ---
  const [groups, setGroups] = useState<Group[]>([]);
  const [discoverCircles, setDiscoverCircles] = useState<Group[]>([]);
  const [circleSearchQuery, setCircleSearchQuery] = useState('');
  const [isSearchingCircles, setIsSearchingCircles] = useState(false);
  const [isCreatingCircle, setIsCreatingCircle] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [newCircleDesc, setNewCircleDesc] = useState('');
  const [isCreatingSubmitting, setIsCreatingSubmitting] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  // --- Secure Chat States ---
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatSearch, setChatSearch] = useState('');

  // Auxiliary UI loaders
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Show inline notification
  const triggerFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // --- 1. Real-time Subscriptions (Sync Engine) ---
  useEffect(() => {
    if (!user) return;
    const isSandboxObj = user.uid.includes('sandbox') || isGuest;
    if (!isSandboxObj) return;

    localStorage.setItem(`SANDBOX_FRIENDS_LIST_${user.uid}`, JSON.stringify(friends));
    localStorage.setItem(`SANDBOX_PENDING_RECEIVED_${user.uid}`, JSON.stringify(pendingReceived));
    localStorage.setItem(`SANDBOX_PENDING_SENT_${user.uid}`, JSON.stringify(pendingSent));
    localStorage.setItem(`SANDBOX_CLASSROOM_GROUPS_${user.uid}`, JSON.stringify(groups));
    localStorage.setItem(`SANDBOX_DISCOVER_CIRCLES_${user.uid}`, JSON.stringify(discoverCircles));
    localStorage.setItem(`SANDBOX_CHAT_LIST_${user.uid}`, JSON.stringify(chats));
  }, [friends, pendingReceived, pendingSent, groups, discoverCircles, chats, user, isGuest]);

  useEffect(() => {
    if (!user) return;

    const isSandboxObj = user.uid.includes('sandbox') || isGuest;

    if (isSandboxObj) {
      // Initialize with realistic mock data, reading from shared sandbox schema keys
      const storedFriendsStr = localStorage.getItem(`SANDBOX_FRIENDS_LIST_${user.uid}`);
      const storedRecvStr = localStorage.getItem(`SANDBOX_PENDING_RECEIVED_${user.uid}`);
      const storedSentStr = localStorage.getItem(`SANDBOX_PENDING_SENT_${user.uid}`);

      const defaultFriends = [
        { uid: 'sb_f1', displayName: 'Alex Rivera', email: 'alex@teengenius.edu', xp: 1450, isOnline: true },
        { uid: 'sb_f2', displayName: 'Emily Chen', email: 'emily@teengenius.edu', xp: 1820, isOnline: false },
        { uid: 'sb_f3', displayName: 'Marcus Vance', email: 'marcus@teengenius.edu', xp: 1200, isOnline: true }
      ];
      const defaultRecv = [
        { id: 'sb_req_in1', fromId: 'sb_f4', fromName: 'Rohan Gupta', timestamp: new Date().toISOString() }
      ];
      const defaultSent = [
        { id: 'sb_req_out1', toId: 'sb_f5', toName: 'Zoe Martinez', timestamp: new Date().toISOString() }
      ];

      const initialFriends = storedFriendsStr ? JSON.parse(storedFriendsStr) : defaultFriends;
      const initialRecv = storedRecvStr ? JSON.parse(storedRecvStr) : defaultRecv;
      const initialSent = storedSentStr ? JSON.parse(storedSentStr) : defaultSent;

      setFriends(initialFriends);
      setPendingReceived(initialRecv);
      setPendingSent(initialSent);

      if (!storedFriendsStr) localStorage.setItem(`SANDBOX_FRIENDS_LIST_${user.uid}`, JSON.stringify(defaultFriends));
      if (!storedRecvStr) localStorage.setItem(`SANDBOX_PENDING_RECEIVED_${user.uid}`, JSON.stringify(defaultRecv));
      if (!storedSentStr) localStorage.setItem(`SANDBOX_PENDING_SENT_${user.uid}`, JSON.stringify(defaultSent));

      // Load or set groups
      const storedGroups = localStorage.getItem(`SANDBOX_CLASSROOM_GROUPS_${user.uid}`);
      const defaultGroups = [
        { id: 'sb_circle1', name: 'AP Calculus BC Study Circle', description: 'Advanced derivatives and integrations sync node.', ownerId: 'sb_f1', memberIds: [user.uid, 'sb_f1', 'sb_f2'], inviteCode: 'TG-CALC99' },
        { id: 'sb_circle2', name: 'Quantum Physics Peer Cohort', description: 'Wave mechanics particle physics prep room.', ownerId: 'sb_f2', memberIds: [user.uid, 'sb_f2', 'sb_f3'], inviteCode: 'TG-PHYS88' }
      ];
      const initialGroups = storedGroups ? JSON.parse(storedGroups) : defaultGroups;
      setGroups(initialGroups);
      if (!storedGroups) {
        localStorage.setItem(`SANDBOX_CLASSROOM_GROUPS_${user.uid}`, JSON.stringify(defaultGroups));
      }

      // Discoverable classes
      const storedDiscover = localStorage.getItem(`SANDBOX_DISCOVER_CIRCLES_${user.uid}`);
      const defaultDiscover = [
        { id: 'sb_dis1', name: 'AP Chemistry Study Group', description: 'Exam preparation for organic chains & thermodynamics.', ownerId: 'sb_f4', memberIds: ['sb_f4', 'sb_f5'] },
        { id: 'sb_dis2', name: 'Teen Writers Hub', description: 'Weekly prompts, peer proofreading and formatting critiques.', ownerId: 'sb_f5', memberIds: ['sb_f5'] },
        { id: 'sb_dis3', name: 'Algebra Homework Hackers', description: 'A collective workspace tackling heavy mathematics assignments.', ownerId: 'sb_f4', memberIds: ['sb_f4'] },
        { id: 'sb_dis4', name: 'AI Creative Tech Guild', description: 'Building fun cool web applications with Gemini AI with other students.', ownerId: 'sb_f6', memberIds: ['sb_f6'] }
      ];
      const initialDiscover = storedDiscover ? JSON.parse(storedDiscover) : defaultDiscover;
      setDiscoverCircles(initialDiscover);
      if (!storedDiscover) {
        localStorage.setItem(`SANDBOX_DISCOVER_CIRCLES_${user.uid}`, JSON.stringify(defaultDiscover));
      }

      // Chats
      const storedChats = localStorage.getItem(`SANDBOX_CHAT_LIST_${user.uid}`);
      const defaultChats = [
        { id: 'sb_chat1', type: 'private', memberIds: [user.uid, 'sb_f1'], lastMessage: 'Let’s sync up for the calculus task.', lastUpdatedAt: { seconds: Math.floor(Date.now() / 1000) }, name: 'Alex Rivera' },
        { id: 'sb_chat2', type: 'group', memberIds: [user.uid, 'sb_f1', 'sb_f2'], lastMessage: 'I uploaded the chemistry notes!', lastUpdatedAt: { seconds: Math.floor(Date.now() / 1000) - 3600 }, name: 'AP Calculus BC Study Circle' }
      ];
      const initialChats = storedChats ? JSON.parse(storedChats) : defaultChats;
      setChats(initialChats);
      if (!storedChats) {
        localStorage.setItem(`SANDBOX_CHAT_LIST_${user.uid}`, JSON.stringify(defaultChats));
      }

      return;
    }

    setLoadingFriends(true);

    // Subscribe to current user's profile and friend list
    const userDocRef = doc(db, 'users', user.uid);
    let unsubscribeFriends: (() => void) | null = null;

    const unsubscribeUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const friendIds = snap.data().friendIds || [];
        if (friendIds.length > 0) {
          if (unsubscribeFriends) unsubscribeFriends();
          const friendsQuery = query(collection(db, 'users'), where('uid', 'in', friendIds));
          unsubscribeFriends = onSnapshot(friendsQuery, (friendsSnap) => {
            setFriends(friendsSnap.docs.map(d => d.data()));
            setLoadingFriends(false);
          }, (err) => {
            console.error("Friends fetch failed:", err);
            setLoadingFriends(false);
          });
        } else {
          setFriends([]);
          setLoadingFriends(false);
          if (unsubscribeFriends) {
            unsubscribeFriends();
            unsubscribeFriends = null;
          }
        }
      } else {
        setFriends([]);
        setLoadingFriends(false);
      }
    }, (err) => {
      console.error("User doc listener failed:", err);
      setLoadingFriends(false);
    });

    // Subscribe to Friend Requests
    const receivedQuery = query(
      collection(db, 'friendRequests'), 
      where('toId', '==', user.uid), 
      where('status', '==', 'pending')
    );
    const unsubscribeReceived = onSnapshot(receivedQuery, (snap) => {
      setPendingReceived(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const sentQuery = query(
      collection(db, 'friendRequests'), 
      where('fromId', '==', user.uid), 
      where('status', '==', 'pending')
    );
    const unsubscribeSent = onSnapshot(sentQuery, (snap) => {
      setPendingSent(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Subscribe to Study Circles
    const groupsQuery = query(
      collection(db, 'studyGroups'),
      where('memberIds', 'array-contains', user.uid)
    );
    const unsubscribeGroups = onSnapshot(groupsQuery, (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() } as Group)));
    });

    // Preload available discoverable Study Circles on load
    getDocs(collection(db, 'studyGroups')).then((snap) => {
      const match = snap.docs
        .map(docInst => ({ id: docInst.id, ...docInst.data() } as Group))
        .filter(g => !g.memberIds.includes(user.uid));
      setDiscoverCircles(match.slice(0, 6));
    }).catch(err => {
      console.warn("Failed to preload open study circles:", err);
    });

    // Subscribe to Encrypted Chats
    const chatsQuery = query(
      collection(db, 'chats'),
      where('memberIds', 'array-contains', user.uid),
      orderBy('lastUpdatedAt', 'desc')
    );
    const unsubscribeChats = onSnapshot(chatsQuery, async (snapshot) => {
      const chatDataList = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as Chat;
        const id = docSnap.id;

        if (data.type === 'private' && !data.name) {
          const otherMemberId = data.memberIds.find(mId => mId !== user.uid);
          if (otherMemberId) {
            const parsedOther = await getDoc(doc(db, 'users', otherMemberId));
            if (parsedOther.exists()) {
              return { ...data, id, name: parsedOther.data().displayName || 'Classmate' };
            }
          }
        }
        return { ...data, id };
      }));
      setChats(chatDataList);
    });

    return () => {
      unsubscribeUser();
      if (unsubscribeFriends) unsubscribeFriends();
      unsubscribeReceived();
      unsubscribeSent();
      unsubscribeGroups();
      unsubscribeChats();
    };
  }, [user, isGuest]);

  // --- 2. Friend Request Logic (Search & Actions) ---
  const handleUserSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (isGuest || user?.uid.includes('sandbox')) {
      // Simulate Search
      setIsSearching(true);
      setTimeout(() => {
        const potentialPeers = [
          { uid: 'sb_f4', displayName: 'Rohan Gupta', email: 'rohan@teengenius.edu', xp: 1540, isOnline: true },
          { uid: 'sb_f5', displayName: 'Zoe Martinez', email: 'zoe@teengenius.edu', xp: 1100, isOnline: false },
          { uid: 'sb_f6', displayName: 'Kabir Dev', email: 'kabir@teengenius.edu', xp: 1600, isOnline: true }
        ];
        const match = potentialPeers.filter(p => 
          p.displayName.toLowerCase().includes(searchQuery.toLowerCase().trim()) || 
          p.email.toLowerCase().includes(searchQuery.toLowerCase().trim())
        );
        setSearchResults(match);
        setIsSearching(false);
      }, 500);
      return;
    }

    setIsSearching(true);
    try {
      const snap = await getDocs(query(collection(db, 'users')));
      const term = searchQuery.toLowerCase().trim();
      const resultsList = snap.docs
        .map(d => d.data())
        .filter(u => u.uid !== user?.uid) // Exclude self
        .filter(u => {
          const name = (u.displayName || '').toLowerCase();
          const email = (u.email || '').toLowerCase();
          return name.includes(term) || email.includes(term);
        });
      setSearchResults(resultsList.slice(0, 40));
    } catch (error) {
      console.error("Search failed:", error);
      triggerFeedback('error', 'Peer discovery search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const sendFriendRequest = async (targetUser: any) => {
    if (isGuest) {
      triggerGuestPrompt("Add classmates and friends");
      return;
    }
    if (!user) return;

    if (user.uid === targetUser.uid) {
      triggerFeedback('error', 'Self-friendships are not supported.');
      return;
    }

    // Sandbox Mock handling
    if (user.uid.includes('sandbox') || isGuest) {
      if (pendingSent.some(r => r.toId === targetUser.uid)) {
        triggerFeedback('error', 'A request is already pending for this student.');
        return;
      }
      const mockReq = {
        id: `sb_req_out_${Date.now()}`,
        toId: targetUser.uid,
        toName: targetUser.displayName,
        timestamp: new Date()
      };
      setPendingSent(prev => [...prev, mockReq]);
      triggerFeedback('success', `Friend request sent to ${targetUser.displayName}!`);
      return;
    }

    try {
      // Avoid Duplicates - check both directions
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
        triggerFeedback('error', 'A connection request is already pending.');
        return;
      }

      // Check current friends list
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && (userDoc.data().friendIds || []).includes(targetUser.uid)) {
        triggerFeedback('error', 'You are already connected to this classmate.');
        return;
      }

      // Add request securely
      await addDoc(collection(db, 'friendRequests'), {
        fromId: user.uid,
        fromName: user.displayName || 'Sub-Genius Member',
        toId: targetUser.uid,
        toName: targetUser.displayName || 'Sub-Genius Member',
        status: 'pending',
        timestamp: serverTimestamp()
      });

      triggerFeedback('success', `Friend request dispatched to ${targetUser.displayName}`);
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Failed to dispatch friend request.');
    }
  };

  const acceptFriendRequest = async (request: any) => {
    if (isGuest) {
      triggerGuestPrompt("Accept requests");
      return;
    }
    if (!user) return;

    if (user.uid.includes('sandbox') || isGuest) {
      setPendingReceived(prev => prev.filter(r => r.id !== request.id));
      const mockFriend = {
        uid: request.fromId,
        displayName: request.fromName || 'Peer Member',
        email: `${(request.fromName || 'peer').toLowerCase().replace(/\s/g, '')}@teengenius.edu`,
        xp: 1200,
        isOnline: true
      };
      setFriends(prev => [...prev, mockFriend]);
      triggerFeedback('success', `You are now friends with ${request.fromName}!`);
      return;
    }

    try {
      console.log("[DEBUG] Starting acceptFriendRequest workflow. Request object:", JSON.stringify(request));
      if (!request.id) {
        throw new Error("Missing request.id in acceptFriendRequest invocation.");
      }
      if (!request.fromId) {
        throw new Error("Missing request.fromId in acceptFriendRequest invocation.");
      }
      if (request.toId !== user.uid) {
        throw new Error(`Auth UID mismatch: currentUser.uid is ${user.uid}, but request.toId is ${request.toId}`);
      }

      console.log(`[DEBUG] Committing atomic friendship update via WriteBatch...`);
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);

      const requestRef = doc(db, 'friendRequests', request.id);
      const userRefSelf = doc(db, 'users', user.uid);
      const userRefTarget = doc(db, 'users', request.fromId);

      // 1. Add mutual friend relations
      batch.update(userRefSelf, { friendIds: arrayUnion(request.fromId) });
      batch.update(userRefTarget, { friendIds: arrayUnion(user.uid) });

      // 2. Clear friend request document
      batch.delete(requestRef);

      // 3. Commit the atomic batch
      await batch.commit();

      console.log(`[DEBUG] Atomic friendship batch committed successfully.`);
      triggerFeedback('success', `Successfully accepted friend request from ${request.fromName}!`);
    } catch (err: any) {
      console.error("[DEBUG] Error inside acceptFriendRequest workflow:", err);
      const detailedMessage = err instanceof Error ? err.message : String(err);
      triggerFeedback('error', `FAILED TO ACCEPT INVITATION: ${detailedMessage}`);
    }
  };

  const declineFriendRequest = async (requestId: string) => {
    if (user?.uid?.includes('sandbox') || isGuest) {
      setPendingReceived(prev => prev.filter(r => r.id !== requestId));
      setPendingSent(prev => prev.filter(r => r.id !== requestId));
      triggerFeedback('success', 'Friend request canceled.');
      return;
    }

    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'friendRequests', requestId));
      triggerFeedback('success', 'Friend request canceled.');
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Error managing request.');
    }
  };

  const removeFriendConnection = async (friendId: string, friendName: string) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to disconnect from ${friendName}?`)) return;

    if (user.uid.includes('sandbox') || isGuest) {
      setFriends(prev => prev.filter(f => f.uid !== friendId));
      triggerFeedback('success', `${friendName} detached from network.`);
      return;
    }

    try {
      const userRefSelf = doc(db, 'users', user.uid);
      const userRefTarget = doc(db, 'users', friendId);

      await updateDoc(userRefSelf, { friendIds: arrayRemove(friendId) });
      await updateDoc(userRefTarget, { friendIds: arrayRemove(user.uid) });

      triggerFeedback('success', `Removed ${friendName} from study network.`);
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Failed to remove connection.');
    }
  };

  // --- 3. Chat Launch Logic ---
  const triggerPrivateChat = async (peer: any) => {
    if (!user) return;

    if (user.uid.includes('sandbox') || isGuest) {
      navigate('/app/chats');
      return;
    }

    try {
      const chatQuery = query(
        collection(db, 'chats'),
        where('type', '==', 'private'),
        where('memberIds', 'array-contains', user.uid)
      );
      const snap = await getDocs(chatQuery);
      const matched = snap.docs.find(docInst => docInst.data().memberIds.includes(peer.uid));

      if (matched) {
        navigate(`/app/chats/${matched.id}`);
      } else {
        const newChatDoc = await addDoc(collection(db, 'chats'), {
          type: 'private',
          memberIds: [user.uid, peer.uid],
          lastUpdatedAt: serverTimestamp(),
          lastMessage: 'Encryption lounge active.'
        });
        navigate(`/app/chats/${newChatDoc.id}`);
      }
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Failed to establish message exchange tunnel.');
    }
  };

  // --- 4. Study Circles Logic ---
  const handleCircleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!circleSearchQuery.trim()) return;

    if (isGuest || user?.uid.includes('sandbox')) {
      setIsSearchingCircles(true);
      setTimeout(() => {
        setDiscoverCircles([
          { id: 'sb_dis1', name: 'AP Chemistry Study Group', description: 'Exam preparation for organic chains & thermodynamics.', ownerId: 'sb_f4', memberIds: ['sb_f4', 'sb_f5'] },
          { id: 'sb_dis2', name: 'Teen Writers Hub', description: 'Weekly prompts, peer proofreading and formatting critiques.', ownerId: 'sb_f5', memberIds: ['sb_f5'] }
        ]);
        setIsSearchingCircles(false);
      }, 500);
      return;
    }

    setIsSearchingCircles(true);
    try {
      const q = query(
        collection(db, 'studyGroups'),
        where('name', '>=', circleSearchQuery),
        where('name', '<=', circleSearchQuery + '\uf8ff')
      );
      const snap = await getDocs(q);
      const match = snap.docs
        .map(docInst => ({ id: docInst.id, ...docInst.data() } as Group))
        .filter(g => !g.memberIds.includes(user.uid));
      setDiscoverCircles(match);
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Failed to trace open Study Circles.');
    } finally {
      setIsSearchingCircles(false);
    }
  };

  const handleJoinCircle = async (groupId: string) => {
    if (isGuest) {
      triggerGuestPrompt("Join Study Circles");
      return;
    }
    if (!user) return;

    setJoiningGroupId(groupId);
    try {
      if (user.uid.includes('sandbox') || isGuest) {
        const target = discoverCircles.find(g => g.id === groupId);
        if (target) {
          setGroups(prev => [...prev, { ...target, memberIds: [...target.memberIds, user.uid] }]);
          setDiscoverCircles(prev => prev.filter(g => g.id !== groupId));
          triggerFeedback('success', `Joined ${target.name}!`);
        }
        return;
      }

      await updateDoc(doc(db, 'studyGroups', groupId), {
        memberIds: arrayUnion(user.uid)
      });
      triggerFeedback('success', 'Joined Circle workspace!');
      setDiscoverCircles(prev => prev.filter(g => g.id !== groupId));
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Collaboration entry failed.');
    } finally {
      setJoiningGroupId(null);
    }
  };

  const joinCircleByInviteCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = inviteCodeInput.trim().toUpperCase();
    if (!formatted || !user) return;

    if (isGuest) {
      triggerGuestPrompt("Join via invite codes");
      return;
    }

    setIsJoiningByCode(true);
    try {
      if (user.uid.includes('sandbox') || isGuest) {
        if (formatted === 'TG-CHEM88' || formatted === 'TG-PHYS88' || formatted === 'TG-CALC99') {
          triggerFeedback('success', 'Invite code valid! Connected.');
          setInviteCodeInput('');
        } else {
          triggerFeedback('error', 'Circle authorization code invalid.');
        }
        return;
      }

      const q = query(
        collection(db, 'studyGroups'),
        where('inviteCode', '==', formatted)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        triggerFeedback('error', 'Study Group code not found.');
        return;
      }

      const matchedDoc = snap.docs[0];
      const data = matchedDoc.data() as Group;
      if (data.memberIds.includes(user.uid)) {
        navigate(`/app/study-groups/${matchedDoc.id}`);
      } else {
        await updateDoc(doc(db, 'studyGroups', matchedDoc.id), {
          memberIds: arrayUnion(user.uid)
        });
        navigate(`/app/study-groups/${matchedDoc.id}`);
      }
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Study Circle connection error.');
    } finally {
      setIsJoiningByCode(false);
    }
  };

  const triggerCreateCircle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCircleName.trim() || !user) return;

    if (isGuest) {
      triggerGuestPrompt("Create Study Circles");
      return;
    }

    setIsCreatingSubmitting(true);
    try {
      const codeSuffix = Math.random().toString(36).substring(3, 9).toUpperCase();
      const generatedCode = `TG-${codeSuffix}`;

      if (user.uid.includes('sandbox') || isGuest) {
        const mockNew = {
          id: `sb_circle_${Date.now()}`,
          name: newCircleName,
          description: newCircleDesc || 'Generic peer study classroom.',
          memberIds: [user.uid],
          ownerId: user.uid,
          inviteCode: generatedCode
        };
        setGroups(prev => [...prev, mockNew]);
        setNewCircleName('');
        setNewCircleDesc('');
        setIsCreatingCircle(false);
        triggerFeedback('success', `Created study circle ${newCircleName}!`);
        return;
      }

      const docRef = await addDoc(collection(db, 'studyGroups'), {
        name: newCircleName,
        description: newCircleDesc || '',
        ownerId: user.uid,
        memberIds: [user.uid],
        inviteCode: generatedCode,
        createdAt: serverTimestamp(),
        scratchpad: '',
        whiteboardLines: [],
        tasks: []
      });

      triggerFeedback('success', 'Circle created successfully!');
      setNewCircleName('');
      setNewCircleDesc('');
      setIsCreatingCircle(false);
      navigate(`/app/study-groups/${docRef.id}`);
    } catch (err) {
      console.error(err);
      triggerFeedback('error', 'Failed to deploy group database schema.');
    } finally {
      setIsCreatingSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-5xl mx-auto space-y-8 pb-32 animate-fade-in relative">
      
      {/* Banner Notifications */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "p-4 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-between shadow-xl fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50",
              feedback.type === 'error'
                ? "bg-red-50 text-red-600 border border-red-200/50"
                : "bg-green-50 text-green-600 border border-green-200/50"
            )}
          >
            <span>{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-zinc-400 hover:text-zinc-650 font-black px-2 cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Intro */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/30 rounded-full border border-blue-200/50 dark:border-blue-900/30">
          <ShieldCheck size={13} className="text-blue-650 dark:text-blue-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Verifiably Encrypted Teen Hub</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
          Genius <span className="text-blue-600 dark:text-blue-400">Community</span>
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-xl">
          Instantly connect with friends, exchange documents asynchronously over encrypted tunnels, and form study peer guilds.
        </p>
      </div>

      {/* Navigational Tabs (No Overflows, Fully Responsive) */}
      <div className={cn(
        "grid bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl gap-1 w-full",
        userRole === 'teacher' ? "grid-cols-2 max-w-md" : "grid-cols-2 md:grid-cols-4 max-w-2xl"
      )}>
        {[
          ...(userRole === 'student' ? [
            { id: 'friends', icon: Users, label: 'Study Buddies' },
            { id: 'requests', icon: Clock, label: 'Buddy Requests', badge: pendingReceived.length },
          ] : []),
          { id: 'circles', icon: GraduationCap, label: 'Classrooms' },
          { id: 'chats', icon: MessageSquare, label: 'Direct Messages' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id as any)}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all cursor-pointer relative",
              activeTab === tab.id 
                ? "bg-white dark:bg-zinc-850 text-zinc-900 dark:text-white shadow-sm" 
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-650 dark:hover:text-zinc-300"
            )}
          >
            <tab.icon size={14} className="shrink-0" />
            <span className="truncate">{tab.label}</span>
            {!!tab.badge && (
              <span className="ml-1 w-4 h-4 bg-red-550 dark:bg-red-650 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Render Panel with smooth presence transitions */}
      <AnimatePresence mode="wait">
        
        {/* ==================== TAB 1: FRIENDS ==================== */}
        {activeTab === 'friends' && (
          <motion.div
            key="friends"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Search Classmates */}
            <div className="bg-zinc-50 dark:bg-zinc-900 p-5 sm:p-6 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Discover Fellow Academics</h3>
              <form onSubmit={handleUserSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by full name or edu address..."
                    className="w-full bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-11 pr-4 py-3 font-semibold text-xs text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all cursor-pointer shadow-indigo-100 disabled:opacity-50"
                  disabled={isSearching}
                >
                  {isSearching ? 'Analyzing...' : 'Search'}
                </button>
              </form>

              {/* Dynamic Search Results */}
              {searchResults.length > 0 && (
                <div className="grid gap-3 pt-3">
                  {searchResults.map(match => {
                    const isFriend = friends.some(f => f.uid === match.uid);
                    const isSent = pendingSent.some(r => r.toId === match.uid);
                    const isReceived = pendingReceived.some(r => r.fromId === match.uid);

                    return (
                      <div key={match.uid} className="bg-white dark:bg-zinc-850 p-4 rounded-2xl flex items-center justify-between border border-zinc-150 dark:border-zinc-800 gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-zinc-800 flex items-center justify-center text-blue-600 dark:text-blue-400 font-extrabold uppercase">
                            {match.displayName?.[0] || '?'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">{match.displayName}</h4>
                            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-mono truncate">{match.email}</p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isFriend ? (
                            <span className="text-[9px] font-black uppercase tracking-wider text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200/50">Friends</span>
                          ) : isSent ? (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/50">Request Sent</span>
                          ) : isReceived ? (
                            <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200/50">Pending Approval</span>
                          ) : (
                            <button
                              onClick={() => sendFriendRequest(match)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[9px] uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                            >
                              <UserPlus size={11} />
                              <span>Add Friend</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Friends Directory */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Your Academics Network ({friends.length})</h3>
              {loadingFriends ? (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 border-3 border-blue-550 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-zinc-450 mt-3 font-semibold">Tuning radio connection...</p>
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-20 bg-zinc-50 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                  <span className="text-3xl">🧩</span>
                  <h4 className="text-sm font-black text-zinc-850 dark:text-white uppercase tracking-wider mt-3">Quiet Broadcast</h4>
                  <p className="text-xs text-zinc-450 dark:text-zinc-500 mt-1 max-w-xs mx-auto">No study buddies configured yet. Execute a query search above to connect.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {friends.map(friend => (
                    <div key={friend.uid} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-5 rounded-2xl flex items-center justify-between gap-4 shadow-sm hover:border-zinc-200 transition-all">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-extrabold text-zinc-650 dark:text-zinc-300 text-lg uppercase shadow-inner">
                            {friend.displayName?.[0] || '?'}
                          </div>
                          <span className={cn(
                            "absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white dark:border-zinc-900 rounded-full",
                            friend.isOnline ? "bg-green-500" : "bg-zinc-300"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">{friend.displayName}</span>
                            {friend.xp && (
                              <span className="text-[8.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">{friend.xp} XP</span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-mono truncate">{friend.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => triggerPrivateChat(friend)}
                          className="bg-blue-50 hover:bg-blue-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-blue-650 dark:text-zinc-300 p-2.5 rounded-xl transition-all cursor-pointer"
                          title="Open Secure DM"
                        >
                          <MessageSquare size={14} />
                        </button>
                        <button
                          onClick={() => removeFriendConnection(friend.uid, friend.displayName)}
                          className="hover:bg-red-50 text-zinc-350 hover:text-red-500 p-2.5 rounded-xl transition-all cursor-pointer"
                          title="Remove Friend"
                        >
                          <UserMinus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ==================== TAB 2: REQUESTS ==================== */}
        {activeTab === 'requests' && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* INCOMING */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <span>Received Invitations</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">{pendingReceived.length}</span>
              </h3>
              <div className="grid gap-3">
                {pendingReceived.length === 0 ? (
                  <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center bg-zinc-50/50 dark:bg-zinc-900/30">
                    <p className="text-[11px] text-zinc-400 font-medium">No incoming invitations present.</p>
                  </div>
                ) : (
                  pendingReceived.map(req => (
                    <div key={req.id} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">{req.fromName}</h4>
                        <p className="text-[9px] text-zinc-450 italic">Incoming study invitation</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => declineFriendRequest(req.id)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                          title="Reject"
                        >
                          <X size={15} />
                        </button>
                        <button
                          onClick={() => acceptFriendRequest(req)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[9px] uppercase tracking-wider px-3.5 py-2 rounded-lg shadow-sm cursor-pointer"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* OUTGOING */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Sent Logs ({pendingSent.length})</h3>
              <div className="grid gap-3">
                {pendingSent.length === 0 ? (
                  <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center bg-zinc-50/50 dark:bg-zinc-900/30">
                    <p className="text-[11px] text-zinc-400 font-medium">No active outgoing invites pending.</p>
                  </div>
                ) : (
                  pendingSent.map(req => (
                    <div key={req.id} className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-sm opacity-90">
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{req.toName}</h4>
                        <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider">Awaiting validation</p>
                      </div>
                      <button
                        onClick={() => declineFriendRequest(req.id)}
                        className="text-zinc-400 hover:text-red-550 hover:bg-red-50/20 p-2 rounded-lg transition-all cursor-pointer"
                        title="Cancel Outgoing Invitation"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ==================== TAB 3: STUDY CIRCLES ==================== */}
        {activeTab === 'circles' && (
          <motion.div
            key="circles"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Secondary Option Actions Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Access via Invite Code */}
              <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 space-y-4">
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-indigo-600" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Submit Invite Passcode</h3>
                </div>
                <form onSubmit={joinCircleByInviteCode} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. TG-CALC99"
                    className="flex-1 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest px-4.5 py-2.5 rounded-xl cursor-pointer shadow-indigo-100 transition-all"
                    disabled={isJoiningByCode}
                  >
                    {isJoiningByCode ? 'Verifying...' : 'Join'}
                  </button>
                </form>
              </div>

              {/* Toggle Create Form Card */}
              <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 flex flex-col justify-center">
                {!isCreatingCircle ? (
                  <button
                    onClick={() => setIsCreatingCircle(true)}
                    className="w-full h-full min-h-[4.5rem] bg-white dark:bg-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl flex items-center justify-center gap-2 transition-all font-black text-xs text-zinc-700 dark:text-zinc-300 uppercase tracking-widest cursor-pointer"
                  >
                    <Plus size={16} className="text-blue-600" />
                    <span>Create a Study Circle</span>
                  </button>
                ) : (
                  <form onSubmit={triggerCreateCircle} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Launch New Syndicate</h4>
                      <button 
                        type="button" 
                        onClick={() => setIsCreatingCircle(false)}
                        className="text-zinc-400 hover:text-zinc-600 font-extrabold text-[10px] uppercase"
                      >
                        Cancel
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. AP World History Circle"
                      className="w-full bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-xs font-semibold text-zinc-900 dark:text-white outline-none"
                      value={newCircleName}
                      onChange={(e) => setNewCircleName(e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Brief room sync description..."
                      className="w-full bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-[11px] font-medium text-zinc-900 dark:text-white outline-none"
                      value={newCircleDesc}
                      onChange={(e) => setNewCircleDesc(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                      disabled={isCreatingSubmitting}
                    >
                      {isCreatingSubmitting ? 'Creating workspace...' : 'Deploy Study Circle'}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* My Active Groups */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Your Active Circles ({groups.length})</h3>
              {groups.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2.5rem] shadow-sm">
                  <div className="w-14 h-14 bg-zinc-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <GraduationCap size={24} className="text-zinc-400" />
                  </div>
                  <h4 className="text-xs font-black uppercase text-zinc-650 mb-1">No Active Study Circles</h4>
                  <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">Create a guild or apply an invite code above to begin real-time workspace collaboration.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {groups.map(circle => (
                    <div 
                      key={circle.id}
                      onClick={() => navigate(`/app/study-groups/${circle.id}`)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6 flex flex-col justify-between gap-6 hover:shadow-xl hover:border-blue-400 cursor-pointer transition-all relative group overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center font-black">
                            <GraduationCap size={18} />
                          </div>
                          {circle.inviteCode && (
                            <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-100 px-2 py-1 rounded-sm">
                              {circle.inviteCode}
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight group-hover:text-blue-600 transition-colors">{circle.name}</h4>
                          <p className="text-[11px] text-zinc-450 leading-relaxed font-semibold line-clamp-2">{circle.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-850 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <span>{circle.memberIds?.length || 1} Members Active</span>
                        <span className="flex items-center gap-1 text-blue-600">
                          <span>Enter Room</span>
                          <ArrowRight size={12} className="group-hover:translate-x-1.5 transition-transform" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Public Find/Discover Search */}
            <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400">Discover Open Study Circles</h3>
              <form onSubmit={handleCircleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. AP Chemistry"
                  className="flex-1 bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 font-semibold text-xs text-zinc-900 dark:text-white outline-none"
                  value={circleSearchQuery}
                  onChange={(e) => setCircleSearchQuery(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white font-extrabold text-[10px] uppercase tracking-widest px-5 py-2.5 rounded-xl whitespace-nowrap cursor-pointer"
                  disabled={isSearchingCircles}
                >
                  {isSearchingCircles ? 'Searching...' : 'Explore'}
                </button>
              </form>

              {discoverCircles.length > 0 && (
                <div className="grid gap-3 pt-3">
                  {discoverCircles.map(disc => (
                    <div key={disc.id} className="bg-white dark:bg-zinc-850 p-4 rounded-xl flex items-center justify-between border border-zinc-150 dark:border-zinc-800 gap-4">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">{disc.name}</h4>
                        <p className="text-[10px] text-zinc-450 dark:text-zinc-500 truncate">{disc.description}</p>
                      </div>
                      <button
                        onClick={() => handleJoinCircle(disc.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase tracking-wider px-3.5 py-2 rounded-lg cursor-pointer"
                        disabled={joiningGroupId === disc.id}
                      >
                        {joiningGroupId === disc.id ? 'Joining...' : 'Join Circle'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ==================== TAB 4: ENCRYPTED CHAT ==================== */}
        {activeTab === 'chats' && (
          <motion.div
            key="chats"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Encryption Protection Info Bar */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
              <Lock size={15} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h4 className="text-[11px] font-black uppercase text-zinc-800 dark:text-zinc-200">Zero-Trust Peer channels</h4>
                <p className="text-[10px] text-zinc-450 dark:text-zinc-500 leading-normal font-semibold">
                  Messages are saved securely inside Firestore databases protected by authenticated student-only security rules. No automated AI advertising crawlers look at these logs.
                </p>
              </div>
            </div>

            {/* Chats Filter Search */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter chat threads..."
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 font-semibold text-xs text-zinc-900 dark:text-white outline-none"
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                />
              </div>
              <button
                onClick={() => {
                  if (friends.length === 0) {
                    triggerFeedback('error', 'Add friends before starting direct conversations.');
                    return;
                  }
                  // Force direct DM mode or toggle chat tab
                  setActiveTab('friends');
                  triggerFeedback('success', 'Choose a friend from your network below to establish a direct chat tunnel!');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase tracking-widest px-5 py-2.5 rounded-xl whitespace-nowrap cursor-pointer active:scale-95 transition-all"
              >
                Start Conversation
              </button>
            </div>

            {/* List Chat Entries */}
            <div className="space-y-3">
              {chats.length === 0 ? (
                <div className="text-center py-20 bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8">
                  <span className="text-2xl">💬</span>
                  <h4 className="text-xs font-black uppercase text-zinc-600 mt-3 mb-1">Silence is Golden</h4>
                  <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">Click "Start Conversation" or visit the Friends tab to spin up private communication threads.</p>
                </div>
              ) : (
                chats
                  .filter(c => !chatSearch || (c.name || '').toLowerCase().includes(chatSearch.toLowerCase()))
                  .map(chat => (
                    <div
                      key={chat.id}
                      onClick={() => navigate(`/app/chats/${chat.id}`)}
                      className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-zinc-700 rounded-2xl p-4 flex items-center justify-between gap-4 cursor-pointer transition-all shadow-xs group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-zinc-800 dark:to-zinc-850 flex items-center justify-center text-blue-600 dark:text-zinc-300 font-extrabold uppercase shrink-0">
                          {chat.name?.[0] || 'G'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">{chat.name}</h4>
                          <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-medium truncate mt-0.5">{chat.lastMessage}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <span className="text-[9px] font-mono font-bold text-zinc-400">
                          {chat.lastUpdatedAt ? formatTime(chat.lastUpdatedAt) : 'active'}
                        </span>
                        <span className="w-2 h-2 bg-blue-500 rounded-full scale-0 group-hover:scale-100 transition-transform" />
                      </div>
                    </div>
                  ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Moderation safety guideline card */}
      <div className="p-4.5 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-start gap-3 bg-zinc-50/40 dark:bg-zinc-900/30">
        <Info size={14} className="text-zinc-450 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <h5 className="text-[10px] font-black uppercase text-zinc-800 dark:text-zinc-200 leading-none">TeenGenius Security Protocols</h5>
          <p className="text-[9.5px] text-zinc-450 dark:text-zinc-500 font-semibold leading-relaxed">
            All workspace groups and chat tunnels are monitored for strict educational focus. Peer-to-peer bullying, direct test code leakage, or harassment triggers immediate profile quarantine. Keep studying safe & fun!
          </p>
        </div>
      </div>
    </div>
  );
}
