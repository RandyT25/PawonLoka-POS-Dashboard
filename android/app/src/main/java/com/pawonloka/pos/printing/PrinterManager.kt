package com.pawonloka.pos.printing

import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import kotlinx.coroutines.*
import java.util.UUID

private const val TAG = "PrinterManager"
private const val PREFS_NAME = "pawonloka_printers"
private val STATIONS = listOf("kitchen", "snack", "bar", "receipt")

object PrinterManager {

    private val connections = mutableMapOf<String, PrinterConnection>()
    private lateinit var db: PrintDatabase
    private lateinit var scope: CoroutineScope
    private var drainJob: Job? = null
    private var cleanupJob: Job? = null

    // ── Initialise ────────────────────────────────────────────────────────────
    fun init(context: Context) {
        db = PrintDatabase.get(context)
        scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
        EscPosBuilder.initLogo(context)
        loadPrintersFromPrefs(context)
    }

    // ── Printer config persistence ────────────────────────────────────────────
    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun loadPrintersFromPrefs(context: Context) {
        val p = prefs(context)
        connections.clear()
        for (station in STATIONS) {
            val mac  = p.getString("${station}_mac",  null) ?: continue
            val name = p.getString("${station}_name", mac)!!
            val size = p.getString("${station}_size", "80mm")!!
            connections[station] = PrinterConnection(mac, station, name, size, context)
            Log.i(TAG, "Loaded printer [$station]: $name ($mac)")
        }
    }

    fun savePrinter(context: Context, station: String, mac: String, name: String, paperSize: String) {
        prefs(context).edit()
            .putString("${station}_mac",  mac)
            .putString("${station}_name", name)
            .putString("${station}_size", paperSize)
            .apply()
        val old = connections[station]
        old?.stopAutoReconnect()
        val conn = PrinterConnection(mac, station, name, paperSize, context)
        connections[station] = conn
        conn.startAutoReconnect(scope)
        Log.i(TAG, "Saved printer [$station]: $name ($mac)")
    }

    fun removePrinter(context: Context, station: String) {
        prefs(context).edit()
            .remove("${station}_mac")
            .remove("${station}_name")
            .remove("${station}_size")
            .apply()
        connections[station]?.stopAutoReconnect()
        connections.remove(station)
        Log.i(TAG, "Removed printer [$station]")
    }

    // ── Bonded devices (for picker in UI) ────────────────────────────────────
    fun getBondedDevices(): List<Map<String, String>> {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return emptyList()
        return adapter.bondedDevices.map { mapOf("mac" to it.address, "name" to (it.name ?: it.address)) }
    }

    // ── Current status ────────────────────────────────────────────────────────
    fun getStatus(): Map<String, Any> {
        return STATIONS.associate { station ->
            val conn = connections[station]
            station to mapOf(
                "mac"       to (conn?.mac ?: ""),
                "name"      to (conn?.name ?: ""),
                "paperSize" to (conn?.paperSize ?: "80mm"),
                "connected" to (conn?.status == ConnectionStatus.CONNECTED)
            )
        }
    }

    fun getQueueStatus(): Map<String, Int> = runBlocking {
        STATIONS.associate { station ->
            station to (db.printJobDao().getPendingJobs(station).size)
        }
    }

    // ── Enqueue a print job ───────────────────────────────────────────────────
    suspend fun enqueuePrint(station: String, type: String, payload: String) {
        val job = PrintJob(
            id      = UUID.randomUUID().toString(),
            station = station,
            type    = type,
            payload = payload
        )
        db.printJobDao().insertJob(job)
        Log.d(TAG, "Enqueued [$station] $type")
    }

    // ── Queue drain ───────────────────────────────────────────────────────────
    fun startQueueDrain() {
        if (drainJob?.isActive == true) return
        drainJob = scope.launch {
            // Drain each station in parallel, indefinitely
            STATIONS.map { station ->
                launch { stationDrainLoop(station) }
            }.joinAll()
        }
        // Cleanup done jobs every hour
        cleanupJob = scope.launch {
            while (isActive) {
                delay(3_600_000L)
                val cutoff = System.currentTimeMillis() - 86_400_000L  // 24h
                db.printJobDao().deleteDoneJobsBefore(cutoff)
            }
        }
    }

    private suspend fun stationDrainLoop(station: String) {
        while (true) {
            try {
                val jobs = db.printJobDao().getPendingJobs(station)
                val job = jobs.firstOrNull()
                if (job != null) {
                    val conn = connections[station]
                    if (conn != null && conn.status == ConnectionStatus.CONNECTED) {
                        db.printJobDao().updateStatusNoError(job.id, "printing")
                        try {
                            val bytes = EscPosBuilder.build(job.type, job.payload)
                            val ok = conn.send(bytes)
                            if (ok) {
                                db.printJobDao().updateStatusNoError(job.id, "done")
                                Log.i(TAG, "[$station] Printed job ${job.id.take(8)}")
                            } else {
                                handleRetry(job)
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "[$station] Build/send error: ${e.message}")
                            handleRetry(job, e.message)
                        }
                    }
                    // If not connected, job stays pending — reconnect loop will reconnect
                }
            } catch (e: Exception) {
                Log.e(TAG, "Drain loop error [$station]: ${e.message}")
            }
            delay(500L)
        }
    }

    private suspend fun handleRetry(job: PrintJob, error: String? = null) {
        if (job.retryCount >= 4) {
            db.printJobDao().updateStatus(job.id, "failed", error ?: "Max retries exceeded")
            Log.w(TAG, "[${job.station}] Job ${job.id.take(8)} failed after ${job.retryCount + 1} attempts")
        } else {
            db.printJobDao().incrementRetry(job.id)
            Log.d(TAG, "[${job.station}] Job ${job.id.take(8)} retry ${job.retryCount + 1}")
            delay(3_000L)
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    fun startAllReconnects() {
        connections.values.forEach { it.startAutoReconnect(scope) }
    }

    fun stopAll() {
        drainJob?.cancel()
        cleanupJob?.cancel()
        connections.values.forEach { it.stopAutoReconnect() }
        scope.cancel()
    }
}
