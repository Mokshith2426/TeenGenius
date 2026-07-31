package com.teengenius.app.data.local.dao

import androidx.room.*
import com.teengenius.app.data.model.ChatSession
import kotlinx.coroutines.flow.Flow

@Dao
interface ChatSessionDao {
    @Query("SELECT * FROM chat_sessions WHERE userId = :userId ORDER BY lastUpdatedAt DESC")
    fun getChatSessionsByUser(userId: String): Flow<List<ChatSession>>

    @Query("SELECT * FROM chat_sessions WHERE id = :sessionId")
    suspend fun getSessionById(sessionId: String): ChatSession?

    @Query("SELECT * FROM chat_sessions WHERE userId = :userId AND id = :sessionId")
    suspend fun getSessionByUserAndId(userId: String, sessionId: String): ChatSession?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSession(session: ChatSession): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSessions(sessions: List<ChatSession>)

    @Update
    suspend fun updateSession(session: ChatSession)

    @Delete
    suspend fun deleteSession(session: ChatSession)

    @Query("DELETE FROM chat_sessions WHERE userId = :userId")
    suspend fun deleteAllUserSessions(userId: String)

    @Query("DELETE FROM chat_sessions")
    suspend fun deleteAllSessions()

    @Query("UPDATE chat_sessions SET lastMessage = :lastMessage, lastUpdatedAt = :lastUpdatedAt WHERE id = :sessionId")
    suspend fun updateSessionLastMessage(sessionId: String, lastMessage: String, lastUpdatedAt: Long)
}