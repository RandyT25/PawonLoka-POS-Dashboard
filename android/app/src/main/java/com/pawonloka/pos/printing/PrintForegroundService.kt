package com.pawonloka.pos.printing

import android.app.*
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

private const val TAG = "PrintForegroundService"
private const val CHANNEL_ID = "pawonloka_print_service"
private const val NOTIFICATION_ID = 1001

class PrintForegroundService : Service() {

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "Service created")
        createNotificationChannel()
        try {
            startForeground(NOTIFICATION_ID, buildNotification())
            PrinterManager.init(this)
            PrinterManager.startAllReconnects()
            PrinterManager.startQueueDrain()
        } catch (e: Exception) {
            Log.w(TAG, "Foreground service start failed (permissions not yet granted): ${e.message}")
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand")
        return START_STICKY  // restart automatically if killed
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "Service destroyed")
        PrinterManager.stopAll()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Notification ──────────────────────────────────────────────────────────
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PawonLoka Print Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Manages Bluetooth printer connections"
                setSound(null, null)
                enableVibration(false)
            }
            getSystemService(NotificationManager::class.java)
                ?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("PawonLoka POS")
            .setContentText("Print service running")
            .setSmallIcon(android.R.drawable.ic_menu_send)
            .setOngoing(true)
            .setSilent(true)
            .build()

    companion object {
        @JvmStatic
        fun start(context: android.content.Context) {
            val intent = Intent(context, PrintForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                context.startForegroundService(intent)
            else
                context.startService(intent)
        }

        @JvmStatic
        fun stop(context: android.content.Context) {
            context.stopService(Intent(context, PrintForegroundService::class.java))
        }
    }
}
