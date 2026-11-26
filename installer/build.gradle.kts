plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The watch app's version (read from its build file) and APK, bundled so one tap installs the matching build.
val watchVersion: String = Regex("versionName\\s*=\\s*\"([^\"]+)\"").find(rootProject.file("wear/build.gradle.kts").readText())?.groupValues?.get(1) ?: "?"
val watchAssets = layout.buildDirectory.dir("generated/watchApk")

android {
    namespace = "app.forgefit.installer"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.forgefit.installer"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "WATCH_VERSION", "\"$watchVersion\"")
    }
    buildFeatures { buildConfig = true }

    signingConfigs {
        create("forge") {
            storeFile = rootProject.file("keystore/forge.jks")
            storePassword = providers.gradleProperty("forge.storePassword").get()
            keyAlias = providers.gradleProperty("forge.keyAlias").get()
            keyPassword = providers.gradleProperty("forge.keyPassword").get()
        }
    }
    buildTypes {
        getByName("release") { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("forge") }
        getByName("debug") { signingConfig = signingConfigs.getByName("forge") }
    }
    sourceSets["main"].assets.srcDir(watchAssets)
    packaging { resources { excludes += setOf("META-INF/versions/9/OSGI-INF/MANIFEST.MF", "META-INF/DEPENDENCIES") } }
    lint { checkReleaseBuilds = false; abortOnError = false }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

val copyWatchApk by tasks.registering(Copy::class) {
    dependsOn(":wear:assembleRelease")
    from(rootProject.file("wear/build/outputs/apk/release/wear-release.apk"))
    into(watchAssets)
    rename { "forge-watch.apk" }
}
tasks.named("preBuild") { dependsOn(copyWatchApk) }

dependencies {
    implementation("androidx.core:core-ktx:1.16.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.github.MuntashirAkon:libadb-android:3.1.1")
    implementation("com.github.MuntashirAkon:sun-security-android:1.1")
    implementation("org.conscrypt:conscrypt-android:2.5.3")
}
