package app.forgefit.wear

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sign
import kotlin.math.sqrt

/**
 * Foreground service that keeps heart-rate + motion sensors running during a workout,
 * counts reps from wrist motion, and streams everything to the phone over the Wear Data Layer.
 */
class TrackingService : Service(), SensorEventListener, MessageClient.OnMessageReceivedListener {

    companion object {
        const val PATH_STATE = "/forge/state"
        const val PATH_EVT = "/forge/evt"
        private const val CHANNEL = "forge_tracking"
        @Volatile var instance: TrackingService? = null

        fun start(ctx: Context) {
            // Started from the visible activity, so a plain start is allowed; the service promotes
            // itself to foreground when the system permits (never crashes if it doesn't).
            ctx.startService(Intent(ctx, TrackingService::class.java))
        }
        fun stop(ctx: Context) { ctx.stopService(Intent(ctx, TrackingService::class.java)) }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var sm: SensorManager
    private val messages by lazy { Wearable.getMessageClient(this) }
    private var phoneNode: String? = null

    // gravity + rep detector state
    private val g = FloatArray(3)
    private var ema = 0f
    private var detState = 0
    private var detSign = 1f
    private var curPeak = 0f
    private var avgPeak = 2.0f
    private var lastRepMs = 0L
    private var firstCrossMs = 0L
    private var lastHrSent = 0L
    private var restBuzzed = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        sm = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        startInForeground()
        try { sm.getDefaultSensor(Sensor.TYPE_HEART_RATE)?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) } } catch (e: SecurityException) { WatchState.fgError = "Heart-rate permission missing" }
        sm.getDefaultSensor(Sensor.TYPE_GRAVITY)?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        sm.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION)?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        runCatching { messages.addListener(this) }
        send(JSONObject().put("type", "hello"))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY

    override fun onDestroy() {
        runCatching { sm.unregisterListener(this) }
        runCatching { messages.removeListener(this) }
        scope.cancel()
        instance = null
        super.onDestroy()
    }

    private fun startInForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Workout tracking", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, WatchActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val n: Notification = Notification.Builder(this, CHANNEL)
            .setContentTitle("Forge")
            .setContentText("Tracking heart rate & reps")
            .setSmallIcon(R.drawable.ic_launcher_fg)
            .setOngoing(true)
            .setContentIntent(open)
            .build()
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
            else startForeground(1, n)
            WatchState.fgError = null
        } catch (e: Exception) {
            // Keep tracking while the app is open even if background tracking isn't permitted.
            WatchState.fgError = e.javaClass.simpleName + ": " + (e.message ?: "")
        }
    }

    // ---------- Phone link ----------
    override fun onMessageReceived(e: MessageEvent) {
        if (e.path != PATH_STATE) return
        phoneNode = e.sourceNodeId
        val st = runCatching { JSONObject(String(e.data, Charsets.UTF_8)) }.getOrNull() ?: return
        val prev = WatchState.phone
        val key = st.optString("phase") + "|" + st.optInt("exIdx") + "|" + st.optInt("set")
        val prevKey = prev?.let { it.optString("phase") + "|" + it.optInt("exIdx") + "|" + it.optInt("set") }
        if (key != prevKey) { resetReps(); restBuzzed = false }
        WatchState.phone = st
        WatchState.notifyChanged()
    }

    fun send(o: JSONObject) {
        scope.launch {
            try {
                val bytes = o.toString().toByteArray(Charsets.UTF_8)
                val target = phoneNode ?: Wearable.getNodeClient(this@TrackingService).connectedNodes.await().firstOrNull()?.id?.also { phoneNode = it }
                if (target != null) messages.sendMessage(target, PATH_EVT, bytes).await()
            } catch (_: Exception) { phoneNode = null }
        }
    }

    fun setDone() {
        send(JSONObject().put("type", "setDone").put("reps", WatchState.reps))
        buzz(60)
    }
    fun skipRest() = send(JSONObject().put("type", "skipRest"))
    fun adjustReps(d: Int) { WatchState.reps = max(0, WatchState.reps + d); WatchState.repsEdited = true; WatchState.notifyChanged() }

    private fun resetReps() {
        WatchState.reps = 0; WatchState.repsEdited = false
        detState = 0; ema = 0f; lastRepMs = 0L; firstCrossMs = 0L
    }

    /** Called ~1 Hz by the activity while visible; buzzes when the phone's rest timer ends. */
    fun tick() {
        val p = WatchState.phone ?: return
        if (p.optString("phase") == "rest" && !restBuzzed && System.currentTimeMillis() >= p.optLong("restEnd")) {
            restBuzzed = true; buzz(450)
        }
    }

    // ---------- Sensors ----------
    override fun onSensorChanged(e: SensorEvent) {
        when (e.sensor.type) {
            Sensor.TYPE_HEART_RATE -> {
                val bpm = e.values[0].toInt()
                if (bpm in 30..240) {
                    WatchState.hr = bpm; WatchState.notifyChanged()
                    val now = System.currentTimeMillis()
                    if (now - lastHrSent >= 2000) { lastHrSent = now; send(JSONObject().put("type", "hr").put("bpm", bpm).put("t", now)) }
                }
            }
            Sensor.TYPE_GRAVITY -> { g[0] = e.values[0]; g[1] = e.values[1]; g[2] = e.values[2] }
            Sensor.TYPE_LINEAR_ACCELERATION -> detectRep(e.values, e.timestamp / 1_000_000L)
        }
    }

    /** Vertical-axis rep detector: one rep = excursion past +thr, then past -thr, then back toward zero. */
    private fun detectRep(v: FloatArray, tMs: Long) {
        if (WatchState.phone?.optString("phase") != "work") return
        val gn = sqrt(g[0] * g[0] + g[1] * g[1] + g[2] * g[2])
        if (gn < 1f) return
        val av = (v[0] * g[0] + v[1] * g[1] + v[2] * g[2]) / gn
        ema = 0.25f * av + 0.75f * ema
        val thr = max(0.7f, 0.35f * avgPeak)
        when (detState) {
            0 -> if (abs(ema) > thr) { detState = 1; detSign = sign(ema); curPeak = abs(ema); if (firstCrossMs == 0L) firstCrossMs = tMs }
            1 -> { curPeak = max(curPeak, abs(ema)); if (ema * detSign < -thr) detState = 2 }
            2 -> {
                curPeak = max(curPeak, abs(ema))
                if (ema * detSign > -thr * 0.3f) {
                    val since = if (lastRepMs == 0L) tMs - firstCrossMs else tMs - lastRepMs
                    if (since in 600..9000) {
                        lastRepMs = tMs
                        avgPeak = 0.7f * avgPeak + 0.3f * curPeak
                        if (!WatchState.repsEdited) {
                            WatchState.reps += 1
                            send(JSONObject().put("type", "rep").put("n", WatchState.reps).put("dur", since).put("peak", curPeak.toDouble()))
                            WatchState.notifyChanged()
                        }
                    } else if (since > 9000) { lastRepMs = tMs }
                    detState = 0
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun buzz(ms: Long) {
        runCatching { getSystemService(Vibrator::class.java).vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)) }
    }
}

/** Shared in-memory state between the service and the UI. */
object WatchState {
    @Volatile var phone: JSONObject? = null
    @Volatile var hr: Int = 0
    @Volatile var reps: Int = 0
    @Volatile var repsEdited: Boolean = false
    @Volatile var fgError: String? = null
    var listener: (() -> Unit)? = null
    fun notifyChanged() { listener?.invoke() }
}
