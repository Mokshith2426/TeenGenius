package com.teengenius.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.teengenius.app.data.local.dao.ChatMessageDao
import com.teengenius.app.data.local.dao.ChatSessionDao
import com.teengenius.app.data.model.ChatMessage
import com.teengenius.app.data.model.ChatSession
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ChatRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val chatSessionDao: ChatSessionDao,
    private val chatMessageDao: ChatMessageDao
) {
    // Chat Sessions
    fun getChatSessions(userId: String): Flow<List<ChatSession>> {
        return chatSessionDao.getChatSessionsByUser(userId)
    }

    suspend fun getSessionById(sessionId: String): ChatSession? {
        return chatSessionDao.getSessionById(sessionId)
    }

    suspend fun createChatSession(userId: String, title: String): ChatSession {
        val session = ChatSession(
            userId = userId,
            title = title,
            lastMessage = "",
            lastUpdatedAt = System.currentTimeMillis()
        )
        val id = chatSessionDao.insertSession(session)
        
        // Sync to Firestore
        try {
            val docRef = firestore.collection("aiChats").document()
            val sessionData = hashMapOf(
                "userId" to userId,
                "title" to title,
                "lastMessage" to "",
                "lastUpdatedAt" to com.google.firebase.Timestamp.now()
            )
            docRef.set(sessionData).await()
        } catch (e: Exception) {
            // Offline - will sync later
        }
        
        return session.copy(id = id.toString())
    }

    suspend fun updateSessionLastMessage(sessionId: String, lastMessage: String) {
        val timestamp = System.currentTimeMillis()
        chatSessionDao.updateSessionLastMessage(sessionId, lastMessage, timestamp)
        
        try {
            firestore.collection("aiChats").document(sessionId)
                .update(
                    mapOf(
                        "lastMessage" to lastMessage,
                        "lastUpdatedAt" to com.google.firebase.Timestamp(timestamp / 1000, ((timestamp % 1000) * 1000000).toInt())
                    )
                ).await()
        } catch (e: Exception) {
            // Offline
        }
    }

    suspend fun deleteSession(sessionId: String) {
        chatSessionDao.deleteSession(chatSessionDao.getSessionById(sessionId))
        try {
            firestore.collection("aiChats").document(sessionId).delete().await()
            // Delete all messages in session
            chatMessageDao.deleteMessagesBySession(sessionId)
        } catch (e: Exception) {
            // Handle error
        }
    }

    // Chat Messages
    fun getMessages(sessionId: String): Flow<List<ChatMessage>> {
        return chatMessageDao.getMessagesBySession(sessionId)
    }

    suspend fun saveMessage(message: ChatMessage): Long {
        // Save locally
        val localId = chatMessageDao.insertMessage(message)
        
        // Sync to Firestore if not a local session
        if (!message.sessionId.startsWith("local_")) {
            try {
                val docRef = firestore.collection("aiChats")
                    .document(message.sessionId)
                    .collection("messages")
                    .document()
                
                val messageData = hashMapOf(
                    "role" to message.role,
                    "content" to message.content,
                    "imageUrl" to message.imageUrl,
                    "timestamp" to com.google.firebase.Timestamp(message.timestamp / 1000, ((message.timestamp % 1000) * 1000000).toInt()),
                    "status" to message.status
                )
                docRef.set(messageData).await()
            } catch (e: Exception) {
                // Offline
            }
        }
        
        return localId
    }

    suspend fun saveMessages(messages: List<ChatMessage>) {
        chatMessageDao.insertMessages(messages)
    }

    suspend fun updateMessageStatus(messageId: String, status: String) {
        chatMessageDao.updateMessageStatus(messageId, status)
    }

    suspend fun clearAllSessions(userId: String) {
        chatSessionDao.deleteAllUserSessions(userId)
        chatMessageDao.deleteAllMessages()
    }
}