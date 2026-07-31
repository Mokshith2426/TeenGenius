package com.teengenius.app.data.local.dao

import androidx.room.*
import com.teengenius.app.data.model.DailyTask
import kotlinx.coroutines.flow.Flow

@Dao
interface DailyTaskDao {
    @Query("SELECT * FROM daily_tasks WHERE userId = :userId ORDER BY createdAt DESC")
    fun getTasksByUser(userId: String): Flow<List<DailyTask>>

    @Query("SELECT * FROM daily_tasks WHERE userId = :userId AND completed = 0 ORDER BY createdAt DESC")
    fun getPendingTasks(userId: String): Flow<List<DailyTask>>

    @Query("SELECT * FROM daily_tasks WHERE id = :taskId")
    suspend fun getTaskById(taskId: String): DailyTask?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTask(task: DailyTask): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTasks(tasks: List<DailyTask>)

    @Update
    suspend fun updateTask(task: DailyTask)

    @Delete
    suspend fun deleteTask(task: DailyTask)

    @Query("DELETE FROM daily_tasks WHERE userId = :userId")
    suspend fun deleteAllUserTasks(userId: String)

    @Query("DELETE FROM daily_tasks")
    suspend fun deleteAllTasks()

    @Query("UPDATE daily_tasks SET completed = :completed WHERE id = :taskId")
    suspend fun updateTaskCompletion(taskId: String, completed: Boolean)
}