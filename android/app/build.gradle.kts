plugins {
    id("com.android.application")
}

android {
    namespace = "id.istore.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "id.istore.app"
        minSdk = 24
        // Keep the TWA on the Android 15 behavior baseline while testing Android 16 launch crashes.
        targetSdk = 35
        versionCode = 2
        versionName = "1.0.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
