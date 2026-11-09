package app.forgefit

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
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

    val health = HealthBridge(act)
    val strava = StravaClient(act) { type, json -> emit(type, json) }
    val wear = WearLink(act) { json -> emit("watch", json) }

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

        "watch.status" -> wear.status()
        "watch.send" -> wear.send(a)

        "share.backup" -> shareBackup(a.getString("json"))
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
