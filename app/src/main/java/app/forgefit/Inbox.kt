package app.forgefit

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** Holds data collected by the background sync until the app UI merges it. */
object Inbox {
    private val lock = Any()
    private fun file(ctx: Context) = File(ctx.filesDir, "inbox.json")

    private fun load(ctx: Context): JSONObject = runCatching { JSONObject(file(ctx).readText()) }.getOrDefault(JSONObject())

    /** Adds items, de-duplicating arrays by "id" (or "t" for body readings). Returns how many were new. */
    fun add(ctx: Context, key: String, items: JSONArray, idKey: String = "id"): Int = synchronized(lock) {
        val o = load(ctx); val arr = o.optJSONArray(key) ?: JSONArray()
        val seen = HashSet<String>(); for (i in 0 until arr.length()) seen += arr.getJSONObject(i).opt(idKey).toString()
        var n = 0
        for (i in 0 until items.length()) { val it = items.getJSONObject(i); if (seen.add(it.opt(idKey).toString())) { arr.put(it); n++ } }
        o.put(key, arr); file(ctx).writeText(o.toString()); n
    }

    fun put(ctx: Context, key: String, value: Any) = synchronized(lock) { val o = load(ctx); o.put(key, value); file(ctx).writeText(o.toString()) }

    fun drain(ctx: Context): JSONObject = synchronized(lock) { val o = load(ctx); file(ctx).delete(); o }
}
