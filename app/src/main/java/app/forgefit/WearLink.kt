package app.forgefit

import android.content.Context
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Node
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

/**
 * Phone side of the Galaxy Watch link (Wear OS Data Layer).
 * Phone -> watch: "/forge/state" (current exercise, set, rest timer).
 * Watch -> phone: "/forge/evt"   (heart rate, rep events, set done, skip rest, hello).
 */
class WearLink(private val ctx: Context, private val onEvent: (String) -> Unit) : MessageClient.OnMessageReceivedListener {

    companion object {
        const val CAPABILITY = "forge_watch"
        const val PATH_STATE = "/forge/state"
        const val PATH_EVT = "/forge/evt"
    }

    private val messages by lazy { Wearable.getMessageClient(ctx) }
    private val capabilities by lazy { Wearable.getCapabilityClient(ctx) }
    private var started = false
    private var lastState: ByteArray? = null

    fun start() {
        if (started) return
        runCatching { messages.addListener(this); started = true }
    }

    fun stop() {
        if (!started) return
        runCatching { messages.removeListener(this) }
        started = false
    }

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == PATH_EVT) onEvent(String(event.data, Charsets.UTF_8))
    }

    private suspend fun watchNodes(): Set<Node> = try {
        capabilities.getCapability(CAPABILITY, CapabilityClient.FILTER_REACHABLE).await().nodes
    } catch (e: Exception) { emptySet() }

    suspend fun status(): JSONObject {
        val nodes = watchNodes()
        val o = JSONObject().put("connected", nodes.isNotEmpty())
        nodes.firstOrNull()?.let { o.put("name", it.displayName) }
        return o
    }

    suspend fun send(state: JSONObject): JSONObject {
        val bytes = state.toString().toByteArray(Charsets.UTF_8)
        lastState = bytes
        val nodes = watchNodes()
        var sent = 0
        for (n in nodes) {
            runCatching { messages.sendMessage(n.id, PATH_STATE, bytes).await(); sent++ }
        }
        return JSONObject().put("ok", true).put("sent", sent)
    }
}
