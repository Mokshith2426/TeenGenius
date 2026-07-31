package com.teengenius.app.data.local.dao

import androidx.room.*
import com.teengenius.app.data.model.StudySession
import kotlinx.coroutines.flow.Flow

@Dao
interface StudySessionDao {
    @Query("SELECT * FROM study_sessions WHERE userId = :userId ORDER BY startTime DESC")
    fun getStudySessionsByUser(userId: String): Flow<List<StudySession>>

    @Query("SELECT * FROM study_sessions WHERE userId = :userId AND startTime >= :startOfDay ORDER BY startTime DESC")
    fun getTodaySessions(userId: String, startOfDay: Long): Flow<List<StudySession>>

    @Query("SELECT * FROM study_sessions WHERE userId = :userId ORDER BY startTime DESC LIMIT :limit")
    suspend fun getRecentSessions(userId: String, limit: Int): List<StudySession>

    @Query("SELECT SUM(duration) FROM study_sessions WHERE userId = :userId AND startTime >= :startOfDay")
    suspend fun getTodayTotalMinutes(userId: String, startOfDay: Long): Double?

    @Query("SELECT SUM(duration) FROM study_sessions WHERE userId = :userId AND startTime >= :weekStart")
    suspend fun getWeekTotalMinutes(userId: String, weekStart: Long): Double?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStudySession(session: StudySession): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStudySessions(sessions: List<StudySession>)

    @Update
    suspend fun updateStudySession(session: StudySession)

    @Delete
    suspend fun deleteStudySession(session: StudySession)

    @Query("DELETE FROM study_sessions WHERE userId = :userId")
    suspend fun deleteAllUserSessions(userId: String)

    @Query("DELETE FROM study_sessions")
    suspend fun deleteAllSessions()
}