plugins { id("com.android.application") }

android {
    namespace = "com.spellspeak.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.spellspeak.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "2.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}
