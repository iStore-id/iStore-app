plugins {
    id("com.android.application")
}

android {
    namespace = "id.istore.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "id.istore.app"
        minSdk = 23
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
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
