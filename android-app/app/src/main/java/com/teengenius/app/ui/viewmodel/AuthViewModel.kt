package com.teengenius.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.teengenius.app.data.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class AuthState(
    val user: User? = null,
    val isLoading: Boolean = true,
    val isAuthenticated: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    private val _authState = MutableStateFlow(AuthState())
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    val isLoading: StateFlow<Boolean> = MutableStateFlow(true)
    val isAuthenticated: StateFlow<Boolean> = MutableStateFlow(false)

    init {
        // Listen to auth state changes
        firebaseAuth.addAuthStateListener { auth ->
            val user = auth.currentUser
            _authState.value = _authState.value.copy(
                user = user?.toUser(),
                isLoading = false,
                isAuthenticated = user != null
            )
            (isLoading as MutableStateFlow).value = false
            (isAuthenticated as MutableStateFlow).value = user != null
        }
    }

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            try {
                _authState.value = _authState.value.copy(isLoading = true, error = null)
                
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                val authResult = firebaseAuth.signInWithCredential(credential).await()
                
                val user = authResult.user?.toUser()
                _authState.value = _authState.value.copy(
                    user = user,
                    isLoading = false,
                    isAuthenticated = true
                )
            } catch (e: Exception) {
                _authState.value = _authState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Google sign-in failed"
                )
            }
        }
    }

    fun signInAnonymously() {
        viewModelScope.launch {
            try {
                _authState.value = _authState.value.copy(isLoading = true, error = null)
                
                val authResult = firebaseAuth.signInAnonymously().await()
                
                val user = authResult.user?.toUser()
                _authState.value = _authState.value.copy(
                    user = user,
                    isLoading = false,
                    isAuthenticated = true
                )
            } catch (e: Exception) {
                _authState.value = _authState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Guest sign-in failed"
                )
            }
        }
    }

    fun signInWithEmail(email: String, password: String) {
        viewModelScope.launch {
            try {
                _authState.value = _authState.value.copy(isLoading = true, error = null)
                
                val authResult = firebaseAuth.signInWithEmailAndPassword(email, password).await()
                
                val user = authResult.user?.toUser()
                _authState.value = _authState.value.copy(
                    user = user,
                    isLoading = false,
                    isAuthenticated = true
                )
            } catch (e: Exception) {
                _authState.value = _authState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Email sign-in failed"
                )
            }
        }
    }

    fun signUpWithEmail(email: String, password: String, displayName: String) {
        viewModelScope.launch {
            try {
                _authState.value = _authState.value.copy(isLoading = true, error = null)
                
                val authResult = firebaseAuth.createUserWithEmailAndPassword(email, password).await()
                
                // Update display name
                authResult.user?.updateProfile(
                    com.google.firebase.auth.UserProfileChangeRequest.Builder()
                        .setDisplayName(displayName)
                        .build()
                )?.await()
                
                val user = authResult.user?.toUser()
                _authState.value = _authState.value.copy(
                    user = user,
                    isLoading = false,
                    isAuthenticated = true
                )
            } catch (e: Exception) {
                _authState.value = _authState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Email sign-up failed"
                )
            }
        }
    }

    fun logout() {
        firebaseAuth.signOut()
        _authState.value = AuthState(isLoading = false, isAuthenticated = false)
    }

    fun clearError() {
        _authState.value = _authState.value.copy(error = null)
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