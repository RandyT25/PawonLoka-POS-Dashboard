package com.pawonloka.pos.printing

import android.util.Log
import kotlinx.coroutines.*
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket

private const val TAG_NET = "NetworkPrinterConn"

class NetworkPrinterConnection(
    val ip: String,
    val port: Int,
    val station: String,
    val name: String,
    val paperSize: String
) {
    @Volatile var status: ConnectionStatus = ConnectionStatus.DISCONNECTED
        private set

    private var socket: Socket? = null
    private var outputStream: OutputStream? = null
    private var reconnectJob: Job? = null

    // ── Connect ──────────────────────────────────────────────────────────────
    suspend fun connect(): Boolean = withContext(Dispatchers.IO) {
        if (status == ConnectionStatus.CONNECTED && socket?.isConnected == true && socket?.isClosed == false)
            return@withContext true
        status = ConnectionStatus.CONNECTING
        try {
            val sock = Socket()
            val connected = withTimeoutOrNull(10_000L) {
                sock.connect(InetSocketAddress(ip, port), 10_000)
                true
            } ?: false
            if (!connected) {
                try { sock.close() } catch (_: Exception) {}
                status = ConnectionStatus.DISCONNECTED
                return@withContext false
            }
            socket = sock
            outputStream = sock.getOutputStream()
            status = ConnectionStatus.CONNECTED
            Log.i(TAG_NET, "[$station] Connected to $ip:$port")
            true
        } catch (e: Exception) {
            Log.w(TAG_NET, "[$station] Connect failed: ${e.message}")
            closeSocket()
            status = ConnectionStatus.DISCONNECTED
            false
        }
    }

    // ── Send bytes ───────────────────────────────────────────────────────────
    suspend fun send(bytes: ByteArray): Boolean = withContext(Dispatchers.IO) {
        val out = outputStream
        if (out == null || status != ConnectionStatus.CONNECTED) {
            Log.w(TAG_NET, "[$station] Send skipped — not connected")
            return@withContext false
        }
        try {
            out.write(bytes)
            out.flush()
            Log.d(TAG_NET, "[$station] Sent ${bytes.size} bytes")
            true
        } catch (e: Exception) {
            Log.w(TAG_NET, "[$station] Send failed: ${e.message}")
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
                    Log.d(TAG_NET, "[$station] Reconnect attempt to $ip:$port")
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
        closeSocket()
    }

    // ── Internal ─────────────────────────────────────────────────────────────
    private fun closeSocket() {
        try { socket?.close() } catch (_: Exception) {}
        socket = null
        outputStream = null
        status = ConnectionStatus.DISCONNECTED
    }
}
