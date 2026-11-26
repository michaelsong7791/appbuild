package app.forgefit.installer

import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Bundle
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Installs the Forge watch app (or any APK) onto a Wear OS watch over Wi-Fi using the watch's
 * Wireless debugging (ADB pairing + TLS), the same way Android Studio / Bugjaeger do — no PC needed.
 */
class MainActivity : ComponentActivity() {
    private val bg = Color.parseColor("#0A0B0E"); private val card = Color.parseColor("#13151A")
    private val line = Color.parseColor("#2A2E38"); private val fg = Color.parseColor("#F2F0EA")
    private val muted = Color.parseColor("#8B909B"); private val accent = Color.parseColor("#FF6A33")
    private val green = Color.parseColor("#2FD3A8"); private val red = Color.parseColor("#FF6B6B")

    private lateinit var ip: EditText; private lateinit var pairPort: EditText; private lateinit var code: EditText
    private lateinit var connPort: EditText; private lateinit var found: TextView; private lateinit var status: TextView
    private lateinit var apkLabel: TextView; private lateinit var bar: ProgressBar; private lateinit var log: TextView
    private lateinit var installBtn: Button; private lateinit var connectBtn: Button; private lateinit var pairBtn: Button
    private var customApk: Uri? = null
    private var connected = false
    private val prefs by lazy { getSharedPreferences("inst", Context.MODE_PRIVATE) }

    private val pickApk = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) { customApk = uri; apkLabel.text = "Selected: " + (uri.lastPathSegment?.substringAfterLast('/') ?: "APK file") }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(22), dp(18), dp(40)) }
        setContentView(ScrollView(this).apply { setBackgroundColor(bg); addView(col) })

        col.addView(tv("FORGE", 12f, accent, bold = true).apply { letterSpacing = .15f })
        col.addView(tv("Watch Installer", 28f, fg, bold = true))
        col.addView(tv("Installs Forge on your Galaxy Watch over Wi-Fi — no computer needed.", 14f, muted).apply { setPadding(0, dp(2), 0, dp(14)) })

        // ---- Step 1
        col.addView(section("1 · On the watch", listOf(
            "Settings › About watch › Software info › tap Software version 5 times (Developer mode on).",
            "Settings › Developer options › turn on ADB debugging and Wireless debugging.",
            "Make sure the watch is on the SAME Wi-Fi as this phone (Settings › Connections › Wi-Fi — set it to Always on for now).",
            "In Wireless debugging tap Pair new device: it shows a 6-digit code and an IP:port.",
        )))

        // ---- Step 2 pair
        val s2 = box(); col.addView(s2)
        s2.addView(tv("2 · Pair (once)", 17f, fg, bold = true))
        found = tv("Searching for the watch on this Wi-Fi…", 13f, muted).apply { setPadding(0, dp(4), 0, dp(8)) }; s2.addView(found)
        ip = field("Watch IP (e.g. 192.168.1.23)", prefs.getString("ip", "") ?: "", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI); s2.addView(ip)
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        pairPort = field("Pairing port", "", InputType.TYPE_CLASS_NUMBER); code = field("6-digit code", "", InputType.TYPE_CLASS_NUMBER)
        row.addView(pairPort, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { marginEnd = dp(8) }); row.addView(code, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        s2.addView(row)
        pairBtn = btn("Pair with watch", true) { pair() }; s2.addView(pairBtn)

        // ---- Step 3 connect
        val s3 = box(); col.addView(s3)
        s3.addView(tv("3 · Connect", 17f, fg, bold = true))
        s3.addView(tv("Use the IP address & Port shown at the top of the watch's Wireless debugging screen (different from the pairing port).", 13f, muted).apply { setPadding(0, dp(4), 0, dp(8)) })
        connPort = field("Connect port", prefs.getString("cport", "") ?: "", InputType.TYPE_CLASS_NUMBER); s3.addView(connPort)
        connectBtn = btn("Connect", true) { connect() }; s3.addView(connectBtn)

        // ---- Step 4 install
        val s4 = box(); col.addView(s4)
        s4.addView(tv("4 · Install", 17f, fg, bold = true))
        apkLabel = tv(if (hasBundled()) "Bundled: Forge watch v" + BuildConfig.WATCH_VERSION else "No bundled APK — choose one", 13f, muted).apply { setPadding(0, dp(4), 0, dp(8)) }; s4.addView(apkLabel)
        s4.addView(btn("Choose a different APK…", false) { pickApk.launch(arrayOf("application/vnd.android.package-archive", "application/octet-stream", "*/*")) })
        installBtn = btn("Install on watch", true) { install() }; s4.addView(installBtn)
        bar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; visibility = View.GONE; progressTintList = android.content.res.ColorStateList.valueOf(accent) }
        s4.addView(bar, LinearLayout.LayoutParams(MATCH_PARENT, dp(10)).apply { topMargin = dp(10) })
        s4.addView(btn("Uninstall Forge from watch (fixes signature errors)", false) { uninstall() })

        status = tv("", 15f, fg, bold = true).apply { setPadding(0, dp(16), 0, dp(4)) }; col.addView(status)
        log = tv("", 12f, muted).apply { typeface = Typeface.MONOSPACE; setTextIsSelectable(true) }; col.addView(log)

        discover()
    }

    // ---------------- ADB ----------------
    private fun mgr() = AdbConnectionManager.getInstance(applicationContext)

    private fun pair() = run("Pairing…", pairBtn) {
        val host = ip.text.toString().trim(); val port = pairPort.text.toString().trim().toInt(); val c = code.text.toString().trim()
        require(host.isNotEmpty() && c.length == 6) { "Enter the watch IP, pairing port and 6-digit code" }
        prefs.edit().putString("ip", host).apply()
        val ok = withTimeout(30_000) { mgr().pair(host, port, c) }
        if (!ok) throw IllegalStateException("Pairing failed — check the code (it changes each time you open Pair new device)")
        "✅ Paired. Now connect (step 3)."
    }

    private fun connect() = run("Connecting…", connectBtn) {
        val host = ip.text.toString().trim(); val port = connPort.text.toString().trim().toInt()
        prefs.edit().putString("ip", host).putString("cport", port.toString()).apply()
        val m = mgr()
        if (m.isConnected) runCatching { m.disconnect() }
        m.setTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        if (!m.connect(host, port)) throw IllegalStateException("Could not connect")
        connected = true
        val model = exec("getprop ro.product.model").trim(); val sdk = exec("getprop ro.build.version.sdk").trim()
        "✅ Connected to " + (model.ifEmpty { "watch" }) + " (Android API $sdk)"
    }

    private fun install() = run("Installing…", installBtn) {
        ensureConnected()
        val bytes = withContext(Dispatchers.IO) {
            customApk?.let { contentResolver.openInputStream(it)!!.use { s -> s.readBytes() } } ?: assets.open("forge-watch.apk").use { it.readBytes() }
        }
        say("Sending ${bytes.size / 1024} KB…")
        val res = withContext(Dispatchers.IO) {
            val s = mgr().openStream("exec:cmd package install -r -S ${bytes.size}")
            val out = s.openOutputStream(); var off = 0
            while (off < bytes.size) {
                val n = minOf(64 * 1024, bytes.size - off); out.write(bytes, off, n); off += n
                val pct = off * 100 / bytes.size; runOnUiThread { bar.visibility = View.VISIBLE; bar.progress = pct }
            }
            out.flush()
            val r = s.openInputStream().bufferedReader().readText(); runCatching { s.close() }; r.trim()
        }
        say("Watch says: $res")
        when {
            res.contains("Success") -> "✅ Installed! Open Forge on the watch (swipe up for the app list)."
            res.contains("UPDATE_INCOMPATIBLE") || res.contains("SIGNATURE") -> throw IllegalStateException("A differently-signed Forge is already on the watch. Tap Uninstall below, then Install again.")
            res.contains("INSUFFICIENT_STORAGE") -> throw IllegalStateException("Not enough storage on the watch.")
            else -> throw IllegalStateException("Install failed: $res")
        }
    }

    private fun uninstall() = run("Uninstalling…", null) {
        ensureConnected()
        val r = exec("cmd package uninstall app.forgefit").trim()
        say("Watch says: $r")
        if (r.contains("Success")) "Old Forge removed from the watch. Now tap Install." else "Nothing to uninstall ($r)"
    }

    private suspend fun ensureConnected() {
        if (connected && mgr().isConnected) return
        say("Not connected — connecting…")
        val host = ip.text.toString().trim(); val port = connPort.text.toString().trim().toIntOrNull() ?: throw IllegalStateException("Connect first (step 3)")
        withContext(Dispatchers.IO) { if (!mgr().connect(host, port)) throw IllegalStateException("Could not connect") }
        connected = true
    }

    private suspend fun exec(cmd: String): String = withContext(Dispatchers.IO) {
        val s = mgr().openStream("exec:$cmd"); val r = s.openInputStream().bufferedReader().readText(); runCatching { s.close() }; r
    }

    private fun run(busy: String, b: Button?, block: suspend () -> String) {
        b?.isEnabled = false; setStatus(busy, fg)
        lifecycleScope.launch {
            try { val msg = withContext(Dispatchers.IO) { block() }; setStatus(msg, green) }
            catch (e: Throwable) {
                val m = e.message ?: e.javaClass.simpleName
                setStatus("⚠️ " + hint(m), red); say(e.javaClass.simpleName + ": " + m)
            } finally { b?.isEnabled = true; bar.visibility = View.GONE }
        }
    }

    private fun hint(m: String) = when {
        m.contains("ECONNREFUSED") || m.contains("Connection refused") -> "Connection refused — check the IP and port, and that Wireless debugging is still on (ports change each time it's toggled)."
        m.contains("timeout", true) || m.contains("EHOSTUNREACH") || m.contains("No route") -> "Can't reach the watch — is it on the same Wi-Fi as the phone, with Wi-Fi set to Always on?"
        m.contains("pairing", true) && m.contains("required", true) -> "Pair first (step 2)."
        m.contains("unauthor", true) -> "Not authorised — pair again (step 2)."
        else -> m
    }

    // ---------------- auto-discovery (mDNS) ----------------
    private var nsd: NsdManager? = null
    private val resolveQ = ConcurrentLinkedQueue<NsdServiceInfo>(); @Volatile private var resolving = false
    private fun discover() {
        val n = getSystemService(NsdManager::class.java) ?: return; nsd = n
        for (type in listOf("_adb-tls-pairing._tcp", "_adb-tls-connect._tcp")) runCatching {
            n.discoverServices(type, NsdManager.PROTOCOL_DNS_SD, object : NsdManager.DiscoveryListener {
                override fun onServiceFound(si: NsdServiceInfo) { resolveQ.add(si); nextResolve() }
                override fun onServiceLost(si: NsdServiceInfo) {}
                override fun onDiscoveryStarted(t: String) {}
                override fun onDiscoveryStopped(t: String) {}
                override fun onStartDiscoveryFailed(t: String, e: Int) {}
                override fun onStopDiscoveryFailed(t: String, e: Int) {}
            })
        }
    }
    @Suppress("DEPRECATION")
    private fun nextResolve() {
        if (resolving) return; val si = resolveQ.poll() ?: return; resolving = true
        nsd?.resolveService(si, object : NsdManager.ResolveListener {
            override fun onResolveFailed(s: NsdServiceInfo, e: Int) { resolving = false; nextResolve() }
            override fun onServiceResolved(s: NsdServiceInfo) {
                resolving = false
                val host = s.host?.hostAddress?.takeIf { !it.contains(':') } // skip IPv6
                runOnUiThread {
                    if (host != null) {
                        val isPair = s.serviceType.contains("pairing")
                        ip.setText(host)
                        if (isPair) pairPort.setText(s.port.toString()) else connPort.setText(s.port.toString())
                        found.text = "📡 Found a device at $host — " + (if (isPair) "pairing port ${s.port} filled in; enter the code" else "connect port ${s.port} filled in")
                        found.setTextColor(green)
                    }
                }
                nextResolve()
            }
        })
    }

    // ---------------- UI helpers ----------------
    private fun hasBundled() = runCatching { assets.open("forge-watch.apk").close(); true }.getOrDefault(false)
    private fun setStatus(s: String, c: Int) = runOnUiThread { status.text = s; status.setTextColor(c) }
    private fun say(s: String) = runOnUiThread { log.append(s + "\n") }
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun tv(s: String, size: Float, c: Int, bold: Boolean = false) = TextView(this).apply { text = s; textSize = size; setTextColor(c); if (bold) setTypeface(typeface, Typeface.BOLD) }
    private fun rounded(c: Int, stroke: Int? = null, r: Int = 16) = GradientDrawable().apply { setColor(c); cornerRadius = dp(r).toFloat(); stroke?.let { setStroke(dp(1), it) } }
    private fun box() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; background = rounded(card, line); setPadding(dp(16), dp(14), dp(16), dp(16))
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(12) }
    }
    private fun section(title: String, steps: List<String>) = box().apply {
        addView(tv(title, 17f, fg, bold = true))
        steps.forEachIndexed { i, s -> addView(tv("${i + 1}.  $s", 14f, muted).apply { setPadding(0, dp(6), 0, 0) }) }
    }
    private fun field(hint: String, value: String, type: Int) = EditText(this).apply {
        this.hint = hint; setText(value); inputType = type; setTextColor(fg); setHintTextColor(Color.parseColor("#5B606B"))
        background = rounded(Color.parseColor("#1B1E25"), line, 12); setPadding(dp(12), dp(12), dp(12), dp(12)); textSize = 16f
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { bottomMargin = dp(8) }
    }
    private fun btn(label: String, primary: Boolean, onClick: () -> Unit) = Button(this).apply {
        text = label; isAllCaps = false; textSize = 15f; setTypeface(typeface, Typeface.BOLD)
        setTextColor(if (primary) Color.parseColor("#1A0B04") else fg)
        background = rounded(if (primary) accent else Color.parseColor("#1B1E25"), if (primary) null else line, 14)
        gravity = Gravity.CENTER; setPadding(dp(12), dp(12), dp(12), dp(12)); setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(6) }
    }
}
