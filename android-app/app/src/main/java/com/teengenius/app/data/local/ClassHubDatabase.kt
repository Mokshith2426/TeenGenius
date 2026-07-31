package com.teengenius.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.teengenius.app.data.local.converter.Converters
import com.teengenius.app.data.local.dao.StudySessionDao
import com.teengenius.app.data.local.dao.DailyTaskDao
import com.teengenius.app.data.local.dao.ChatMessageDao
import com.teengenius.app.data.local.dao.ChatSessionDao
import com.teengenius.app.data.model.StudySession
import com.teengenius.app.data.model.DailyTask
import com.teengenius.app.data.model.ChatMessage
import com.teengenius.app.data.model.ChatSession

@Database(
    entities = [
        StudySession::class,
        DailyTask::class,
        ChatMessage::class,
        ChatSession::class
    ],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class ClassHubDatabase : RoomDatabase() {
    abstract fun studySessionDao(): StudySessionDao
    abstract fun dailyTaskDao(): DailyTaskDao
    abstract fun chatSessionDao(): ChatSessionDao
    abstract fun chatMessageDao(): ChatMessageDao

    companion object {
        const val DATABASE_NAME = "classhub_database"
    }
}