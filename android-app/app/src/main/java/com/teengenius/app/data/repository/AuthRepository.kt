package com.teengenius.app.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import com.teengenius.app.data.model.User
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val firebaseAuth: FirebaseAuth,
    private val firestore: FirebaseFirestore
) {
    fun getCurrentUser(): FirebaseUser? = firebaseAuth.currentUser

    suspend fun signInWithGoogle(idToken: String): Result<User> {
        return try {
            val credential = com.google.firebase.auth.GoogleAuthProvider.getCredential(idToken, null)
            val authResult = firebaseAuth.signInWithCredential(credential).await()
            val user = authResult.user?.toUser()
            if (user != null) {
                createUserDocument(user)
                Result.success(user)
            } else {
                Result.failure(Exception("Authentication failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signInAnonymously(): Result<User> {
        return try {
            val authResult = firebaseAuth.signInAnonymously().await()
            val user = authResult.user?.toUser()
            if (user != null) {
                createUserDocument(user)
                Result.success(user)
            } else {
                Result.failure(Exception("Guest sign-in failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signInWithEmail(email: String, password: String): Result<User> {
        return try {
            val authResult = firebaseAuth.signInWithEmailAndPassword(email, password).await()
            val user = authResult.user?.toUser()
            if (user != null) {
                updateUserDocument(user)
                Result.success(user)
            } else {
                Result.failure(Exception("Email sign-in failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signUpWithEmail(email: String, password: String, displayName: String): Result<User> {
        return try {
            val authResult = firebaseAuth.createUserWithEmailAndPassword(email, password).await()
            
            // Update display name
            authResult.user?.updateProfile(
                com.google.firebase.auth.UserProfileChangeRequest.Builder()
                    .setDisplayName(displayName)
                    .build()
            )?.await()
            
            val user = authResult.user?.toUser()
            if (user != null) {
                createUserDocument(user)
                Result.success(user)
            } else {
                Result.failure(Exception("Email sign-up failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout(): Result<Unit> {
        return try {
            firebaseAuth.signOut()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun createUserDocument(user: User) {
        try {
            val userRef = firestore.collection("users").document(user.uid)
            val todayStr = getTodayDateString()
            
            val userData = hashMapOf(
                "uid" to user.uid,
                "email" to user.email,
                "displayName" to user.displayName,
                "photoURL" to user.photoURL,
                "isAnonymous" to user.isAnonymous,
                "isOnline" to true,
                "friendIds" to emptyList<String>(),
                "xp" to 0,
                "badges" to emptyList<String>(),
                "streak" to 0,
                "weeklyXp" to 0,
                "lastActiveDate" to todayStr,
                "createdAt" to com.google.firebase.Timestamp.now()
            )
            
            userRef.set(userData, com.google.firebase.firestore.SetOptions.merge()).await()
        } catch (e: Exception) {
            // Non-blocking error
        }
    }

    private suspend fun updateUserDocument(user: User) {
        try {
            val userRef = firestore.collection("users").document(user.uid)
            val todayStr = getTodayDateString()
            
            userRef.update(
                mapOf(
                    "isOnline" to true,
                    "lastActiveDate" to todayStr
                )
            ).await()
        } catch (e: Exception) {
            // Non-blocking error
        }
    }

    private fun getTodayDateString(): String {
        val formatter = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
        return formatter.format(java.util.Date())
    }
}

private fun FirebaseUser.toUser(): User {
    return User(
        uid = uid,
        email = email,
        displayName = displayName,
        photoURL = photoUrl?.toString(),
        isAnonymous = isAnonymous
    )
}