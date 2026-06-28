package com.pawonloka.pos.printing

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
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
        try {
            val adapter = BluetoothAdapter.getDefaultAdapter()
                ?: return@withContext false.also { status = ConnectionStatus.ERROR }
            val device: BluetoothDevice = adapter.getRemoteDevice(mac)
            adapter.cancelDiscovery()
            // Insecure RFCOMM skips PIN/security handshake — thermal printers don't need it
            val s = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID)
            val connected = kotlinx.coroutines.withTimeoutOrNull(10_000L) {
                s.connect()
                true
            } ?: false
            if (!connected) {
                try { s.close() } catch (_: Exception) {}
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
