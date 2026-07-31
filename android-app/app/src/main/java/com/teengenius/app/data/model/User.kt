package com.teengenius.app.data.model

data class User(
    val uid: String = "",
    val email: String? = null,
    val displayName: String? = null,
    val photoURL: String? = null,
    val isAnonymous: Boolean = false,
    val isOnline: Boolean = true,
    val friendIds: List<String> = emptyList(),
    val xp: Int = 0,
    val badges: List<String> = emptyList(),
    val streak: Int = 0,
    val weeklyXp: Int = 0,
    val lastActiveDate: String = ""
)

data class StudySession(
    val id: String = "",
    val userId: String = "",
    val startTime: Long = 0L,
    val duration: Double = 0.0,
    val createdAt: Long = 0L
)

data class DailyTask(
    val id: String = "",
    val text: String = "",
    val completed: Boolean = false,
    val createdAt: Long = 0L
)

data class ChatMessage(
    val id: String = "",
    val sessionId: String = "",
    val role: String = "user",
    val content: String = "",
    val imageUrl: String? = null,
    val timestamp: Long = 0L,
    val status: String = "sending"
)

data class ChatSession(
    val id: String = "",
    val userId: String = "",
    val title: String = "",
    val lastMessage: String = "",
    val lastUpdatedAt: Long = 0L
)

data class StudyPlan(
    val id: String = "",
    val userId: String = "",
    val subject: String = "",
    val board: String = "",
    val studentClass: String = "",
    val examDate: String = "",
    val dailyHours: String = "4",
    val goal: String = "85",
    val overview: String = "",
    val schedule: List<DaySchedule> = emptyList(),
    val milestones: List<String> = emptyList(),
    val tips: List<String> = emptyList(),
    val createdAt: Long = 0L
)

data class DaySchedule(
    val day: String = "",
    val tasks: List<String> = emptyList(),
    val hours: String = "",
    val focus: String = ""
)

data class Question(
    val question: String = "",
    val options: List<String> = emptyList(),
    val correctAnswerIndex: Int = 0,
    val explanation: String = ""
)

data class QuizResult(
    val totalQuestions: Int = 0,
    val correctAnswers: Int = 0,
    val scorePercentage: Double = 0.0,
    val questions: List<Question> = emptyList(),
    val userAnswers: List<Int> = emptyList()
)

data class RevisionMaterial(
    val id: String = "",
    val title: String = "",
    val content: String = "",
    val type: String = "concept"
)

data class MistakeBookEntry(
    val id: String = "",
    val userId: String = "",
    val question: String = "",
    val userAnswer: String = "",
    val correctAnswer: String = "",
    val explanation: String = "",
    val subject: String = "",
    val topic: String = "",
    val createdAt: Long = 0L
)