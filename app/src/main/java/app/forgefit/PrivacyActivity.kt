package app.forgefit

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.ScrollView
import android.widget.TextView

/** Shown by Health Connect when the user asks why Forge wants health permissions. */
class PrivacyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (24 * resources.displayMetrics.density).toInt()
        val tv = TextView(this).apply {
            setTextColor(Color.parseColor("#F2F0EA"))
            textSize = 16f
            gravity = Gravity.START
            setPadding(pad, pad * 2, pad, pad)
            text = """
                Forge — how your health data is used

                • Sleep, resting heart rate and HRV (from Samsung Health / your Galaxy Watch) are read to calculate a daily readiness score and adjust muscle-recovery estimates.
                • Heart rate during a workout is read to show effort and heart-rate recovery between sets.
                • Steps are read for context on your activity level.
                • Finished workouts, workout heart rate and estimated calories are written so they appear in Samsung Health.

                Everything is processed on this phone. Forge has no server and never sends health data anywhere, except workouts you choose to upload to your own Strava account.

                You can revoke access at any time in Settings → Health Connect.
            """.trimIndent()
        }
        setContentView(ScrollView(this).apply { setBackgroundColor(Color.parseColor("#0A0B0E")); addView(tv) })
    }
}
