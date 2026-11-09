plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.forgefit.wear"
    compileSdk = 36

    defaultConfig {
        // Must match the phone app's applicationId for the Wear Data Layer to connect them.
        applicationId = "app.forgefit"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        create("forge") {
            storeFile = rootProject.file("keystore/forge.jks")
            storePassword = providers.gradleProperty("forge.storePassword").get()
            keyAlias = providers.gradleProperty("forge.keyAlias").get()
            keyPassword = providers.gradleProperty("forge.keyPassword").get()
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("forge")
        }
        getByName("debug") {
            signingConfig = signingConfigs.getByName("forge")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")
}
