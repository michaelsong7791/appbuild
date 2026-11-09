package app.forgefit

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.health.connect.client.PermissionController
import androidx.webkit.WebViewAssetLoader
import kotlinx.coroutines.CompletableDeferred

class MainActivity : ComponentActivity() {

    lateinit var web: WebView
        private set
    private lateinit var bridge: Bridge
    private var pageReady = false
    private var pendingIntent: Intent? = null

    // Health Connect permission request -> resolved by HealthBridge
    var hcPermissionResult: CompletableDeferred<Set<String>>? = null
    val hcPermissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted -> hcPermissionResult?.complete(granted) }

    // <input type=file> support for backup import
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val filePicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        fileCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        val root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#0A0B0E")) }
        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#0A0B0E"))
            layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            overScrollMode = WebView.OVER_SCROLL_NEVER
        }
        root.addView(web)
        setContentView(root)

        // Keep content clear of status bar, nav bar, camera cutout and the Fold hinge-free insets.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            textZoom = 100
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.host == "appassets.androidplatform.net") return false
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, u)) }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                pageReady = true
                pendingIntent?.let { handleIntent(it); pendingIntent = null }
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try { filePicker.launch("*/*"); true } catch (e: Exception) { fileCallback = null; false }
            }
        }

        bridge = Bridge(this)
        web.addJavascriptInterface(bridge, "ForgeNative")
        web.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(window.forgeBack && window.forgeBack()) ? 'yes' : 'no'") { r ->
                    if (r?.contains("yes") != true) {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                    }
                }
            }
        })

        intent?.let { if (it.data != null) pendingIntent = it }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (pageReady) handleIntent(intent) else pendingIntent = intent
    }

    private fun handleIntent(intent: Intent) {
        val data = intent.data ?: return
        if (data.scheme == "forgefit") bridge.strava.handleRedirect(data)
    }

    override fun onResume() {
        super.onResume()
        bridge.wear.start()
        if (pageReady) bridge.emit("resume", "{}")
    }

    override fun onPause() {
        bridge.wear.stop()
        super.onPause()
    }

    fun setKeepAwake(on: Boolean) = runOnUiThread {
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    override fun onDestroy() {
        web.removeJavascriptInterface("ForgeNative")
        web.destroy()
        super.onDestroy()
    }
}
