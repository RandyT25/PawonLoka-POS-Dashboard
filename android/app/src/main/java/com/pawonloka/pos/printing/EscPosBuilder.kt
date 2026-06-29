package com.pawonloka.pos.printing

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.io.ByteArrayOutputStream
import java.text.NumberFormat
import java.util.Locale

private var logoBytes58: ByteArray? = null
private var logoBytes80: ByteArray? = null

// ── ESC/POS command constants (mirrors usePrinter.js CMD object) ─────────────
object Cmd {
    val INIT       = byteArrayOf(0x1B, 0x40)
    val ALIGN_L    = byteArrayOf(0x1B, 0x61, 0x00)
    val ALIGN_C    = byteArrayOf(0x1B, 0x61, 0x01)
    val ALIGN_R    = byteArrayOf(0x1B, 0x61, 0x02)
    val BOLD_ON    = byteArrayOf(0x1B, 0x45, 0x01)
    val BOLD_OFF   = byteArrayOf(0x1B, 0x45, 0x00)
    val DOUBLE_ON  = byteArrayOf(0x1D, 0x21, 0x11)
    val DOUBLE_OFF = byteArrayOf(0x1D, 0x21, 0x00)
    val TALL_ON    = byteArrayOf(0x1D, 0x21, 0x10)
    val TALL_OFF   = byteArrayOf(0x1D, 0x21, 0x00)
    val LF         = byteArrayOf(0x0A)
    val CUT        = byteArrayOf(0x1D, 0x56, 0x41, 0x03)
    val DRAWER     = byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte())
}

// ── Data classes (deserialized from JSON sent by React) ──────────────────────
data class ReceiptItem(
    val name: String = "",
    val qty: Int = 1,
    val price: Long = 0,
    val modifiers: Map<String, String>? = null,
    val note: String? = null,
    val sku: String? = null,
    @SerializedName("itemDisc") val itemDisc: Long = 0,
    @SerializedName("itemDiscLabel") val itemDiscLabel: String? = null
)

data class PaymentLine(
    val method: String = "",
    val amount: Long = 0
)

data class OutletSettings(
    val name: String = "",
    val address: String? = null,
    val phone: String? = null,
    val website: String? = null,
    val tagline: String? = null,
    @SerializedName("thankYou") val thankYou: String? = null,
    val wifi: String? = null,
    val promo: String? = null,
    val social: String? = null,
    @SerializedName("custom_line_1") val customLine1: String? = null,
    @SerializedName("custom_line_2") val customLine2: String? = null,
    @SerializedName("showOrderId") val showOrderId: Boolean = true,
    @SerializedName("showTable") val showTable: Boolean = false,
    @SerializedName("showCashier") val showCashier: Boolean = false,
    @SerializedName("showDatetime") val showDatetime: Boolean = true,
    @SerializedName("showTax") val showTax: Boolean = true,
    @SerializedName("showService") val showService: Boolean = true,
    @SerializedName("showLoyalty") val showLoyalty: Boolean = false
)

data class TaxSettings(val enabled: Boolean = false, val rate: Double = 0.0, val label: String = "PPN")
data class ServiceSettings(val enabled: Boolean = false, val rate: Double = 0.0)

data class ReceiptData(
    val orderId: String = "",
    val code: String? = null,
    val items: List<ReceiptItem> = emptyList(),
    val subtotal: Long = 0,
    val tax: Long = 0,
    val service: Long = 0,
    val discount: Long = 0,
    val total: Long = 0,
    val change: Long = 0,
    val payments: List<PaymentLine> = emptyList(),
    val outlet: OutletSettings = OutletSettings(),
    val taxSettings: TaxSettings? = null,
    val serviceSettings: ServiceSettings? = null,
    val table: String? = null,
    val staff: String? = null,
    val datetime: String? = null,
    @SerializedName("paperSize") val paperSize: String = "80mm",
    @SerializedName("preBillNote")  val preBillNote:  String? = null,
    @SerializedName("preBillNote2") val preBillNote2: String? = null,
    val customer: String? = null,
    val points: Int = 0
)

data class KitchenSettings(
    @SerializedName("show_outlet_name") val showOutletName: Boolean = false,
    @SerializedName("outlet_name") val outletName: String = "",
    @SerializedName("show_order_id") val showOrderId: Boolean = true,
    @SerializedName("show_order_type") val showOrderType: Boolean = true,
    @SerializedName("show_table") val showTable: Boolean = true,
    @SerializedName("show_datetime") val showDatetime: Boolean = true,
    @SerializedName("show_footer") val showFooter: Boolean = false,
    @SerializedName("footer_text") val footerText: String = ""
)

data class KitchenTicketData(
    val stationRole: String = "kitchen",
    val stationName: String = "KITCHEN",
    val table: String = "-",
    val orderType: String = "Dine-in",
    val type: String = "new",   // "new" | "addition" | "cancellation" | "update"
    val items: List<String> = emptyList(),       // pre-formatted: "2x Nasi Goreng\n  [Extra Telur]"
    val cancelItems: List<String> = emptyList(),
    val time: String = "",
    val orderId: String = "",
    val settings: KitchenSettings? = null,
    @SerializedName("paperSize") val paperSize: String = "80mm"
)

data class ShiftInfo(
    val staff: String = "-",
    val date: String = "",
    @SerializedName("clock_in")  val clockIn:  String = "-",
    @SerializedName("float_open") val floatOpen: Long = 0
)

data class ShiftSummary(
    val orderCount: Int = 0,
    val sales: Map<String, Long> = emptyMap(),
    val totalSales: Long = 0,
    val cashSales: Long = 0,
    val topups: Long = 0,
    val expenses: Long = 0,
    val returns: Long = 0,
    val expectedCash: Long = 0
)

data class ShiftReportData(
    val shift: ShiftInfo = ShiftInfo(),
    val report: ShiftSummary? = null,
    @SerializedName("paperSize") val paperSize: String = "80mm"
)

data class ProductItem(
    val name: String = "",
    val cat: String = "Lainnya",
    val qty: Int = 0,
    val mods: Map<String, Int>? = null
)

data class ProductSoldData(
    val shift: ShiftInfo? = null,
    val productData: Map<String, ProductItem>? = null,
    @SerializedName("paperSize") val paperSize: String = "80mm"
)

// ── Builder ──────────────────────────────────────────────────────────────────
object EscPosBuilder {

    private val gson = Gson()

    fun initLogo(context: Context) {
        logoBytes58 = renderLogoBytes(context, 200)
        logoBytes80 = renderLogoBytes(context, 300)
    }

    private fun renderLogoBytes(context: Context, printWidthPx: Int): ByteArray? {
        return try {
            val src = context.assets.open("logo.png").use { BitmapFactory.decodeStream(it) }
            val scaledH = (src.height.toFloat() / src.width * printWidthPx).toInt()
            val bmp = Bitmap.createScaledBitmap(src, printWidthPx, scaledH, true)
            val bytesPerRow = (printWidthPx + 7) / 8
            val imgData = ByteArray(bytesPerRow * scaledH)
            for (y in 0 until scaledH) {
                for (x in 0 until printWidthPx) {
                    val p = bmp.getPixel(x, y)
                    val lum = (0.299 * ((p shr 16) and 0xFF) +
                               0.587 * ((p shr 8)  and 0xFF) +
                               0.114 * (p and 0xFF)).toInt()
                    if (lum < 128) {
                        val idx = y * bytesPerRow + x / 8
                        imgData[idx] = (imgData[idx].toInt() or (0x80 ushr (x % 8))).toByte()
                    }
                }
            }
            val xL = bytesPerRow and 0xFF; val xH = bytesPerRow shr 8
            val yL = scaledH and 0xFF;     val yH = scaledH shr 8
            byteArrayOf(0x1D, 0x76, 0x30, 0x00,
                        xL.toByte(), xH.toByte(), yL.toByte(), yH.toByte()) + imgData
        } catch (e: Exception) {
            Log.w("EscPosBuilder", "Logo render failed: ${e.message}")
            null
        }
    }

    private fun logoForPaper(paperSize: String) =
        if (paperSize == "58mm") logoBytes58 else logoBytes80

    fun build(type: String, payload: String): ByteArray = when (type) {
        "receipt"     -> buildReceipt(payload)
        "kitchen"     -> buildKitchenTicket(payload)
        "prebill"     -> buildPreBill(payload)
        "shift"       -> buildShiftReport(payload)
        "productsold" -> buildProductSoldReport(payload)
        "test"        -> buildTestPage(payload)
        else          -> buildTestPage(payload)
    }

    // ── Receipt ──────────────────────────────────────────────────────────────
    fun buildReceipt(json: String): ByteArray {
        val d = gson.fromJson(json, ReceiptData::class.java)
        val w = lineWidth(d.paperSize)
        return buf {
            add(Cmd.INIT)
            // Header
            add(Cmd.ALIGN_C)
            logoForPaper(d.paperSize)?.let { write(it); add(Cmd.LF) }
            add(Cmd.BOLD_ON); add(Cmd.DOUBLE_ON)
            addLine(d.outlet.name.uppercase())
            add(Cmd.DOUBLE_OFF); add(Cmd.BOLD_OFF)
            if (!d.outlet.tagline.isNullOrBlank())  addLine(d.outlet.tagline)
            if (!d.outlet.address.isNullOrBlank())  addLine(d.outlet.address)
            if (!d.outlet.phone.isNullOrBlank())    addLine("Telp: ${d.outlet.phone}")
            if (!d.outlet.website.isNullOrBlank())  addLine(d.outlet.website)
            addLine(dash(w))
            // Order meta
            add(Cmd.ALIGN_L)
            if (d.outlet.showOrderId && (d.code ?: d.orderId).isNotBlank())
                addLine("No: ${d.code ?: d.orderId.takeLast(8)}")
            if (d.outlet.showDatetime && !d.datetime.isNullOrBlank())
                addLine(d.datetime)
            if (d.outlet.showTable && !d.table.isNullOrBlank())
                addLine("Meja: ${d.table}")
            if (d.outlet.showCashier && !d.staff.isNullOrBlank())
                addLine("Kasir: ${d.staff}")
            addLine(dash(w))
            // Items
            for (item in d.items) {
                val itemTotal = item.price * item.qty - item.itemDisc
                if (d.paperSize == "58mm") {
                    addLine("${item.qty}x ${item.name.take(w)}")
                    addLine(padLine("", fmt(itemTotal), w))
                } else {
                    addLine(truncLine("${item.qty}x ${item.name}", fmt(itemTotal), w))
                }
                item.modifiers?.values?.forEach { mod -> addLine("  [$mod]") }
                if (!item.note.isNullOrBlank()) addLine("  * ${item.note}")
                if (item.itemDisc > 0 && !item.itemDiscLabel.isNullOrBlank())
                    addLine("  Disc: ${item.itemDiscLabel}")
            }
            addLine(dash(w))
            // Totals
            if (d.discount > 0) {
                addLine(padLine("Subtotal", fmt(d.subtotal + d.discount), w))
                addLine(padLine("Diskon", "-${fmt(d.discount)}", w))
            }
            if ((d.taxSettings?.enabled == true) && d.tax > 0)
                addLine(padLine(d.taxSettings.label, fmt(d.tax), w))
            if ((d.serviceSettings?.enabled == true) && d.service > 0)
                addLine(padLine("Service", fmt(d.service), w))
            add(Cmd.BOLD_ON)
            addLine(padLine("TOTAL", fmt(d.total), w))
            add(Cmd.BOLD_OFF)
            // Payments
            for (pay in d.payments)
                addLine(padLine(pay.method, fmt(pay.amount), w))
            if (d.change > 0)
                addLine(padLine("Kembali", fmt(d.change), w))
            addLine(dash(w))
            // Footer
            add(Cmd.ALIGN_C)
            if (!d.outlet.wifi.isNullOrBlank())   addLine("WiFi: ${d.outlet.wifi}")
            if (!d.outlet.promo.isNullOrBlank())  addLine(d.outlet.promo)
            if (!d.outlet.social.isNullOrBlank()) addLine(d.outlet.social)
            if (!d.outlet.customLine1.isNullOrBlank()) addLine(d.outlet.customLine1)
            if (!d.outlet.customLine2.isNullOrBlank()) addLine(d.outlet.customLine2)
            val thanks = d.outlet.thankYou?.takeIf { it.isNotBlank() } ?: "Terima kasih!"
            add(Cmd.BOLD_ON); addLine(thanks); add(Cmd.BOLD_OFF)
            add(Cmd.LF); add(Cmd.LF); add(Cmd.LF)
            add(Cmd.CUT)
        }
    }

    // ── Pre-bill ─────────────────────────────────────────────────────────────
    fun buildPreBill(json: String): ByteArray {
        val d = gson.fromJson(json, ReceiptData::class.java)
        val w = lineWidth(d.paperSize)
        return buf {
            add(Cmd.INIT)
            add(Cmd.ALIGN_C)
            add(Cmd.BOLD_ON); addLine("TAGIHAN"); add(Cmd.BOLD_OFF)
            if (!d.outlet.name.isNullOrBlank()) {
                add(Cmd.BOLD_ON); add(Cmd.DOUBLE_ON)
                addLine(d.outlet.name)
                add(Cmd.DOUBLE_OFF); add(Cmd.BOLD_OFF)
            }
            if (d.outlet.showDatetime && !d.datetime.isNullOrBlank()) addLine(d.datetime)
            if (d.outlet.showTable    && !d.table.isNullOrBlank())    addLine("Meja: ${d.table}")
            addLine(dash(w))
            add(Cmd.ALIGN_L)
            for (item in d.items) {
                if (d.paperSize == "58mm") {
                    addLine("${item.qty}x ${item.name.take(w)}")
                    addLine(padLine("", fmt(item.price * item.qty), w))
                } else {
                    addLine(truncLine("${item.qty}x ${item.name}", fmt(item.price * item.qty), w))
                }
                item.modifiers?.values?.forEach { mod -> addLine("  [$mod]") }
                if (!item.note.isNullOrBlank()) addLine("  * ${item.note}")
            }
            addLine(dash(w))
            if (d.discount > 0) {
                addLine(padLine("Subtotal", fmt(d.subtotal + d.discount), w))
                addLine(padLine("Diskon", "-${fmt(d.discount)}", w))
            }
            add(Cmd.BOLD_ON); addLine(padLine("TOTAL", fmt(d.total), w)); add(Cmd.BOLD_OFF)
            addLine(dash(w))
            add(Cmd.ALIGN_C)
            val note = d.preBillNote?.takeIf { it.isNotBlank() } ?: "Ini bukan struk pembayaran"
            addLine(note)
            val note2 = d.preBillNote2?.takeIf { it.isNotBlank() }
            if (note2 != null) addLine(note2)
            if (!d.outlet.wifi.isNullOrBlank())        addLine("WiFi: ${d.outlet.wifi}")
            if (!d.outlet.promo.isNullOrBlank())       addLine(d.outlet.promo)
            if (!d.outlet.social.isNullOrBlank())      addLine(d.outlet.social)
            if (!d.outlet.customLine1.isNullOrBlank()) addLine(d.outlet.customLine1)
            if (!d.outlet.customLine2.isNullOrBlank()) addLine(d.outlet.customLine2)
            add(Cmd.LF); add(Cmd.LF); add(Cmd.LF)
            add(Cmd.CUT)
        }
    }

    // ── Kitchen ticket ───────────────────────────────────────────────────────
    fun buildKitchenTicket(json: String): ByteArray {
        val d = gson.fromJson(json, KitchenTicketData::class.java)
        val s = d.settings ?: KitchenSettings()
        val w = lineWidth(d.paperSize)
        return buf {
            add(Cmd.INIT)
            add(Cmd.ALIGN_C)
            // Type header
            when (d.type) {
                "new"          -> { add(Cmd.BOLD_ON); addLine("** PESANAN BARU **");  add(Cmd.BOLD_OFF) }
                "addition"     -> { add(Cmd.BOLD_ON); addLine("** TAMBAHAN **");      add(Cmd.BOLD_OFF) }
                "cancellation" -> { add(Cmd.BOLD_ON); addLine("*** BATALKAN ***");    add(Cmd.BOLD_OFF) }
                "update"       -> { add(Cmd.BOLD_ON); addLine("** UPDATE PESANAN **");add(Cmd.BOLD_OFF) }
                "reprint"      -> { add(Cmd.BOLD_ON); addLine("** CETAK ULANG **");   add(Cmd.BOLD_OFF) }
            }
            // Station header
            if (s.showOutletName && s.outletName.isNotBlank())
                addLine(s.outletName)
            add(Cmd.BOLD_ON); add(Cmd.DOUBLE_ON)
            addLine(d.stationName.uppercase())
            add(Cmd.DOUBLE_OFF); add(Cmd.BOLD_OFF)
            addLine(dash(w))
            add(Cmd.ALIGN_L)
            if (s.showTable && d.table.isNotBlank() && d.table != "-")
                addLine("Meja: ${d.table}")
            if (s.showOrderType && d.orderType.isNotBlank())
                addLine(d.orderType)
            if (s.showDatetime && d.time.isNotBlank())
                addLine(d.time)
            if (s.showOrderId && d.orderId.isNotBlank())
                addLine("Order: ${d.orderId.takeLast(8)}")
            addLine(dash(w))
            // Items
            if (d.type == "update") {
                // Split into add / cancel sections
                if (d.items.isNotEmpty()) {
                    add(Cmd.BOLD_ON); addLine("+ TAMBAH:"); add(Cmd.BOLD_OFF)
                    for (item in d.items) { add(Cmd.BOLD_ON); addLines(item); add(Cmd.BOLD_OFF) }
                }
                if (d.cancelItems.isNotEmpty()) {
                    addLine(dash(w))
                    add(Cmd.BOLD_ON); addLine("- BATALKAN:"); add(Cmd.BOLD_OFF)
                    for (item in d.cancelItems) addLines(item)
                }
            } else {
                for (item in (d.items + d.cancelItems)) {
                    add(Cmd.BOLD_ON)
                    addLines(item)
                    add(Cmd.BOLD_OFF)
                }
            }
            addLine(dash(w))
            if (s.showFooter && s.footerText.isNotBlank()) {
                add(Cmd.ALIGN_C)
                addLine(s.footerText)
                add(Cmd.ALIGN_L)
            }
            add(Cmd.LF); add(Cmd.LF); add(Cmd.LF)
            add(Cmd.CUT)
        }
    }

    // ── Shift closing report ──────────────────────────────────────────────────
    fun buildShiftReport(json: String): ByteArray {
        val d = gson.fromJson(json, ShiftReportData::class.java)
        val w = lineWidth(d.paperSize)
        val r = d.report
        val now = java.time.LocalDateTime.now()
        val timeStr = "%02d:%02d".format(now.hour, now.minute)
        val dateStr = "${now.dayOfMonth} ${monthId(now.monthValue)} ${now.year}"
        return buf {
            add(Cmd.INIT)
            add(Cmd.ALIGN_C)
            add(Cmd.BOLD_ON); addLine("LAPORAN SHIFT"); add(Cmd.BOLD_OFF)
            addLine(dash(w))
            add(Cmd.ALIGN_L)
            addLine("Kasir   : ${d.shift.staff}")
            if (d.shift.date.isNotBlank()) addLine("Tanggal : ${d.shift.date}")
            addLine("Buka    : ${d.shift.clockIn}")
            addLine("Tutup   : $timeStr")
            addLine(dash(w))
            if (r != null) {
                add(Cmd.BOLD_ON); addLine("RINGKASAN PENJUALAN"); add(Cmd.BOLD_OFF)
                addLine(padLine("Total Order", r.orderCount.toString(), w))
                r.sales.entries.sortedBy { it.key }.forEach { (pay, amt) ->
                    addLine(padLine("  $pay", fmt(amt), w))
                }
                addLine(dash(w))
                add(Cmd.BOLD_ON); addLine(padLine("Total Penjualan", fmt(r.totalSales), w)); add(Cmd.BOLD_OFF)
                addLine(dash(w))
                add(Cmd.BOLD_ON); addLine("ARUS KAS"); add(Cmd.BOLD_OFF)
                addLine(padLine("Modal Awal", fmt(d.shift.floatOpen), w))
                addLine(padLine("+ Cash Penjualan", fmt(r.cashSales), w))
                if (r.topups > 0)   addLine(padLine("+ Top-up Float", fmt(r.topups), w))
                if (r.expenses > 0) addLine(padLine("- Pengeluaran", fmt(r.expenses), w))
                if (r.returns > 0)  addLine(padLine("+ Kembalian", fmt(r.returns), w))
                addLine(dash(w))
                add(Cmd.BOLD_ON); addLine(padLine("Ekspektasi Kas", fmt(r.expectedCash), w)); add(Cmd.BOLD_OFF)
                addLine(dash(w))
            }
            add(Cmd.ALIGN_C)
            addLine("Dicetak: $dateStr $timeStr")
            add(Cmd.LF); add(Cmd.LF); add(Cmd.LF)
            add(Cmd.CUT)
        }
    }

    // ── Product sold report ───────────────────────────────────────────────────
    fun buildProductSoldReport(json: String): ByteArray {
        val d = gson.fromJson(json, ProductSoldData::class.java)
        val w = lineWidth(d.paperSize)
        val now = java.time.LocalDateTime.now()
        val timeStr = "%02d:%02d".format(now.hour, now.minute)
        return buf {
            add(Cmd.INIT)
            add(Cmd.ALIGN_C)
            add(Cmd.BOLD_ON); addLine("LAPORAN TUTUP KASIR"); addLine("PENJUALAN MENU"); add(Cmd.BOLD_OFF)
            addLine(dash(w))
            add(Cmd.ALIGN_L)
            addLine("Kasir       : ${d.shift?.staff ?: "-"}")
            addLine("Waktu Buka  : ${d.shift?.clockIn ?: "-"}")
            addLine("Waktu Tutup : $timeStr")
            addLine(dash(w))
            add(Cmd.BOLD_ON); addLine("Produk Terjual"); add(Cmd.BOLD_OFF)
            addLine(dash(w))
            val byCategory = d.productData?.values
                ?.groupBy { it.cat }
                ?.toSortedMap()
                ?: emptyMap()
            for ((cat, items) in byCategory) {
                add(Cmd.BOLD_ON); addLine(cat); add(Cmd.BOLD_OFF)
                items.sortedBy { it.name }.forEach { item ->
                    addLine(padLine(item.name.take(w - 6), item.qty.toString(), w))
                    item.mods?.entries?.sortedBy { it.key }?.forEach { (mod, qty) ->
                        addLine(padLine("  + ${mod.take(w - 8)}", qty.toString(), w))
                    }
                }
            }
            addLine(dash(w))
            add(Cmd.ALIGN_C)
            add(Cmd.LF); add(Cmd.LF); add(Cmd.LF)
            add(Cmd.CUT)
        }
    }

    // ── Test page ─────────────────────────────────────────────────────────────
    fun buildTestPage(stationOrJson: String): ByteArray {
        val station = try {
            gson.fromJson(stationOrJson, Map::class.java)["station"] as? String ?: stationOrJson
        } catch (_: Exception) { stationOrJson }
        val ps = try { gson.fromJson(stationOrJson, Map::class.java)["paperSize"] as? String ?: "80mm" } catch (_: Exception) { "80mm" }
        return buf {
            add(Cmd.INIT)
            add(Cmd.ALIGN_C)
            logoForPaper(ps)?.let { write(it); add(Cmd.LF) }
            add(Cmd.BOLD_ON); add(Cmd.DOUBLE_ON); addLine("TEST PRINT"); add(Cmd.DOUBLE_OFF); add(Cmd.BOLD_OFF)
            addLine("PawonLoka POS")
            addLine(dash(32))
            add(Cmd.ALIGN_L)
            addLine("Station : $station")
            addLine("Status  : OK")
            addLine(java.time.LocalDateTime.now().toString().take(19).replace('T', ' '))
            addLine(dash(32))
            add(Cmd.ALIGN_C)
            addLine("Printer siap digunakan")
            add(Cmd.LF); add(Cmd.LF); add(Cmd.LF)
            add(Cmd.CUT)
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private fun lineWidth(paperSize: String) = if (paperSize == "58mm") 32 else 42

    private fun fmt(amount: Long): String {
        val nf = NumberFormat.getNumberInstance(Locale("id", "ID"))
        return "Rp ${nf.format(amount)}"
    }

    private fun truncLine(left: String, right: String, width: Int): String {
        val avail = width - right.length - 1
        val l = if (left.length > avail) left.take(avail) else left
        return padLine(l, right, width)
    }

    private fun padLine(left: String, right: String, width: Int): String {
        val space = width - left.length - right.length
        return if (space > 0) left + " ".repeat(space) + right
        else "$left\n${" ".repeat(width - right.length)}$right"
    }

    private fun center(text: String, width: Int): String {
        val pad = ((width - text.length) / 2).coerceAtLeast(0)
        return " ".repeat(pad) + text
    }

    private fun dash(width: Int) = "-".repeat(width)

    private fun monthId(m: Int) = listOf("","Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des")[m]

    // DSL for building byte arrays
    private fun buf(block: ByteArrayOutputStream.() -> Unit): ByteArray {
        val out = ByteArrayOutputStream()
        out.block()
        return out.toByteArray()
    }

    private fun ByteArrayOutputStream.add(bytes: ByteArray) = write(bytes)
    private fun ByteArrayOutputStream.addLine(text: String) {
        write(text.toByteArray(Charsets.UTF_8))
        write(Cmd.LF)
    }
    private fun ByteArrayOutputStream.addLines(text: String) {
        for (line in text.split("\n")) addLine(line)
    }
}
