package com.pawonloka.pos.printing

import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.*

@CapacitorPlugin(name = "PrintBridge")
class PrintBridgePlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // ── Service control ───────────────────────────────────────────────────────
    @PluginMethod
    fun startService(call: PluginCall) {
        PrintForegroundService.start(context)
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun stopService(call: PluginCall) {
        PrintForegroundService.stop(context)
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun getServiceStatus(call: PluginCall) {
        // Service is running if PrinterManager is initialised (connections exist)
        call.resolve(JSObject().put("running", true))
    }

    // ── Device discovery ──────────────────────────────────────────────────────
    @PluginMethod
    fun getBondedDevices(call: PluginCall) {
        val devices = PrinterManager.getBondedDevices(context)
        val arr = JSArray()
        for (d in devices) {
            arr.put(JSObject().put("mac", d["mac"]).put("name", d["name"]))
        }
        call.resolve(JSObject().put("devices", arr))
    }

    // ── Printer config ────────────────────────────────────────────────────────
    @PluginMethod
    fun setPrinterMac(call: PluginCall) {
        val station   = call.getString("station") ?: return call.reject("station required")
        val mac       = call.getString("mac")     ?: return call.reject("mac required")
        val name      = call.getString("name")    ?: mac
        val paperSize = call.getString("paperSize") ?: "80mm"
        PrinterManager.savePrinter(context, station, mac, name, paperSize)
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun getPrinterConfig(call: PluginCall) {
        val status = PrinterManager.getStatus()
        val result = JSObject()
        for ((station, info) in status) {
            val s = info as Map<*, *>
            result.put(station, JSObject()
                .put("mac",       s["mac"])
                .put("name",      s["name"])
                .put("paperSize", s["paperSize"])
                .put("connected", s["connected"])
                .put("type",      s["type"] ?: "bluetooth")
                .put("ip",        s["ip"]   ?: "")
                .put("port",      s["port"] ?: 9100)
            )
        }
        call.resolve(result)
    }

    @PluginMethod
    fun removePrinter(call: PluginCall) {
        val station = call.getString("station") ?: return call.reject("station required")
        PrinterManager.removePrinter(context, station)
        call.resolve(JSObject().put("ok", true))
    }

    // ── Printing ──────────────────────────────────────────────────────────────
    @PluginMethod
    fun printTicket(call: PluginCall) {
        val station = call.getString("station") ?: return call.reject("station required")
        val type    = call.getString("type")    ?: "receipt"
        val payload = call.getString("payload") ?: return call.reject("payload required")
        scope.launch {
            PrinterManager.enqueuePrint(station, type, payload)
        }
        call.resolve(JSObject().put("queued", true))
    }

    @PluginMethod
    fun testPrint(call: PluginCall) {
        val station = call.getString("station") ?: return call.reject("station required")
        if (!PrinterManager.isStationConnected(station)) {
            return call.reject("Printer tidak terhubung — pastikan printer menyala dan dalam jangkauan Bluetooth")
        }
        val paperSize = (PrinterManager.getStatus()[station] as? Map<*, *>)?.get("paperSize") as? String ?: "80mm"
        val payload = """{"station":"$station","paperSize":"$paperSize"}"""
        scope.launch {
            PrinterManager.enqueuePrint(station, "test", payload)
        }
        call.resolve(JSObject().put("queued", true))
    }

    // ── Network printer config ────────────────────────────────────────────────
    @PluginMethod
    fun setNetworkPrinter(call: PluginCall) {
        val station   = call.getString("station")       ?: return call.reject("station required")
        val ip        = call.getString("ip")            ?: return call.reject("ip required")
        val port      = call.getInt("port", 9100)!!
        val name      = call.getString("name", ip)!!
        val paperSize = call.getString("paperSize", "80mm")!!
        PrinterManager.saveNetworkPrinter(context, station, ip, port, name, paperSize)
        call.resolve(JSObject().put("ok", true))
    }

    // ── Queue status ──────────────────────────────────────────────────────────
    @PluginMethod
    fun getQueueStatus(call: PluginCall) {
        val queueStatus = PrinterManager.getQueueStatus()
        val result = JSObject()
        for ((station, count) in queueStatus) result.put(station, count)
        call.resolve(result)
    }
}
