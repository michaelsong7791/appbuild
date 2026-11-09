package app.forgefit

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import org.json.JSONArray
import java.util.concurrent.TimeUnit

/**
 * Periodic background sync (min. 15 min, Android's limit): pulls new workouts and body readings from
 * Health Connect (Samsung Health & other connected apps) and Strava into the inbox so they're ready the
 * moment Forge opens. Optionally notifies about newly imported activities.
 */
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    companion object {
        private const val NAME = "forge-sync"
        private const val CHANNEL = "forge_sync"

        fun schedule(ctx: Context, on: Boolean, minutes: Int, notify: Boolean) {
            val wm = WorkManager.getInstance(ctx)
            ctx.getSharedPreferences("sync", Context.MODE_PRIVATE).edit().putBoolean("notify", notify).apply()
            if (!on) { wm.cancelUniqueWork(NAME); return }
            val req = PeriodicWorkRequestBuilder<SyncWorker>(minutes.coerceAtLeast(15).toLong(), TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            wm.enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, req)
        }
    }

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val prefs = ctx.getSharedPreferences("sync", Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val since = maxOf(now - 3 * 86_400_000L, prefs.getLong("lastRun", 0L) - 6 * 3_600_000L)
        var newActivities = 0
        val titles = mutableListOf<String>()

        // Health Connect (needs "read in background" permission; silently skipped if not granted)
        val health = HealthBridge(ctx)
        runCatching {
            val r = health.readSessions(since)
            val arr = r.optJSONArray("sessions") ?: JSONArray()
            newActivities += Inbox.add(ctx, "sessions", arr)
            for (i in 0 until arr.length()) arr.getJSONObject(i).optString("type").let { if (titles.size < 3) titles += it }
        }
        runCatching {
            val b = health.readBody(since)
            Inbox.add(ctx, "body", b.optJSONArray("entries") ?: JSONArray(), "t")
            if (b.has("heightM")) Inbox.put(ctx, "heightM", b.getDouble("heightM"))
        }

        // Strava
        val strava = StravaClient(ctx) { _, _ -> }
        if (strava.status().optBoolean("connected")) {
            runCatching {
                val acts = strava.activities(since).optJSONArray("activities") ?: JSONArray()
                var streams = 0
                for (i in 0 until acts.length()) {
                    val a = acts.getJSONObject(i)
                    if (streams < 5 && a.optString("type") in setOf("run", "walk", "hike") && a.optDouble("distM", 0.0) > 0) {
                        runCatching { a.put("streams", strava.streams(a.getLong("id"))); streams++ }
                    }
                    if (titles.size < 3) titles += a.optString("name")
                }
                newActivities += Inbox.add(ctx, "activities", acts)
            }
        }

        prefs.edit().putLong("lastRun", now).apply()
        if (newActivities > 0 && prefs.getBoolean("notify", true)) notifyNew(ctx, newActivities, titles)
        return Result.success()
    }

    private fun notifyNew(ctx: Context, n: Int, titles: List<String>) {
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Synced activities", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val n2 = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher_fg)
            .setContentTitle("Forge synced $n new activit${if (n > 1) "ies" else "y"}")
            .setContentText(titles.filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "Tap to see calories & recovery" })
            .setContentIntent(open).setAutoCancel(true)
            .build()
        nm.notify(42, n2)
    }
}
