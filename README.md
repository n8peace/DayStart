# DayStart 🌅

A hyper-personalized, AI-powered alarm clock that improves the way people wake up. Each morning, it plays background music and a warm, emotionally intelligent voice that delivers a brief, personalized message using AI — like weather, news, encouragement, or reminders.

## 🚀 Vision

DayStart transforms the morning routine by combining:
- **Personalized AI Scripts**: GPT-4o generates unique morning messages
- **Emotional Intelligence**: Context-aware content based on user preferences
- **High-Quality Voice Synthesis**: ElevenLabs delivers warm, natural speech
- **Seamless Integration**: SwiftUI + Supabase for smooth user experience

## 🧱 Tech Stack

- **Frontend**: SwiftUI iOS app
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: GPT-4o for morning script generation
- **Voice**: ElevenLabs for voice synthesis
- **CI/CD**: GitHub Actions, with `develop` and `main` branch strategy

## 📁 Project Structure

```
daystart/
├── ios-app/           # SwiftUI iOS app code
├── supabase/          # Supabase project files
│   ├── functions/     # Edge functions
│   └── migrations/    # Database migrations
├── scripts/           # Helper scripts for local dev, migrations, audio testing
├── docs/              # Project overview, architecture, onboarding
├── .github/           # GitHub Actions workflows
├── .env               # Local environment file (gitignored)
└── README.md          # This file
```

## 🚀 Getting Started

### Prerequisites

- Xcode 15.0+
- iOS 17.0+
- Node.js 18+ (for Supabase CLI)
- Supabase CLI
- ElevenLabs API key
- OpenAI API key

### Local Development Setup

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd daystart
   cp .env.example .env
   # Edit .env with your API keys
   ```

2. **iOS App Setup**
   ```bash
   cd ios-app
   # Open DayStart.xcodeproj in Xcode
   # Configure signing and capabilities
   ```

3. **Supabase Setup**
   ```bash
   cd supabase
   supabase start
   supabase db reset
   ```

4. **Install Dependencies**
   ```bash
   # iOS dependencies managed via Swift Package Manager
   # Supabase functions dependencies
   cd supabase/functions
   npm install
   ```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# ElevenLabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# App Configuration
APP_ENV=development
```

## 🔄 Development Workflow

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature branches
- `hotfix/*`: Critical production fixes

### Development Process
1. Create feature branch from `develop`
2. Implement feature with tests
3. Create PR to `develop`
4. Code review and CI checks
5. Merge to `develop`
6. Release to `main` via PR

## 📱 iOS App Features

- **Smart Alarm**: AI-generated personalized wake-up messages
- **Voice Customization**: Multiple voice options via ElevenLabs
- **Weather Integration**: Local weather in morning messages
- **News Briefing**: Curated news based on user interests
- **Sleep Tracking**: Basic sleep pattern analysis
- **Offline Support**: Core functionality works offline

## 🔧 Available Scripts

```bash
# Database operations
./scripts/migrate.sh          # Run database migrations
./scripts/seed.sh             # Seed test data

# Audio testing
./scripts/test-audio.sh       # Test ElevenLabs integration

# Development helpers
./scripts/setup-dev.sh        # Complete dev environment setup
./scripts/clean.sh            # Clean build artifacts
```

## 📚 Documentation

- [Architecture Overview](docs/architecture.md)
- [API Documentation](docs/api.md)
- [iOS Development Guide](docs/ios-guide.md)
- [Supabase Setup](docs/supabase-setup.md)
- [Deployment Guide](docs/deployment.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Check the [documentation](docs/)
- Review [troubleshooting guide](docs/troubleshooting.md) 