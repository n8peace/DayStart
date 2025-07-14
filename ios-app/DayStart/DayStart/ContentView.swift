import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        Group {
            if appState.isLoading {
                LoadingView()
            } else if appState.isAuthenticated {
                MainTabView()
            } else {
                AuthenticationView()
            }
        }
        .alert("Error", isPresented: .constant(appState.errorMessage != nil)) {
            Button("OK") {
                appState.errorMessage = nil
            }
        } message: {
            if let errorMessage = appState.errorMessage {
                Text(errorMessage)
            }
        }
    }
}

// MARK: - Loading View
struct LoadingView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "sunrise.fill")
                .font(.system(size: 60))
                .foregroundColor(.orange)
            
            Text("DayStart")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            ProgressView()
                .scaleEffect(1.2)
        }
    }
}

// MARK: - Main Tab View
struct MainTabView: View {
    var body: some View {
        TabView {
            AlarmView()
                .tabItem {
                    Image(systemName: "alarm.fill")
                    Text("Alarm")
                }
            
            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
        }
        .accentColor(.orange)
    }
}

// MARK: - Authentication View
struct AuthenticationView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                // App Logo and Title
                VStack(spacing: 20) {
                    Image(systemName: "sunrise.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.orange)
                    
                    Text("DayStart")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Your AI-powered morning companion")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                // Authentication Form
                VStack(spacing: 20) {
                    TextField("Email", text: $email)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    
                    SecureField("Password", text: $password)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                    
                    Button(action: {
                        // Handle authentication
                    }) {
                        Text(isSignUp ? "Sign Up" : "Sign In")
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.orange)
                            .cornerRadius(10)
                    }
                }
                .padding(.horizontal, 40)
                
                // Toggle between sign in and sign up
                Button(action: {
                    isSignUp.toggle()
                }) {
                    Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up")
                        .foregroundColor(.orange)
                }
                
                Spacer()
            }
            .padding()
        }
    }
}

// MARK: - Alarm View
struct AlarmView: View {
    @State private var wakeUpTime = Date()
    @State private var isAlarmEnabled = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                // Time Picker
                DatePicker("Wake Up Time", selection: $wakeUpTime, displayedComponents: .hourAndMinute)
                    .datePickerStyle(WheelDatePickerStyle())
                    .labelsHidden()
                
                // Enable/Disable Toggle
                Toggle("Enable Alarm", isOn: $isAlarmEnabled)
                    .padding(.horizontal)
                
                // Quick Actions
                VStack(spacing: 15) {
                    Button(action: {
                        // Test alarm sound
                    }) {
                        HStack {
                            Image(systemName: "speaker.wave.2.fill")
                            Text("Test Sound")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(10)
                    }
                    
                    Button(action: {
                        // Generate preview message
                    }) {
                        HStack {
                            Image(systemName: "message.fill")
                            Text("Preview Message")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green.opacity(0.1))
                        .cornerRadius(10)
                    }
                }
                .padding(.horizontal)
                
                Spacer()
            }
            .navigationTitle("Alarm")
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        NavigationView {
            List {
                Section("Account") {
                    if let user = appState.currentUser {
                        HStack {
                            Text("Name")
                            Spacer()
                            Text(user.name)
                                .foregroundColor(.secondary)
                        }
                        
                        HStack {
                            Text("Email")
                            Spacer()
                            Text(user.email)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Button("Sign Out") {
                        // Handle sign out
                    }
                    .foregroundColor(.red)
                }
                
                Section("Preferences") {
                    NavigationLink("Voice Settings") {
                        Text("Voice Settings")
                    }
                    
                    NavigationLink("Weather & News") {
                        Text("Weather & News Settings")
                    }
                    
                    NavigationLink("Background Music") {
                        Text("Background Music Settings")
                    }
                }
                
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
} 