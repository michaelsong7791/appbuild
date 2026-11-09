# Forge — personal strength-training app (Galaxy Z Fold7 + Galaxy Watch)

Personal, non-commercial workout planner & tracker:

- **Adaptive planner** — goal-based (build muscle / strength / fat loss / endurance / general), scheduled on the exact weekdays you pick, auto-selects a split (full body, upper/lower, PPL, body-part), fits your session length and equipment, adds volume to focus muscles. Every day is editable: swap, reorder, add/remove, sets/reps/rest.
- **522 weight-training exercises** with looping start/end demo frames (bundled offline), step-by-step instructions, and a body map of primary vs. assisting muscles.
- **Progression from history** — double progression: hit the top of the rep range → weight goes up next time; two rough sessions → automatic 10 % back-off. Live PR detection.
- **Muscle recovery model** — every logged set adds fatigue to each muscle (weighted by involvement and effort/RPE), decaying with muscle-specific recovery times. Sleep, resting heart rate and HRV from Samsung Health shift recovery speed and the daily readiness score. "Adaptive mode" trims sets on still-recovering muscles.
- **Galaxy Watch companion** — live heart rate, automatic rep counting from wrist motion, rep tempo and "speed drop" (a velocity-loss proxy for nearing failure), heart-rate recovery between rest periods, log sets/skip rest from the wrist, rotating bezel adjusts reps.
- **Sync** — finished workouts (+ watch heart rate + estimated calories) are written to **Health Connect**, which Samsung Health reads. Optional upload to **Strava** as a *Weight Training* activity (with heart-rate graph when available).
- **Gamification** — XP & levels with titles, weekly streaks, 24 achievements, 3 rotating weekly quests, per-muscle mastery levels, PR confetti and level-up celebrations.
- Responsive UI: phone layout on the cover screen, two-pane layout when unfolded.

> **About "precision" tracking:** the watch has heart-rate, HRV and motion sensors, not muscle (EMG) sensors. Muscle fatigue is therefore *estimated* from training load + recovery signals; it's a model, not a measurement.

---

## 1. Get the APKs

### Option A — GitHub builds them for you (no tools needed)
1. Create an empty **private** repository on GitHub and push this folder to it (branch `main`).
2. The **Build APKs** workflow runs automatically (~5 min). When it's green:
   - On your phone, open the repo → **Releases → latest** → download `Forge-phone.apk`, or
   - Actions → latest run → **forge-apks** artifact (zip).

### Option B — Android Studio
Open the `forge` folder in Android Studio (Ladybug or newer, JDK 17) → **Build → Build APK(s)**, or run
`./gradlew :app:assembleRelease :wear:assembleRelease`.
Outputs: `app/build/outputs/apk/release/app-release.apk`, `wear/build/outputs/apk/release/wear-release.apk`.

## 2. Install on the Galaxy Z Fold7
1. Open the downloaded `Forge-phone.apk`.
2. Allow **Install unknown apps** for your browser / My Files when prompted.
3. If Play Protect warns about an unknown developer, choose **More details → Install anyway** (it's your own build).

## 3. Install on the Galaxy Watch (optional but recommended)
Wear OS doesn't install APKs by tapping, so use ADB once:
1. Watch: **Settings → About watch → Software → tap "Software version" 5×** to enable Developer options.
2. Watch: **Settings → Developer options → ADB debugging ON**, then **Wireless debugging ON** → **Pair new device** (shows IP:port + code).
3. From a computer with platform-tools: `adb pair IP:PAIRPORT` (enter code) → `adb connect IP:PORT` → `adb install Forge-watch.apk`.
   *(Phone-only alternative: apps like "Bugjaeger" or "Wear Installer 2" can push an APK to the watch over the same wireless-debugging pairing.)*
4. Open **Forge** on the watch and allow body sensors. Start a workout on the phone — the watch follows along.

The phone and watch APKs are signed with the same key (`keystore/forge.jks`) — this is required for them to talk to each other. Keep that file if you rebuild later, otherwise updates won't install over the old version.

## 4. Connect Samsung Health
In Forge: **You → Connected → Samsung Health → Connect** and grant the Health Connect permissions.
In **Samsung Health → Settings → Health Connect**, make sure Samsung Health is allowed to *write* sleep, heart rate and HRV (so Forge can read them) and to *read* exercise (so Forge workouts show up).

## 5. Connect Strava (optional)
Strava requires each app to use its own free API keys:
1. Go to <https://www.strava.com/settings/api> and create an app (name e.g. "Forge", website `http://localhost`).
2. Set **Authorization Callback Domain** to `localhost`.
3. In Forge: **You → Strava → Set up**, paste the **Client ID** and **Client Secret**, then approve in Strava.
4. Toggle **Auto-upload workouts to Strava** in Settings, or upload individual sessions from the workout summary.

---

## Project layout
```
app/                      Phone app (Kotlin shell + web UI)
  src/main/java/app/forgefit/
    MainActivity.kt       WebView host, back handling, insets, OAuth redirect
    Bridge.kt             JS <-> native bridge
    HealthBridge.kt       Health Connect read/write (Samsung Health)
    StravaClient.kt       Strava OAuth + uploads (TCX with HR)
    WearLink.kt           Wear Data Layer (phone side)
  src/main/assets/www/    UI: index.html, css/, js/ (engine, game, views, workout…), data/, img/
wear/                     Galaxy Watch app (sensors, rep detection, data layer)
.github/workflows/        CI that builds both APKs
```
Data stays on the phone (app storage + backup export/import in **You → Your data**).

Credits: exercise data & images from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (public domain / Unlicense). Fonts: Barlow & Barlow Condensed (SIL OFL).
