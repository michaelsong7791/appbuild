package app.forgefit

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import kotlinx.coroutines.CompletableDeferred
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit

/** Health Connect access. Samsung Health mirrors Galaxy Watch data (sleep, HR, HRV) into Health Connect. */
class HealthBridge(private val act: MainActivity) {

    val permissions: Set<String> = setOf(
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getWritePermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class),
    )

    private fun sdkStatus(): Int = HealthConnectClient.getSdkStatus(act)
    private val client: HealthConnectClient by lazy { HealthConnectClient.getOrCreate(act) }

    private fun requireAvailable() {
        if (sdkStatus() != HealthConnectClient.SDK_AVAILABLE) throw IllegalStateException("Health Connect is not available")
    }

    suspend fun status(): JSONObject {
        val st = when (sdkStatus()) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
            else -> "unavailable"
        }
        val o = JSONObject().put("status", st)
        if (st == "available") {
            val granted = runCatching { client.permissionController.getGrantedPermissions() }.getOrDefault(emptySet())
            o.put("granted", granted.containsAll(permissions))
            o.put("grantedCount", granted.intersect(permissions).size)
        }
        return o
    }

    suspend fun requestPermissions(): JSONObject {
        requireAvailable()
        val already = client.permissionController.getGrantedPermissions()
        if (already.containsAll(permissions)) return JSONObject().put("granted", true)
        val d = CompletableDeferred<Set<String>>()
        act.hcPermissionResult = d
        act.hcPermissionLauncher.launch(permissions)
        val granted = d.await()
        act.hcPermissionResult = null
        // Core reads are enough to be useful even if a write was declined.
        val core = setOf(
            HealthPermission.getReadPermission(SleepSessionRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
        )
        return JSONObject().put("granted", granted.containsAll(core)).put("all", granted.containsAll(permissions))
    }

    private suspend fun <T : Record> read(cls: kotlin.reflect.KClass<T>, from: Instant, to: Instant): List<T> =
        runCatching { client.readRecords(ReadRecordsRequest(cls, timeRangeFilter = TimeRangeFilter.between(from, to))).records }
            .getOrDefault(emptyList())

    /** Sleep last night, resting HR + HRV (latest vs 14-day baseline), steps today. */
    suspend fun readRecovery(): JSONObject {
        requireAvailable()
        val now = Instant.now()
        val o = JSONObject()

        // Sleep: sessions ending in the last 20 h (covers last night incl. naps merged)
        val sleeps = read(SleepSessionRecord::class, now.minus(36, ChronoUnit.HOURS), now)
            .filter { it.endTime.isAfter(now.minus(20, ChronoUnit.HOURS)) }
        if (sleeps.isNotEmpty()) {
            val mins = sleeps.sumOf { ChronoUnit.MINUTES.between(it.startTime, it.endTime) }
            o.put("sleepH", mins / 60.0)
        }

        // Resting HR
        val rhr = read(RestingHeartRateRecord::class, now.minus(14, ChronoUnit.DAYS), now).sortedBy { it.time }
        if (rhr.isNotEmpty()) {
            o.put("restingHr", rhr.last().beatsPerMinute.toDouble())
            if (rhr.size >= 3) o.put("restingHrBase", rhr.dropLast(1).map { it.beatsPerMinute }.average())
        } else {
            // Fallback: estimate resting HR from the lowest sustained HR overnight
            val hr = read(HeartRateRecord::class, now.minus(14, ChronoUnit.DAYS), now)
            val byDay = hr.flatMap { it.samples }.groupBy { it.time.atZone(ZoneId.systemDefault()).toLocalDate() }
            val daily = byDay.mapValues { (_, s) -> s.map { it.beatsPerMinute }.sorted().let { l -> l[(l.size * 0.05).toInt().coerceAtMost(l.size - 1)] } }
            val today = LocalDate.now()
            daily[today]?.let { o.put("restingHr", it.toDouble()) } ?: daily[today.minusDays(1)]?.let { o.put("restingHr", it.toDouble()) }
            val prior = daily.filterKeys { it.isBefore(today) }.values
            if (prior.size >= 3) o.put("restingHrBase", prior.average())
        }

        // HRV (RMSSD)
        val hrv = read(HeartRateVariabilityRmssdRecord::class, now.minus(14, ChronoUnit.DAYS), now).sortedBy { it.time }
        if (hrv.isNotEmpty()) {
            o.put("hrv", hrv.last().heartRateVariabilityMillis)
            if (hrv.size >= 3) o.put("hrvBase", hrv.dropLast(1).map { it.heartRateVariabilityMillis }.average())
        }

        // Steps today
        runCatching {
            val start = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant()
            val agg = client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), TimeRangeFilter.between(start, now)))
            agg[StepsRecord.COUNT_TOTAL]?.let { o.put("steps", it) }
        }
        return o
    }

    suspend fun readHeartRate(start: Long, end: Long): JSONObject {
        requireAvailable()
        val recs = read(HeartRateRecord::class, Instant.ofEpochMilli(start), Instant.ofEpochMilli(end))
        val arr = JSONArray()
        recs.flatMap { it.samples }.sortedBy { it.time }.forEach {
            val t = it.time.toEpochMilli()
            if (t in start..end) arr.put(JSONObject().put("t", t).put("bpm", it.beatsPerMinute))
        }
        return JSONObject().put("samples", arr)
    }

    /** Save a strength session (+ watch heart rate + calories) so it shows up in Samsung Health. */
    suspend fun writeWorkout(a: JSONObject): JSONObject {
        requireAvailable()
        val start = Instant.ofEpochMilli(a.getLong("start"))
        val end = Instant.ofEpochMilli(a.getLong("end")).let { if (!it.isAfter(start)) start.plusSeconds(60) else it }
        val zone: ZoneOffset = ZoneId.systemDefault().rules.getOffset(start)
        val records = mutableListOf<Record>()

        records += ExerciseSessionRecord(
            startTime = start, startZoneOffset = zone,
            endTime = end, endZoneOffset = zone,
            metadata = Metadata.manualEntry(clientRecordId = "forge-" + a.optString("id").ifBlank { a.getLong("start").toString() }),
            exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
            title = a.optString("name", "Strength training").take(100),
            notes = a.optString("description").take(1000),
        )

        val hr = a.optJSONArray("hr")
        if (hr != null && hr.length() > 1 && !a.optBoolean("hrFromHc")) {
            val samples = ArrayList<HeartRateRecord.Sample>()
            var lastT = 0L
            for (i in 0 until hr.length()) {
                val s = hr.getJSONObject(i)
                val t = s.getLong("t"); val bpm = s.getLong("bpm")
                if (t - lastT < 5000 || bpm !in 30..240) continue // ≤ 1 sample / 5 s
                val inst = Instant.ofEpochMilli(t)
                if (inst.isBefore(start) || !inst.isBefore(end)) continue
                samples += HeartRateRecord.Sample(time = inst, beatsPerMinute = bpm)
                lastT = t
            }
            if (samples.isNotEmpty()) {
                records += HeartRateRecord(
                    startTime = start, startZoneOffset = zone, endTime = end, endZoneOffset = zone,
                    samples = samples,
                    metadata = Metadata.activelyRecorded(device = Device(type = Device.TYPE_WATCH)),
                )
            }
        }

        val kcal = a.optDouble("kcal", 0.0)
        if (kcal > 0) {
            records += ActiveCaloriesBurnedRecord(
                startTime = start, startZoneOffset = zone, endTime = end, endZoneOffset = zone,
                energy = Energy.kilocalories(kcal),
                metadata = Metadata.manualEntry(),
            )
        }
        val res = client.insertRecords(records)
        return JSONObject().put("ok", true).put("ids", res.recordIdsList.size)
    }
}
