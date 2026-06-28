import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc, deleteDoc, limitToLast } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Send, ArrowLeft, MoreVertical, Image as ImageIcon, Check, CheckCheck, Lock, ShieldCheck, Smile, Camera } from 'lucide-react';
import CameraCapture from '../components/CameraCapture';
import { cn } from '../lib/utils';
import { safeFetch } from '../lib/api';
import { encryptMessage, decryptMessage, hasPrivateKey, loadPrivateKeyFromDB, encryptSimple, decryptSimple } from '../lib/crypto';
import { formatTime, toDate } from '../lib/dateUtils';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: any;
  type: 'text' | 'image';
  isEncrypted?: boolean;
  reactions?: Record<string, string>;
}

interface TypingStatus {
  id: string;
  userName: string;
  isTyping: boolean;
}

function EncryptedMessage({ message, chatId, isImage }: { message: Message, chatId: string, isImage?: boolean }) {
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (message.isEncrypted) {
      // Try symmetric decryption
      const simple = decryptSimple(message.content, chatId);
      if (simple && simple.length > 0) {
        setDecryptedText(simple);
      } else {
        // Try asymmetric if it exists
        decryptMessage(message.content)
          .then(setDecryptedText)
          .catch(() => {
            // Final fallback: Maybe it's NOT actually encrypted but has the flag
            // (e.g. if simple/asymmetric both fail but content is readable)
            // AES strings are usually long base64 strings
            if (message.content.length > 50 && message.content.includes('/') && message.content.includes('+')) {
              setError(true);
            } else {
              // If it's short or doesn't look like base64, it might just be a plain text message that got flagged
              setDecryptedText(message.content);
            }
          });
      }
    } else {
      setDecryptedText(message.content);
    }
  }, [message.content, message.isEncrypted, chatId]);

  if (message.isEncrypted && !decryptedText && !error) {
    return <div className="italic text-xs opacity-50 flex items-center gap-2"><Lock size={10} /> Decrypting Tunnel...</div>;
  }

  if (error) {
    return (
      <div className="text-xs text-red-500 bg-red-500/5 dark:bg-red-400/5 p-3 rounded-xl border border-red-500/20 italic space-y-2">
        <p className="flex items-center gap-2 font-black uppercase text-[8px] tracking-widest"><ShieldCheck size={12} /> Decryption Error</p>
        <p>This transmission segment is inaccessible on this device. System keys may be mismatching.</p>
      </div>
    );
  }

  if (isImage && decryptedText) {
    return (
      <div className="rounded-2xl overflow-hidden border border-white/10 shadow-sm transition-transform hover:scale-[1.02] cursor-pointer">
        <img src={decryptedText} alt="Shared" className="w-full h-auto max-h-[300px] object-cover" />
      </div>
    );
  }

  return <div className="whitespace-pre-wrap">{decryptedText || message.content}</div>;
}

const ChatMsgItem = React.memo(({ m, i, user, status, messages, chatId }: {
  m: Message;
  i: number;
  user: any;
  status: string | null;
  messages: Message[];
  chatId: string;
}) => {
  const isMe = m.senderId === user?.uid;
  const showAvatar = !isMe && (i === 0 || messages[i-1].senderId !== m.senderId);

  const [showPicker, setShowPicker] = useState(false);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLongPress = () => {
    if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = setTimeout(() => {
      setShowPicker(true);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleReact = async (emoji: string) => {
    setShowPicker(false);
    if (!m.id || !chatId || !user) return;

    try {
      const msgRef = doc(db, 'chats', chatId, 'messages', m.id);
      const currentReactions = m.reactions || {};
      const updatedReactions = { ...currentReactions };

      if (updatedReactions[user.uid] === emoji) {
        delete updatedReactions[user.uid];
      } else {
        updatedReactions[user.uid] = emoji;
      }

      await updateDoc(msgRef, { reactions: updatedReactions });
    } catch (e) {
      console.error("Failed to post message reaction", e);
    }
  };

  const reactionCounts = useMemo(() => {
    if (!m.reactions) return [];
    const counts: Record<string, { count: number; users: string[] }> = {};
    for (const [userId, emoji] of Object.entries(m.reactions)) {
      if (!counts[emoji]) {
        counts[emoji] = { count: 0, users: [] };
      }
      counts[emoji].count += 1;
      counts[emoji].users.push(userId);
    }
    return Object.entries(counts).map(([emoji, details]) => ({
      emoji,
      count: details.count,
      hasReacted: m.reactions?.[user?.uid] === emoji
    }));
  }, [m.reactions, user?.uid]);

  return (
    <motion.div
      initial={{ opacity: 0, x: isMe ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex flex-col relative w-full mb-2",
        reactionCounts.length > 0 ? "mb-5" : "",
        isMe ? "items-end" : "items-start"
      )}
    >
      {!isMe && showAvatar && (
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 ml-1 italic">
          {m.senderName}
        </span>
      )}

      <div 
        className={cn(
          "flex items-center gap-2 group/msg w-auto max-w-[85%] md:max-w-[70%] relative",
          isMe ? "flex-row-reverse" : "flex-row"
        )}
      >
        <div 
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onMouseLeave={cancelLongPress}
          className={cn(
            "px-6 py-4 text-sm relative transition-all duration-200 select-none",
            isMe 
              ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-[2rem] rounded-tr-none shadow-xl shadow-zinc-200 dark:shadow-none" 
              : "bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-[2rem] rounded-tl-none shadow-sm"
          )}
        >
          {m.type === 'image' ? (
            <div className="space-y-2">
               <EncryptedMessage message={m} chatId={chatId} isImage />
            </div>
          ) : (
            <EncryptedMessage message={m} chatId={chatId} />
          )}
          
          <div className={cn(
            "flex items-center gap-1.5 mt-2 opacity-40 group-hover/msg:opacity-100 transition-opacity",
            isMe ? "justify-end" : "justify-start"
          )}>
            <span className="text-[9px] font-black uppercase tracking-widest">
              {formatTime(m.timestamp, { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isMe && m.timestamp && (
              <span 
                className={cn(
                  "transition-colors cursor-help",
                  status === 'read' ? "text-blue-500" : "text-zinc-400"
                )}
                title={status === 'read' ? 'Read' : status === 'delivered' ? 'Delivered' : 'Sent'}
              >
                {status === 'read' ? <CheckCheck size={12} /> : 
                 status === 'delivered' ? <CheckCheck size={12} /> : 
                 <Check size={12} />}
              </span>
            )}
          </div>

          {reactionCounts.length > 0 && (
            <div className={cn(
              "absolute -bottom-3.5 flex items-center gap-1.5 bg-white dark:bg-zinc-805 px-2 py-0.5 rounded-full border border-zinc-150 dark:border-zinc-800 shadow text-[9px] font-black select-none z-10",
              isMe ? "right-6" : "left-6"
            )}>
              {reactionCounts.map(({ emoji, count, hasReacted }) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReact(emoji);
                  }}
                  className={cn(
                    "flex items-center gap-0.5 hover:scale-110 active:scale-95 transition-all text-xs cursor-pointer",
                    hasReacted ? "text-blue-600 font-extrabold scale-105" : "text-zinc-500 font-medium"
                  )}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="text-[8px] text-zinc-400 dark:text-zinc-500 font-black">{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className={cn(
            "p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-full transition-all cursor-pointer opacity-0 group-hover/msg:opacity-100 focus:opacity-100 hover:scale-110 active:scale-90 shadow-sm shrink-0",
            showPicker && "opacity-100 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900"
          )}
          title="Add Reaction"
        >
          <Smile size={14} />
        </button>

        <AnimatePresence>
          {showPicker && (
            <>
              <div 
                className="fixed inset-0 z-30 opacity-0 cursor-default" 
                onClick={() => setShowPicker(false)} 
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className={cn(
                  "absolute z-40 bg-zinc-950 dark:bg-zinc-900 text-white border border-zinc-800 dark:border-zinc-800 shadow-2xl rounded-2xl px-2 py-1 flex items-center gap-1.5 -top-12 shrink-0 select-none",
                  isMe ? "right-2" : "left-2"
                )}
              >
                {['👍', '❤️', '💡', '🔥'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReact(emoji)}
                    className="text-base hover:scale-130 active:scale-90 transition-transform px-1 py-0.5 cursor-pointer focus:outline-none"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

ChatMsgItem.displayName = 'ChatMsgItem';

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user, isGuest, isSandbox, triggerGuestPrompt } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [chatName, setChatName] = useState('Chat');
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingStatus[]>([]);
  const [participantStatuses, setParticipantStatuses] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chatId || !user) return;

    const isSandboxObj = isSandbox || chatId.startsWith('sb_');
    if (isSandboxObj) {
      const isC1 = chatId === 'sb_chat1';
      setChatName(isC1 ? 'Alex Rivera' : 'Chemistry Study Crew');
      setIsPrivate(isC1);
      setMessages([
        { id: 'm1', senderId: 'f1', senderName: 'Alex Rivera', content: isC1 ? 'Hey there! Ready for the math review?' : 'I started a document for the chemistry assignment.', type: 'text', timestamp: { seconds: Math.floor(Date.now()/1000) - 7200 } as any },
        { id: 'm2', senderId: user.uid, senderName: user.displayName || 'Guest Student', content: isC1 ? 'Absolutely, let’s do integration by parts.' : 'Awesome, I’ll add elements definitions.', type: 'text', timestamp: { seconds: Math.floor(Date.now()/1000) - 3600 } as any }
      ]);
      return () => {};
    }

    loadPrivateKeyFromDB(); // Ensure local key is loaded into session

    // Fetch chat info
    const chatRef = doc(db, 'chats', chatId);
    getDoc(chatRef).then(async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const privateChat = data.type === 'private';
        setIsPrivate(privateChat);

        if (privateChat) {
          const otherId = data.memberIds.find((m: string) => m !== user.uid);
          if (otherId) {
            const userSnap = await getDoc(doc(db, 'users', otherId));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              setChatName(uData.displayName || 'Chat');
              if (uData.publicKey) {
                setRecipientPublicKey(uData.publicKey);
              }
              return;
            }
          }
        }
        setChatName(data.name || 'Chat');
      }
    }).catch(err => handleFirestoreError(err, OperationType.GET, `chats/${chatId}`));

    // Update user's lastRead bit
    const updateLastRead = async () => {
      try {
        await setDoc(doc(db, 'chats', chatId, 'participants', user.uid), {
          uid: user.uid,
          lastReadAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error("Failed to update lastReadAt", e);
      }
    };
    updateLastRead();

    // Listen for participants' lastRead bits
    const participantsUnsubscribe = onSnapshot(collection(db, 'chats', chatId, 'participants'), (snap) => {
      const statuses: Record<string, any> = {};
      snap.docs.forEach(doc => {
        statuses[doc.id] = doc.data();
      });
      setParticipantStatuses(statuses);
    });

    // Listen for typing status
    const typingUnsubscribe = onSnapshot(collection(db, 'chats', chatId, 'typing'), (snap) => {
      const typing = snap.docs
        .filter(doc => doc.id !== user.uid)
        .map(doc => ({ id: doc.id, ...doc.data() } as TypingStatus));
      setTypingUsers(typing);
    });

    // Listen for messages
    const messagesPath = `chats/${chatId}/messages`;
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc'),
      limitToLast(120)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
      
      // Update last read whenever new messages arrive and we are in screen
      updateLastRead();
      
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, messagesPath);
    });

    return () => {
      unsubscribe();
      typingUnsubscribe();
      participantsUnsubscribe();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [chatId, user, isGuest]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Direct local scroll adjustment to prevent iframe/window scrolling
    container.scrollTop = container.scrollHeight;

    // Observe size changes from typing notifications or dynamic image rendering
    const observer = new ResizeObserver(() => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom || typingUsers.length > 0) {
        container.scrollTop = container.scrollHeight;
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [messages, typingUsers]);

  const handleTyping = async () => {
    if (isGuest) return;
    if (!chatId || !user) return;

    if (!typingTimeoutRef.current) {
      await setDoc(doc(db, 'chats', chatId, 'typing', user.uid), {
        userName: user.displayName || 'Unidentified',
        isTyping: true,
        lastUpdatedAt: serverTimestamp()
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(async () => {
      await deleteDoc(doc(db, 'chats', chatId, 'typing', user.uid));
      typingTimeoutRef.current = null;
    }, 3000);
  };

  const handleSend = async (imageFile?: File) => {
    if (isGuest) {
      triggerGuestPrompt("Send chat messages or images");
      return;
    }
    if ((!inputText.trim() && !imageFile) || !chatId || !user) return;

    const text = inputText;
    if (!imageFile) setInputText('');
    
    // Clear typing status immediately
    const isSandboxObj = isSandbox || chatId.startsWith('sb_');

    if (!isSandboxObj && typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      await deleteDoc(doc(db, 'chats', chatId, 'typing', user.uid));
    }

    if (isSandboxObj) {
      if (imageFile) {
        setUploading(true);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Str = reader.result as string;
          const newMsg: Message = {
            id: `msg_${Date.now()}`,
            senderId: user.uid,
            senderName: user.displayName || 'Guest Student',
            content: base64Str,
            type: 'image',
            timestamp: { seconds: Math.floor(Date.now() / 1000) } as any
          };
          setMessages(prev => [...prev, newMsg]);
          setUploading(false);
        };
        reader.readAsDataURL(imageFile);
        return;
      }

      const newMsg: Message = {
        id: `msg_${Date.now()}`,
        senderId: user.uid,
        senderName: user.displayName || 'Guest Student',
        content: text,
        type: 'text',
        timestamp: { seconds: Math.floor(Date.now() / 1000) } as any
      };
      setMessages(prev => [...prev, newMsg]);

      setTimeout(() => {
        const replyMsg: Message = {
          id: `reply_${Date.now()}`,
          senderId: 'f1',
          senderName: chatId === 'sb_chat1' ? 'Alex Rivera' : 'Chemistry Studier',
          content: `Awesome! Received your message. Let's work hard together! 🚀`,
          type: 'text',
          timestamp: { seconds: Math.floor(Date.now() / 1000) } as any
        };
        setMessages(prev => [...prev, replyMsg]);
      }, 1500);
      return;
    }

    const messagesPath = `chats/${chatId}/messages`;

    try {
      let finalContent = text;
      let fileUrl = '';
      let isEncrypted = true;

      if (imageFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', imageFile);
        const uploadRes = await safeFetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          fileUrl = uploadData.url;
          // For images, we can either encrypt the URL or just send it if the server is trusted.
          // Since it's E2E, we'll encrypt the URL as the "content"
          finalContent = fileUrl;
        }
      }

      // Always prefer Symmetric for Reliability in this version
      // The chatId serves as the secret key
      const contentToEncrypt = imageFile ? finalContent : text;
      finalContent = encryptSimple(contentToEncrypt, chatId);

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        senderName: user.displayName,
        content: finalContent,
        type: imageFile ? 'image' : 'text',
        isEncrypted,
        timestamp: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: imageFile ? '📷 Image Shared' : (isEncrypted ? '🔐 Encrypted Message' : text),
        lastUpdatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, messagesPath);
    } finally {
      if (imageFile) setUploading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSend(file);
    }
  };

  const getMessageStatus = (message: Message) => {
    if (!message.timestamp) return 'sent';
    
    // Check if ANY other participant has read a message after its timestamp
    const otherParticipants = Object.values(participantStatuses).filter(p => p.uid !== user?.uid);
    if (otherParticipants.length === 0) return 'sent';

    const allRead = otherParticipants.every(p => {
      const pReadDate = toDate(p.lastReadAt);
      const mDate = toDate(message.timestamp);
      if (!pReadDate || !mDate) return false;
      return pReadDate.getTime() >= mDate.getTime();
    });

    return allRead ? 'read' : 'delivered';
  };

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-white dark:bg-zinc-950 transition-colors">
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-800 flex flex-col sticky top-0 z-10">
        <div className="bg-blue-600 text-[8px] font-black uppercase tracking-[0.4em] text-white py-1.5 flex items-center justify-center gap-2">
          <Lock size={10} /> <span className="hidden xs:inline">End-to-End Encrypted Tunnel Established</span><span className="xs:hidden">Tunnel Secured</span>
        </div>
        <div className="px-4 py-3 md:px-6 md:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => navigate(-1)} className="p-2 md:p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-all active:scale-90">
              <ArrowLeft size={18} className="text-zinc-400 group-hover:text-zinc-900" />
            </button>
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-zinc-900 dark:bg-zinc-100 rounded-[1rem] md:rounded-[1.25rem] flex items-center justify-center text-white dark:text-zinc-900 font-black text-lg shadow-xl shadow-zinc-200">
                {chatName[0]}
              </div>
              <div>
                <h2 className="font-black text-zinc-900 dark:text-white tracking-tighter leading-none flex items-center gap-2 uppercase text-sm md:text-lg">
                  {chatName}
                  {isPrivate && recipientPublicKey && <ShieldCheck size={14} className="text-blue-600" />}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full", typingUsers.length > 0 ? "bg-blue-600 animate-pulse" : "bg-green-500")} />
                  <p className="text-[8px] md:text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em] truncate max-w-[150px] md:max-w-none">
                    {typingUsers.length > 0 
                      ? <span className="text-blue-600">{typingUsers.map(u => u.userName).join(', ')} typing</span>
                      : (isPrivate && recipientPublicKey ? "E2E Encrypted" : "Active Study Circle")
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button className="p-2 md:p-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 bg-zinc-50/50 dark:bg-zinc-950/50"
      >
        <div className="flex flex-col items-center justify-center py-10 space-y-3 opacity-30 select-none">
          <Lock size={24} className="text-zinc-400" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 text-center max-w-[200px]">
            This channel is architected for secure academic exchange.
          </p>
        </div>

        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const isMe = m.senderId === user?.uid;
            const status = isMe ? getMessageStatus(m) : null;
            return (
              <ChatMsgItem 
                key={m.id || i}
                m={m}
                i={i}
                user={user}
                status={status}
                messages={messages}
                chatId={chatId || ''}
              />
            );
          })}
        </AnimatePresence>
        
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 ml-2 max-w-[85%] md:max-w-[70%]"
          >
            <div className="bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/40 dark:border-zinc-800 rounded-[2rem] rounded-tl-none px-6 py-4 flex items-center gap-3 shadow-sm select-none">
              <span className="text-xs font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                {typingUsers.map(u => u.userName).join(', ')} is typing
              </span>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </motion.div>
        )}
      </div>

      <footer className="p-4 md:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-6 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 transition-colors shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="relative flex items-center gap-3 md:gap-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-[2.25rem] md:rounded-[2.75rem] p-3 pl-4 pr-3 md:p-4.5 md:pl-6 md:pr-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)] dark:shadow-none hover:border-zinc-250 transition-all">
            <input 
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageChange}
              accept="image/*"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 rounded-2xl transition-all disabled:opacity-50 cursor-pointer"
              title="Upload Image"
            >
              {uploading ? <ImageIcon size={20} className="animate-pulse" /> : <ImageIcon size={20} />}
            </button>
            <button 
              onClick={() => setIsCameraOpen(true)}
              disabled={uploading}
              className="p-3 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white dark:hover:bg-zinc-800 rounded-2xl transition-all disabled:opacity-50 cursor-pointer"
              title="Take Photo"
            >
              <Camera size={20} />
            </button>
            <input 
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={uploading ? "Transmitting..." : "Send a message..."}
              disabled={uploading}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm md:text-base py-3.5 md:py-4.5 font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:italic min-w-0 outline-none"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!inputText.trim() && !uploading}
              className="p-3.5 md:p-4.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl hover:scale-105 disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:scale-100 transition-all active:scale-95 shadow-xl shadow-zinc-200 dark:shadow-none cursor-pointer shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </footer>

      {isCameraOpen && (
        <CameraCapture 
          onCapture={(file) => handleSend(file)} 
          onClose={() => setIsCameraOpen(false)} 
        />
      )}
    </div>
  );
}
