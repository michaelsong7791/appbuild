package app.forgefit

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Base64
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.documentfile.provider.DocumentFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Backups: a private copy (included in Android's Google backup), Downloads/Forge, and optionally a folder the user picked. */
class Backups(private val ctx: Context) {
    private val prefs = ctx.getSharedPreferences("forge_backup", Context.MODE_PRIVATE)
    private val privDir get() = File(ctx.filesDir, "backups").apply { mkdirs() }

    fun status(): JSONObject = JSONObject()
        .put("folder", prefs.getString("tree", null)?.let { Uri.parse(it).lastPathSegment?.substringAfterLast(':') ?: "chosen folder" })
        .put("last", prefs.getLong("last", 0))
        .put("lastWhere", prefs.getString("lastWhere", ""))
        .put("private", JSONArray(privDir.listFiles()?.sortedByDescending { it.name }?.map { it.name } ?: emptyList<String>()))

    fun setTree(uri: Uri?) {
        if (uri == null) { prefs.edit().remove("tree").apply(); return }
        ctx.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        prefs.edit().putString("tree", uri.toString()).apply()
    }

    fun write(json: String, keep: Int): JSONObject {
        val stamp = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val name = "forge-backup-$stamp.json"
        val where = mutableListOf<String>()
        // 1) private copy, rotated (restorable from inside the app; travels with Android's Google backup)
        File(privDir, name).writeText(json)
        privDir.listFiles()?.sortedByDescending { it.name }?.drop(keep)?.forEach { it.delete() }
        where += "app"
        // 2) user-picked folder (e.g. a synced cloud folder)
        prefs.getString("tree", null)?.let { t ->
            runCatching {
                val dir = DocumentFile.fromTreeUri(ctx, Uri.parse(t))!!
                dir.findFile(name)?.delete()
                val f = dir.createFile("application/json", name)!!
                ctx.contentResolver.openOutputStream(f.uri, "wt")!!.use { it.write(json.toByteArray()) }
                dir.listFiles().filter { it.name?.startsWith("forge-backup-") == true }.sortedByDescending { it.name }.drop(keep).forEach { it.delete() }
                where += "folder"
            }
        }
        // 3) Downloads/Forge (survives uninstall; visible in My Files)
        if (Build.VERSION.SDK_INT >= 29) runCatching {
            val r = ctx.contentResolver; val col = MediaStore.Downloads.EXTERNAL_CONTENT_URI
            r.delete(col, MediaStore.Downloads.DISPLAY_NAME + "=?", arrayOf(name))
            val v = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name); put(MediaStore.Downloads.MIME_TYPE, "application/json")
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Forge")
            }
            val uri = r.insert(col, v)!!
            r.openOutputStream(uri, "wt")!!.use { it.write(json.toByteArray()) }
            // rotate the ones this app created
            r.query(col, arrayOf(MediaStore.Downloads._ID, MediaStore.Downloads.DISPLAY_NAME), MediaStore.Downloads.DISPLAY_NAME + " LIKE 'forge-backup-%'", null, MediaStore.Downloads.DISPLAY_NAME + " DESC")?.use { c ->
                var i = 0
                while (c.moveToNext()) { if (i++ >= keep) r.delete(Uri.withAppendedPath(col, c.getLong(0).toString()), null, null) }
            }
            where += "downloads"
        }
        prefs.edit().putLong("last", System.currentTimeMillis()).putString("lastWhere", where.joinToString(",")).apply()
        return JSONObject().put("ok", true).put("name", name).put("where", JSONArray(where))
    }

    fun readPrivate(name: String): JSONObject {
        val f = File(privDir, File(name).name)
        if (!f.exists()) throw IllegalArgumentException("Backup not found")
        return JSONObject().put("json", f.readText())
    }
}

/** Ongoing rest-timer notification with a live countdown; buzzes when the rest is over, even with the screen off. */
class RestNotifier(private val ctx: Context) {
    var foreground = false
    private val h = Handler(Looper.getMainLooper())
    private var done: Runnable? = null
    private val nm = NotificationManagerCompat.from(ctx)

    private fun channels() {
        if (Build.VERSION.SDK_INT < 26) return
        val m = ctx.getSystemService(NotificationManager::class.java)
        if (m.getNotificationChannel("rest") == null) m.createNotificationChannel(NotificationChannel("rest", "Rest timer", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) })
        if (m.getNotificationChannel("rest_done") == null) m.createNotificationChannel(NotificationChannel("rest_done", "Rest finished", NotificationManager.IMPORTANCE_HIGH).apply { enableVibration(true); vibrationPattern = longArrayOf(0, 350, 150, 350) })
    }
    private fun open(): PendingIntent = PendingIntent.getActivity(ctx, 7, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    fun show(until: Long, title: String, next: String) {
        channels(); cancelTimer()
        val n = NotificationCompat.Builder(ctx, "rest").setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Rest · $title").setContentText(next).setOngoing(true).setOnlyAlertOnce(true)
            .setUsesChronometer(true).setChronometerCountDown(true).setWhen(until).setShowWhen(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH).setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(open()).build()
        runCatching { nm.notify(41, n) }
        done = Runnable {
            nm.cancel(41)
            if (foreground) return@Runnable  // the app is on screen and handles its own alert
            val d = NotificationCompat.Builder(ctx, "rest_done").setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("Rest over — go!").setContentText(next).setAutoCancel(true).setTimeoutAfter(60_000)
                .setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setContentIntent(open()).build()
            runCatching { nm.notify(42, d) }
        }
        h.postDelayed(done!!, (until - System.currentTimeMillis()).coerceAtLeast(0))
    }
    private fun cancelTimer() { done?.let { h.removeCallbacks(it) }; done = null }
    fun clear() { cancelTimer(); nm.cancel(41); nm.cancel(42) }
}

/** Private progress photos in filesDir/photos, served to the web UI at /photos/ (excluded from cloud backup). */
class Photos(private val ctx: Context) {
    val dir get() = File(ctx.filesDir, "photos").apply { mkdirs() }
    fun save(id: String, b64: String): JSONObject {
        val f = File(dir, safe(id) + ".jpg"); f.writeBytes(Base64.decode(b64, Base64.DEFAULT))
        return JSONObject().put("ok", true).put("url", "https://appassets.androidplatform.net/photos/" + f.name)
    }
    fun delete(id: String): JSONObject { File(dir, safe(id) + ".jpg").delete(); return JSONObject().put("ok", true) }
    private fun safe(s: String) = s.replace(Regex("[^A-Za-z0-9_-]"), "")
}

/** Home-screen widget: today's workout, readiness, streak. Data is pushed from the app. */
class ForgeWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) = render(ctx, mgr, ids)

    companion object {
        fun push(ctx: Context, data: JSONObject) {
            ctx.getSharedPreferences("forge_widget", Context.MODE_PRIVATE).edit().putString("d", data.toString()).apply()
            val mgr = AppWidgetManager.getInstance(ctx)
            render(ctx, mgr, mgr.getAppWidgetIds(ComponentName(ctx, ForgeWidget::class.java)))
        }

        fun render(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
            if (ids.isEmpty()) return
            val d = runCatching { JSONObject(ctx.getSharedPreferences("forge_widget", Context.MODE_PRIVATE).getString("d", "{}")!!) }.getOrDefault(JSONObject())
            val open = PendingIntent.getActivity(ctx, 8, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val start = PendingIntent.getActivity(ctx, 9, Intent(ctx, MainActivity::class.java).setData(Uri.parse("forgefit://localhost/start")), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            for (id in ids) {
                val v = RemoteViews(ctx.packageName, R.layout.widget_forge)
                v.setTextViewText(R.id.w_kicker, d.optString("kicker", "FORGE"))
                v.setTextViewText(R.id.w_title, d.optString("title", "Open Forge"))
                v.setTextViewText(R.id.w_sub, d.optString("sub", ""))
                v.setTextViewText(R.id.w_ready, d.optString("ready", "—"))
                v.setTextViewText(R.id.w_streak, d.optString("streak", "0"))
                v.setTextViewText(R.id.w_btn, d.optString("btn", "Open"))
                v.setOnClickPendingIntent(R.id.w_root, open)
                v.setOnClickPendingIntent(R.id.w_btn, if (d.optBoolean("canStart")) start else open)
                mgr.updateAppWidget(id, v)
            }
        }
    }
}
