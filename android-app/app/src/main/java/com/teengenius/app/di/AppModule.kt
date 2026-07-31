package com.teengenius.app.di

import android.content.Context
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.ktx.auth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ktx.firestore
import com.google.firebase.ktx.Firebase
import com.teengenius.app.data.local.ClassHubDatabase
import com.teengenius.app.data.local.dao.StudySessionDao
import com.teengenius.app.data.local.dao.DailyTaskDao
import com.teengenius.app.data.local.dao.ChatMessageDao
import com.teengenius.app.data.local.dao.ChatSessionDao
import com.teengenius.app.data.repository.AuthRepository
import com.teengenius.app.data.repository.StudyRepository
import com.teengenius.app.data.repository.ChatRepository
import com.teengenius.app.data.repository.ExamRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth = Firebase.auth

    @Provides
    @Singleton
    fun provideFirebaseFirestore(): FirebaseFirestore = Firebase.firestore

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): ClassHubDatabase {
        return ClassHubDatabase.getDatabase(context)
    }

    @Provides
    @Singleton
    fun provideStudySessionDao(database: ClassHubDatabase): StudySessionDao {
        return database.studySessionDao()
    }

    @Provides
    @Singleton
    fun provideDailyTaskDao(database: ClassHubDatabase): DailyTaskDao {
        return database.dailyTaskDao()
    }

    @Provides
    @Singleton
    fun provideChatSessionDao(database: ClassHubDatabase): ChatSessionDao {
        return database.chatSessionDao()
    }

    @Provides
    @Singleton
    fun provideChatMessageDao(database: ClassHubDatabase): ChatMessageDao {
        return database.chatMessageDao()
    }

    @Provides
    @Singleton
    fun provideAuthRepository(
        firebaseAuth: FirebaseAuth,
        firestore: FirebaseFirestore
    ): AuthRepository {
        return AuthRepository(firebaseAuth, firestore)
    }

    @Provides
    @Singleton
    fun provideStudyRepository(
        firestore: FirebaseFirestore,
        studySessionDao: StudySessionDao,
        dailyTaskDao: DailyTaskDao
    ): StudyRepository {
        return StudyRepository(firestore, studySessionDao, dailyTaskDao)
    }

    @Provides
    @Singleton
    fun provideChatRepository(
        firestore: FirebaseFirestore,
        chatSessionDao: ChatSessionDao,
        chatMessageDao: ChatMessageDao
    ): ChatRepository {
        return ChatRepository(firestore, chatSessionDao, chatMessageDao)
    }

    @Provides
    @Singleton
    fun provideExamRepository(
        firestore: FirebaseFirestore
    ): ExamRepository {
        return ExamRepository(firestore)
    }
}