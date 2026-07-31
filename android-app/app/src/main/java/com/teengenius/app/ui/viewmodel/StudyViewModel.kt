package com.teengenius.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.teengenius.app.data.model.DailyTask
import com.teengenius.app.data.repository.StudyRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

data class StudyState(
    val todayMinutes: Double = 0.0,
    val dailyTarget: Double = 2.0,
    val tasks: List<DailyTask> = emptyList(),
    val weeklyStudy: Double = 0.0,
    val streak: Int = 0,
    val isLoading: Boolean = false
)

@HiltViewModel
class StudyViewModel @Inject constructor(
    private val studyRepository: StudyRepository
) : ViewModel() {

    private val _studyState = MutableStateFlow(StudyState())
    val studyState: StateFlow<StudyState> = _studyState.asStateFlow()

    val todayMinutes: StateFlow<Double> = _studyState.map { it.todayMinutes }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 0.0
    )

    val dailyTarget: StateFlow<Double> = _studyState.map { it.dailyTarget }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 2.0
    )

    val tasks: StateFlow<List<DailyTask>> = _studyState.map { it.tasks }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val weeklyStudy: StateFlow<Double> = _studyState.map { it.weeklyStudy }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 0.0
    )

    val streak: StateFlow<Int> = _studyState.map { it.streak }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = 0
    )

    init {
        loadStudyData()
    }

    fun loadStudyData() {
        viewModelScope.launch {
            _studyState.value = _studyState.value.copy(isLoading = true)
            
            // Load tasks
            val userId = "current_user" // TODO: Get from auth
            studyRepository.getDailyTasks(userId).collect { taskList ->
                _studyState.value = _studyState.value.copy(tasks = taskList)
            }
        }
    }

    fun addTask(text: String) {
        viewModelScope.launch {
            val userId = "current_user" // TODO: Get from auth
            studyRepository.addTask(userId, text)
        }
    }

    fun toggleTask(taskId: String, completed: Boolean) {
        viewModelScope.launch {
            studyRepository.updateTaskCompletion(taskId, completed)
        }
    }

    fun deleteTask(taskId: String) {
        viewModelScope.launch {
            studyRepository.deleteTask(taskId)
        }
    }

    fun startStudySession() {
        // TODO: Implement study session timer
    }

    fun stopStudySession(durationMinutes: Double) {
        viewModelScope.launch {
            val userId = "current_user" // TODO: Get from auth
            studyRepository.saveStudySession(userId, System.currentTimeMillis(), durationMinutes)
            // Refresh stats
            val todayTotal = studyRepository.getTodayTotalMinutes(userId)
            val weekTotal = studyRepository.getWeekTotalMinutes(userId)
            _studyState.value = _studyState.value.copy(
                todayMinutes = todayTotal,
                weeklyStudy = weekTotal / 60.0
            )
        }
    }

    fun setDailyTarget(target: Double) {
        _studyState.value = _studyState.value.copy(dailyTarget = target)
    }
}