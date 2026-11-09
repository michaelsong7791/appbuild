package app.forgefit.wear

import android.app.Application
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/** Saves any crash to a file so the next launch can show what went wrong on the watch screen. */
class ForgeWatchApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val prev = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            try {
                val sw = StringWriter(); e.printStackTrace(PrintWriter(sw))
                File(filesDir, "crash.txt").writeText("Forge watch ${BuildConfigLite.VERSION}\nThread: ${t.name}\n$sw")
            } catch (_: Throwable) { }
            prev?.uncaughtException(t, e)
        }
    }
}

object BuildConfigLite { const val VERSION = "1.0.1" }
