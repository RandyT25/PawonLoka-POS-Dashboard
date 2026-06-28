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

    private val btConnections  = mutableMapOf<String, PrinterConnection>()
    private val lanConnections = mutableMapOf<String, NetworkPrinterConnection>()
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
        btConnections.clear()
        lanConnections.clear()
        for (station in STATIONS) {
            val type = p.getString("${station}_type", "bluetooth") ?: "bluetooth"
            val name = p.getString("${station}_name", "") ?: ""
            val size = p.getString("${station}_size", "80mm") ?: "80mm"
            if (type == "lan") {
                val ip   = p.getString("${station}_ip",   null) ?: continue
                val port = p.getInt("${station}_port", 9100)
                lanConnections[station] = NetworkPrinterConnection(ip, port, station, name.ifBlank { ip }, size)
                Log.i(TAG, "Loaded LAN printer [$station]: $name ($ip:$port)")
            } else {
                val mac = p.getString("${station}_mac", null) ?: continue
                btConnections[station] = PrinterConnection(mac, station, name.ifBlank { mac }, size, context)
                Log.i(TAG, "Loaded BT printer [$station]: $name ($mac)")
            }
        }
    }

    fun savePrinter(context: Context, station: String, mac: String, name: String, paperSize: String) {
        prefs(context).edit()
            .putString("${station}_type", "bluetooth")
            .putString("${station}_mac",  mac)
            .putString("${station}_name", name)
            .putString("${station}_size", paperSize)
            .remove("${station}_ip")
            .remove("${station}_port")
            .apply()
        lanConnections[station]?.stopAutoReconnect()
        lanConnections.remove(station)
        btConnections[station]?.stopAutoReconnect()
        val conn = PrinterConnection(mac, station, name, paperSize, context)
        btConnections[station] = conn
        conn.startAutoReconnect(scope)
        Log.i(TAG, "Saved BT printer [$station]: $name ($mac)")
    }

    fun saveNetworkPrinter(context: Context, station: String, ip: String, port: Int, name: String, paperSize: String) {
        prefs(context).edit()
            .putString("${station}_type", "lan")
            .putString("${station}_ip",   ip)
            .putInt("${station}_port",    port)
            .putString("${station}_name", name)
            .putString("${station}_size", paperSize)
            .remove("${station}_mac")
            .apply()
        btConnections[station]?.stopAutoReconnect()
        btConnections.remove(station)
        lanConnections[station]?.stopAutoReconnect()
        val conn = NetworkPrinterConnection(ip, port, station, name.ifBlank { ip }, paperSize)
        lanConnections[station] = conn
        conn.startAutoReconnect(scope)
        Log.i(TAG, "Saved LAN printer [$station]: $name ($ip:$port)")
    }

    fun removePrinter(context: Context, station: String) {
        prefs(context).edit()
            .remove("${station}_type")
            .remove("${station}_mac")
            .remove("${station}_ip")
            .remove("${station}_port")
            .remove("${station}_name")
            .remove("${station}_size")
            .apply()
        btConnections[station]?.stopAutoReconnect()
        btConnections.remove(station)
        lanConnections[station]?.stopAutoReconnect()
        lanConnections.remove(station)
        Log.i(TAG, "Removed printer [$station]")
    }

    // ── Bonded devices (for Bluetooth picker in UI) ───────────────────────────
    fun getBondedDevices(): List<Map<String, String>> {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return emptyList()
        return adapter.bondedDevices.map { mapOf("mac" to it.address, "name" to (it.name ?: it.address)) }
    }

    // ── Current status ────────────────────────────────────────────────────────
    fun getStatus(): Map<String, Any> {
        return STATIONS.associate { station ->
            val bt  = btConnections[station]
            val lan = lanConnections[station]
            station to when {
                bt != null -> mapOf(
                    "mac"       to bt.mac,
                    "name"      to bt.name,
                    "paperSize" to bt.paperSize,
                    "connected" to (bt.status == ConnectionStatus.CONNECTED),
                    "type"      to "bluetooth"
                )
                lan != null -> mapOf(
                    "mac"       to "${lan.ip}:${lan.port}",
                    "name"      to lan.name,
                    "paperSize" to lan.paperSize,
                    "connected" to (lan.status == ConnectionStatus.CONNECTED),
                    "type"      to "lan",
                    "ip"        to lan.ip,
                    "port"      to lan.port
                )
                else -> mapOf(
                    "mac" to "", "name" to "", "paperSize" to "80mm",
                    "connected" to false, "type" to ""
                )
            }
        }
    }

    fun getQueueStatus(): Map<String, Int> = runBlocking {
        STATIONS.associate { station ->
            station to (db.printJobDao().getPendingJobs(station).size)
        }
    }

    // ── Send helper (used by drain loop) ─────────────────────────────────────
    private fun isStationConnected(station: String): Boolean =
        btConnections[station]?.status == ConnectionStatus.CONNECTED ||
        lanConnections[station]?.status == ConnectionStatus.CONNECTED

    private suspend fun sendToStation(station: String, bytes: ByteArray): Boolean {
        btConnections[station]?.let { if (it.status == ConnectionStatus.CONNECTED) return it.send(bytes) }
        lanConnections[station]?.let { if (it.status == ConnectionStatus.CONNECTED) return it.send(bytes) }
        return false
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
            STATIONS.map { station ->
                launch { stationDrainLoop(station) }
            }.joinAll()
        }
        cleanupJob = scope.launch {
            while (isActive) {
                delay(3_600_000L)
                val cutoff = System.currentTimeMillis() - 86_400_000L
                db.printJobDao().deleteDoneJobsBefore(cutoff)
            }
        }
    }

    private suspend fun stationDrainLoop(station: String) {
        while (true) {
            try {
                val jobs = db.printJobDao().getPendingJobs(station)
                val job = jobs.firstOrNull()
                if (job != null && isStationConnected(station)) {
                    db.printJobDao().updateStatusNoError(job.id, "printing")
                    try {
                        val bytes = EscPosBuilder.build(job.type, job.payload)
                        val ok = sendToStation(station, bytes)
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
        btConnections.values.forEach  { it.startAutoReconnect(scope) }
        lanConnections.values.forEach { it.startAutoReconnect(scope) }
    }

    fun stopAll() {
        drainJob?.cancel()
        cleanupJob?.cancel()
        btConnections.values.forEach  { it.stopAutoReconnect() }
        lanConnections.values.forEach { it.stopAutoReconnect() }
        scope.cancel()
    }
}
