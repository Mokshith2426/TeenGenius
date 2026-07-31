# ClassHub - Android App

A modern, feature-rich Android study companion app built with Kotlin and Jetpack Compose.

## Features

### Core Features
- **AI Assistant**: Chat with AI tutor, voice input, image upload, subject detection
- **Exam Lab**: AI-generated study plans, practice questions, mock tests, revision materials
- **Study Timer**: Track study sessions with streaks and daily targets
- **Task Management**: Daily to-do lists with completion tracking
- **Notes Generator**: Create and manage study notes
- **Timetable Maker**: Plan your weekly schedule
- **Study Groups**: Collaborate with peers
- **Gamification**: XP points, badges, and study streaks

### Technical Features
- **Offline-First**: Works without internet, syncs when online
- **Real-time Sync**: Firestore real-time updates
- **Modern UI**: Material Design 3 with dark theme
- **Smooth Animations**: Lottie animations and Compose transitions
- **Voice Input**: Speech-to-text for AI assistant
- **Push Notifications**: Stay updated with reminders

## Tech Stack

### Core
- **Language**: Kotlin
- **UI**: Jetpack Compose
- **Architecture**: MVVM + Repository Pattern
- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 34 (Android 14)

### Key Libraries
- **Firebase**: Auth, Firestore, Storage, Analytics, Crashlytics
- **Room**: Local database for offline support
- **Hilt**: Dependency injection
- **Retrofit**: Networking
- **Coil**: Image loading
- **ML Kit**: On-device text recognition
- **Gemini AI**: Cloud AI assistant
- **MPAndroidChart**: Analytics charts
- **Lottie**: Animations

## Project Structure

```
android-app/
├── app/
│   ├── src/main/
│   │   ├── java/com/teengenius/app/
│   │   │   ├── data/
│   │   │   │   ├── local/          # Room database, DAOs, converters
│   │   │   │   ├── model/          # Data classes
│   │   │   │   ├── repository/     # Repository classes
│   │   │   │   └── remote/         # API services
│   │   │   ├── di/                 # Dependency injection (Hilt)
│   │   │   ├── ui/
│   │   │   │   ├── screen/         # Compose screens
│   │   │   │   ├── theme/          # Colors, typography
│   │   │   │   └── viewmodel/      # ViewModels
│   │   │   ├── utils/              # Helper functions
│   │   │   ├── MainActivity.kt
│   │   │   └── ClassHubApp.kt      # Navigation
│   │   └── AndroidManifest.xml
│   └── build.gradle.kts
├── build.gradle.kts
└── settings.gradle.kts
```

## Architecture

### MVVM Pattern
- **View**: Compose UI screens
- **ViewModel**: Business logic and state management
- **Repository**: Data abstraction layer
- **Model**: Data classes and entities

### Data Flow
```
UI (Compose) → ViewModel → Repository → 
├── Local (Room DB)
└── Remote (Firebase/Firestore)
```

## Getting Started

### Prerequisites
- Android Studio Hedgehog (2023.1.1) or later
- JDK 8 or higher
- Firebase project with Auth, Firestore, and Storage enabled

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd android-app
   ```

2. **Add Firebase configuration**
   - Download `google-services.json` from Firebase Console
   - Place it in `app/` directory

3. **Add API Keys**
   - Copy `.env.example` to `.env`
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

4. **Build the project**
   ```bash
   ./gradlew build
   ```

5. **Run the app**
   - Connect an Android device (API 24+) or start an emulator
   - Click "Run" in Android Studio

## Key Features Implementation

### Authentication
- Google Sign-In
- Email/Password authentication
- Anonymous guest mode
- Firebase Auth state management

### Offline Support
- Room database for local storage
- Offline message queuing
- Automatic sync when online
- Conflict resolution

### AI Assistant
- Gemini AI integration
- Voice input with Speech-to-Text
- Image upload and analysis
- Chat history with sessions
- Subject detection

### Study Features
- Real-time study timer
- Task management with reminders
- Progress tracking
- Streak calculation
- Daily/weekly statistics

### Exam Preparation
- AI-generated study plans
- Practice questions with explanations
- Mock tests with scoring
- Mistake book for review
- Revision materials

## Development

### Building
```bash
# Debug build
./gradlew assembleDebug

# Release build
./gradlew assembleRelease

# Run tests
./gradlew test
```

### Code Style
- Follow Kotlin coding conventions
- Use meaningful variable names
- Add comments for complex logic
- Keep composables small and focused

### Testing
- Unit tests with JUnit
- UI tests with Compose Test
- Integration tests with Hilt

## Performance Optimization

- **Lazy Loading**: Compose lazy columns for lists
- **Caching**: Room database + in-memory cache
- **Image Optimization**: Coil with caching
- **Network**: Retrofit with OkHttp caching
- **Memory**: Proper lifecycle management

## Security

- Firebase Security Rules
- Encrypted local storage (optional)
- API key protection
- No sensitive data in logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Contact

For support or questions, please open an issue on GitHub.

---

Built with ❤️ using Kotlin and Jetpack Compose