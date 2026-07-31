package com.teengenius.app.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.teengenius.app.data.model.StudyPlan
import com.teengenius.app.data.model.Question
import com.teengenius.app.data.model.RevisionMaterial
import com.teengenius.app.data.model.MistakeBookEntry
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ExamRepository @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    // Study Plans
    suspend fun saveStudyPlan(plan: StudyPlan): Result<String> {
        return try {
            val docRef = firestore.collection("studyPlans").document()
            val planData = hashMapOf(
                "userId" to plan.userId,
                "subject" to plan.subject,
                "board" to plan.board,
                "studentClass" to plan.studentClass,
                "examDate" to plan.examDate,
                "dailyHours" to plan.dailyHours,
                "goal" to plan.goal,
                "overview" to plan.overview,
                "schedule" to plan.schedule.map { 
                    hashMapOf(
                        "day" to it.day,
                        "tasks" to it.tasks,
                        "hours" to it.hours,
                        "focus" to it.focus
                    )
                },
                "milestones" to plan.milestones,
                "tips" to plan.tips,
                "createdAt" to com.google.firebase.Timestamp.now()
            )
            docRef.set(planData).await()
            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getStudyPlans(userId: String): Result<List<StudyPlan>> {
        return try {
            val snapshot = firestore.collection("studyPlans")
                .whereEqualTo("userId", userId)
                .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .get()
                .await()
            
            val plans = snapshot.documents.map { doc ->
                StudyPlan(
                    id = doc.id,
                    userId = doc.getString("userId") ?: "",
                    subject = doc.getString("subject") ?: "",
                    board = doc.getString("board") ?: "",
                    studentClass = doc.getString("studentClass") ?: "",
                    examDate = doc.getString("examDate") ?: "",
                    dailyHours = doc.getString("dailyHours") ?: "4",
                    goal = doc.getString("goal") ?: "85",
                    overview = doc.getString("overview") ?: "",
                    createdAt = doc.getTimestamp("createdAt")?.toDate()?.time ?: 0L
                )
            }
            Result.success(plans)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Practice Questions & Mock Tests
    suspend fun saveQuizResult(
        userId: String,
        subject: String,
        quizType: String,
        questions: List<Question>,
        userAnswers: List<Int>,
        score: Int
    ): Result<String> {
        return try {
            val docRef = firestore.collection("quizResults").document()
            val resultData = hashMapOf(
                "userId" to userId,
                "subject" to subject,
                "quizType" to quizType,
                "totalQuestions" to questions.size,
                "correctAnswers" to score,
                "scorePercentage" to (score.toDouble() / questions.size * 100),
                "completedAt" to com.google.firebase.Timestamp.now()
            )
            docRef.set(resultData).await()
            
            // Save incorrect answers to mistake book
            questions.forEachIndexed { index, question ->
                if (userAnswers[index] != question.correctAnswerIndex) {
                    saveMistake(
                        userId = userId,
                        question = question.question,
                        userAnswer = question.options[userAnswers[index]],
                        correctAnswer = question.options[question.correctAnswerIndex],
                        explanation = question.explanation,
                        subject = subject,
                        topic = quizType
                    )
                }
            }
            
            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Mistake Book
    private suspend fun saveMistake(
        userId: String,
        question: String,
        userAnswer: String,
        correctAnswer: String,
        explanation: String,
        subject: String,
        topic: String
    ) {
        try {
            val docRef = firestore.collection("mistakeBook").document()
            val mistakeData = hashMapOf(
                "userId" to userId,
                "question" to question,
                "userAnswer" to userAnswer,
                "correctAnswer" to correctAnswer,
                "explanation" to explanation,
                "subject" to subject,
                "topic" to topic,
                "createdAt" to com.google.firebase.Timestamp.now()
            )
            docRef.set(mistakeData).await()
        } catch (e: Exception) {
            // Handle error
        }
    }

    suspend fun getMistakeBook(userId: String): Result<List<MistakeBookEntry>> {
        return try {
            val snapshot = firestore.collection("mistakeBook")
                .whereEqualTo("userId", userId)
                .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .get()
                .await()
            
            val mistakes = snapshot.documents.map { doc ->
                MistakeBookEntry(
                    id = doc.id,
                    userId = doc.getString("userId") ?: "",
                    question = doc.getString("question") ?: "",
                    userAnswer = doc.getString("userAnswer") ?: "",
                    correctAnswer = doc.getString("correctAnswer") ?: "",
                    explanation = doc.getString("explanation") ?: "",
                    subject = doc.getString("subject") ?: "",
                    topic = doc.getString("topic") ?: "",
                    createdAt = doc.getTimestamp("createdAt")?.toDate()?.time ?: 0L
                )
            }
            Result.success(mistakes)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteMistake(mistakeId: String): Result<Unit> {
        return try {
            firestore.collection("mistakeBook").document(mistakeId).delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Revision Materials
    suspend fun saveRevisionMaterial(
        userId: String,
        title: String,
        content: String,
        type: String
    ): Result<String> {
        return try {
            val docRef = firestore.collection("revisionMaterials").document()
            val materialData = hashMapOf(
                "userId" to userId,
                "title" to title,
                "content" to content,
                "type" to type,
                "createdAt" to com.google.firebase.Timestamp.now()
            )
            docRef.set(materialData).await()
            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getRevisionMaterials(userId: String): Result<List<RevisionMaterial>> {
        return try {
            val snapshot = firestore.collection("revisionMaterials")
                .whereEqualTo("userId", userId)
                .orderBy("createdAt", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .get()
                .await()
            
            val materials = snapshot.documents.map { doc ->
                RevisionMaterial(
                    id = doc.id,
                    title = doc.getString("title") ?: "",
                    content = doc.getString("content") ?: "",
                    type = doc.getString("type") ?: "concept"
                )
            }
            Result.success(materials)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}