import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";

// Detect Capacitor native Android — injected by Capacitor bridge at runtime
const isNative = () => !!window?.Capacitor?.isNativePlatform?.();

// Lazy-load BLE plugin (only installed in APK project, not web project)
let _BleClient = null;
async function getBleClient() {
  if (_BleClient) return _BleClient;
  const mod = await import('@capacitor-community/bluetooth-le');
  _BleClient = mod.BleClient;
  try { await _BleClient.requestPermissions(); } catch {}
  await _BleClient.initialize();
  return _BleClient;
}

const BLE_SERVICES_NATIVE = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

async function nativeGetChar(deviceId) {
  const ble = await getBleClient();
  for (const svc of BLE_SERVICES_NATIVE) {
    try {
      const chars = await ble.getCharacteristics(deviceId, svc);
      const w = chars.find(c => c.properties.writeWithoutResponse || c.properties.write);
      if (w) return { deviceId, serviceUUID: svc, charUUID: w.uuid, isNative: true };
    } catch { continue; }
  }
  throw new Error('No writable characteristic found on this device.');
}

const ESC = 0x1B, GS = 0x1D;

function escpos(cmds) {
  const bytes = [];
  for (const cmd of cmds) {
    if (typeof cmd === "number") bytes.push(cmd);
    else if (typeof cmd === "string") {
      for (let i = 0; i < cmd.length; i++) bytes.push(cmd.charCodeAt(i) & 0xFF);
    } else if (Array.isArray(cmd)) bytes.push(...cmd);
  }
  return new Uint8Array(bytes);
}

const CMD = {
  INIT:      [ESC, 0x40],
  ALIGN_L:   [ESC, 0x61, 0x00],
  ALIGN_C:   [ESC, 0x61, 0x01],
  ALIGN_R:   [ESC, 0x61, 0x02],
  BOLD_ON:   [ESC, 0x45, 0x01],
  BOLD_OFF:  [ESC, 0x45, 0x00],
  DOUBLE_ON: [GS,  0x21, 0x11],
  DOUBLE_OFF:[GS,  0x21, 0x00],
  TALL_ON:   [GS,  0x21, 0x10],  // double height only — no width artifacts
  TALL_OFF:  [GS,  0x21, 0x00],
  LF:        [0x0A],
  CUT:       [GS,  0x56, 0x41, 0x03],
  BEEP:      [ESC, 0x42, 0x03, 0x02],
  DRAWER:    [ESC, 0x70, 0x00, 0x19, 0xFA],
};

const BLE_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

// Connect GATT and return the first writable characteristic found.
// ms: timeout in ms — use short value (5000) for startup probes, full (15000) for print.
async function gattGetChar(device, ms = 15000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`BLE timeout (${ms/1000}s)`)), ms)
  );
  const connect = async () => {
    const server = await device.gatt.connect();
    for (const uuid of BLE_SERVICES) {
      try {
        const svc   = await server.getPrimaryService(uuid);
        const chars = await svc.getCharacteristics();
        const char  = chars.find(c => c.properties.writeWithoutResponse || c.properties.write);
        if (char) return char;
      } catch { continue; }
    }
    throw new Error("No writable characteristic found on this device.");
  };
  return Promise.race([connect(), timeout]);
}

const logoCache = new Map(); // url+paperSize → Uint8Array, persists for the session

// Fetch a logo URL and return ESC/POS GS v 0 raster bitmap bytes, centered on paper.
async function logoToEscpos(url, paperSize = "80mm") {
  const cacheKey = url + "|" + paperSize;
  if (logoCache.has(cacheKey)) return logoCache.get(cacheKey);
  const maxW         = paperSize === "58mm" ? 384 : 576;
  const bytesPerLine = maxW / 8;
  try {
    const blob   = await fetch(url).then(r => r.blob());
    const objUrl = URL.createObjectURL(blob);
    return await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const scale  = Math.min(1, maxW / img.width, 96 / img.height);
        const w      = Math.round(img.width  * scale);
        const h      = Math.round(img.height * scale);
        const wBytes = Math.ceil(w / 8);
        const canvas = document.createElement("canvas");
        canvas.width  = wBytes * 8;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, h);
        ctx.drawImage(img, Math.floor((canvas.width - w) / 2), 0, w, h);
        const px      = ctx.getImageData(0, 0, canvas.width, h).data;
        const padLeft = Math.max(0, Math.floor((bytesPerLine - wBytes) / 2));
        const bmp     = new Uint8Array(bytesPerLine * h);
        for (let y = 0; y < h; y++) {
          for (let bx = 0; bx < wBytes && (padLeft + bx) < bytesPerLine; bx++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
              const x = bx * 8 + bit;
              const i = (y * canvas.width + x) * 4;
              if (px[i+3] > 128 && (px[i]*0.299 + px[i+1]*0.587 + px[i+2]*0.114) < 128)
                byte |= (0x80 >> bit);
            }
            bmp[y * bytesPerLine + padLeft + bx] = byte;
          }
        }
        const xL = bytesPerLine & 0xFF, xH = (bytesPerLine >> 8) & 0xFF;
        const yL = h & 0xFF,           yH = (h >> 8) & 0xFF;
        const out = new Uint8Array(8 + bmp.length);
        out[0]=0x1D; out[1]=0x76; out[2]=0x30; out[3]=0x00;
        out[4]=xL;   out[5]=xH;   out[6]=yL;   out[7]=yH;
        out.set(bmp, 8);
        logoCache.set(cacheKey, out);
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(new Uint8Array(0)); };
      img.src = objUrl;
    });
  } catch { return new Uint8Array(0); }
}

function line(left, right, width = 42) {
  const r = String(right ?? "");
  const l = String(left ?? "").slice(0, width - r.length);
  return l.padEnd(width - r.length, " ") + r;
}
function divider(char = "-", width = 42) { return char.repeat(width); }

export function prefetchLogo(url, paperSize = "80mm") {
  if (url) logoToEscpos(url, paperSize).catch(() => {});
}

export function buildReceiptData({ order, outlet, tax, service, logoBytes, paperSize = "80mm" }) {
  const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
  const w   = paperSize === "58mm" ? 32 : 42;
  const EQ  = "=".repeat(w);
  const HR  = "-".repeat(w);
  const L   = (left, right) => line(left, right, w);
  const lines = [];

  // toggles — default ON if not explicitly false
  const showOrderId  = outlet?.showOrderId  !== false;
  const showTable    = outlet?.showTable    !== false;
  const showCashier  = outlet?.showCashier  !== false;
  const showDatetime = outlet?.showDatetime !== false;
  const showTax      = outlet?.showTax      !== false;
  const showService  = outlet?.showService  !== false;
  const showLoyalty  = outlet?.showLoyalty  !== false;
  const showSku      = outlet?.showSku      === true;

  // ── Header ──────────────────────────────────────────
  lines.push({ cmd: "ALIGN_C" });
  if (logoBytes?.length > 0) {
    lines.push({ raw: logoBytes });
    // no extra \n — keep gap tight
  }
  const outletName = outlet?.name || "PawonLoka";
  lines.push({ cmd: "BOLD_ON" });
  lines.push({ text: outletName + "\n" });
  lines.push({ cmd: "BOLD_OFF" });
  if (outlet?.address) lines.push({ text: outlet.address + "\n" });
  if (outlet?.phone)   lines.push({ text: outlet.phone  + "\n" });
  if (outlet?.website) lines.push({ text: outlet.website + "\n" });
  if (outlet?.tagline) lines.push({ text: outlet.tagline + "\n" });
  lines.push({ text: EQ + "\n" });

  // ── Order info ──────────────────────────────────────
  const orderId  = (order.code || order.id || "-").slice(-Math.max(w - 9, 12));
  const waktu    = order.created_at
    ? new Date(order.created_at).toLocaleString("id-ID", { dateStyle:"short", timeStyle:"short" })
    : "-";
  lines.push({ cmd: "ALIGN_L" });
  if (showOrderId)  lines.push({ text: "Order : " + orderId + "\n" });
  if (showTable)    lines.push({ text: "Meja  : " + (order.table  || "Walk-in") + "\n" });
  if (showCashier)  lines.push({ text: "Kasir : " + (order.cashier || "-") + "\n" });
  if (showDatetime) lines.push({ text: "Waktu : " + waktu + "\n" });
  lines.push({ text: HR + "\n" });

  // ── Items ───────────────────────────────────────────
  for (const item of (order.items || [])) {
    lines.push({ cmd: "BOLD_ON" });
    lines.push({ text: item.name + "\n" });
    lines.push({ cmd: "BOLD_OFF" });
    if (showSku && item.sku) lines.push({ text: "  SKU: " + item.sku + "\n" });
    if (item.modifiers && Object.values(item.modifiers).length)
      lines.push({ text: "  [" + Object.values(item.modifiers).join(", ") + "]\n" });
    lines.push({ text: L("  " + item.qty + " x " + fmt(item.price), fmt(item.qty * item.price)) + "\n" });
    if (item.note) lines.push({ text: "  * " + item.note + "\n" });
    const itemDiscAmt = item.itemDisc || item.discount || 0;
    if (itemDiscAmt > 0) lines.push({ text: L("  " + (item.itemDiscLabel || "Diskon"), "-" + fmt(itemDiscAmt * item.qty)) + "\n" });
  }

  // ── Totals ──────────────────────────────────────────
  lines.push({ text: HR + "\n" });
  const subtotal = (order.items || []).reduce((s, i) => s + (i.qty * i.price) - (i.qty * (i.itemDisc || i.discount || 0)), 0);
  const taxAmt   = tax?.enabled     ? Math.round(subtotal * (tax.rate / 100))     : 0;
  const svcAmt   = service?.enabled ? Math.round(subtotal * (service.rate / 100)) : 0;
  const total    = subtotal + taxAmt + svcAmt - (order.discount || 0);
  lines.push({ text: L("Subtotal", fmt(subtotal)) + "\n" });
  if (taxAmt && showTax)     lines.push({ text: L((tax.label || "PPN") + " " + tax.rate + "%", fmt(taxAmt)) + "\n" });
  if (svcAmt && showService) lines.push({ text: L("Service " + service.rate + "%", fmt(svcAmt)) + "\n" });
  if (order.discount)        lines.push({ text: L(order.promo || "Diskon", "-" + fmt(order.discount)) + "\n" });
  lines.push({ text: EQ + "\n" });
  lines.push({ cmd: "BOLD_ON" });
  lines.push({ text: L("TOTAL", fmt(total)) + "\n" });
  lines.push({ cmd: "BOLD_OFF" });
  lines.push({ text: EQ + "\n" });

  // ── Split partial payment info ───────────────────────
  if (order._splitAmount) {
    lines.push({ text: L("Dibayar", fmt(order._splitAmount)) + "\n" });
    if (order._splitRemaining > 0)
      lines.push({ text: L("Sisa Tagihan", fmt(order._splitRemaining)) + "\n" });
    lines.push({ text: HR + "\n" });
  }

  // ── Points earned ────────────────────────────────────
  if (showLoyalty && order.customer_id && total > 0) {
    const pts = Math.floor(total / 100);
    if (pts > 0) lines.push({ text: L("Points earned", "+" + pts + " pts") + "\n" });
  }

  // ── Payment ─────────────────────────────────────────
  for (const pay of (order.payments || [])) {
    lines.push({ text: L(pay.method, fmt(pay.amount)) + "\n" });
  }
  if (order.change > 0) lines.push({ text: L("Kembali", fmt(order.change)) + "\n" });
  if ((order.payments || []).length > 0 || order.change > 0)
    lines.push({ text: HR + "\n" });

  // ── Footer ──────────────────────────────────────────
  lines.push({ cmd: "ALIGN_C" });
  lines.push({ text: (outlet?.thankYou || "Terima kasih!") + "\n" });
  if (outlet?.wifi)          lines.push({ text: "WiFi: " + outlet.wifi + "\n" });
  if (outlet?.promo)         lines.push({ text: outlet.promo + "\n" });
  if (outlet?.social)        lines.push({ text: outlet.social + "\n" });
  if (outlet?.custom_line_1) lines.push({ text: outlet.custom_line_1 + "\n" });
  if (outlet?.custom_line_2) lines.push({ text: outlet.custom_line_2 + "\n" });
  lines.push({ text: "\n\n" });
  lines.push({ cmd: "CUT" });
  return lines;
}

// Pre-payment bill — shows items + total WITHOUT payment info.
// Prints on the receipt printer so the customer can see what they owe.
export function buildPreBillData({ order, outlet, tax, service, paperSize = "80mm", preBillNote }) {
  const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID");
  const w   = paperSize === "58mm" ? 32 : 42;
  const EQ  = "=".repeat(w);
  const HR  = "-".repeat(w);
  const L   = (left, right) => line(left, right, w);
  const lines = [];

  lines.push({ cmd: "ALIGN_C" });
  const outletName = outlet?.name || "PawonLoka";
  lines.push({ cmd: "BOLD_ON" });
  lines.push({ text: outletName + "\n" });
  lines.push({ cmd: "BOLD_OFF" });
  if (outlet?.address) lines.push({ text: outlet.address + "\n" });
  if (outlet?.phone)   lines.push({ text: outlet.phone   + "\n" });
  lines.push({ text: EQ + "\n" });

  lines.push({ cmd: "BOLD_ON" }, { cmd: "TALL_ON" });
  lines.push({ text: "TAGIHAN\n" });
  lines.push({ cmd: "TALL_OFF" }, { cmd: "BOLD_OFF" });
  lines.push({ text: EQ + "\n" });

  const waktu = order.created_at
    ? new Date(order.created_at).toLocaleString("id-ID", { dateStyle:"short", timeStyle:"short" })
    : new Date().toLocaleString("id-ID", { dateStyle:"short", timeStyle:"short" });
  lines.push({ cmd: "ALIGN_L" });
  if (order.table) lines.push({ text: "Meja  : " + order.table + "\n" });
  lines.push({ text: "Kasir : " + (order.cashier || order.staff || "-") + "\n" });
  lines.push({ text: "Waktu : " + waktu + "\n" });
  lines.push({ text: HR + "\n" });

  for (const item of (order.items || [])) {
    lines.push({ cmd: "BOLD_ON" });
    lines.push({ text: item.name + "\n" });
    lines.push({ cmd: "BOLD_OFF" });
    if (item.modifiers && Object.values(item.modifiers).filter(Boolean).length)
      lines.push({ text: "  [" + Object.values(item.modifiers).filter(Boolean).join(", ") + "]\n" });
    lines.push({ text: L("  " + item.qty + " x " + fmt(item.price), fmt(item.qty * item.price)) + "\n" });
    if (item.note) lines.push({ text: "  * " + item.note + "\n" });
  }

  lines.push({ text: HR + "\n" });
  const subtotal = (order.items || []).reduce((s, i) => s + (i.qty * i.price) - (i.qty * (i.itemDisc || i.discount || 0)), 0);
  const taxAmt   = tax?.enabled     ? Math.round(subtotal * (tax.rate / 100))     : 0;
  const svcAmt   = service?.enabled ? Math.round(subtotal * (service.rate / 100)) : 0;
  const total    = subtotal + taxAmt + svcAmt - (order.discount || 0);
  if (taxAmt || order.discount || svcAmt) lines.push({ text: L("Subtotal", fmt(subtotal)) + "\n" });
  if (taxAmt)        lines.push({ text: L((tax?.label || "PPN") + " " + (tax?.rate || "") + "%", fmt(taxAmt)) + "\n" });
  if (svcAmt)        lines.push({ text: L("Service " + (service?.rate || "") + "%", fmt(svcAmt)) + "\n" });
  if (order.discount) lines.push({ text: L(order.promo || "Diskon", "-" + fmt(order.discount)) + "\n" });
  lines.push({ text: EQ + "\n" });
  lines.push({ cmd: "BOLD_ON" });
  lines.push({ text: L("TOTAL", fmt(total)) + "\n" });
  lines.push({ cmd: "BOLD_OFF" });
  lines.push({ text: EQ + "\n" });

  // Custom pre-bill message — prominent, centered, bold
  const note = preBillNote || "Ini bukan struk pembayaran";
  lines.push({ cmd: "ALIGN_C" }, { cmd: "BOLD_ON" });
  lines.push({ text: note + "\n" });
  lines.push({ cmd: "BOLD_OFF" });
  lines.push({ text: "\n\n" });
  lines.push({ cmd: "CUT" });
  return lines;
}

export function buildKitchenData({ ticket, paperSize }) {
  const cfg = ticket.settings || {};
  const w   = paperSize === "80mm" ? 42 : 32;
  const EQ  = "=".repeat(w);
  const HR  = "-".repeat(w);
  const lines = [];

  // ── Outlet name ───────────────────────────────────────
  if (cfg.show_outlet_name !== false && cfg.outlet_name) {
    lines.push({ cmd: "ALIGN_C" }, { cmd: "BOLD_ON" });
    lines.push({ text: cfg.outlet_name + "\n" });
    lines.push({ cmd: "BOLD_OFF" });
  }

  // ── Station header ────────────────────────────────────
  lines.push({ text: EQ + "\n" });
  lines.push({ cmd: "ALIGN_C" }, { cmd: "BOLD_ON" }, { cmd: "TALL_ON" });
  lines.push({ text: (ticket.stationName || "KITCHEN") + "\n" });
  lines.push({ cmd: "TALL_OFF" }, { cmd: "BOLD_OFF" });
  lines.push({ text: EQ + "\n" });

  // ── Order info ────────────────────────────────────────
  lines.push({ cmd: "ALIGN_L" });
  if (cfg.show_order_id !== false && ticket.orderId && ticket.orderId !== "NEW") {
    lines.push({ cmd: "BOLD_ON" });
    lines.push({ text: String(ticket.orderId).slice(-16) + "\n" });
    lines.push({ cmd: "BOLD_OFF" });
  }
  const metaParts = [
    cfg.show_order_type !== false && ticket.orderType,
    cfg.show_table !== false && ticket.table && ticket.table !== ticket.orderType && ticket.table,
  ].filter(Boolean);
  if (metaParts.length) lines.push({ text: metaParts.join(" · ") + "\n" });
  if (cfg.show_datetime !== false) {
    const ts = ticket.time || new Date().toLocaleString("id-ID", { dateStyle:"short", timeStyle:"short" });
    lines.push({ text: ts + "\n" });
  }
  lines.push({ text: HR + "\n" });
  const ticketType = ticket.type || (ticket.isAdditional ? "addition" : "new");
  const TICKET_HEADERS = { addition: "** TAMBAHAN **", cancellation: "*** BATALKAN ***", update: "*** ORDER UPDATE ***" };
  if (TICKET_HEADERS[ticketType]) {
    lines.push({ cmd: "ALIGN_C" }, { cmd: "BOLD_ON" });
    lines.push({ text: TICKET_HEADERS[ticketType] + "\n" });
    lines.push({ cmd: "BOLD_OFF" });
  }
  lines.push({ cmd: "ALIGN_L" });
  const renderKLines = (arr) => {
    for (const item of arr || []) {
      const parts = (typeof item === "string" ? item : "").split("\n");
      lines.push({ cmd: "BOLD_ON" });
      lines.push({ text: parts[0] + "\n" });
      lines.push({ cmd: "BOLD_OFF" });
      for (let k = 1; k < parts.length; k++) lines.push({ text: parts[k] + "\n" });
    }
  };
  if (ticketType === "update") {
    if (ticket.items?.length) {
      lines.push({ cmd: "BOLD_ON" });
      lines.push({ text: "TAMBAH:\n" });
      lines.push({ cmd: "BOLD_OFF" });
      renderKLines(ticket.items);
    }
    if (ticket.cancelItems?.length) {
      lines.push({ text: HR + "\n" });
      lines.push({ cmd: "BOLD_ON" });
      lines.push({ text: "BATALKAN:\n" });
      lines.push({ cmd: "BOLD_OFF" });
      renderKLines(ticket.cancelItems);
    }
  } else {
    renderKLines(ticketType === "cancellation" ? (ticket.cancelItems || ticket.items) : ticket.items);
  }
  lines.push({ text: EQ + "\n" });
  // ── Footer ────────────────────────────────────────────
  if (cfg.show_footer !== false && cfg.footer_text) {
    lines.push({ cmd: "ALIGN_C" });
    lines.push({ text: cfg.footer_text + "\n" });
    lines.push({ cmd: "ALIGN_L" });
  }
  lines.push({ text: "\n\n" }, { cmd: "CUT" });
  return lines;
}

export function buildShiftReport({ shift, report, paperSize = "80mm" }) {
  const fmt = n => "Rp " + Number(n || 0).toLocaleString("id-ID")
  const w   = paperSize === "58mm" ? 32 : 42
  const EQ  = "=".repeat(w)
  const HR  = "-".repeat(w)
  const L   = (left, right) => {
    const gap = w - left.length - right.length
    return left + " ".repeat(Math.max(1, gap)) + right
  }
  const lines = []
  const now = new Date()
  const dateStr = now.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" })
  const timeStr = now.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })

  lines.push({ cmd: "ALIGN_C" })
  lines.push({ cmd: "BOLD_ON" })
  lines.push({ text: "LAPORAN SHIFT\n" })
  lines.push({ cmd: "BOLD_OFF" })
  lines.push({ text: EQ + "\n" })
  lines.push({ cmd: "ALIGN_L" })
  lines.push({ text: "Kasir   : " + (shift.staff || "-") + "\n" })
  lines.push({ text: "Tanggal : " + (shift.date || dateStr) + "\n" })
  lines.push({ text: "Buka    : " + (shift.clock_in || "-") + "\n" })
  lines.push({ text: "Tutup   : " + timeStr + "\n" })
  lines.push({ text: EQ + "\n" })

  if (report) {
    lines.push({ cmd: "BOLD_ON" })
    lines.push({ text: "RINGKASAN PENJUALAN\n" })
    lines.push({ cmd: "BOLD_OFF" })
    lines.push({ text: L("Total Order", String(report.orderCount || 0)) + "\n" })
    Object.entries(report.sales || {}).forEach(([pay, amt]) => {
      lines.push({ text: L("  " + pay, fmt(amt)) + "\n" })
    })
    lines.push({ text: HR + "\n" })
    lines.push({ cmd: "BOLD_ON" })
    lines.push({ text: L("Total Penjualan", fmt(report.totalSales || 0)) + "\n" })
    lines.push({ cmd: "BOLD_OFF" })
    lines.push({ text: EQ + "\n" })

    lines.push({ cmd: "BOLD_ON" })
    lines.push({ text: "ARUS KAS\n" })
    lines.push({ cmd: "BOLD_OFF" })
    lines.push({ text: L("Modal Awal", fmt(shift.float_open || 0)) + "\n" })
    lines.push({ text: L("+ Cash Penjualan", fmt(report.cashSales || 0)) + "\n" })
    if (report.topups > 0)    lines.push({ text: L("+ Top-up Float", fmt(report.topups)) + "\n" })
    if (report.expenses > 0)  lines.push({ text: L("- Pengeluaran", fmt(report.expenses)) + "\n" })
    if (report.returns > 0)   lines.push({ text: L("+ Kembalian Belanja", fmt(report.returns)) + "\n" })
    lines.push({ text: HR + "\n" })
    lines.push({ cmd: "BOLD_ON" })
    lines.push({ text: L("Ekspektasi Kas", fmt(report.expectedCash || 0)) + "\n" })
    lines.push({ cmd: "BOLD_OFF" })
    lines.push({ text: EQ + "\n" })
  }

  lines.push({ cmd: "ALIGN_C" })
  lines.push({ text: "Dicetak: " + dateStr + " " + timeStr + "\n" })
  lines.push({ text: "\n\n" })
  lines.push({ cmd: "CUT" })
  return lines
}

export function buildProductSoldReport({ shift, productData, paperSize = "80mm" }) {
  const w   = paperSize === "58mm" ? 32 : 42
  const EQ  = "=".repeat(w)
  const HR  = "-".repeat(w)
  const rpad = (left, right, width) => {
    const gap = width - left.length - String(right).length
    return left + " ".repeat(Math.max(1, gap)) + right
  }
  const lines = []
  const now = new Date()
  const timeStr = now.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })
  const dateStr = now.toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })

  lines.push({ cmd: "ALIGN_C" })
  lines.push({ cmd: "BOLD_ON" })
  lines.push({ text: "LAPORAN TUTUP KASIR\n" })
  lines.push({ text: "PENJUALAN MENU\n" })
  lines.push({ cmd: "BOLD_OFF" })
  lines.push({ text: EQ + "\n" })
  lines.push({ cmd: "ALIGN_L" })
  lines.push({ text: "Kasir      : " + (shift?.staff || "-") + "\n" })
  lines.push({ text: "Waktu Buka : " + (shift?.clock_in || "-") + "\n" })
  lines.push({ text: "Waktu Tutup: " + timeStr + "\n" })
  lines.push({ text: EQ + "\n" })

  lines.push({ cmd: "BOLD_ON" })
  lines.push({ text: "Produk Terjual\n" })
  lines.push({ cmd: "BOLD_OFF" })
  lines.push({ text: HR + "\n" })

  // Group by category, sort alphabetically
  const byCategory = {}
  Object.values(productData || {}).forEach(item => {
    const cat = item.cat || 'Lainnya'
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(item)
  })

  Object.keys(byCategory).sort().forEach(cat => {
    lines.push({ cmd: "BOLD_ON" })
    lines.push({ text: cat + "\n" })
    lines.push({ cmd: "BOLD_OFF" })
    byCategory[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
      lines.push({ text: rpad(item.name.slice(0, w - 6), item.qty, w) + "\n" })
      Object.entries(item.mods || {}).sort().forEach(([mod, qty]) => {
        const modLabel = "  + " + mod.slice(0, w - 8)
        lines.push({ text: rpad(modLabel, qty, w) + "\n" })
      })
    })
  })

  lines.push({ text: EQ + "\n" })
  lines.push({ cmd: "ALIGN_C" })
  lines.push({ text: "Dicetak: " + dateStr + " " + timeStr + "\n" })
  lines.push({ text: "\n\n" })
  lines.push({ cmd: "CUT" })
  return lines
}

export function renderToBytes(lines) {
  const chunks = [escpos([CMD.INIT])];
  for (const l of lines) {
    if (l.cmd && CMD[l.cmd])   chunks.push(escpos([CMD[l.cmd]]));
    else if (l.raw)            chunks.push(l.raw);
    else if (l.text)           chunks.push(escpos([l.text]));
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export function usePrinter() {
  const [printers,    setPrinters]    = useState([]);
  const [scanning,    setScanning]    = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [printError,  setPrintError]  = useState(null);  // visible in-app error
  const deviceRefs  = useRef({});
  const charRefs    = useRef({});
  const printerChains  = useRef({});
  const listenersAdded = useRef(new Set());
  const reconnectTimers = useRef({});

  // Load printers from Supabase on mount
  useEffect(() => {
    loadPrinters();
  }, []);

  async function loadPrinters() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("hardware_devices")
        .select("*")
        .eq("type", "receipt_printer")
        .order("created_at");
      const { data: kitchen } = await supabase
        .from("hardware_devices")
        .select("*")
        .eq("type", "kitchen_printer")
        .order("created_at");
      const all = [...(data||[]), ...(kitchen||[])].map(d => ({
        id:        d.id,
        name:      d.name,
        deviceId:  d.mac || d.deviceId || "",
        role:      d.role || (d.type === "receipt_printer" ? "receipt" : "kitchen1"),
        paperSize: d.paper?.includes("58") ? "58mm" : "80mm",
        connected: false,
        type:      d.type,
      }));
      setPrinters(all);
      // First attempt immediately, then retry after 4s — Android BLE stack
      // sometimes needs a moment to initialize after page load.
      autoConnectAll(all);
      setTimeout(() => autoConnectAll(all), 4000);
    } finally { setLoading(false); }
  }

  // Attach auto-reconnect listeners exactly once per printer.
  // Uses watchAdvertisements (fires the moment printer powers on) +
  // gattserverdisconnected timer as fallback.
  function attachAutoReconnect(printerId, device) {
    if (listenersAdded.current.has(printerId)) return;
    listenersAdded.current.add(printerId);

    // watchAdvertisements: passive BLE scan — fires advertisementreceived the
    // instant the printer starts broadcasting (powers on / comes in range).
    // Safe now because we no longer disconnect after printing, so charRefs stays
    // set during print jobs and the guard below prevents spurious reconnects.
    const startWatching = () => {
      if (device.watchAdvertisements) {
        device.watchAdvertisements().catch(() => {});
      }
    };

    if (device.watchAdvertisements) {
      device.addEventListener("advertisementreceived", async () => {
        if (charRefs.current[printerId]) return; // already connected — ignore
        if (!deviceRefs.current[printerId]) return; // printer removed
        try {
          const char = await gattGetChar(device);
          charRefs.current[printerId] = char;
          setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: true } : p));
        } catch {}
      });
      startWatching();
    }

    // gattserverdisconnected: printer powered off or walked out of range
    let retries = 0;
    const tryReconnect = async () => {
      if (!deviceRefs.current[printerId]) return;
      try {
        const char = await gattGetChar(device);
        charRefs.current[printerId] = char;
        setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: true } : p));
        retries = 0;
      } catch {
        retries++;
        reconnectTimers.current[printerId] = setTimeout(tryReconnect, Math.min(3000 * retries, 30000));
      }
    };

    device.addEventListener("gattserverdisconnected", () => {
      delete charRefs.current[printerId];
      setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: false } : p));
      retries = 0;
      clearTimeout(reconnectTimers.current[printerId]);
      // watchAdvertisements catches it first; timer is fallback for browsers without it
      reconnectTimers.current[printerId] = setTimeout(tryReconnect, 5000);
      startWatching(); // restart scanning in case it stopped
    });
  }

  // Auto-connect all stored printers silently on startup using getDevices().
  // getDevices() returns previously-permitted devices with no user dialog (Chrome 85+).
  // When the initial connect fails (common after page refresh — BLE stack needs time),
  // starts a retry loop with backoff instead of silently giving up.
  async function autoConnectAll(loadedPrinters) {
    if (isNative()) {
      for (const printer of loadedPrinters) {
        if (!printer.deviceId) continue;
        try {
          const ble = await getBleClient();
          deviceRefs.current[printer.id] = printer.deviceId;
          await ble.connect(printer.deviceId, () => {
            delete charRefs.current[printer.id];
            setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, connected: false } : p));
            setTimeout(() => autoConnectAll([printer]), 5000);
          });
          const ch = await nativeGetChar(printer.deviceId);
          charRefs.current[printer.id] = ch;
          setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, connected: true } : p));
        } catch {}
      }
      return;
    }
    if (!navigator.bluetooth?.getDevices) return;
    let permitted;
    try { permitted = await navigator.bluetooth.getDevices(); } catch { return; }
    for (const printer of loadedPrinters) {
      if (!printer.deviceId) continue;
      // Skip if already connected or a retry loop is already running
      if (charRefs.current[printer.id]) continue;
      const device = permitted.find(d => d.id === printer.deviceId);
      if (!device) continue;
      deviceRefs.current[printer.id] = device;
      attachAutoReconnect(printer.id, device);
      // Skip if a retry is already scheduled (prevents duplicate loops on double call)
      if (reconnectTimers.current[printer.id]) continue;

      let retries = 0;
      const attempt = async () => {
        if (charRefs.current[printer.id] || !deviceRefs.current[printer.id]) return;
        try {
          // First 4 attempts: 5s timeout (fast probe — BLE stack usually ready within 1-3s)
          // Later attempts: 15s timeout (printer may be temporarily out of range)
          const ms = retries < 4 ? 5000 : 15000;
          const char = await gattGetChar(device, ms);
          charRefs.current[printer.id] = char;
          setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, connected: true } : p));
        } catch {
          retries++;
          // Back-off: 2s, 4s, 6s … capped at 20s; give up after 12 attempts (~3 min total)
          if (retries <= 12) {
            reconnectTimers.current[printer.id] = setTimeout(attempt, Math.min(2000 * retries, 20000));
          }
        }
      };
      attempt();
    }
  }

  // Populate deviceRefs from previously-permitted BLE devices (no user gesture needed).
  // Must run before any batch print so connect() skips requestDevice() entirely.
  async function warmDeviceRefs(loadedPrinters) {
    if (!navigator.bluetooth?.getDevices) return;
    try {
      const permitted = await navigator.bluetooth.getDevices();
      for (const printer of loadedPrinters) {
        if (!printer.deviceId || deviceRefs.current[printer.id]) continue;
        const device = permitted.find(d => d.id === printer.deviceId);
        if (device) {
          deviceRefs.current[printer.id] = device;
          console.log("[BLE] warm deviceRef:", printer.name || printer.id);
        } else {
          console.warn("[BLE] not in getDevices():", printer.name || printer.id, printer.deviceId);
        }
      }
    } catch (e) {
      console.warn("[BLE] warmDeviceRefs failed:", e.message);
    }
  }

  async function savePrinterToDb(printer) {
    const payload = {
      name:  printer.name,
      type:  printer.role === "receipt" ? "receipt_printer" : "kitchen_printer",
      mac:   printer.deviceId || "",
      paper: printer.paperSize === "58mm" ? "58mm" : "80mm (standard)",
      role:  printer.role,
    };
    const { data: existing } = await supabase
      .from("hardware_devices").select("id").eq("id", printer.id).maybeSingle();
    if (existing) {
      await supabase.from("hardware_devices").update(payload).eq("id", printer.id);
    } else {
      await supabase.from("hardware_devices").insert({ id: printer.id, ...payload });
    }
  }

  const refresh = useCallback((next) => {
    setPrinters(next);
    // Save each printer to DB
    next.forEach(p => savePrinterToDb(p).catch(() => {}));
  }, []);

  const scanAndPair = useCallback(async (role = "receipt") => {
    setScanning(true);
    if (isNative()) {
      try {
        const ble = await getBleClient();
        const device = await ble.requestDevice({
          services: ['000018f0-0000-1000-8000-00805f9b34fb'],
          optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
        });
        const existing = printers.find(p => p.deviceId === device.deviceId);
        const np = { id: existing?.id || crypto.randomUUID(), name: device.name || 'Printer', deviceId: device.deviceId, role, paperSize: /58/i.test(device.name || '') ? '58mm' : '80mm', connected: false, type: role === 'receipt' ? 'receipt_printer' : 'kitchen_printer' };
        deviceRefs.current[np.id] = device.deviceId;
        await ble.connect(device.deviceId, () => { delete charRefs.current[np.id]; setPrinters(prev => prev.map(p => p.id === np.id ? { ...p, connected: false } : p)); setTimeout(() => autoConnectAll([np]), 5000); });
        const ch = await nativeGetChar(device.deviceId);
        charRefs.current[np.id] = ch;
        await savePrinterToDb(np);
        setPrinters(prev => existing ? prev.map(p => p.id === existing.id ? { ...p, name: device.name || p.name, connected: true } : p) : [...prev, { ...np, connected: true }]);
        return np;
      } finally { setScanning(false); }
    }
    if (!navigator.bluetooth) throw new Error("Web Bluetooth not supported. Use Chrome on Android or desktop.");
    setScanning(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ["000018f0-0000-1000-8000-00805f9b34fb"] },
          { namePrefix: "VSC" }, { namePrefix: "H-58" },
          { namePrefix: "Epson" }, { namePrefix: "Star" },
          { namePrefix: "MUNBYN" }, { namePrefix: "Rongta" },
          { namePrefix: "RPP" }, { namePrefix: "MTP" },
          { namePrefix: "PT" }, { namePrefix: "Sewoo" },
        ],
        optionalServices: [
          "000018f0-0000-1000-8000-00805f9b34fb",
          "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
          "49535343-fe7d-4ae5-8fa9-9fafd205e455",
        ],
      });
      const existing = printers.find(p => p.deviceId === device.id);
      const np = {
        id:        existing?.id || crypto.randomUUID(),
        name:      device.name || "Unknown Printer",
        deviceId:  device.id,
        role,
        paperSize: /58/i.test(device.name || "") ? "58mm" : "80mm",
        connected: false,
        type:      role === "receipt" ? "receipt_printer" : "kitchen_printer",
      };
      deviceRefs.current[np.id] = device;
      const next = existing
        ? printers.map(p => p.id === existing.id ? { ...p, name: device.name || p.name } : p)
        : [...printers, np];
      await savePrinterToDb(np);
      setPrinters(next);
      // Immediately connect after pairing — no second tap needed
      attachAutoReconnect(np.id, device);
      gattGetChar(device)
        .then(char => {
          charRefs.current[np.id] = char;
          setPrinters(prev => prev.map(p => p.id === np.id ? { ...p, connected: true } : p));
        })
        .catch(() => {});
      return np;
    } finally { setScanning(false); }
  }, [printers]);

  // connect() — used internally by printBytes. NEVER calls requestDevice() (no user gesture).
  const connect = useCallback(async (printerId) => {
    const printer = printers.find(p => p.id === printerId);
    if (!printer) throw new Error("Printer not found");
    if (isNative()) {
      const deviceId = deviceRefs.current[printerId] || printer.deviceId;
      if (!deviceId) throw new Error("Printer '" + (printer.name || printerId) + "' tidak ditemukan. Buka Pengaturan > Hardware lalu tap Reconnect.");
      const ble = await getBleClient();
      deviceRefs.current[printerId] = deviceId;
      await ble.connect(deviceId, () => { delete charRefs.current[printerId]; setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: false } : p)); });
      const ch = await nativeGetChar(deviceId);
      charRefs.current[printerId] = ch;
      setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: true } : p));
      return ch;
    }
    let device = deviceRefs.current[printerId];
    if (!device) {
      if (navigator.bluetooth?.getDevices) {
        try {
          const devs = await navigator.bluetooth.getDevices();
          device = devs.find(d => d.id === printer.deviceId);
        } catch {}
      }
      if (!device) {
        throw new Error("Printer '" + (printer.name||printerId) + "' tidak ditemukan. Buka Pengaturan > Hardware lalu tap Reconnect.");
      }
      deviceRefs.current[printerId] = device;
    }
    const char = await gattGetChar(device);
    charRefs.current[printerId] = char;
    attachAutoReconnect(printerId, device);
    setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: true } : p));
    return char;
  }, [printers]);

  // reconnect() — called ONLY from the Settings Connect button (user gesture required).
  // Opens a filtered BLE picker so the cashier can re-pair the printer.
  const reconnect = useCallback(async (printerId) => {
    const printer = printers.find(p => p.id === printerId);
    if (!printer) throw new Error("Printer not found");
    if (isNative()) {
      const ble = await getBleClient();
      const device = await ble.requestDevice({ services: ['000018f0-0000-1000-8000-00805f9b34fb'], optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'] });
      if (device.deviceId !== printer.deviceId) { setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, deviceId: device.deviceId } : p)); savePrinterToDb({ ...printer, deviceId: device.deviceId }).catch(() => {}); }
      deviceRefs.current[printerId] = device.deviceId;
      await ble.connect(device.deviceId, () => { delete charRefs.current[printerId]; setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: false } : p)); });
      const ch = await nativeGetChar(device.deviceId);
      charRefs.current[printerId] = ch;
      setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: true } : p));
      return ch;
    }
    if (!navigator.bluetooth) throw new Error("Web Bluetooth not supported.");
    const printerName = printer.name || "";
    const filters = printerName
      ? [{ name: printerName }, { namePrefix: printerName.slice(0, 4) }]
      : BLE_SERVICES.map(s => ({ services: [s] }));
    const device = await navigator.bluetooth.requestDevice({ filters, optionalServices: BLE_SERVICES });
    if (device.id !== printer.deviceId) {
      setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, deviceId: device.id } : p));
      savePrinterToDb({ ...printer, deviceId: device.id }).catch(() => {});
    }
    deviceRefs.current[printerId] = device;
    const char = await gattGetChar(device);
    charRefs.current[printerId] = char;
    attachAutoReconnect(printerId, device);
    setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: true } : p));
    return char;
  }, [printers]);

  const disconnect = useCallback(async (printerId) => {
    clearTimeout(reconnectTimers.current[printerId]);
    delete reconnectTimers.current[printerId];
    listenersAdded.current.delete(printerId);
    if (isNative()) {
      const deviceId = deviceRefs.current[printerId];
      if (deviceId) getBleClient().then(ble => ble.disconnect(deviceId)).catch(() => {});
    } else {
      const device = deviceRefs.current[printerId];
      if (device?.gatt?.connected) device.gatt.disconnect();
    }
    delete charRefs.current[printerId];
    delete deviceRefs.current[printerId];
    setPrinters(prev => prev.map(p => p.id === printerId ? { ...p, connected: false } : p));
  }, []);

  const removePrinter = useCallback(async (id) => {
    disconnect(id);
    await supabase.from("hardware_devices").delete().eq("id", id);
    setPrinters(prev => prev.filter(p => p.id !== id));
  }, [disconnect]);

  const updatePrinter = useCallback(async (id, changes) => {
    setPrinters(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...changes } : p);
      const updated = next.find(p => p.id === id);
      if (updated) savePrinterToDb(updated).catch(() => {});
      return next;
    });
  }, []);

  const printBytes = useCallback((printerId, bytes) => {
    if (!printerChains.current[printerId]) printerChains.current[printerId] = Promise.resolve();
    const job = printerChains.current[printerId].then(async () => {
      console.group('[PRINT]', printerId);
      console.log('charRefs set:', !!charRefs.current[printerId]);
      console.log('deviceRefs set:', !!deviceRefs.current[printerId]);
      console.log('bytes length:', bytes?.length);

      let char = charRefs.current[printerId];
      if (!char) {
        console.log('no cached char — calling connect()');
        char = await connect(printerId);
        console.log('connect() succeeded, char:', char?.uuid);
      } else {
        // Verify the cached char's GATT server is still connected
        const gattOk = char?.isNative ? true : char?.service?.device?.gatt?.connected;
        console.log('cached char GATT connected:', gattOk);
        if (!gattOk) {
          console.log('stale char — reconnecting');
          delete charRefs.current[printerId];
          char = await connect(printerId);
          console.log('reconnect succeeded');
        }
      }

      const CHUNK = 20;
      async function writeBytes(c) {
        if (c?.isNative) {
          const ble = await getBleClient();
          for (let i = 0; i < bytes.length; i += CHUNK) {
            const chunk = bytes.slice(i, i + CHUNK);
            await ble.writeWithoutResponse(c.deviceId, c.serviceUUID, c.charUUID, new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength));
          }
          return;
        }
        for (let i = 0; i < bytes.length; i += CHUNK) {
          const chunk = bytes.slice(i, i + CHUNK);
          for (let attempt = 0; ; attempt++) {
            try {
              if (c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(chunk);
              else await c.writeValue(chunk);
              break;
            } catch (err) {
              console.warn('write attempt', attempt, 'failed:', err.message);
              if (attempt >= 4) throw new Error("BLE write congestion — printer not responding");
              await new Promise(r => setTimeout(r, 10 * (attempt + 1)));
            }
          }
        }
      }
      try {
        await writeBytes(char);
        console.log('print succeeded');
        setPrintError(null);
      } catch(e) {
        console.warn('write failed, reconnecting once:', e.message);
        delete charRefs.current[printerId];
        const char2 = await connect(printerId);
        await writeBytes(char2);
        console.log('print succeeded after reconnect');
        setPrintError(null);
      }
      console.groupEnd();
    });
    printerChains.current[printerId] = job.catch(err => {
      console.error('[PRINT FAILED]', printerId, err);
      setPrintError(err.message || 'Print failed');
    });
    return job;
  }, [connect]);

  const printPreBill = useCallback(async (order, { outlet, tax, service, preBillNote } = {}) => {
    const rp = printers.find(p => p.role === "receipt");
    if (!rp) throw new Error("No receipt printer configured");
    await printBytes(rp.id, renderToBytes(buildPreBillData({ order, outlet, tax, service, paperSize: rp.paperSize, preBillNote })));
  }, [printers, printBytes]);

  const printReceipt = useCallback(async (order, { outlet, tax, service } = {}) => {
    const printer = printers.find(p => p.role === "receipt");
    if (!printer) throw new Error("No receipt printer configured");
    const logoBytes = outlet?.logo
      ? await logoToEscpos(outlet.logo, printer.paperSize).catch(() => null)
      : null;
    await printBytes(printer.id, renderToBytes(buildReceiptData({ order, outlet, tax, service, logoBytes, paperSize: printer.paperSize })));
  }, [printers, printBytes]);

  const printKitchenTicket = useCallback(async (ticket) => {
    const role = ticket.stationRole || "kitchen1";
    const printer = printers.find(p => p.role === role)
                 || printers.find(p => p.role === "kitchen1" || p.role === "kitchen2" || p.role === "bar");
    if (!printer) throw new Error("No kitchen printer configured for " + (ticket.stationName || role) + ". Check Hardware settings.");
    await printBytes(printer.id, renderToBytes(buildKitchenData({ ticket, paperSize: printer.paperSize })));
  }, [printers, printBytes]);

  const testPrint = useCallback(async (printerId) => {
    const lines = [
      { cmd: "ALIGN_C" }, { cmd: "BOLD_ON" }, { cmd: "TALL_ON" },
      { text: "PawonLoka POS\n" },
      { cmd: "TALL_OFF" }, { cmd: "BOLD_OFF" },
      { text: "Test Print\n" },
      { text: new Date().toLocaleString("id-ID") + "\n" },
      { text: "-------------------------------\n" },
      { text: "Printer OK!\n" },
      { text: "\n\n\n" }, { cmd: "CUT" },
    ];
    await printBytes(printerId, renderToBytes(lines));
  }, [printBytes]);

  return {
    printers, scanning, loading,
    printError, clearPrintError: () => setPrintError(null),
    scanAndPair, connect, reconnect, disconnect, removePrinter, updatePrinter,
    printPreBill, printReceipt, printKitchenTicket, testPrint,
    printBytes, renderLines: renderToBytes,
    reloadPrinters: loadPrinters,
  };
}
