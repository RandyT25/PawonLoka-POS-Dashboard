package com.pawonloka.pos.printing

import android.Manifest
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.*
import java.io.IOException
import java.util.UUID

private const val TAG = "PrinterConnection"
private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

enum class ConnectionStatus { DISCONNECTED, CONNECTING, CONNECTED, ERROR }

class PrinterConnection(
    val mac: String,
    val station: String,
    val name: String,
    val paperSize: String,
    private val context: Context
) {
    @Volatile var status: ConnectionStatus = ConnectionStatus.DISCONNECTED
        private set

    private var socket: BluetoothSocket? = null
    private var reconnectJob: Job? = null

    // ── Connect ──────────────────────────────────────────────────────────────
    suspend fun connect(): Boolean = withContext(Dispatchers.IO) {
        if (status == ConnectionStatus.CONNECTED && socket?.isConnected == true) return@withContext true
        status = ConnectionStatus.CONNECTING

        // Permission guard — Android 12+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT)
                != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "[$station] BLUETOOTH_CONNECT not granted — skipping connect")
            status = ConnectionStatus.DISCONNECTED
            return@withContext false
        }

        try {
            val adapter = context.getSystemService(BluetoothManager::class.java)?.adapter
                ?: return@withContext false.also { status = ConnectionStatus.DISCONNECTED }
            val device = adapter.getRemoteDevice(mac)
            adapter.cancelDiscovery()

            // Try insecure RFCOMM first (no PIN), then fall back to secure
            var s: BluetoothSocket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
            var ok = tryConnectSocket(s)
            if (!ok) {
                Log.d(TAG, "[$station] Insecure RFCOMM failed, trying secure...")
                s = device.createRfcommSocketToServiceRecord(SPP_UUID)
                ok = tryConnectSocket(s)
            }
            if (!ok) {
                status = ConnectionStatus.DISCONNECTED
                return@withContext false
            }
            socket = s
            status = ConnectionStatus.CONNECTED
            Log.i(TAG, "[$station] Connected to $name ($mac)")
            true
        } catch (e: Exception) {
            Log.w(TAG, "[$station] Connect failed: ${e.message}")
            closeSocket()
            status = ConnectionStatus.DISCONNECTED
            false
        }
    }

    private fun tryConnectSocket(s: BluetoothSocket): Boolean {
        return try {
            val ok = runBlocking(Dispatchers.IO) {
                withTimeoutOrNull(10_000L) {
                    s.connect()
                    true
                }
            } ?: false
            if (!ok) try { s.close() } catch (_: Exception) {}
            ok
        } catch (e: Exception) {
            try { s.close() } catch (_: Exception) {}
            false
        }
    }

    // ── Disconnect ───────────────────────────────────────────────────────────
    suspend fun disconnect() = withContext(Dispatchers.IO) {
        stopAutoReconnect()
        closeSocket()
        status = ConnectionStatus.DISCONNECTED
    }

    // ── Send bytes ───────────────────────────────────────────────────────────
    suspend fun send(bytes: ByteArray): Boolean = withContext(Dispatchers.IO) {
        val s = socket
        if (s == null || !s.isConnected) {
            Log.w(TAG, "[$station] Send skipped — not connected")
            return@withContext false
        }
        try {
            s.outputStream.write(bytes)
            s.outputStream.flush()
            Log.d(TAG, "[$station] Sent ${bytes.size} bytes")
            true
        } catch (e: IOException) {
            Log.w(TAG, "[$station] Send failed: ${e.message}")
            closeSocket()
            status = ConnectionStatus.DISCONNECTED
            false
        }
    }

    // ── Auto-reconnect loop ──────────────────────────────────────────────────
    fun startAutoReconnect(scope: CoroutineScope) {
        if (reconnectJob?.isActive == true) return
        reconnectJob = scope.launch(Dispatchers.IO) {
            var delayMs = 3_000L
            while (isActive) {
                if (status != ConnectionStatus.CONNECTED || socket?.isConnected != true) {
                    Log.d(TAG, "[$station] Reconnect attempt")
                    val ok = connect()
                    delayMs = if (ok) 5_000L else (delayMs * 3 / 2).coerceAtMost(30_000L)
                } else {
                    delayMs = 5_000L
                }
                delay(delayMs)
            }
        }
    }

    fun stopAutoReconnect() {
        reconnectJob?.cancel()
        reconnectJob = null
    }

    // ── Internal ─────────────────────────────────────────────────────────────
    private fun closeSocket() {
        try { socket?.close() } catch (_: Exception) {}
        socket = null
    }
}
