package com.teengenius.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.teengenius.app.data.local.dao.StudySessionDao
import com.teengenius.app.data.local.dao.DailyTaskDao
import com.teengenius.app.data.model.StudySession
import com.teengenius.app.data.model.DailyTask
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.tasks.await
import java.util.Calendar
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StudyRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val studySessionDao: StudySessionDao,
    private val dailyTaskDao: DailyTaskDao
) {
    // Study Sessions
    fun getStudySessions(userId: String): Flow<List<StudySession>> {
        return studySessionDao.getStudySessionsByUser(userId)
    }

    suspend fun getTodaySessions(userId: String): List<StudySession> {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        return studySessionDao.getTodaySessions(userId, calendar.timeInMillis).let { flow ->
            // Convert Flow to List synchronously for this example
            // In real app, use flow operations
            emptyList()
        }
    }

    suspend fun saveStudySession(userId: String, startTime: Long, duration: Double): Long {
        val session = StudySession(
            userId = userId,
            startTime = startTime,
            duration = duration,
            createdAt = System.currentTimeMillis()
        )
        
        // Save to local database
        val localId = studySessionDao.insertStudySession(session)
        
        // Try to sync to Firestore
        try {
            val docRef = firestore.collection("studySessions").document()
            val sessionData = hashMapOf(
                "userId" to userId,
                "startTime" to com.google.firebase.Timestamp(startTime / 1000, ((startTime % 1000) * 1000000).toInt()),
                "duration" to duration,
                "createdAt" to com.google.firebase.Timestamp.now()
            )
            docRef.set(sessionData).await()
        } catch (e: Exception) {
            // Offline - will sync later
        }
        
        return localId
    }

    suspend fun deleteStudySession(session: StudySession) {
        studySessionDao.deleteStudySession(session)
        try {
            firestore.collection("studySessions").document(session.id).delete().await()
        } catch (e: Exception) {
            // Handle error
        }
    }

    // Daily Tasks
    fun getDailyTasks(userId: String): Flow<List<DailyTask>> {
        return dailyTaskDao.getTasksByUser(userId)
    }

    fun getPendingTasks(userId: String): Flow<List<DailyTask>> {
        return dailyTaskDao.getPendingTasks(userId)
    }

    suspend fun addTask(userId: String, text: String): Long {
        val task = DailyTask(
            id = "task_${System.currentTimeMillis()}",
            userId = userId,
            text = text,
            completed = false,
            createdAt = System.currentTimeMillis()
        )
        return dailyTaskDao.insertTask(task)
    }

    suspend fun updateTaskCompletion(taskId: String, completed: Boolean) {
        dailyTaskDao.updateTaskCompletion(taskId, completed)
    }

    suspend fun deleteTask(taskId: String) {
        dailyTaskDao.getTaskById(taskId)?.let { task ->
            dailyTaskDao.deleteTask(task)
        }
    }

    suspend fun clearAllTasks(userId: String) {
        dailyTaskDao.deleteAllUserTasks(userId)
    }

    // Statistics
    suspend fun getTodayTotalMinutes(userId: String): Double {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        return studySessionDao.getTodayTotalMinutes(userId, calendar.timeInMillis) ?: 0.0
    }

    suspend fun getWeekTotalMinutes(userId: String): Double {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.DAY_OF_WEEK, Calendar.MONDAY)
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        return studySessionDao.getWeekTotalMinutes(userId, calendar.timeInMillis) ?: 0.0
    }
}