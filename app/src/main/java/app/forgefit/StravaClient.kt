package app.forgefit

import android.content.Context
import android.content.Intent
import android.net.Uri
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Strava OAuth (mobile flow) + uploads. The user supplies their own Strava API app keys
 * (Authorization Callback Domain = "localhost"); redirect comes back as forgefit://localhost/strava.
 */
class StravaClient(private val ctx: Context, private val emit: (String, String) -> Unit) {

    private val prefs = ctx.getSharedPreferences("strava", Context.MODE_PRIVATE)
    private val redirect = "forgefit://localhost/strava"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    fun status(): JSONObject = JSONObject()
        .put("configured", !prefs.getString("clientId", null).isNullOrBlank())
        .put("connected", !prefs.getString("refresh", null).isNullOrBlank())
        .put("athlete", prefs.getString("athlete", null))

    fun configure(clientId: String, secret: String): JSONObject {
        prefs.edit().putString("clientId", clientId).putString("secret", secret).apply()
        return JSONObject().put("ok", true)
    }

    fun connect(): JSONObject {
        val id = prefs.getString("clientId", null) ?: throw IllegalStateException("Add your Strava Client ID first")
        val url = Uri.parse("https://www.strava.com/oauth/mobile/authorize").buildUpon()
            .appendQueryParameter("client_id", id)
            .appendQueryParameter("redirect_uri", redirect)
            .appendQueryParameter("response_type", "code")
            .appendQueryParameter("approval_prompt", "auto")
            .appendQueryParameter("scope", "read,activity:write,activity:read_all")
            .build()
        ctx.startActivity(Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return JSONObject().put("opened", true)
    }

    fun disconnect(): JSONObject {
        prefs.edit().remove("access").remove("refresh").remove("expires").remove("athlete").apply()
        return JSONObject().put("ok", true)
    }

    /** Called from MainActivity when forgefit://localhost/strava?code=... arrives. */
    fun handleRedirect(uri: Uri) {
        val err = uri.getQueryParameter("error")
        val code = uri.getQueryParameter("code")
        if (err != null || code == null) { emit("strava", JSONObject().put("error", err ?: "Authorization cancelled").toString()); return }
        val granted = uri.getQueryParameter("scope") ?: ""
        scope.launch {
            try {
                val tok = withContext(Dispatchers.IO) {
                    postForm("https://www.strava.com/oauth/token", mapOf(
                        "client_id" to prefs.getString("clientId", "")!!,
                        "client_secret" to prefs.getString("secret", "")!!,
                        "code" to code, "grant_type" to "authorization_code",
                    ))
                }
                saveToken(tok)
                val name = tok.optJSONObject("athlete")?.optString("firstname")
                prefs.edit().putString("athlete", name).apply()
                if (!granted.contains("activity:write")) emit("strava", JSONObject().put("error", "Upload permission was not granted — reconnect and allow it").toString())
                else emit("strava", JSONObject().put("connected", true).put("athlete", name).toString())
            } catch (e: Exception) {
                emit("strava", JSONObject().put("error", e.message ?: "Token exchange failed").toString())
            }
        }
    }

    private fun saveToken(t: JSONObject) {
        prefs.edit()
            .putString("access", t.getString("access_token"))
            .putString("refresh", t.getString("refresh_token"))
            .putLong("expires", t.getLong("expires_at"))
            .apply()
    }

    private suspend fun token(): String = withContext(Dispatchers.IO) {
        val exp = prefs.getLong("expires", 0)
        if (System.currentTimeMillis() / 1000 < exp - 120) return@withContext prefs.getString("access", "")!!
        val refresh = prefs.getString("refresh", null) ?: throw IllegalStateException("Strava is not connected")
        val t = postForm("https://www.strava.com/oauth/token", mapOf(
            "client_id" to prefs.getString("clientId", "")!!,
            "client_secret" to prefs.getString("secret", "")!!,
            "grant_type" to "refresh_token", "refresh_token" to refresh,
        ))
        saveToken(t)
        t.getString("access_token")
    }

    /** Upload a workout. With heart-rate samples → TCX file upload (keeps the HR graph); otherwise a manual activity. */
    suspend fun upload(a: JSONObject): JSONObject {
        val access = token()
        val start = a.getLong("start"); val end = a.getLong("end")
        val name = a.optString("name", "Strength training")
        val desc = a.optString("description")
        val hr = a.optJSONArray("hr")
        val sport = a.optString("sportType", "WeightTraining").ifBlank { "WeightTraining" }
        val distM = a.optDouble("distM", 0.0)
        return withContext(Dispatchers.IO) {
            if (hr != null && hr.length() >= 10) {
                val tcx = buildTcx(start, end, a.optDouble("kcal", 0.0), hr)
                val up = postMultipart(
                    "https://www.strava.com/api/v3/uploads", access,
                    mapOf("data_type" to "tcx", "name" to name, "description" to desc, "external_id" to "forge-" + a.optString("id") + ".tcx"),
                    "file", "forge.tcx", tcx.toByteArray(),
                )
                val uploadId = up.getLong("id")
                var activityId = 0L
                for (i in 0 until 15) {
                    delay(2000)
                    val st = getJson("https://www.strava.com/api/v3/uploads/$uploadId", access)
                    if (!st.isNull("error") && st.optString("error").isNotBlank()) throw IllegalStateException(st.optString("error"))
                    activityId = st.optLong("activity_id", 0)
                    if (activityId > 0) break
                }
                if (activityId > 0) {
                    runCatching { putForm("https://www.strava.com/api/v3/activities/$activityId", access, mapOf("sport_type" to sport, "name" to name, "description" to desc)) }
                    JSONObject().put("ok", true).put("activityId", activityId)
                } else JSONObject().put("ok", true).put("pending", true)
            } else {
                val local = LocalDateTime.ofInstant(Instant.ofEpochMilli(start), ZoneId.systemDefault())
                val form = mutableMapOf(
                    "name" to name, "sport_type" to sport,
                    "start_date_local" to local.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                    "elapsed_time" to ((end - start) / 1000).coerceAtLeast(60).toString(),
                    "description" to desc,
                )
                if (distM > 0) form["distance"] = distM.toString()
                val res = postForm("https://www.strava.com/api/v3/activities", form, access)
                JSONObject().put("ok", true).put("activityId", res.optLong("id"))
            }
        }
    }

    /** Recent activities (for importing runs/rides/swims into Forge). Skips ones Forge uploaded. */
    suspend fun activities(since: Long): JSONObject {
        val access = token()
        return withContext(Dispatchers.IO) {
            val c = URL("https://www.strava.com/api/v3/athlete/activities?per_page=60&after=" + (since / 1000)).openConnection() as HttpURLConnection
            val text = try {
                c.setRequestProperty("Authorization", "Bearer $access")
                c.connectTimeout = 15000; c.readTimeout = 30000
                if (c.responseCode !in 200..299) throw IllegalStateException("Strava ${c.responseCode}")
                c.inputStream.bufferedReader().use { it.readText() }
            } finally { c.disconnect() }
            val src = org.json.JSONArray(text); val out = org.json.JSONArray()
            for (i in 0 until src.length()) {
                val x = src.getJSONObject(i)
                if (x.optString("external_id").startsWith("forge-") || x.optString("name").startsWith("Forge ·")) continue
                val type = when (x.optString("sport_type", x.optString("type"))) {
                    "Run", "TrailRun" -> "run"; "VirtualRun" -> "run_tread"; "Walk" -> "walk"; "Hike" -> "hike"
                    "Ride", "GravelRide", "MountainBikeRide", "EBikeRide" -> "cycle"; "VirtualRide" -> "cycle_indoor"
                    "Swim" -> "swim"; "Rowing", "VirtualRow" -> "row"; "Elliptical" -> "elliptical"; "StairStepper" -> "stairs"
                    "HighIntensityIntervalTraining", "Crossfit" -> "hiit"; "Yoga", "Pilates" -> "yoga"
                    "WeightTraining" -> null
                    "Soccer", "Tennis", "Badminton", "Basketball", "Volleyball", "Squash", "Pickleball" -> "sport"
                    else -> "other"
                } ?: continue
                val start = runCatching { Instant.parse(x.getString("start_date")).toEpochMilli() }.getOrNull() ?: continue
                val o = JSONObject().put("id", x.optLong("id")).put("type", type).put("start", start)
                    .put("elapsed", x.optInt("elapsed_time")).put("moving", x.optInt("moving_time"))
                    .put("distM", x.optDouble("distance", 0.0)).put("name", x.optString("name"))
                if (x.has("average_heartrate")) o.put("hrAvg", x.optDouble("average_heartrate"))
                if (x.has("average_watts")) o.put("watts", x.optDouble("average_watts"))
                if (x.has("kilojoules")) o.put("kcal", x.optDouble("kilojoules")) // cycling: kJ of work ≈ kcal burned (~24% efficiency)
                out.put(o)
            }
            JSONObject().put("activities", out)
        }
    }

    private fun buildTcx(start: Long, end: Long, kcal: Double, hr: org.json.JSONArray): String {
        val iso = DateTimeFormatter.ISO_INSTANT
        fun t(ms: Long) = iso.format(Instant.ofEpochMilli(ms))
        val sb = StringBuilder()
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
        sb.append("<TrainingCenterDatabase xmlns=\"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2\">")
        sb.append("<Activities><Activity Sport=\"Other\"><Id>").append(t(start)).append("</Id>")
        sb.append("<Lap StartTime=\"").append(t(start)).append("\"><TotalTimeSeconds>").append((end - start) / 1000).append("</TotalTimeSeconds>")
        sb.append("<DistanceMeters>0</DistanceMeters><Calories>").append(kcal.toInt()).append("</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>")
        for (i in 0 until hr.length()) {
            val s = hr.getJSONObject(i)
            sb.append("<Trackpoint><Time>").append(t(s.getLong("t"))).append("</Time><HeartRateBpm><Value>").append(s.getInt("bpm")).append("</Value></HeartRateBpm></Trackpoint>")
        }
        sb.append("</Track></Lap></Activity></Activities></TrainingCenterDatabase>")
        return sb.toString()
    }

    // ---------- tiny HTTP helpers ----------
    private fun enc(m: Map<String, String>) = m.entries.joinToString("&") { URLEncoder.encode(it.key, "UTF-8") + "=" + URLEncoder.encode(it.value, "UTF-8") }

    private fun postForm(url: String, form: Map<String, String>, bearer: String? = null) = send("POST", url, bearer, "application/x-www-form-urlencoded", enc(form).toByteArray())
    private fun putForm(url: String, bearer: String, form: Map<String, String>) = send("PUT", url, bearer, "application/x-www-form-urlencoded", enc(form).toByteArray())
    private fun getJson(url: String, bearer: String) = send("GET", url, bearer, null, null)

    private fun postMultipart(url: String, bearer: String, fields: Map<String, String>, fileField: String, fileName: String, data: ByteArray): JSONObject {
        val b = "----forge" + System.currentTimeMillis()
        val out = ByteArrayOutputStream()
        fields.forEach { (k, v) -> out.write("--$b\r\nContent-Disposition: form-data; name=\"$k\"\r\n\r\n$v\r\n".toByteArray()) }
        out.write("--$b\r\nContent-Disposition: form-data; name=\"$fileField\"; filename=\"$fileName\"\r\nContent-Type: application/xml\r\n\r\n".toByteArray())
        out.write(data)
        out.write("\r\n--$b--\r\n".toByteArray())
        return send("POST", url, bearer, "multipart/form-data; boundary=$b", out.toByteArray())
    }

    private fun send(method: String, url: String, bearer: String?, contentType: String?, body: ByteArray?): JSONObject {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method
            c.connectTimeout = 15000; c.readTimeout = 30000
            c.setRequestProperty("Accept", "application/json")
            if (bearer != null) c.setRequestProperty("Authorization", "Bearer $bearer")
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", contentType)
                c.outputStream.use { it.write(body) }
            }
            val code = c.responseCode
            val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) {
                val msg = runCatching { JSONObject(text).optString("message") }.getOrNull()
                throw IllegalStateException("Strava $code${if (!msg.isNullOrBlank()) ": $msg" else ""}")
            }
            return if (text.isBlank()) JSONObject() else JSONObject(text)
        } finally { c.disconnect() }
    }
}
