package app.forgefit

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * JavaScript <-> Android bridge. JS calls ForgeNative.call(method, argsJson, callbackId);
 * results come back through window.__forgeResolve(id, ok, json). Native events go to window.__forgeEmit(type, json).
 */
class Bridge(private val act: MainActivity) {

    val health = HealthBridge(act, act)
    val strava = StravaClient(act) { type, json -> emit(type, json) }
    val wear = WearLink(act) { json -> emit("watch", json) }
    val backups = Backups(act)
    val rest = RestNotifier(act)
    val photos = Photos(act)

    private val stateFile = File(act.filesDir, "state.json")

    @JavascriptInterface
    fun saveState(json: String) {
        try {
            val tmp = File(act.filesDir, "state.json.tmp")
            tmp.writeText(json)
            if (!tmp.renameTo(stateFile)) { stateFile.writeText(json); tmp.delete() }
        } catch (_: Exception) { }
    }

    @JavascriptInterface
    fun loadState(): String? = try { if (stateFile.exists()) stateFile.readText() else null } catch (_: Exception) { null }

    @JavascriptInterface
    fun vibrate(ms: Int) = buzz(ms.toLong())

    @JavascriptInterface
    fun call(method: String, args: String, id: String) {
        act.lifecycleScope.launch {
            try {
                val a = if (args.isBlank()) JSONObject() else JSONObject(args)
                val res = dispatch(method, a)
                resolve(id, true, res.toString())
            } catch (e: Throwable) {
                resolve(id, false, JSONObject().put("error", e.message ?: e.javaClass.simpleName).toString())
            }
        }
    }

    private suspend fun dispatch(method: String, a: JSONObject): JSONObject = when (method) {
        "hc.status" -> health.status()
        "hc.requestPermissions" -> health.requestPermissions()
        "hc.readRecovery" -> health.readRecovery()
        "hc.readHeartRate" -> health.readHeartRate(a.getLong("start"), a.getLong("end"))
        "hc.writeWorkout" -> health.writeWorkout(a)
        "hc.readSessions" -> health.readSessions(a.getLong("since"))
        "hc.writeCardio" -> health.writeCardio(a)
        "hc.readBody" -> health.readBody(a.getLong("since"))
        "hc.writeBody" -> health.writeBody(a)

        "strava.status" -> strava.status()
        "strava.configure" -> strava.configure(a.getString("clientId"), a.getString("clientSecret"))
        "strava.connect" -> strava.connect()
        "strava.disconnect" -> strava.disconnect()
        "strava.upload" -> strava.upload(a)
        "strava.activities" -> strava.activities(a.getLong("since"))
        "strava.streams" -> strava.streams(a.getLong("id"))
        "strava.uploadStatus" -> strava.uploadStatus(a.getLong("uploadId"))

        "sync.schedule" -> {
            val on = a.optBoolean("on", true)
            SyncWorker.schedule(act, on, a.optInt("minutes", 15), a.optBoolean("notify", true))
            if (on && a.optBoolean("notify", true)) act.askNotificationPermission()
            JSONObject().put("ok", true)
        }
        "sync.inbox" -> Inbox.drain(act)
        "watch.status" -> wear.status()
        "watch.send" -> wear.send(a)

        "share.backup" -> shareBackup(a.getString("json"))
        "backup.status" -> backups.status()
        "backup.write" -> withContext(Dispatchers.IO) { backups.write(a.getString("json"), a.optInt("keep", 8)) }
        "backup.readPrivate" -> withContext(Dispatchers.IO) { backups.readPrivate(a.getString("name")) }
        "backup.pickFolder" -> {
            val d = kotlinx.coroutines.CompletableDeferred<Uri?>(); act.treeResult = d
            act.runOnUiThread { runCatching { act.treePicker.launch(null) }.onFailure { d.complete(null) } }
            val u = d.await(); if (u != null) backups.setTree(u); backups.status()
        }
        "backup.clearFolder" -> { backups.setTree(null); backups.status() }
        "rest.show" -> { act.runOnUiThread { rest.show(a.getLong("until"), a.optString("title"), a.optString("next")) }; JSONObject() }
        "rest.clear" -> { act.runOnUiThread { rest.clear() }; JSONObject() }
        "photos.save" -> withContext(Dispatchers.IO) { photos.save(a.getString("id"), a.getString("b64")) }
        "photos.delete" -> withContext(Dispatchers.IO) { photos.delete(a.getString("id")) }
        "widget.update" -> { ForgeWidget.push(act, a); JSONObject() }
        "media.saveImage" -> saveImage(a.getString("b64"), a.getString("name"))
        "media.shareImage" -> shareImage(a.getString("b64"), a.getString("name"), a.optString("text"))
        "app.keepAwake" -> { act.setKeepAwake(a.optBoolean("on")); JSONObject() }
        "app.vibrate" -> { buzz(a.optLong("ms", 80)); JSONObject() }
        "app.openUrl" -> { act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(a.getString("url")))); JSONObject() }
        else -> throw IllegalArgumentException("Unknown method $method")
    }

    private suspend fun shareBackup(json: String): JSONObject {
        val file = withContext(Dispatchers.IO) {
            val dir = File(act.cacheDir, "exports").apply { mkdirs() }
            val stamp = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
            File(dir, "forge-backup-$stamp.json").apply { writeText(json) }
        }
        val uri = FileProvider.getUriForFile(act, act.packageName + ".files", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "application/json"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        act.startActivity(Intent.createChooser(send, "Save Forge backup"))
        return JSONObject().put("ok", true)
    }

    /** Save a PNG to Pictures/Forge (shows up in Gallery and in Strava's photo picker). Android 9 has no scoped
        MediaStore path without a storage permission, so it reports saved=false and the app falls back to sharing. */
    private suspend fun saveImage(b64: String, name: String): JSONObject = withContext(Dispatchers.IO) {
        val bytes = Base64.decode(b64, Base64.DEFAULT)
        if (Build.VERSION.SDK_INT >= 29) {
            val v = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, name)
                put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Forge")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
            val uri = act.contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v)
                ?: throw IllegalStateException("Could not save the image")
            act.contentResolver.openOutputStream(uri)!!.use { it.write(bytes) }
            v.clear(); v.put(MediaStore.Images.Media.IS_PENDING, 0)
            act.contentResolver.update(uri, v, null, null)
            JSONObject().put("ok", true).put("saved", true).put("uri", uri.toString())
        } else JSONObject().put("ok", true).put("saved", false)
    }

    private suspend fun shareImage(b64: String, name: String, text: String): JSONObject {
        val file = withContext(Dispatchers.IO) {
            val dir = File(act.cacheDir, "exports").apply { mkdirs() }
            File(dir, name).apply { writeBytes(Base64.decode(b64, Base64.DEFAULT)) }
        }
        val uri = FileProvider.getUriForFile(act, act.packageName + ".files", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            if (text.isNotBlank()) putExtra(Intent.EXTRA_TEXT, text)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        act.startActivity(Intent.createChooser(send, "Share muscle map"))
        return JSONObject().put("ok", true)
    }

    private fun buzz(ms: Long) {
        try {
            val v: Vibrator = if (Build.VERSION.SDK_INT >= 31)
                (act.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
            else act.getSystemService(Vibrator::class.java)
            v.vibrate(VibrationEffect.createOneShot(ms.coerceIn(10, 2000), VibrationEffect.DEFAULT_AMPLITUDE))
        } catch (_: Exception) { }
    }

    private fun resolve(id: String, ok: Boolean, json: String) = act.runOnUiThread {
        act.web.evaluateJavascript("window.__forgeResolve(${JSONObject.quote(id)},$ok,${JSONObject.quote(json)})", null)
    }

    fun emit(type: String, json: String) = act.runOnUiThread {
        act.web.evaluateJavascript("window.__forgeEmit && window.__forgeEmit(${JSONObject.quote(type)},${JSONObject.quote(json)})", null)
    }
}
