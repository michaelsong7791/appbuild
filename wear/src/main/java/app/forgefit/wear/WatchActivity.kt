package app.forgefit.wear

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.max

/** Round-screen workout companion: current exercise, live heart rate, auto rep count, log set / skip rest. */
class WatchActivity : Activity() {

    private val ui = Handler(Looper.getMainLooper())
    private lateinit var tvTop: TextView
    private lateinit var tvEx: TextView
    private lateinit var tvTarget: TextView
    private lateinit var tvHr: TextView
    private lateinit var tvBig: TextView
    private lateinit var tvBigLbl: TextView
    private lateinit var btnMinus: TextView
    private lateinit var btnMain: TextView
    private lateinit var btnPlus: TextView
    private var rotaryAcc = 0f

    private val ORANGE = Color.parseColor("#FF6A33")
    private val MUTED = Color.parseColor("#8B909B")
    private val TEXT = Color.parseColor("#F2F0EA")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        val need = mutableListOf<String>()
        if (checkSelfPermission(Manifest.permission.BODY_SENSORS) != PackageManager.PERMISSION_GRANTED) need += Manifest.permission.BODY_SENSORS
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) need += Manifest.permission.POST_NOTIFICATIONS
        if (need.isNotEmpty()) requestPermissions(need.toTypedArray(), 1) else startTracking()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (checkSelfPermission(Manifest.permission.BODY_SENSORS) == PackageManager.PERMISSION_GRANTED) startTracking()
        else { tvEx.text = "Allow body sensors to track heart rate"; }
    }

    private fun startTracking() {
        try { TrackingService.start(this) } catch (e: Exception) { tvEx.text = "Couldn't start tracking: ${e.message}" }
    }

    override fun onResume() {
        super.onResume()
        WatchState.listener = { ui.post { render() } }
        ui.post(ticker)
        TrackingService.instance?.send(org.json.JSONObject().put("type", "hello"))
        render()
    }

    override fun onPause() {
        WatchState.listener = null
        ui.removeCallbacks(ticker)
        super.onPause()
    }

    override fun onDestroy() {
        // Stop sensors when the user leaves outside a workout.
        val phase = WatchState.phone?.optString("phase")
        if (phase == null || phase == "idle") TrackingService.stop(this)
        super.onDestroy()
    }

    private val ticker = object : Runnable {
        override fun run() { TrackingService.instance?.tick(); render(); ui.postDelayed(this, 1000) }
    }

    private fun render() {
        val p = WatchState.phone
        val phase = p?.optString("phase") ?: "idle"
        tvHr.text = if (WatchState.hr > 0) "♥ ${WatchState.hr}" else "♥ --"
        when (phase) {
            "work" -> {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                tvTop.text = "${p!!.optInt("exIdx")}/${p.optInt("exCount")} · ${p.optString("title").uppercase()}"
                tvEx.text = p.optString("ex")
                val w = if (p.isNull("w")) "" else fmt(p.optDouble("w")) + " " + p.optString("unit") + " × "
                tvTarget.text = "Set ${p.optInt("set")}/${p.optInt("sets")} · $w${if (p.isNull("r")) "" else p.optInt("r").toString()}"
                tvBig.text = WatchState.reps.toString(); tvBigLbl.text = if (WatchState.repsEdited) "REPS (EDITED)" else "REPS"
                btnMinus.visibility = View.VISIBLE; btnPlus.visibility = View.VISIBLE
                btnMain.text = "✓ DONE"
            }
            "rest" -> {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                val left = max(0L, p!!.optLong("restEnd") - System.currentTimeMillis()) / 1000
                tvTop.text = "REST"
                tvEx.text = "Next: " + p.optString("ex")
                tvTarget.text = "Set ${p.optInt("set")}/${p.optInt("sets")}"
                tvBig.text = "%d:%02d".format(left / 60, left % 60); tvBigLbl.text = "REMAINING"
                btnMinus.visibility = View.GONE; btnPlus.visibility = View.GONE
                btnMain.text = "SKIP ›"
            }
            else -> {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                tvTop.text = "FORGE"
                tvEx.text = "Start a workout on your phone"
                tvTarget.text = "Heart rate & reps stream automatically"
                tvBig.text = if (WatchState.hr > 0) WatchState.hr.toString() else "--"; tvBigLbl.text = "BPM"
                btnMinus.visibility = View.GONE; btnPlus.visibility = View.GONE
                btnMain.text = "SYNC"
            }
        }
    }

    private fun fmt(d: Double) = if (d % 1.0 == 0.0) d.toInt().toString() else "%.1f".format(d)

    private fun onMain() {
        val svc = TrackingService.instance
        if (svc == null) { startTracking(); return }
        when (WatchState.phone?.optString("phase")) {
            "work" -> svc.setDone()
            "rest" -> svc.skipRest()
            else -> svc.send(org.json.JSONObject().put("type", "hello"))
        }
    }

    // Rotating bezel / crown adjusts the rep count.
    override fun onGenericMotionEvent(ev: MotionEvent): Boolean {
        if (ev.action == MotionEvent.ACTION_SCROLL && ev.isFromSource(InputDevice.SOURCE_ROTARY_ENCODER)) {
            rotaryAcc += -ev.getAxisValue(MotionEvent.AXIS_SCROLL)
            if (abs(rotaryAcc) >= 1f && WatchState.phone?.optString("phase") == "work") {
                TrackingService.instance?.adjustReps(if (rotaryAcc > 0) 1 else -1); rotaryAcc = 0f
            }
            return true
        }
        return super.onGenericMotionEvent(ev)
    }
    private fun abs(f: Float) = if (f < 0) -f else f

    // ---------- UI ----------
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun label(size: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
        textSize = size; setTextColor(color); gravity = Gravity.CENTER
        if (bold) typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
        maxLines = 2
    }
    private fun pill(text: String, bg: Int, fg: Int) = TextView(this).apply {
        this.text = text; textSize = 15f; setTextColor(fg); gravity = Gravity.CENTER
        typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
        background = GradientDrawable().apply { cornerRadius = dp(22).toFloat(); setColor(bg) }
        setPadding(dp(14), 0, dp(14), 0)
    }

    private fun buildUi() {
        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
            val side = (resources.displayMetrics.widthPixels * 0.11).toInt()
            setPadding(side, dp(18), side, dp(14))
        }
        tvTop = label(11f, ORANGE, true).apply { letterSpacing = 0.1f; maxLines = 1 }
        tvEx = label(16f, TEXT, true)
        tvTarget = label(12f, MUTED)
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER }
        tvHr = label(18f, Color.parseColor("#FF5A5A"), true).apply { setPadding(0, 0, dp(14), 0) }
        val bigCol = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER }
        tvBig = label(40f, TEXT, true).apply { maxLines = 1 }
        tvBigLbl = label(9f, MUTED, true).apply { letterSpacing = 0.12f }
        bigCol.addView(tvBig); bigCol.addView(tvBigLbl)
        row.addView(tvHr); row.addView(bigCol)
        val btns = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER; setPadding(0, dp(6), 0, 0) }
        btnMinus = pill("−", Color.parseColor("#242832"), TEXT).apply { setOnClickListener { TrackingService.instance?.adjustReps(-1) } }
        btnMain = pill("✓ DONE", ORANGE, Color.parseColor("#1A0B04")).apply { setOnClickListener { onMain() } }
        btnPlus = pill("+", Color.parseColor("#242832"), TEXT).apply { setOnClickListener { TrackingService.instance?.adjustReps(1) } }
        val h = dp(44)
        btns.addView(btnMinus, LinearLayout.LayoutParams(h, h).apply { marginEnd = dp(6) })
        btns.addView(btnMain, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, h))
        btns.addView(btnPlus, LinearLayout.LayoutParams(h, h).apply { marginStart = dp(6) })
        listOf<View>(tvTop, tvEx, tvTarget, row, btns).forEach { col.addView(it) }
        root.addView(col, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)
    }
}
