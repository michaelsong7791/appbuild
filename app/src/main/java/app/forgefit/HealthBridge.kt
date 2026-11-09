package app.forgefit

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.LeanBodyMassRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.units.Length
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Percentage
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
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getWritePermission(DistanceRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getWritePermission(WeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getWritePermission(BodyFatRecord::class),
        HealthPermission.getReadPermission(HeightRecord::class),
        HealthPermission.getWritePermission(HeightRecord::class),
        HealthPermission.getReadPermission(LeanBodyMassRecord::class),
        HealthPermission.getReadPermission(BasalMetabolicRateRecord::class),
    )
    private val corePermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
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
            o.put("granted", granted.containsAll(corePermissions))
            o.put("all", granted.containsAll(permissions))
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
            exerciseType = exerciseTypeFor(a.optString("exerciseType", "strength")),
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

    // ---------- Cardio / other workouts ----------
    private fun typeName(t: Int): String? = when (t) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "run"
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "run_tread"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "walk"
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "hike"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "cycle"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "cycle_indoor"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL, ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "swim"
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING, ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> "row"
        ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> "elliptical"
        ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING, ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE -> "stairs"
        ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "hiit"
        ExerciseSessionRecord.EXERCISE_TYPE_YOGA, ExerciseSessionRecord.EXERCISE_TYPE_PILATES -> "yoga"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> null
        ExerciseSessionRecord.EXERCISE_TYPE_SOCCER, ExerciseSessionRecord.EXERCISE_TYPE_BASKETBALL, ExerciseSessionRecord.EXERCISE_TYPE_TENNIS,
        ExerciseSessionRecord.EXERCISE_TYPE_BADMINTON, ExerciseSessionRecord.EXERCISE_TYPE_VOLLEYBALL -> "sport"
        else -> "other"
    }

    private fun typeCode(name: String): Int = when (name) {
        "run" -> ExerciseSessionRecord.EXERCISE_TYPE_RUNNING
        "run_tread" -> ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL
        "walk" -> ExerciseSessionRecord.EXERCISE_TYPE_WALKING
        "hike" -> ExerciseSessionRecord.EXERCISE_TYPE_HIKING
        "cycle" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING
        "cycle_indoor" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY
        "swim" -> ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL
        "row" -> ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE
        "elliptical" -> ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL
        "stairs" -> ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE
        "hiit" -> ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
        "yoga" -> ExerciseSessionRecord.EXERCISE_TYPE_YOGA
        "stretching" -> ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING
        "calisthenics" -> ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS
        "bootcamp" -> ExerciseSessionRecord.EXERCISE_TYPE_BOOT_CAMP
        "strength" -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
        else -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
    }
    fun exerciseTypeFor(name: String?): Int = typeCode(name ?: "strength")

    /** Workouts recorded by other apps (Samsung Health / Galaxy Watch, etc.) since [since]. */
    suspend fun readSessions(since: Long): JSONObject {
        requireAvailable()
        val now = Instant.now()
        val recs = read(ExerciseSessionRecord::class, Instant.ofEpochMilli(since), now)
            .filter { it.metadata.dataOrigin.packageName != act.packageName }
        val arr = JSONArray()
        for (r in recs) {
            val type = typeName(r.exerciseType) ?: continue
            val range = TimeRangeFilter.between(r.startTime, r.endTime)
            val o = JSONObject().put("id", r.metadata.id).put("type", type)
                .put("start", r.startTime.toEpochMilli()).put("end", r.endTime.toEpochMilli())
                .put("title", r.title ?: "")
            runCatching {
                val agg = client.aggregate(AggregateRequest(setOf(
                    DistanceRecord.DISTANCE_TOTAL, HeartRateRecord.BPM_AVG, HeartRateRecord.BPM_MAX,
                    ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL, TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                ), range))
                agg[DistanceRecord.DISTANCE_TOTAL]?.let { o.put("distM", it.inMeters) }
                agg[HeartRateRecord.BPM_AVG]?.let { o.put("hrAvg", it) }
                agg[HeartRateRecord.BPM_MAX]?.let { o.put("hrMax", it) }
                val active = agg[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
                val total = agg[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
                if (active != null && active > 0) o.put("kcal", active)
                else if (total != null && total > 0) {
                    // total includes resting energy; subtract ~BMR share (1 kcal/kg/h ≈ 1.2 kcal/min for an average adult)
                    val mins = ChronoUnit.SECONDS.between(r.startTime, r.endTime) / 60.0
                    o.put("kcal", (total - mins * 1.2).coerceAtLeast(0.0))
                }
            }
            arr.put(o)
        }
        return JSONObject().put("sessions", arr)
    }

    /** Write a cardio/other session logged in Forge. */
    suspend fun writeCardio(a: JSONObject): JSONObject {
        requireAvailable()
        val start = Instant.ofEpochMilli(a.getLong("start"))
        val end = Instant.ofEpochMilli(a.getLong("end")).let { if (!it.isAfter(start)) start.plusSeconds(60) else it }
        val zone: ZoneOffset = ZoneId.systemDefault().rules.getOffset(start)
        val records = mutableListOf<Record>()
        records += ExerciseSessionRecord(
            startTime = start, startZoneOffset = zone, endTime = end, endZoneOffset = zone,
            metadata = Metadata.manualEntry(clientRecordId = "forge-" + a.optString("id").ifBlank { a.getLong("start").toString() }),
            exerciseType = typeCode(a.optString("type")),
            title = a.optString("name", "Workout").take(100),
        )
        val dist = a.optDouble("distM", 0.0)
        if (dist > 0) records += DistanceRecord(startTime = start, startZoneOffset = zone, endTime = end, endZoneOffset = zone, distance = Length.meters(dist), metadata = Metadata.manualEntry())
        val kcal = a.optDouble("kcal", 0.0)
        if (kcal > 0) records += ActiveCaloriesBurnedRecord(startTime = start, startZoneOffset = zone, endTime = end, endZoneOffset = zone, energy = Energy.kilocalories(kcal), metadata = Metadata.manualEntry())
        client.insertRecords(records)
        return JSONObject().put("ok", true)
    }

    // ---------- Body composition ----------
    /** Weight, body fat, lean mass, BMR (Galaxy Watch BIA scans land here via Samsung Health) + latest height. */
    suspend fun readBody(since: Long): JSONObject {
        requireAvailable()
        val from = Instant.ofEpochMilli(since); val now = Instant.now()
        data class E(var weightKg: Double? = null, var bf: Double? = null, var lbmKg: Double? = null, var bmr: Double? = null)
        val byTime = sortedMapOf<Long, E>()
        fun slot(t: Instant): E { val k = t.toEpochMilli() / 600_000L * 600_000L; return byTime.getOrPut(k) { E() } } // merge within 10 min
        read(WeightRecord::class, from, now).forEach { slot(it.time).weightKg = it.weight.inKilograms }
        read(BodyFatRecord::class, from, now).forEach { slot(it.time).bf = it.percentage.value }
        read(LeanBodyMassRecord::class, from, now).forEach { slot(it.time).lbmKg = it.mass.inKilograms }
        read(BasalMetabolicRateRecord::class, from, now).forEach { slot(it.time).bmr = it.basalMetabolicRate.inKilocaloriesPerDay }
        val arr = JSONArray()
        byTime.forEach { (t, e) ->
            val o = JSONObject().put("t", t)
            e.weightKg?.let { o.put("weightKg", it) }; e.bf?.let { o.put("bf", it) }
            e.lbmKg?.let { o.put("lbmKg", it) }; e.bmr?.let { o.put("bmr", it) }
            arr.put(o)
        }
        val res = JSONObject().put("entries", arr)
        read(HeightRecord::class, now.minus(3650, ChronoUnit.DAYS), now).maxByOrNull { it.time }?.let { res.put("heightM", it.height.inMeters) }
        return res
    }

    suspend fun writeBody(a: JSONObject): JSONObject {
        requireAvailable()
        val now = Instant.now(); val zone = ZoneId.systemDefault().rules.getOffset(now)
        val records = mutableListOf<Record>()
        if (!a.isNull("weightKg")) records += WeightRecord(time = now, zoneOffset = zone, weight = Mass.kilograms(a.getDouble("weightKg")), metadata = Metadata.manualEntry())
        if (!a.isNull("bf")) records += BodyFatRecord(time = now, zoneOffset = zone, percentage = Percentage(a.getDouble("bf")), metadata = Metadata.manualEntry())
        if (!a.isNull("heightM")) records += HeightRecord(time = now, zoneOffset = zone, height = Length.meters(a.getDouble("heightM")), metadata = Metadata.manualEntry())
        if (records.isNotEmpty()) client.insertRecords(records)
        return JSONObject().put("ok", true).put("count", records.size)
    }
}
